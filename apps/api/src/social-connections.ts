import {
  ConflictException,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  AuthedRequest,
  Db,
  Roles,
  TenantGuard,
  idSchema,
  writerRoles,
} from "./common";

const metadata = {
  id: true,
  provider: true,
  externalAccountId: true,
  accountLabel: true,
  scopes: true,
  tokenExpiresAt: true,
  revokedAt: true,
  createdAt: true,
} as const;

@Controller("workspaces/:organizationId/social-connections")
@UseGuards(TenantGuard)
export class SocialConnectionsController {
  constructor(private db: Db) {}

  @Get() @Roles(...writerRoles) list(@Req() req: AuthedRequest) {
    return this.db.socialConnection.findMany({
      where: { organizationId: req.organizationId },
      select: metadata,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
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

@Module({ controllers: [SocialConnectionsController] })
export class SocialConnectionsModule {}
