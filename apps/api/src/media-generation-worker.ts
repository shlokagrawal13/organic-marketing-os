import { PrismaClient } from "@prisma/client";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { ObjectStore } from "../../../packages/core/object-store";
import {
  processMediaGeneration,
  recoverMediaGenerations,
} from "../../../packages/core/media-generation-runtime";

const db = new PrismaClient(),
  store = new ObjectStore();
const connection = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  { maxRetriesPerRequest: null },
);
const queue = new Queue("marketing-media-generation", {
  connection: connection as any,
});
const shutdown = new AbortController();
let dispatching = false,
  closing = false;
async function dispatch() {
  if (dispatching || closing) return;
  dispatching = true;
  try {
    await connection.set(
      "media-generation:heartbeat",
      String(Date.now()),
      "EX",
      30,
    );
    await recoverMediaGenerations(db);
    const rows = await db.mediaGeneration.findMany({
      where: {
        state: { in: ["QUEUED", "PENDING", "OUTPUT_READY"] },
        nextAttemptAt: { lte: new Date() },
        OR: [
          { runToken: null },
          { heartbeatAt: { lt: new Date(Date.now() - 60000) } },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
    for (const row of rows) {
      const previous = await queue.getJob(row.id);
      if (previous) {
        if (["completed", "failed"].includes(await previous.getState()))
          await previous.remove();
        else continue;
      }
      await queue.add(
        "generate",
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
    console.error(
      JSON.stringify({ event: "media_generation.dispatch_failed" }),
    );
  } finally {
    dispatching = false;
  }
}
const worker = new Worker(
  "marketing-media-generation",
  (job) => processMediaGeneration(db, store, job.data.id, shutdown.signal),
  {
    connection: connection as any,
    concurrency: 2,
    lockDuration: 120000,
    stalledInterval: 30000,
    maxStalledCount: 1,
  },
);
worker.on("error", () =>
  console.error(JSON.stringify({ event: "media_generation.worker_error" })),
);
const timer = setInterval(dispatch, 2000);
void dispatch();
async function close() {
  if (closing) return;
  closing = true;
  clearInterval(timer);
  shutdown.abort();
  await worker.close();
  await queue.close();
  await connection.quit();
  await db.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
