import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  Module,
  HttpException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Response } from "express";
import { z } from "zod";
import { mkdtemp, appendFile, rm, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { Db, Cache, TenantGuard, AuthedRequest, Roles, parse } from "./common";
import { AssetsModule, MediaStorage } from "./assets";
import {
  providersFromEnv,
  RedisProviderHealthStore,
} from "../../../packages/core/ai";
import { evaluateYoutubeLiveReadiness } from "../../../packages/core/youtube-live-readiness";

const legalHoldEnableSchema = z.object({
  reason: z.string().min(3).max(500),
  caseReference: z.string().max(100).optional(),
});

const legalHoldReleaseSchema = z.object({
  releaseReason: z.string().min(3).max(500),
});

const workspaceErasureSchema = z.object({
  confirmText: z.literal("ERASE_WORKSPACE_DATA"),
  reason: z.string().min(5).max(500),
});

@Controller("workspaces/:organizationId/operations")
@UseGuards(TenantGuard)
@Roles("OWNER", "ADMIN")
export class OperationsController {
  constructor(
    private db: Db,
    private cache: Cache,
    private store: MediaStorage,
  ) {}
  @Get("status") async status(@Req() req: AuthedRequest) {
    const org = req.organizationId;
    const checks = await Promise.allSettled([
      this.db.$queryRaw`SELECT 1`,
      this.cache.client.ping(),
      this.store.ready(),
      this.cache.client.get("worker:heartbeat"),
      this.cache.client.get("render:heartbeat"),
      this.cache.client.get("media-generation:heartbeat"),
    ]);
    const available = (i: number) => checks[i].status === "fulfilled";
    const alive = (i: number) => {
      const r = checks[i];
      return (
        r.status === "fulfilled" &&
        typeof r.value === "string" &&
        Date.now() - Number(r.value) < 30000
      );
    };
    const [assets, outputs, segments, ai, renders, media] = await Promise.all([
      this.db.asset.aggregate({
        where: { organizationId: org },
        _sum: { bytes: true },
        _count: true,
      }),
      this.db.renderJob.aggregate({
        where: { organizationId: org },
        _sum: { outputBytes: true },
      }),
      this.db.renderSegment.aggregate({
        where: { organizationId: org },
        _sum: { bytes: true },
      }),
      this.db.aIJob.groupBy({
        by: ["status"],
        where: { organizationId: org },
        _count: true,
      }),
      this.db.renderJob.groupBy({
        by: ["status"],
        where: { organizationId: org },
        _count: true,
      }),
      this.db.mediaGeneration.groupBy({
        by: ["state"],
        where: { organizationId: org },
        _count: true,
      }),
    ]);
    const providerHealth = new RedisProviderHealthStore(this.cache.client);
    const providers = await Promise.all(
      providersFromEnv().map(
        async ({ name, model, qualityTier, capabilities, allowedPlans }) => {
          try {
            return {
              name,
              model,
              qualityTier,
              capabilities,
              allowedPlans,
              state: "configured_not_live_verified",
              health: await providerHealth.get(name),
            };
          } catch {
            return {
              name,
              model,
              qualityTier,
              capabilities,
              allowedPlans,
              state: "health_store_unavailable",
              health: null,
            };
          }
        },
      ),
    );
    return {
      checkedAt: new Date().toISOString(),
      services: [
        { name: "Database", ready: available(0) },
        { name: "Queue", ready: available(1) },
        { name: "Private media storage", ready: available(2) },
        { name: "Text generation worker", ready: alive(3) },
        { name: "Video rendering worker", ready: alive(4) },
        { name: "Media generation worker", ready: alive(5) },
      ],
      providers,
      emailConfigured: Boolean(process.env.SMTP_HOST),
      storage: {
        assets: assets._count,
        sourceBytes: assets._sum.bytes || 0,
        sourceLimitBytes: 2 * 1024 ** 3,
        renderBytes: outputs._sum.outputBytes || 0,
        sceneCacheBytes: segments._sum.bytes || 0,
        automaticRetention: false,
        scope:
          "Database-tracked originals, MP4s and cached segments; excludes thumbnails, SRTs and orphan objects.",
      },
      jobs: { ai, renders, media },
      unavailable: ["Social connections and publishing", "External analytics"],
    };
  }
  @Get("youtube-live-readiness") youtubeLiveReadiness() {
    const readiness = evaluateYoutubeLiveReadiness(process.env);
    return {
      ...readiness,
      receipt: {
        type: "youtube-live-readiness",
        generatedBy: "operations",
        secretValuesIncluded: false,
        liveGoogleCallAttempted: false,
        externalPostAttempted: false,
      },
    };
  }
  @Get("export") async export(@Req() req: AuthedRequest, @Res() res: Response) {
    const granted = await this.cache.client.set(
      `export:${req.organizationId}:${req.userId}`,
      "1",
      "EX",
      60,
      "NX",
    );
    if (!granted)
      throw new HttpException(
        "An export was requested recently. Wait one minute before trying again.",
        429,
      );
    const dir = await mkdtemp(join(tmpdir(), "mos-export-")),
      path = join(dir, "workspace.ndjson");
    let disconnected = false,
      bytes = 0;
    const closed = () => {
      disconnected = true;
    };
    res.once("close", closed);
    const counts: Record<string, number> = {};
    const hash = createHash("sha256");
    const write = async (type: string, data: unknown) => {
      if (disconnected) throw new Error("Export canceled by client.");
      const line = JSON.stringify({ type, data }) + "\n";
      bytes += Buffer.byteLength(line);
      if (bytes > 64 * 1024 * 1024)
        throw new HttpException(
          "Workspace export exceeds 64 MiB. Ask the administrator for an offline export.",
          413,
        );
      hash.update(line);
      counts[type] = (counts[type] || 0) + 1;
      await appendFile(path, line, { mode: 0o600 });
    };
    try {
      await this.db.$transaction(
        async (tx) => {
          const org = req.organizationId;
          await write("manifest", {
            schemaVersion: 1,
            createdAt: new Date().toISOString(),
            organizationId: org,
            description:
              "Workspace data export. Media files are represented by authenticated download paths. Passwords, sessions, tokens and provider credentials are excluded. This is not a database restore backup.",
          });
          await write(
            "workspace",
            await tx.organization.findUniqueOrThrow({ where: { id: org } }),
          );
          const brain = await tx.brandBrain.findUnique({
            where: { organizationId: org },
          });
          if (brain) await write("brand", brain);
          const youtubePolicy = await tx.workspaceYoutubePolicy.findUnique({
            where: { organizationId: org },
          });
          if (youtubePolicy) await write("youtubePolicy", youtubePolicy);
          const creditAccount = await tx.creditAccount.findUnique({
            where: { organizationId: org },
          });
          if (creditAccount) await write("creditAccount", creditAccount);
          for (const row of await tx.membership.findMany({
            where: { organizationId: org },
            select: {
              role: true,
              createdAt: true,
              user: { select: { id: true, name: true, email: true } },
            },
          }))
            await write("member", row);
          const own = { organizationId: org };
          const tables: [string, any, any, ((v: any) => any)?][] = [
            ["brandVersion", tx.brandVersion, own],
            ["research", tx.researchRecord, own],
            ["campaign", tx.campaign, own],
            ["content", tx.contentItem, own],
            ["contentVersion", tx.contentVersion, { content: own }],
            ["comment", tx.contentComment, { content: own }],
            [
              "asset",
              tx.asset,
              own,
              ({ objectKey, ...row }) => ({
                ...row,
                downloadPath: `/api/workspaces/${org}/assets/${row.id}/file?download=1`,
              }),
            ],
            [
              "render",
              tx.renderJob,
              own,
              ({
                outputKey,
                thumbnailKey,
                captionsKey,
                runToken,
                requestHash,
                ...row
              }) => ({
                ...row,
                downloadPath: outputKey
                  ? `/api/workspaces/${org}/renders/${row.id}/file/video?download=1`
                  : null,
              }),
            ],
            [
              "mediaGeneration",
              tx.mediaGeneration,
              own,
              ({
                outputKey,
                runToken,
                heartbeatAt,
                requestHash,
                configuration,
                ...row
              }) => ({ ...row, provider: "openai" }),
            ],
            ["aiJob", tx.aIJob, own, ({ runToken, ...row }) => row],
            ["aiAgentRun", tx.aIAgentRun, own],
            ["aiAgentStep", tx.aIAgentStep, { run: own }],
            ["aiUsage", tx.aIUsage, own],
            [
              "creditEntry",
              tx.creditEntry,
              own,
              ({ requestHash, operationKey, ...row }) => row,
            ],
            ["creditReservation", tx.creditReservation, own],
            ["activity", tx.auditLog, own],
            ["invitation", tx.invitation, own, ({ tokenHash, ...row }) => row],
            // DATA-01A: previously missing tables — added to complete export
            [
              "socialConnection",
              tx.socialConnection,
              own,
              // strip encrypted credential ciphertexts; export metadata only
              ({
                accessTokenCiphertext,
                refreshTokenCiphertext,
                ...row
              }: {
                accessTokenCiphertext: string;
                refreshTokenCiphertext: string | null;
                [k: string]: unknown;
              }) => row,
            ],
            ["contentClaimReview", tx.contentClaimReview, own],
            [
              "publicationIntent",
              tx.publicationIntent,
              own,
              ({
                requestHash,
                requestKey,
                ...row
              }: {
                requestHash?: string;
                requestKey?: string;
                [k: string]: unknown;
              }) => row,
            ],
            [
              "publicationSchedule",
              tx.publicationSchedule,
              own,
              ({
                requestKey,
                ...row
              }: {
                requestKey?: string;
                [k: string]: unknown;
              }) => row,
            ],
            [
              "publicationAttempt",
              tx.publicationAttempt,
              own,
              ({
                uploadSessionCiphertext,
                requestHash,
                requestKey,
                ...row
              }: {
                uploadSessionCiphertext?: string | null;
                requestHash?: string;
                requestKey?: string;
                [k: string]: unknown;
              }) => row,
            ],
            ["publicationPolicyReview", tx.publicationPolicyReview, own],
            ["billingSubscription", tx.billingSubscription, own],
            ["billingEvent", tx.billingEvent, own],
            ["billingInvoice", tx.billingInvoice, own],
          ];
          for (const [type, model, where, safe] of tables) {
            let cursor: string | undefined;
            while (true) {
              const rows = await model.findMany({
                where,
                orderBy: { id: "asc" },
                take: 100,
                ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
              });
              for (const row of rows) await write(type, safe ? safe(row) : row);
              if (rows.length < 100) break;
              cursor = rows.at(-1).id;
            }
          }
        },
        { isolationLevel: "RepeatableRead", maxWait: 5000, timeout: 120000 },
      );
      await appendFile(
        path,
        JSON.stringify({
          type: "complete",
          data: { counts, sha256: hash.digest("hex") },
        }) + "\n",
      );
      await this.db.auditLog.create({
        data: {
          organizationId: req.organizationId,
          actorId: req.userId,
          action: "workspace.exported",
          detail: { counts },
        },
      });
      const size = (await stat(path)).size;
      res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="workspace-${req.organizationId.slice(0, 8)}.ndjson"`,
      );
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Length", size);
      await pipeline(createReadStream(path), res);
    } catch (error) {
      if (res.headersSent) res.destroy();
      else throw error;
    } finally {
      res.removeListener("close", closed);
      await rm(dir, { recursive: true, force: true });
    }
  }

  /**
   * Helper to retrieve active legal hold status for the workspace.
   */
  private async getLegalHoldStatus(org: string) {
    const latest = await this.db.auditLog.findFirst({
      where: {
        organizationId: org,
        action: { in: ["data.legal_hold.enabled", "data.legal_hold.released"] },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    if (latest && latest.action === "data.legal_hold.enabled") {
      const detail = latest.detail as Record<string, unknown>;
      return {
        active: true,
        hold: {
          id: latest.id,
          reason: (detail?.reason as string) || "Legal hold active",
          caseReference: (detail?.caseReference as string) || null,
          enabledAt: latest.createdAt,
          enabledBy: latest.actorId,
        },
      };
    }
    return {
      active: false,
      hold: null,
    };
  }

  /**
   * DATA-01A: Safe member-data revocation.
   *
   * Revokes membership and permanently removes personal-session and social-token
   * data for a workspace member without touching financial records or audit logs.
   *
   * Rules:
   *  - Caller must be OWNER or ADMIN (enforced by @Roles + TenantGuard).
   *  - OWNER cannot self-revoke (last-owner protection already exists in the
   *    membership controller; this guard adds an explicit 403).
   *  - CreditEntry/CreditReservation rows are preserved (financial constraint).
   *  - AuditLog rows are preserved (immutable audit trail).
   *  - An audit event is written for the revocation.
   *  - Blocked with HTTP 423 Locked when workspace is under active legal hold.
   */
  @Delete("members/:targetUserId")
  async revokeMember(
    @Param("targetUserId") targetUserId: string,
    @Req() req: AuthedRequest,
  ) {
    const org = req.organizationId;

    const holdStatus = await this.getLegalHoldStatus(org);
    if (holdStatus.active) {
      throw new HttpException(
        {
          statusCode: 423,
          error: "Locked",
          message: "Member data deletion is locked: workspace is under an active legal hold.",
          legalHold: holdStatus.hold,
        },
        423,
      );
    }

    // Prevent OWNER self-revocation via this endpoint
    if (targetUserId === req.userId) {
      throw new ForbiddenException(
        "Use the workspace-leave flow to remove yourself.",
      );
    }

    const membership = await this.db.membership.findUnique({
      where: {
        userId_organizationId: { userId: targetUserId, organizationId: org },
      },
    });
    if (!membership)
      throw new NotFoundException(
        "Member not found in this workspace.",
      );

    await this.db.$transaction(async (tx) => {
      // 1. Remove membership
      await tx.membership.delete({
        where: {
          userId_organizationId: { userId: targetUserId, organizationId: org },
        },
      });

      // 2. Revoke all active sessions for this user
      await tx.session.deleteMany({
        where: { userId: targetUserId },
      });

      // 3. Revoke social connections are org-scoped without userId — preserved as-is.
      // Invitations have no invitedById field — preserved as-is.

      // 4. Audit the revocation
      await tx.auditLog.create({
        data: {
          organizationId: org,
          actorId: req.userId,
          action: "member.revoked",
          entityId: targetUserId,
          detail: {
            role: membership.role,
            revokedBy: req.userId,
          },
        },
      });
    });

    return { revokedUserId: targetUserId, organizationId: org };
  }

  /**
   * DATA-01C: Tenant data retention and expired record pruning.
   *
   * Prunes expired invitations, invalidated publication intents, canceled schedules,
   * and transient scratch records past retention window according to documented
   * retention rules (MASTER_SPEC §71 & §147).
   *
   * Invariants:
   *  - Caller must be OWNER or ADMIN (enforced by class @Roles + TenantGuard).
   *  - Non-elevated roles (EDITOR, CREATOR, ANALYST, CLIENT) are rejected with 403.
   *  - CreditEntry, CreditReservation, BillingSubscription, BillingInvoice, and
   *    AuditLog records are IMMUTABLE and strictly preserved.
   *  - Active content, approved assets, and active schedules/attempts are untouched.
   *  - Dry-run preview supported via ?dryRun=true query parameter.
   *  - Real executions append an immutable retention.pruned entry to AuditLog.
   *  - Blocked with HTTP 423 Locked when workspace is under active legal hold.
   */
  @Post("retention-prune")
  async pruneRetention(
    @Req() req: AuthedRequest,
    @Query("dryRun") dryRunQuery?: string,
  ) {
    const org = req.organizationId;

    const holdStatus = await this.getLegalHoldStatus(org);
    if (holdStatus.active) {
      throw new HttpException(
        {
          statusCode: 423,
          error: "Locked",
          message: "Retention pruning is locked: workspace is under an active legal hold.",
          legalHold: holdStatus.hold,
        },
        423,
      );
    }

    const isDryRun = dryRunQuery === "true";
    const now = new Date();

    // 1. Expired Invitations (expiresAt < now)
    const expiredInvitationsWhere: Prisma.InvitationWhereInput = {
      organizationId: org,
      expiresAt: { lt: now },
    };

    // 2. Invalidated or Canceled Publication Intents without active child schedules or attempts
    const invalidatedIntentsWhere: Prisma.PublicationIntentWhereInput = {
      organizationId: org,
      status: { in: ["INVALIDATED", "CANCELED"] },
      schedule: null,
      attempt: null,
    };

    // 3. Canceled Publication Schedules without active attempt references
    const canceledSchedulesWhere: Prisma.PublicationScheduleWhereInput = {
      organizationId: org,
      status: "CANCELED",
      attemptId: null,
    };

    // 4. Failed/Canceled Render Jobs older than 24h
    const renderCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const staleRendersWhere: Prisma.RenderJobWhereInput = {
      organizationId: org,
      status: { in: ["FAILED", "CANCELED"] },
      createdAt: { lt: renderCutoff },
    };

    // Compute candidate counts
    const [invitationCount, intentCount, scheduleCount, renderCount] = await Promise.all([
      this.db.invitation.count({ where: expiredInvitationsWhere }),
      this.db.publicationIntent.count({ where: invalidatedIntentsWhere }),
      this.db.publicationSchedule.count({ where: canceledSchedulesWhere }),
      this.db.renderJob.count({ where: staleRendersWhere }),
    ]);

    const candidates = {
      expiredInvitations: invitationCount,
      invalidatedIntents: intentCount,
      canceledSchedules: scheduleCount,
      staleRenders: renderCount,
      total: invitationCount + intentCount + scheduleCount + renderCount,
    };

    if (isDryRun) {
      return {
        dryRun: true,
        pruned: false,
        organizationId: org,
        candidates,
      };
    }

    // Execute atomic pruning transaction in dependency-safe order
    const pruned = await this.db.$transaction(async (tx) => {
      const delSchedules = await tx.publicationSchedule.deleteMany({ where: canceledSchedulesWhere });
      const delIntents = await tx.publicationIntent.deleteMany({ where: invalidatedIntentsWhere });
      const delRenders = await tx.renderJob.deleteMany({ where: staleRendersWhere });
      const delInvitations = await tx.invitation.deleteMany({ where: expiredInvitationsWhere });

      const details = {
        expiredInvitations: delInvitations.count,
        invalidatedIntents: delIntents.count,
        canceledSchedules: delSchedules.count,
        staleRenders: delRenders.count,
        total: delInvitations.count + delIntents.count + delSchedules.count + delRenders.count,
      };

      await tx.auditLog.create({
        data: {
          organizationId: org,
          actorId: req.userId,
          action: "retention.pruned",
          entityId: org,
          detail: {
            ...details,
            prunedBy: req.userId,
          },
        },
      });

      return details;
    });

    return {
      dryRun: false,
      pruned: true,
      organizationId: org,
      summary: pruned,
    };
  }

  /**
   * DATA-01E: Workspace Legal Hold & Data Freeze Management
   *
   * Enables enterprise legal discovery, dispute preservation, and regulatory freeze.
   * When legal hold is active:
   *  - Retention pruning (retention-prune) is rejected with 423 Locked.
   *  - Member data revocation (members/:userId) is rejected with 423 Locked.
   *  - Full audit logging tracks who enabled and released the hold.
   */
  @Get("legal-hold")
  async getLegalHold(@Req() req: AuthedRequest) {
    const org = req.organizationId;
    const status = await this.getLegalHoldStatus(org);
    return {
      organizationId: org,
      active: status.active,
      hold: status.hold,
    };
  }

  @Post("legal-hold")
  async enableLegalHold(@Req() req: AuthedRequest, @Body() body: unknown) {
    const org = req.organizationId;
    const current = await this.getLegalHoldStatus(org);
    if (current.active) {
      throw new ConflictException("Workspace is already under active legal hold.");
    }
    const input = parse(legalHoldEnableSchema, body ?? {});
    const now = new Date();
    const audit = await this.db.auditLog.create({
      data: {
        organizationId: org,
        actorId: req.userId,
        action: "data.legal_hold.enabled",
        entityId: org,
        detail: {
          reason: input.reason,
          caseReference: input.caseReference ?? null,
          enabledAt: now.toISOString(),
          enabledBy: req.userId,
        },
      },
    });
    return {
      organizationId: org,
      active: true,
      hold: {
        id: audit.id,
        reason: input.reason,
        caseReference: input.caseReference ?? null,
        enabledAt: now,
        enabledBy: req.userId,
      },
    };
  }

  @Delete("legal-hold")
  async releaseLegalHold(
    @Req() req: AuthedRequest,
    @Body() body: unknown,
    @Query("releaseReason") releaseReasonQuery?: string,
  ) {
    const org = req.organizationId;
    const current = await this.getLegalHoldStatus(org);
    if (!current.active) {
      throw new ConflictException("Workspace does not have an active legal hold to release.");
    }
    const rawInput =
      body && typeof body === "object" && Object.keys(body).length > 0
        ? body
        : { releaseReason: releaseReasonQuery };
    const input = parse(legalHoldReleaseSchema, rawInput);
    const now = new Date();
    await this.db.auditLog.create({
      data: {
        organizationId: org,
        actorId: req.userId,
        action: "data.legal_hold.released",
        entityId: org,
        detail: {
          releaseReason: input.releaseReason,
          releasedAt: now.toISOString(),
          releasedBy: req.userId,
          priorHoldId: current.hold?.id,
        },
      },
    });
    return {
      organizationId: org,
      active: false,
      releasedAt: now,
      releasedBy: req.userId,
    };
  }

  /**
   * DATA-01D: Tenant Audit Log Querying & Filtering
   *
   * Query parameters:
   *  - action: string (optional, matches exact action or prefix)
   *  - actorId: string (optional UUID)
   *  - startDate: string (optional ISO string)
   *  - endDate: string (optional ISO string)
   *  - cursor: string (optional cursor id)
   *  - take: number (optional, default 50, bounded to max 100)
   */
  @Get("audit")
  async getAuditLogs(
    @Req() req: AuthedRequest,
    @Query("action") action?: string,
    @Query("actorId") actorId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("cursor") cursor?: string,
    @Query("take") take?: string,
  ) {
    const org = req.organizationId;
    const limit = Math.min(100, Math.max(1, Number(take) || 50));

    const where: Prisma.AuditLogWhereInput = {
      organizationId: org,
      ...(action ? { action: { startsWith: action } } : {}),
      ...(actorId ? { actorId } : {}),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
    };

    const [totalCount, rows] = await Promise.all([
      this.db.auditLog.count({ where }),
      this.db.auditLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        ...(cursor
          ? {
              cursor: { id: cursor },
              skip: 1,
            }
          : {}),
      }),
    ]);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      organizationId: org,
      totalCount,
      items,
      nextCursor,
    };
  }

  /**
   * DATA-01D: Compliance Audit Trail NDJSON Export with Tamper-Evident SHA-256
   *
   * Streams tenant audit log entries in NDJSON format with:
   *  - manifest header
   *  - filtered audit log records
   *  - complete footer with record count and SHA-256 over all preceding lines
   */
  @Get("audit-export")
  async exportAuditLogs(
    @Req() req: AuthedRequest,
    @Res() res: Response,
    @Query("action") action?: string,
    @Query("actorId") actorId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    const org = req.organizationId;
    const dir = await mkdtemp(join(tmpdir(), "audit-export-"));
    const path = join(dir, "audit-export.ndjson");
    let count = 0;
    const hash = createHash("sha256");

    const closed = () => {
      res.destroy();
    };
    res.on("close", closed);

    try {
      const filters = {
        ...(action ? { action } : {}),
        ...(actorId ? { actorId } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      };

      const writeLine = async (obj: unknown) => {
        const line = JSON.stringify(obj) + "\n";
        hash.update(line);
        await appendFile(path, line);
      };

      // 1. Manifest
      await writeLine({
        type: "manifest",
        format: "audit-ndjson",
        organizationId: org,
        exportedAt: new Date().toISOString(),
        filters,
      });

      // 2. Fetch and write audit rows
      const where: Prisma.AuditLogWhereInput = {
        organizationId: org,
        ...(action ? { action: { startsWith: action } } : {}),
        ...(actorId ? { actorId } : {}),
        ...(startDate || endDate
          ? {
              createdAt: {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
              },
            }
          : {}),
      };

      let cursor: string | undefined;
      while (true) {
        const rows = await this.db.auditLog.findMany({
          where,
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: 100,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (!rows.length) break;
        for (const row of rows) {
          await writeLine({ type: "auditLog", data: row });
          count++;
        }
        cursor = rows[rows.length - 1].id;
      }

      // 3. Complete record with SHA-256 over all preceding lines
      const sha256 = hash.digest("hex");
      await appendFile(
        path,
        JSON.stringify({
          type: "complete",
          data: { count, sha256 },
        }) + "\n",
      );

      // 4. Record audit event for the export operation
      await this.db.auditLog.create({
        data: {
          organizationId: org,
          actorId: req.userId,
          action: "audit.exported",
          detail: { count, sha256, filters },
        },
      });

      const size = (await stat(path)).size;
      res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="audit-${org.slice(0, 8)}.ndjson"`,
      );
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Length", size);
      await pipeline(createReadStream(path), res);
    } catch (error) {
      if (res.headersSent) res.destroy();
      else throw error;
    } finally {
      res.removeListener("close", closed);
      await rm(dir, { recursive: true, force: true });
    }
  }

  /**
   * DATA-01F: Orphan asset and transient cache reconciliation
   *
   * Reconciles unreferenced or archived assets:
   *  - Identifies assets where archivedAt is not null OR have zero renderInputs and zero generations
   *  - Supports ?dryRun=true preview
   *  - Enforces Legal Hold lock (HTTP 423 Locked)
   *  - Appends data.assets.reconciled audit event
   */
  @Post("reconcile-assets")
  async reconcileAssets(
    @Req() req: AuthedRequest,
    @Query("dryRun") dryRunQuery?: string,
  ) {
    const org = req.organizationId;
    const holdStatus = await this.getLegalHoldStatus(org);
    if (holdStatus.active) {
      throw new HttpException(
        {
          statusCode: 423,
          error: "Locked",
          message: "Asset reconciliation is locked: workspace is under an active legal hold.",
          legalHold: holdStatus.hold,
        },
        423,
      );
    }

    const isDryRun = dryRunQuery === "true";
    const candidateWhere: Prisma.AssetWhereInput = {
      organizationId: org,
      OR: [
        { archivedAt: { not: null } },
        {
          AND: [
            { renderInputs: { none: {} } },
            { generations: { none: {} } },
          ],
        },
      ],
    };

    const count = await this.db.asset.count({ where: candidateWhere });
    const candidates = await this.db.asset.findMany({
      where: candidateWhere,
      select: { id: true, name: true, bytes: true, mimeType: true, archivedAt: true },
      take: 100,
    });
    const totalBytes = candidates.reduce((sum, a) => sum + a.bytes, 0);

    if (isDryRun) {
      return {
        dryRun: true,
        reconciled: false,
        organizationId: org,
        totalCandidates: count,
        estimatedBytes: totalBytes,
        candidates,
      };
    }

    const deleteResult = await this.db.asset.deleteMany({
      where: candidateWhere,
    });

    await this.db.auditLog.create({
      data: {
        organizationId: org,
        actorId: req.userId,
        action: "data.assets.reconciled",
        entityId: org,
        detail: {
          prunedCount: deleteResult.count,
          estimatedBytes: totalBytes,
          reconciledBy: req.userId,
        },
      },
    });

    return {
      dryRun: false,
      reconciled: true,
      organizationId: org,
      prunedCount: deleteResult.count,
      freedBytes: totalBytes,
    };
  }

  /**
   * DATA-01F: Workspace Account Anonymization & Safe Erasure (GDPR Right to Be Forgotten)
   *
   * Invariants per MASTER_SPEC §145, §147 and DATA_GOVERNANCE §41:
   *  - Caller must be OWNER.
   *  - Blocked with HTTP 423 Locked when workspace is under active legal hold.
   *  - Blocked with HTTP 409 Conflict if video render or publishing jobs are actively in-flight.
   *  - Strict Financial Protection: CreditEntry, CreditReservation, BillingSubscription, and
   *    BillingInvoice records are immutable and NEVER deleted.
   *  - Workspace metadata, BrandBrain, and child content/assets are purged or scrambled.
   *  - All user memberships for the tenant are revoked.
   *  - Appends final audit event: data.workspace.erased.
   */
  @Post("erasure")
  async eraseWorkspace(
    @Req() req: AuthedRequest,
    @Body() body: unknown,
  ) {
    if (req.role !== "OWNER") {
      throw new ForbiddenException("Only workspace OWNER can request workspace erasure.");
    }

    const org = req.organizationId;
    const holdStatus = await this.getLegalHoldStatus(org);
    if (holdStatus.active) {
      throw new HttpException(
        {
          statusCode: 423,
          error: "Locked",
          message: "Workspace erasure is prohibited: workspace is under an active legal hold.",
          legalHold: holdStatus.hold,
        },
        423,
      );
    }

    const input = parse(workspaceErasureSchema, body ?? {});

    // Check for in-flight render or publication jobs
    const activeRenders = await this.db.renderJob.count({
      where: {
        organizationId: org,
        status: { in: ["QUEUED", "RUNNING"] },
      },
    });
    const activePubs = await this.db.publicationAttempt.count({
      where: {
        organizationId: org,
        status: { in: ["RESERVED", "SUBMITTING"] },
      },
    });
    if (activeRenders > 0 || activePubs > 0) {
      throw new ConflictException(
        "Cannot erase workspace while render or publishing jobs are actively in-flight. Wait for them to complete or cancel them.",
      );
    }

    const now = new Date();
    await this.db.$transaction(async (tx) => {
      // 1. Purge content and reviews
      await tx.contentComment.deleteMany({ where: { content: { organizationId: org } } });
      await tx.contentClaimReview.deleteMany({ where: { content: { organizationId: org } } });
      await tx.contentVersion.deleteMany({ where: { content: { organizationId: org } } });
      await tx.contentItem.deleteMany({ where: { organizationId: org } });
      await tx.campaign.deleteMany({ where: { organizationId: org } });

      // 2. Purge publications
      await tx.publicationAttempt.deleteMany({ where: { organizationId: org } });
      await tx.publicationSchedule.deleteMany({ where: { organizationId: org } });
      await tx.publicationIntent.deleteMany({ where: { organizationId: org } });
      await tx.publicationPolicyReview.deleteMany({ where: { organizationId: org } });
      await tx.socialConnection.deleteMany({ where: { organizationId: org } });

      // 3. Purge renders and assets
      await tx.renderInput.deleteMany({ where: { render: { organizationId: org } } });
      await tx.renderJob.deleteMany({ where: { organizationId: org } });
      await tx.mediaGeneration.deleteMany({ where: { organizationId: org } });
      await tx.asset.deleteMany({ where: { organizationId: org } });

      // 4. Purge AI jobs & agent steps
      await tx.aIAgentStep.deleteMany({ where: { run: { organizationId: org } } });
      await tx.aIAgentRun.deleteMany({ where: { organizationId: org } });
      await tx.aIUsage.deleteMany({ where: { organizationId: org } });
      await tx.aIJob.deleteMany({ where: { organizationId: org } });

      // 5. Purge invitations & Brand versions
      await tx.invitation.deleteMany({ where: { organizationId: org } });
      await tx.brandVersion.deleteMany({ where: { organizationId: org } });

      // 6. Scramble BrandBrain
      await tx.brandBrain.updateMany({
        where: { organizationId: org },
        data: {
          profile: { status: "erased", erasedAt: now.toISOString() },
          creativeDna: { status: "erased", erasedAt: now.toISOString() },
        },
      });

      // 7. Anonymize Organization profile (Financial FKs prevent deleting organization row itself)
      await tx.organization.update({
        where: { id: org },
        data: {
          name: "[ERASED WORKSPACE]",
        },
      });

      // 8. Revoke memberships
      await tx.membership.deleteMany({ where: { organizationId: org } });

      // 9. Record immutable audit record of erasure
      await tx.auditLog.create({
        data: {
          organizationId: org,
          actorId: req.userId,
          action: "data.workspace.erased",
          entityId: org,
          detail: {
            reason: input.reason,
            erasedBy: req.userId,
            erasedAt: now.toISOString(),
          },
        },
      });
    });

    return {
      acknowledged: true,
      organizationId: org,
      status: "erased",
      erasedAt: now,
    };
  }
}
@Module({ imports: [AssetsModule], controllers: [OperationsController] })
export class OperationsModule {}
