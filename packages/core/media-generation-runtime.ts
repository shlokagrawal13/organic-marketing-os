import { MediaGeneration, PrismaClient, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generationRequestSchema } from "./generated-media";
import { mediaConfigurationSchema, OpenAIMediaProvider } from "./openai-media";
import { ObjectStore } from "./object-store";
import {
  MAX_UPLOAD_BYTES,
  sniffMedia,
  probeMedia,
  validateProbe,
  sha256,
} from "./media";
import { reviewCredits, settleCredits } from "./credits";

const activeStates = ["SUBMITTING", "PENDING", "OUTPUT_READY"] as const;
const LEASE_MS = 60000;
class InvalidOutput extends Error {}
async function lock(tx: Prisma.TransactionClient, org: string) {
  await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${org} FOR UPDATE`;
}
async function finish(
  db: PrismaClient,
  job: MediaGeneration,
  state: "UNKNOWN" | "FAILED",
  error: string,
  knownUnsubmitted = false,
) {
  return db.$transaction(async (tx) => {
    await lock(tx, job.organizationId);
    const changed = await tx.mediaGeneration.updateMany({
      where: {
        id: job.id,
        organizationId: job.organizationId,
        state: job.state,
        runToken: job.runToken,
      },
      data: {
        state,
        error,
        runToken: null,
        heartbeatAt: null,
        completedAt: new Date(),
        ...(knownUnsubmitted ? { actualCostUsd: 0 } : {}),
      },
    });
    if (!changed.count) return;
    if (job.creditReservationId) {
      if (knownUnsubmitted)
        await settleCredits(
          tx,
          job.organizationId,
          job.creditReservationId,
          0,
          "Provider was not called; release media reservation",
          job.actorId,
        );
      else await reviewCredits(tx, job.organizationId, job.creditReservationId);
    }
    await tx.auditLog.create({
      data: {
        organizationId: job.organizationId,
        actorId: job.actorId,
        action: `media_generation.${state.toLowerCase()}`,
        entityId: job.id,
        detail: {
          providerJobId: job.providerJobId,
          costStatus: knownUnsubmitted ? "unsubmitted" : "unknown",
        },
      },
    });
  });
}
export async function recoverMediaGenerations(db: PrismaClient) {
  const stale = await db.mediaGeneration.findMany({
    where: {
      state: "SUBMITTING",
      OR: [
        { heartbeatAt: { lt: new Date(Date.now() - LEASE_MS) } },
        { heartbeatAt: null },
      ],
    },
    take: 100,
  });
  for (const job of stale) {
    // Recheck the lease under the same tenant lock used for cancellation/claim.
    await db.$transaction(async (tx) => {
      await lock(tx, job.organizationId);
      const changed = await tx.mediaGeneration.updateMany({
        where: {
          id: job.id,
          state: "SUBMITTING",
          runToken: job.runToken,
          OR: [
            { heartbeatAt: { lt: new Date(Date.now() - LEASE_MS) } },
            { heartbeatAt: null },
          ],
        },
        data: {
          state: "UNKNOWN",
          error:
            "Worker interrupted at provider submission. Reconcile provider evidence; this request will not be resubmitted.",
          runToken: null,
          completedAt: new Date(),
        },
      });
      if (changed.count && job.creditReservationId)
        await reviewCredits(tx, job.organizationId, job.creditReservationId);
      if (changed.count)
        await tx.auditLog.create({
          data: {
            organizationId: job.organizationId,
            actorId: job.actorId,
            action: "media_generation.interrupted",
            entityId: job.id,
          },
        });
    });
  }
}
async function ingest(
  db: PrismaClient,
  store: ObjectStore,
  job: MediaGeneration,
) {
  if (!job.outputKey?.startsWith(`${job.organizationId}/generated/${job.id}/`))
    throw new InvalidOutput("Private output reference is invalid.");
  const bytes = await store.read(job.outputKey, MAX_UPLOAD_BYTES);
  const request = generationRequestSchema.parse(job.request);
  let detected, metadata;
  const temp = await mkdtemp(join(tmpdir(), "mos-generation-"));
  try {
    detected = sniffMedia(bytes);
    const expected = { image: "IMAGE", video: "VIDEO", voice: "AUDIO" }[
      request.kind
    ];
    if (detected.kind !== expected) throw new Error("Unexpected media type.");
    const path = join(temp, `source.${detected.extension}`);
    await writeFile(path, bytes, { mode: 0o600 });
    metadata = validateProbe(await probeMedia(path), detected.kind);
  } catch {
    throw new InvalidOutput(
      "Provider output failed media type, size, dimensions or duration validation.",
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
  const digest = sha256(bytes),
    info = detected,
    dimensions = metadata;
  let discardKey: string | undefined;
  await db.$transaction(async (tx) => {
    await lock(tx, job.organizationId);
    const current = await tx.mediaGeneration.findFirst({
      where: {
        id: job.id,
        organizationId: job.organizationId,
        state: "OUTPUT_READY",
        runToken: job.runToken,
      },
    });
    if (!current) return;
    let asset = await tx.asset.findUnique({
      where: {
        organizationId_sha256: {
          organizationId: job.organizationId,
          sha256: digest,
        },
      },
    });
    if (asset?.archivedAt)
      throw new InvalidOutput(
        "Identical media is archived. Restore the asset before attempting to attach it.",
      );
    if (!asset) {
      const used = await tx.asset.aggregate({
        where: { organizationId: job.organizationId },
        _sum: { bytes: true },
      });
      if ((used._sum.bytes || 0) + bytes.length > 2 * 1024 * 1024 * 1024)
        throw new InvalidOutput(
          "Workspace media allowance is full; provider cost needs review.",
        );
      asset = await tx.asset.create({
        data: {
          organizationId: job.organizationId,
          name: `Generated ${request.kind} ${job.id.slice(0, 8)}.${info.extension}`,
          kind: info.kind,
          mimeType: info.mimeType,
          bytes: bytes.length,
          sha256: digest,
          objectKey: job.outputKey!,
          ...dimensions,
          rightsNote: `${request.rightsNote}${request.kind === "voice" ? " | AI-generated voice" : ""}`,
          tags: ["generated", request.kind],
          createdBy: job.actorId,
        },
      });
    } else if (asset.objectKey !== job.outputKey) discardKey = job.outputKey!;
    await tx.mediaGeneration.update({
      where: { id: job.id },
      data: {
        state: "SUCCEEDED",
        assetId: asset.id,
        outputKey: null,
        runToken: null,
        completedAt: new Date(),
        heartbeatAt: null,
        error: null,
      },
    });
    if (job.creditReservationId)
      await settleCredits(
        tx,
        job.organizationId,
        job.creditReservationId,
        job.quotedCredits,
        "Validated generated media delivered at accepted fixed credit price",
        job.actorId,
      );
    await tx.auditLog.create({
      data: {
        organizationId: job.organizationId,
        actorId: job.actorId,
        action: "media_generation.completed",
        entityId: job.id,
        detail: {
          assetId: asset.id,
          sha256: digest,
          provider: "openai",
          model: request.model,
          providerJobId: job.providerJobId,
          providerRequestId: job.providerRequestId,
          rightsConfirmed: true,
          quotedCredits: job.quotedCredits,
          actualCostUsd: null,
        },
      },
    });
  });
  if (discardKey) await store.remove(discardKey).catch(() => {});
}
export async function processMediaGeneration(
  db: PrismaClient,
  store: ObjectStore,
  id: string,
  shutdown?: AbortSignal,
) {
  let job = await db.mediaGeneration.findUnique({ where: { id } });
  if (!job || !["QUEUED", "PENDING", "OUTPUT_READY"].includes(job.state))
    return;
  if (
    job.startedAt &&
    job.startedAt.getTime() < Date.now() - 86400000 &&
    job.state !== "QUEUED" &&
    (!job.runToken ||
      !job.heartbeatAt ||
      job.heartbeatAt.getTime() < Date.now() - LEASE_MS)
  ) {
    await finish(
      db,
      job,
      "UNKNOWN",
      "Saved generation exceeded 24 hours. Reconcile provider evidence; no paid retry will occur.",
    );
    return;
  }
  const token = randomUUID();
  // Preflight before crossing the paid boundary. A queued job never runs while
  // its frozen provider/model has been removed or private storage is unavailable.
  let provider: OpenAIMediaProvider | undefined;
  try {
    await store.ready();
    if (job.state !== "OUTPUT_READY")
      provider = new OpenAIMediaProvider(
        mediaConfigurationSchema.parse(job.configuration),
      );
  } catch {
    if (job.state === "QUEUED")
      await finish(
        db,
        job,
        "FAILED",
        "Media provider or private storage is unavailable. No provider request was made.",
        true,
      );
    return;
  }
  const claimed = await db.$transaction(async (tx) => {
    await lock(tx, job!.organizationId);
    const changed = await tx.mediaGeneration.updateMany({
      where: {
        id,
        state: job!.state,
        nextAttemptAt: { lte: new Date() },
        OR: [
          { runToken: null },
          { heartbeatAt: { lt: new Date(Date.now() - LEASE_MS) } },
        ],
      },
      data: {
        runToken: token,
        heartbeatAt: new Date(),
        ...(job!.state === "QUEUED"
          ? { state: "SUBMITTING", startedAt: new Date() }
          : {}),
      },
    });
    return changed.count
      ? tx.mediaGeneration.findUniqueOrThrow({ where: { id } })
      : null;
  });
  if (!claimed) return;
  job = claimed;
  const abort = new AbortController();
  const onShutdown = () => abort.abort();
  shutdown?.addEventListener("abort", onShutdown, { once: true });
  if (shutdown?.aborted) abort.abort();
  const deadline = setTimeout(() => abort.abort(), 180000);
  let monitoring = false;
  const timer = setInterval(async () => {
    if (monitoring) return;
    monitoring = true;
    try {
      const update = await db.mediaGeneration.updateMany({
        where: { id, runToken: token, state: { in: [...activeStates] } },
        data: { heartbeatAt: new Date() },
      });
      if (!update.count) abort.abort();
    } catch {
      abort.abort();
    } finally {
      monitoring = false;
    }
  }, 1000);
  try {
    if (job.startedAt && job.startedAt.getTime() < Date.now() - 86400000) {
      await finish(
        db,
        job,
        "UNKNOWN",
        "Provider completion or output ingestion exceeded 24 hours. Reconcile provider evidence before another request.",
      );
      return;
    }
    if (job.state !== "OUTPUT_READY") {
      const result =
        job.state === "SUBMITTING"
          ? await provider!.submit(
              generationRequestSchema.parse(job.request),
              `${job.organizationId}:${job.id}`,
              abort.signal,
            )
          : await provider!.poll(job.providerJobId!, abort.signal);
      if (result.state === "failed") {
        await finish(
          db,
          job,
          "FAILED",
          "Provider reported generation failure. Cost remains unknown pending review.",
        );
        return;
      }
      if (result.state === "pending") {
        await db.mediaGeneration.updateMany({
          where: { id, runToken: token, state: job.state },
          data: {
            state: "PENDING",
            providerJobId: result.providerJobId,
            providerRequestId: result.requestId,
            nextAttemptAt: new Date(Date.now() + 2000),
            error: null,
          },
        });
        return;
      }
      if (abort.signal.aborted) throw new Error("Worker lease lost.");
      const outputKey = `${job.organizationId}/generated/${id}/${token}`;
      await store.put(outputKey, result.bytes, "application/octet-stream");
      // Keep an ambiguous object write private for reconciliation; never delete
      // an object merely because the database response was lost after commit.
      const changed = await db.mediaGeneration.updateMany({
        where: { id, runToken: token, state: job.state },
        data: {
          state: "OUTPUT_READY",
          outputKey,
          providerRequestId: result.requestId,
          error: null,
        },
      });
      if (!changed.count) return;
      job = await db.mediaGeneration.findUniqueOrThrow({ where: { id } });
    }
    await ingest(db, store, job);
  } catch (e) {
    const current = await db.mediaGeneration.findUnique({ where: { id } });
    if (!current || current.runToken !== token) return;
    if (current.state === "SUBMITTING")
      await finish(
        db,
        current,
        "UNKNOWN",
        "Submission outcome is unknown. This job will not automatically repeat the paid request.",
      );
    else if (e instanceof InvalidOutput)
      await finish(db, current, "FAILED", e.message);
    else
      await db.mediaGeneration.updateMany({
        where: { id, runToken: token },
        data: {
          error:
            "Provider polling or private ingestion is temporarily unavailable. Retrying the saved result only.",
          nextAttemptAt: new Date(Date.now() + 15000),
        },
      });
  } finally {
    clearInterval(timer);
    clearTimeout(deadline);
    shutdown?.removeEventListener("abort", onShutdown);
    await db.mediaGeneration.updateMany({
      where: { id, runToken: token },
      data: { runToken: null, heartbeatAt: null },
    });
  }
}
