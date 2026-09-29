import "reflect-metadata";
import { PrismaClient, Prisma } from "@prisma/client";
import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { randomUUID } from "node:crypto";
import {
  ModelRouter,
  providersFromEnv,
  AITask,
  AIPlan,
  RedisProviderHealthStore,
  routingOptionsFromEnv,
} from "../../../packages/core/ai";
import {
  creditPolicy,
  settleCredits,
  reviewCredits,
} from "../../../packages/core/credits";
import {
  buildAgentPlan,
  contextArtifact,
  freezeAgentContext,
  reviewAgentOutput,
} from "../../../packages/core/agents";

const db = new PrismaClient();
const connection = new Redis(
  process.env.REDIS_URL || "redis://localhost:6379",
  { maxRetriesPerRequest: null },
);
const queue = new Queue("marketing-ai", { connection: connection as any });
const router = new ModelRouter(
  providersFromEnv(),
  fetch,
  new RedisProviderHealthStore(connection),
);
const billingPolicy = creditPolicy();
const active = new Set<AbortController>();
let dispatching = false,
  closing = false;

async function dispatch() {
  if (dispatching || closing) return;
  dispatching = true;
  try {
    await connection.set("worker:heartbeat", String(Date.now()), "EX", 30);
    const cutoff = new Date(Date.now() - 60000);
    const staleWhere: Prisma.AIJobWhereInput = {
      status: "RUNNING",
      OR: [
        { heartbeatAt: { lt: cutoff } },
        { heartbeatAt: null, startedAt: { lt: cutoff } },
      ],
    };
    const stale = await db.aIJob.findMany({ where: staleWhere, take: 50 });
    for (const row of stale)
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${row.organizationId} FOR UPDATE`;
        const changed = await tx.aIJob.updateMany({
          where: { ...staleWhere, id: row.id },
          data: {
            status: "FAILED",
            completedAt: new Date(),
            error:
              "Worker was interrupted. Provider usage may have been incurred. Review it before creating a new request.",
          },
        });
        if (changed.count && row.creditReservationId)
          await reviewCredits(tx, row.organizationId, row.creditReservationId);
        if (changed.count) {
          const run = await tx.aIAgentRun.findUnique({
            where: { jobId: row.id },
            select: { id: true },
          });
          if (run) {
            await tx.aIAgentStep.updateMany({
              where: { runId: run.id, state: "RUNNING" },
              data: {
                state: "FAILED",
                error: "Worker heartbeat expired.",
                completedAt: new Date(),
              },
            });
            await tx.aIAgentRun.updateMany({
              where: { id: run.id, state: "RUNNING" },
              data: { state: "FAILED", completedAt: new Date() },
            });
          }
        }
      });
    // PostgreSQL is the source of truth even if Redis lost a dispatched queue entry.
    const rows = await db.aIJob.findMany({
      where: { status: "QUEUED" },
      take: 50,
      orderBy: { createdAt: "asc" },
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
        row.task,
        { id: row.id },
        {
          jobId: row.id,
          attempts: 1,
          removeOnComplete: { age: 86400 },
          removeOnFail: { age: 604800 },
        },
      );
      await db.aIJob.updateMany({
        where: { id: row.id, status: "QUEUED" },
        data: { dispatchedAt: new Date() },
      });
    }
  } catch {
    console.error(JSON.stringify({ event: "worker.dispatch_failed" }));
  } finally {
    dispatching = false;
  }
}

const worker = new Worker(
  "marketing-ai",
  async (job) => {
    const row = await db.aIJob.findUnique({ where: { id: job.data.id } });
    if (!row || row.status !== "QUEUED") return;
    const runToken = randomUUID();
    const claimed = await db.aIJob.updateMany({
      where: { id: row.id, status: "QUEUED" },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        heartbeatAt: new Date(),
        runToken,
        attempts: { increment: 1 },
        error: null,
      },
    });
    if (!claimed.count) return;
    const ownership = { id: row.id, status: "RUNNING" as const, runToken };
    const abort = new AbortController();
    active.add(abort);
    let monitoring = false;
    const heartbeat = setInterval(async () => {
      if (monitoring) return;
      monitoring = true;
      try {
        const result = await db.aIJob.updateMany({
          where: ownership,
          data: { heartbeatAt: new Date() },
        });
        if (!result.count) abort.abort();
      } catch {
        abort.abort();
      } finally {
        monitoring = false;
      }
    }, 1000);
    const deadline = setTimeout(() => abort.abort(), 210000);
    let providerStarted = false;
    let agentRunId: string | undefined;
    let generatorStepId: string | undefined;
    try {
      const brand =
        row.brandContext ||
        (await db.brandBrain.findUnique({
          where: { organizationId: row.organizationId },
        }));
      if (!brand) throw new Error("Brand Brain is unavailable.");
      const plan = buildAgentPlan(row.task as AITask);
      const frozenContext = freezeAgentContext({
        task: row.task,
        input: row.input,
        brand,
        requestCreatedAt: row.createdAt.toISOString(),
      });
      const agentRun = await db.aIAgentRun.create({
        data: {
          organizationId: row.organizationId,
          jobId: row.id,
          graphVersion: plan.version,
          task: row.task,
          frozenContext: frozenContext as Prisma.InputJsonValue,
          steps: {
            create: plan.steps.map((node, sequence) => ({
              key: node.id,
              sequence,
              role: node.role,
              kind: node.kind,
              responsibility: node.responsibility,
              dependencies: node.dependsOn,
              inputContext: {
                brandRevision: (brand as any).revision ?? null,
                requestTask: row.task,
              },
              state: node.kind === "human" ? "WAITING" : "PENDING",
            })),
          },
        },
        include: { steps: true },
      });
      agentRunId = agentRun.id;
      for (const node of plan.steps.filter((item) => item.kind === "context")) {
        const current = agentRun.steps.find((item) => item.key === node.id)!;
        await db.aIAgentStep.update({
          where: { id: current.id },
          data: { state: "RUNNING", startedAt: new Date() },
        });
        await db.aIAgentStep.update({
          where: { id: current.id },
          data: {
            state: "SUCCEEDED",
            output: contextArtifact(
              node,
              frozenContext as Record<string, any>,
            ) as Prisma.InputJsonValue,
            completedAt: new Date(),
          },
        });
      }
      const generatorStep = agentRun.steps.find(
        (item) => item.kind === "generate",
      )!;
      generatorStepId = generatorStep.id;
      await db.aIAgentStep.update({
        where: { id: generatorStep.id },
        data: { state: "RUNNING", startedAt: new Date() },
      });
      const subscription = await db.billingSubscription.findUnique({
        where: { organizationId: row.organizationId },
        select: { planId: true, status: true },
      });
      const routePlan: AIPlan =
        billingPolicy.mode === "self_hosted"
          ? "self_hosted"
          : subscription && ["ACTIVE", "TRIALING"].includes(subscription.status)
            ? ((["free", "starter", "growth"].includes(subscription.planId)
                ? subscription.planId
                : "free") as AIPlan)
            : "free";
      const output = await router.run(
        row.task as AITask,
        row.input,
        brand,
        async (usage) => {
          const { routingMetadata, ...record } = usage;
          await db.aIUsage.create({
            data: {
              organizationId: row.organizationId,
              jobId: row.id,
              agentStepId: generatorStep.id,
              ...record,
              routingMetadata: routingMetadata as Prisma.InputJsonValue,
            },
          });
        },
        abort.signal,
        async () => {
          providerStarted = true;
        },
        routingOptionsFromEnv(routePlan),
      );
      const finalReview = reviewAgentOutput(row.task as AITask, output);
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${row.organizationId} FOR UPDATE`;
        const changed = await tx.aIJob.updateMany({
          where: ownership,
          data: { status: "SUCCEEDED", output, completedAt: new Date() },
        });
        if (!changed.count) return;
        await tx.aIAgentStep.update({
          where: { id: generatorStep.id },
          data: {
            state: "SUCCEEDED",
            output: output as Prisma.InputJsonValue,
            completedAt: new Date(),
          },
        });
        for (const key of ["compliance", "critique"])
          await tx.aIAgentStep.update({
            where: { runId_key: { runId: agentRun.id, key } },
            data: {
              state: finalReview.passed ? "SUCCEEDED" : "BLOCKED",
              startedAt: new Date(),
              completedAt: new Date(),
              output: finalReview as Prisma.InputJsonValue,
            },
          });
        await tx.aIAgentRun.update({
          where: { id: agentRun.id },
          data: {
            state: "AWAITING_REVIEW",
            finalReview: finalReview as Prisma.InputJsonValue,
            completedAt: new Date(),
          },
        });
        if (row.creditReservationId) {
          const reservation = await tx.creditReservation.findUniqueOrThrow({
            where: { id: row.creditReservationId },
          });
          await settleCredits(
            tx,
            row.organizationId,
            reservation.id,
            reservation.credits,
            "Validated AI result saved successfully",
            row.actorId,
          );
        }
        await tx.auditLog.create({
          data: {
            organizationId: row.organizationId,
            actorId: row.actorId,
            action: "ai.completed",
            entityId: row.id,
            detail: { task: row.task },
          },
        });
      });
    } catch {
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${row.organizationId} FOR UPDATE`;
        const changed = await tx.aIJob.updateMany({
          where: ownership,
          data: {
            status: "FAILED",
            completedAt: new Date(),
            error: abort.signal.aborted
              ? "Generation was interrupted. Review provider usage before creating a new request."
              : "Generation or usage recording failed. Review provider usage before retrying.",
          },
        });
        if (changed.count && row.creditReservationId) {
          if (providerStarted)
            await reviewCredits(
              tx,
              row.organizationId,
              row.creditReservationId,
            );
          else
            await settleCredits(
              tx,
              row.organizationId,
              row.creditReservationId,
              0,
              "Generation stopped before any provider request",
              row.actorId,
            );
        }
        if (agentRunId) {
          if (generatorStepId)
            await tx.aIAgentStep.updateMany({
              where: { id: generatorStepId, state: "RUNNING" },
              data: {
                state: "FAILED",
                error: "Generation did not produce a reviewable result.",
                completedAt: new Date(),
              },
            });
          await tx.aIAgentRun.updateMany({
            where: { id: agentRunId, state: "RUNNING" },
            data: { state: "FAILED", completedAt: new Date() },
          });
        }
      });
      throw new Error("AI job failed. See its recorded status.");
    } finally {
      clearInterval(heartbeat);
      clearTimeout(deadline);
      active.delete(abort);
    }
  },
  {
    connection: connection as any,
    concurrency: 2,
    lockDuration: 240000,
    stalledInterval: 30000,
    maxStalledCount: 1,
  },
);
worker.on("error", () =>
  console.error(JSON.stringify({ event: "worker.error" })),
);
worker.on("failed", (job) =>
  console.error(JSON.stringify({ event: "job.failed", jobId: job?.id })),
);
connection.on("error", () => {});
const timer = setInterval(dispatch, 2000);
void dispatch();
async function close() {
  if (closing) return;
  closing = true;
  clearInterval(timer);
  for (const abort of active) abort.abort();
  await worker.close();
  await queue.close();
  await connection.quit();
  await db.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
