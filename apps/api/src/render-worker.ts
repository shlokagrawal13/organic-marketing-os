import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { randomUUID } from "node:crypto";
import { ObjectStore } from "../../../packages/core/object-store";
import { draftSchema } from "../../../packages/core/ai";
import { renderOptions, runProcess } from "../../../packages/core/media";
import { renderVideo } from "../../../packages/core/renderer";
const db = new PrismaClient(),
  store = new ObjectStore();
const connection = new Redis(
  process.env.REDIS_URL || "redis://localhost:6379",
  { maxRetriesPerRequest: null },
);
connection.on("error", () => {});
const queue = new Queue("marketing-render", { connection: connection as any });
let dispatching = false,
  closing = false;
const active = new Set<AbortController>();
async function dispatch() {
  if (dispatching || closing) return;
  dispatching = true;
  try {
    await connection.set("render:heartbeat", String(Date.now()), "EX", 30);
    await db.renderJob.updateMany({
      where: {
        status: "RUNNING",
        heartbeatAt: { lt: new Date(Date.now() - 60000) },
      },
      data: {
        status: "FAILED",
        error:
          "The render worker was interrupted. Retry to resume using cached scenes.",
        stage: "Worker interrupted",
        completedAt: new Date(),
      },
    });
    const rows = await db.renderJob.findMany({
      where: { status: "QUEUED" },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
    for (const row of rows) {
      const existing = await queue.getJob(row.id);
      if (existing) {
        const state = await existing.getState();
        if (state === "completed" || state === "failed")
          await existing.remove();
        else continue;
      }
      await queue.add(
        "render",
        { id: row.id },
        {
          jobId: row.id,
          attempts: 1,
          removeOnComplete: { age: 86400 },
          removeOnFail: { age: 604800 },
        },
      );
    }
  } catch {
    console.error(JSON.stringify({ event: "render.dispatch_failed" }));
  } finally {
    dispatching = false;
  }
}
const worker = new Worker(
  "marketing-render",
  async (job) => {
    const row = await db.renderJob.findUnique({
      where: { id: job.data.id },
      include: { inputs: { include: { asset: true } } },
    });
    if (!row || row.status !== "QUEUED") return;
    const runToken = randomUUID();
    const claimed = await db.renderJob.updateMany({
      where: { id: row.id, status: "QUEUED" },
      data: {
        status: "RUNNING",
        runToken,
        startedAt: new Date(),
        heartbeatAt: new Date(),
        progress: 2,
        stage: "Preparing media",
        error: null,
      },
    });
    if (!claimed.count) return;
    const abort = new AbortController();
    active.add(abort);
    let monitoring = false;
    const ownership = { id: row.id, status: "RUNNING" as const, runToken };
    const timer = setInterval(async () => {
      if (monitoring) return;
      monitoring = true;
      try {
        const updated = await db.renderJob.updateMany({
          where: ownership,
          data: { heartbeatAt: new Date() },
        });
        if (!updated.count) abort.abort();
      } catch {
        abort.abort();
      } finally {
        monitoring = false;
      }
    }, 1000);
    const deadline = setTimeout(() => abort.abort(), 10 * 60 * 1000);
    let output: Awaited<ReturnType<typeof renderVideo>> | undefined,
      committed = false;
    try {
      const snapshot = draftSchema.parse(row.snapshot),
        options = renderOptions.parse(row.options);
      output = await renderVideo({
        id: row.id,
        organizationId: row.organizationId,
        scenes: snapshot.scenes,
        options,
        assets: row.inputs.map((i) => i.asset),
        store,
        signal: abort.signal,
        progress: async (progress, stage, reusedScenes) => {
          const r = await db.renderJob.updateMany({
            where: ownership,
            data: { progress, stage, reusedScenes, heartbeatAt: new Date() },
          });
          if (!r.count) {
            abort.abort();
            throw new Error("Render canceled.");
          }
        },
        cacheGet: (key) =>
          db.renderSegment.findUnique({
            where: {
              organizationId_cacheKey: {
                organizationId: row.organizationId,
                cacheKey: key,
              },
            },
          }),
        cachePut: async (key, entry) => {
          await db.renderSegment.upsert({
            where: {
              organizationId_cacheKey: {
                organizationId: row.organizationId,
                cacheKey: key,
              },
            },
            create: {
              organizationId: row.organizationId,
              cacheKey: key,
              ...entry,
            },
            update: entry,
          });
        },
      });
      committed = await db.$transaction(async (tx) => {
        const changed = await tx.renderJob.updateMany({
          where: ownership,
          data: {
            ...output,
            status: "SUCCEEDED",
            progress: 100,
            stage: "Ready for review",
            completedAt: new Date(),
          },
        });
        if (!changed.count) return false;
        await tx.auditLog.create({
          data: {
            organizationId: row.organizationId,
            actorId: row.actorId,
            action: "render.completed",
            entityId: row.id,
            detail: {
              contentRevision: row.contentRevision,
              reusedScenes: output!.reusedScenes,
            },
          },
        });
        return true;
      });
    } catch (error) {
      // Detailed local codec messages stay out of HTTP responses and can contain temporary paths.
      console.error(
        JSON.stringify({
          event: "render.failed",
          jobId: row.id,
          message: (error as Error).message.slice(0, 1500),
        }),
      );
      await db.renderJob.updateMany({
        where: ownership,
        data: {
          status: "FAILED",
          error: abort.signal.aborted
            ? "The render was interrupted or exceeded 10 minutes. Retry to reuse completed scenes."
            : "Media processing failed. Check the selected files and render-worker logs, then retry.",
          stage: "Render failed",
          completedAt: new Date(),
        },
      });
    } finally {
      clearInterval(timer);
      clearTimeout(deadline);
      active.delete(abort);
      if (output && !committed)
        for (const key of [
          output.outputKey,
          output.thumbnailKey,
          output.captionsKey,
        ])
          await store.remove(key).catch(() => {});
    }
  },
  {
    connection: connection as any,
    concurrency: 1,
    lockDuration: 120000,
    stalledInterval: 30000,
    maxStalledCount: 1,
  },
);
worker.on("error", () =>
  console.error(JSON.stringify({ event: "render.worker_error" })),
);
const timer = setInterval(dispatch, 2000);
async function boot() {
  await runProcess(process.env.FFMPEG_PATH || "ffmpeg", ["-version"], {
    timeout: 5000,
  });
  await dispatch();
}
boot().catch(() => {
  console.error("FFmpeg is required by the render worker.");
  process.exit(1);
});
async function close() {
  if (closing) return;
  closing = true;
  clearInterval(timer);
  for (const a of active) a.abort();
  await worker.close();
  await queue.close();
  await connection.quit();
  await db.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
