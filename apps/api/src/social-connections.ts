import {
  ConflictException,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { z } from "zod";
import { digest } from "../../../packages/core/security";
import { encryptSocialToken } from "../../../packages/core/social-tokens";
import {
  exchangeYoutubeCode,
  newYoutubeOAuthProof,
  youtubeAuthorizationUrl,
  youtubeOAuthConfig,
  youtubeOwnChannel,
} from "../../../packages/core/youtube-oauth";
import {
  AuthedRequest,
  Cache,
  Db,
  Roles,
  TenantGuard,
  idSchema,
  origin,
  writerRoles,
} from "./common";

const stateLifetimeSeconds = 600;
const stateSchema = z.object({
  organizationId: idSchema,
  userId: idSchema,
  sessionId: idSchema,
  verifier: z.string().min(43).max(128),
  expiresAtMs: z.number().int().positive(),
});

function oauthStateKey(state: string, sessionId: string) {
  return `oauth:youtube:state:${digest(state)}:${digest(sessionId)}`;
}

// The default adapter only calls Google's fixed endpoints. Isolated API tests
// replace these methods on the Nest provider instance, never through a runtime URL.
@Injectable()
export class YoutubeOAuthProvider {
  exchange(code: string, verifier: string) {
    return exchangeYoutubeCode(youtubeOAuthConfig(), code, verifier);
  }
  channel(accessToken: string) {
    return youtubeOwnChannel(accessToken);
  }
}

const metadata = {
  id: true,
  provider: true,
  externalAccountId: true,
  accountLabel: true,
  scopes: true,
  tokenExpiresAt: true,
  refreshTokenExpiresAt: true,
  revokedAt: true,
  createdAt: true,
} as const;

@Controller("workspaces/:organizationId/social-connections")
@UseGuards(TenantGuard)
export class SocialConnectionsController {
  constructor(
    private db: Db,
    private cache: Cache,
  ) {}

  @Get() @Roles(...writerRoles) list(@Req() req: AuthedRequest) {
    return this.db.socialConnection.findMany({
      where: { organizationId: req.organizationId },
      select: metadata,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  @Post("youtube/authorize") @Roles("OWNER", "ADMIN") async authorize(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    let config;
    try {
      config = youtubeOAuthConfig();
      // Fail before showing consent when the encryption key is missing/invalid.
      encryptSocialToken("configuration-check", {
        organizationId: req.organizationId,
        provider: "YOUTUBE",
        externalAccountId: "oauth-configuration-check",
      });
    } catch {
      throw new ServiceUnavailableException(
        "YouTube connection is not configured.",
      );
    }
    const proof = newYoutubeOAuthProof();
    const saved = await this.cache.client.set(
      oauthStateKey(proof.state, req.sessionId),
      JSON.stringify({
        organizationId: req.organizationId,
        userId: req.userId,
        sessionId: req.sessionId,
        verifier: proof.verifier,
        expiresAtMs: Date.now() + stateLifetimeSeconds * 1000,
      }),
      "EX",
      stateLifetimeSeconds,
      "NX",
    );
    if (saved !== "OK")
      throw new ServiceUnavailableException(
        "Could not start YouTube connection.",
      );
    response.setHeader("Cache-Control", "no-store");
    return {
      authorizationUrl: youtubeAuthorizationUrl(config, proof),
      expiresInSeconds: stateLifetimeSeconds,
    };
  }

  @Post(":id/revoke") @Roles("OWNER", "ADMIN") async revoke(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
  ) {
    idSchema.parse(id);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${req.organizationId} FOR UPDATE`;
      const row = await tx.socialConnection.findFirst({
        where: { id, organizationId: req.organizationId },
      });
      if (!row) throw new NotFoundException("Social connection not found.");
      if (row.revokedAt)
        throw new ConflictException("Connection already revoked.");
      const now = new Date();
      await tx.socialConnection.update({
        where: { id },
        data: { revokedAt: now },
      });
      await tx.publicationAttempt.updateMany({
        where: {
          organizationId: req.organizationId,
          connectionId: id,
          status: "RESERVED",
        },
        data: {
          status: "BLOCKED",
          completedAt: now,
          outcomeCode: "AUTH_REVOKED",
          version: { increment: 1 },
        },
      });
      await tx.publicationAttempt.updateMany({
        where: {
          organizationId: req.organizationId,
          connectionId: id,
          status: "SUBMITTING",
        },
        data: {
          status: "UNKNOWN",
          completedAt: now,
          outcomeCode: "REVOKED_DURING_SUBMISSION",
          version: { increment: 1 },
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: req.organizationId,
          actorId: req.userId,
          action: "social_connection.revoked",
          entityId: id,
          detail: {
            provider: row.provider,
            externalAccountId: row.externalAccountId,
          },
        },
      });
      return { ok: true };
    });
  }
}

@Controller("social/youtube")
export class YoutubeOAuthCallbackController {
  constructor(
    private db: Db,
    private cache: Cache,
    private provider: YoutubeOAuthProvider,
  ) {}

  private redirect(response: Response, connected: boolean) {
    const destination = new URL("/", origin());
    destination.searchParams.set("youtube", connected ? "connected" : "failed");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.redirect(303, destination.toString());
  }

  @Get("callback") async callback(
    @Req() req: AuthedRequest,
    @Query("state") state: unknown,
    @Query("code") code: unknown,
    @Query("error") providerError: unknown,
    @Res() response: Response,
  ) {
    try {
      if (typeof state !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(state))
        throw new Error("Invalid OAuth state.");
      const raw = await this.cache.client.getdel(
        oauthStateKey(state, req.sessionId),
      );
      if (!raw) throw new Error("OAuth state expired or was used.");
      const pending = stateSchema.parse(JSON.parse(raw));
      if (
        pending.sessionId !== req.sessionId ||
        pending.userId !== req.userId ||
        pending.expiresAtMs <= Date.now()
      )
        throw new Error("OAuth session changed.");
      if (
        providerError !== undefined ||
        typeof code !== "string" ||
        !code ||
        code.length > 4096
      )
        throw new Error("OAuth authorization was not granted.");
      const membership = await this.db.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: req.userId,
            organizationId: pending.organizationId,
          },
        },
      });
      if (!membership || !["OWNER", "ADMIN"].includes(membership.role))
        throw new Error("Workspace authorization changed.");

      const granted = await this.provider.exchange(code, pending.verifier);
      const channel = await this.provider.channel(granted.access_token);
      const context = {
        organizationId: pending.organizationId,
        provider: "YOUTUBE" as const,
        externalAccountId: channel.id,
      };
      const now = Date.now();
      const data = {
        accountLabel: channel.label,
        scopes: granted.scope!.trim().split(/\s+/),
        accessTokenCiphertext: encryptSocialToken(
          granted.access_token,
          context,
        ),
        refreshTokenCiphertext: encryptSocialToken(
          granted.refresh_token!,
          context,
        ),
        tokenExpiresAt: new Date(
          now + Math.max(1, granted.expires_in - 60) * 1000,
        ),
        refreshTokenExpiresAt: granted.refresh_token_expires_in
          ? new Date(now + granted.refresh_token_expires_in * 1000)
          : null,
        revokedAt: null,
      };
      await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${pending.organizationId} FOR UPDATE`;
        const session = await tx.session.findUnique({
          where: { id: req.sessionId },
        });
        const member = await tx.membership.findUnique({
          where: {
            userId_organizationId: {
              userId: req.userId,
              organizationId: pending.organizationId,
            },
          },
        });
        if (
          !session ||
          session.userId !== req.userId ||
          session.expiresAt <= new Date() ||
          !member ||
          !["OWNER", "ADMIN"].includes(member.role)
        )
          throw new Error("OAuth authorization changed.");
        const connection = await tx.socialConnection.upsert({
          where: { organizationId_provider_externalAccountId: context },
          create: { ...context, ...data },
          update: data,
        });
        await tx.auditLog.create({
          data: {
            organizationId: pending.organizationId,
            actorId: req.userId,
            action: "social_connection.connected",
            entityId: connection.id,
            detail: { provider: "YOUTUBE", externalAccountId: channel.id },
          },
        });
      });
      this.redirect(response, true);
    } catch {
      // Keep the provider code, state and token response out of redirects/logs.
      this.redirect(response, false);
    }
  }
}

@Module({
  controllers: [SocialConnectionsController, YoutubeOAuthCallbackController],
  providers: [YoutubeOAuthProvider],
})
export class SocialConnectionsModule {}
