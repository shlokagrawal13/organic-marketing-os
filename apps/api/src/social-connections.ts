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
import { decryptSocialToken, encryptSocialToken } from "../../../packages/core/social-tokens";
import {
  exchangeYoutubeCode,
  newYoutubeOAuthProof,
  refreshYoutubeToken,
  revokeYoutubeGrant,
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
  refresh(refreshToken: string) {
    return refreshYoutubeToken(youtubeOAuthConfig(), refreshToken);
  }
  revoke(refreshToken: string) {
    return revokeYoutubeGrant(refreshToken);
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
    private provider: YoutubeOAuthProvider,
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
    const pendingRevocation = await this.db.socialConnection.findFirst({
      where: {
        organizationId: req.organizationId,
        provider: "YOUTUBE",
        revokedAt: { not: null },
        refreshTokenCiphertext: { not: null },
      },
      select: { id: true },
    });
    if (pendingRevocation)
      throw new ConflictException("Complete provider revocation before reconnecting.");
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
    await this.revokeLocally(req, id, false);
    return { ok: true, providerRevocation: "NOT_CONFIRMED" };
  }

  private async revokeLocally(req: AuthedRequest, id: string, allowAlready: boolean) {
    idSchema.parse(id);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${req.organizationId} FOR UPDATE`;
      const row = await tx.socialConnection.findFirst({
        where: { id, organizationId: req.organizationId },
      });
      if (!row) throw new NotFoundException("Social connection not found.");
      if (row.revokedAt && !allowAlready)
        throw new ConflictException("Connection already revoked.");
      if (row.revokedAt) return row;
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
      return row;
    });
  }

  @Post(":id/revoke-provider") @Roles("OWNER", "ADMIN") async revokeProvider(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
  ) {
    const original = await this.revokeLocally(req, id, true);
    const row = await this.db.socialConnection.findFirst({
      where: { id, organizationId: req.organizationId },
    });
    if (!row || !row.revokedAt)
      throw new ServiceUnavailableException("Provider revocation was not confirmed.");
    if (!row.refreshTokenCiphertext)
      return { ok: true, providerRevocation: "CONFIRMED" };
    const context = {
      organizationId: req.organizationId,
      provider: "YOUTUBE" as const,
      externalAccountId: row.externalAccountId,
    };
    try {
      const token = decryptSocialToken(row.refreshTokenCiphertext, context);
      await this.provider.revoke(token);
    } catch {
      throw new ServiceUnavailableException("Provider revocation was not confirmed.");
    }
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${req.organizationId} FOR UPDATE`;
      const current = await tx.socialConnection.findFirst({
        where: { id, organizationId: req.organizationId },
      });
      if (!current?.revokedAt || current.refreshTokenCiphertext !== row.refreshTokenCiphertext)
        throw new ConflictException("Connection changed during revocation.");
      await tx.socialConnection.update({
        where: { id },
        data: { refreshTokenCiphertext: null, tokenExpiresAt: null },
      });
      await tx.auditLog.create({
        data: {
          organizationId: req.organizationId,
          actorId: req.userId,
          action: "social_connection.provider_revocation_confirmed",
          entityId: id,
          detail: { provider: original.provider, externalAccountId: original.externalAccountId },
        },
      });
    });
    return { ok: true, providerRevocation: "CONFIRMED" };
  }

  @Post(":id/refresh") @Roles("OWNER", "ADMIN") async refresh(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
  ) {
    idSchema.parse(id);
    let providerReturned = false;
    let priorRefreshCiphertext: string | null = null;
    try {
      return await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${req.organizationId} FOR UPDATE`;
        const row = await tx.socialConnection.findFirst({
          where: { id, organizationId: req.organizationId },
        });
        if (!row) throw new NotFoundException("Social connection not found.");
        if (row.revokedAt || !row.refreshTokenCiphertext ||
            (row.refreshTokenExpiresAt && row.refreshTokenExpiresAt <= new Date()))
          throw new ConflictException("Connection requires reconnect or revocation.");
        priorRefreshCiphertext = row.refreshTokenCiphertext;
        const context = {
          organizationId: req.organizationId,
          provider: "YOUTUBE" as const,
          externalAccountId: row.externalAccountId,
        };
        const refreshToken = decryptSocialToken(row.refreshTokenCiphertext, context);
        const granted = await this.provider.refresh(refreshToken);
        providerReturned = true;
        const session = await tx.session.findUnique({ where: { id: req.sessionId } });
        const member = await tx.membership.findUnique({
          where: { userId_organizationId: { userId: req.userId, organizationId: req.organizationId } },
        });
        if (!session || session.userId !== req.userId || session.expiresAt <= new Date() ||
            !member || !["OWNER", "ADMIN"].includes(member.role))
          throw new Error("Workspace authorization changed.");
        const now = Date.now();
        const updated = await tx.socialConnection.update({
          where: { id },
          data: {
            accessTokenCiphertext: encryptSocialToken(granted.access_token, context),
            refreshTokenCiphertext: granted.refresh_token
              ? encryptSocialToken(granted.refresh_token, context)
              : row.refreshTokenCiphertext,
            tokenExpiresAt: new Date(now + Math.max(1, granted.expires_in - 60) * 1000),
            refreshTokenExpiresAt: granted.refresh_token_expires_in
              ? new Date(now + granted.refresh_token_expires_in * 1000)
              : row.refreshTokenExpiresAt,
            scopes: granted.scope ? granted.scope.trim().split(/\s+/) : row.scopes,
          },
        });
        await tx.auditLog.create({
          data: { organizationId: req.organizationId, actorId: req.userId,
            action: "social_connection.refreshed", entityId: id,
            detail: { provider: row.provider, externalAccountId: row.externalAccountId } },
        });
        return {
          id: updated.id, provider: updated.provider,
          externalAccountId: updated.externalAccountId,
          tokenExpiresAt: updated.tokenExpiresAt,
          refreshTokenExpiresAt: updated.refreshTokenExpiresAt,
        };
      }, { timeout: 20000, maxWait: 5000 });
    } catch (error) {
      if (providerReturned && priorRefreshCiphertext) {
        // A rotated grant may have invalidated the old token. Fail closed for dispatch.
        await this.db.socialConnection.updateMany({
          where: { id, organizationId: req.organizationId, revokedAt: null,
            refreshTokenCiphertext: priorRefreshCiphertext },
          data: { tokenExpiresAt: null },
        }).catch(() => undefined);
      }
      if (error instanceof NotFoundException || error instanceof ConflictException) throw error;
      throw new ServiceUnavailableException("YouTube token refresh was not completed.");
    }
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
        const prior = await tx.socialConnection.findUnique({
          where: { organizationId_provider_externalAccountId: context },
        });
        if (prior?.revokedAt && prior.refreshTokenCiphertext)
          throw new Error("Provider revocation must complete before reconnecting.");
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
