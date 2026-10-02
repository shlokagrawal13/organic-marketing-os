import {
  Controller,
  Get,
  Req,
  Res,
  UseGuards,
  Module,
  HttpException,
} from "@nestjs/common";
import { Response } from "express";
import { mkdtemp, appendFile, rm, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { Db, Cache, TenantGuard, AuthedRequest, Roles } from "./common";
import { AssetsModule, MediaStorage } from "./assets";
import {
  providersFromEnv,
  RedisProviderHealthStore,
} from "../../../packages/core/ai";

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
}
@Module({ imports: [AssetsModule], controllers: [OperationsController] })
export class OperationsModule {}
