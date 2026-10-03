import { z } from "zod";
import { createHash } from "node:crypto";
import { stableJson } from "./requests";

export const imageGenerationOptionsSchema = z
  .object({
    size: z.enum(["1024x1024", "1536x1024", "1024x1536"]).default("1024x1024"),
    quality: z.enum(["low", "medium", "high"]).default("medium"),
    background: z.enum(["opaque", "transparent"]).default("opaque"),
  })
  .strict();
export const voiceGenerationOptionsSchema = z
  .object({
    voice: z
      .enum([
        "alloy",
        "ash",
        "ballad",
        "coral",
        "echo",
        "fable",
        "onyx",
        "nova",
        "sage",
        "shimmer",
        "verse",
        "marin",
        "cedar",
      ])
      .default("alloy"),
    responseFormat: z.enum(["wav", "mp3"]).default("wav"),
    speed: z.number().min(0.25).max(4).default(1),
  })
  .strict();

export const generationRequestSchema = z
  .object({
    kind: z.enum(["image", "video", "voice"]),
    prompt: z.string().trim().min(1).max(4000),
    model: z.string().trim().min(1).max(160),
    rightsConfirmed: z.literal(true),
    rightsNote: z.string().trim().min(1).max(1000),
    sourceAssetIds: z.array(z.string().uuid()).max(8).default([]),
    options: z
      .object({
        image: imageGenerationOptionsSchema.optional(),
        voice: voiceGenerationOptionsSchema.optional(),
      })
      .strict()
      .default({}),
    target: z
      .object({
        contentId: z.string().uuid(),
        revision: z.number().int().positive(),
        sceneId: z.string().min(1).max(100),
        component: z.enum(["visual", "narration"]),
      })
      .strict()
      .optional(),
    maxCostUsd: z.number().finite().nonnegative().max(100),
  })
  .strict()
  .superRefine((request, context) => {
    if (
      request.target &&
      (request.kind === "voice") !== (request.target.component === "narration")
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Voice replaces narration; image/video replaces a visual.",
      });
    if (request.options.image && request.kind !== "image")
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options", "image"],
        message: "Image options can only be used for image generation.",
      });
    if (request.options.voice && request.kind !== "voice")
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options", "voice"],
        message: "Voice options can only be used for voice generation.",
      });
  });
export type GenerationRequest = z.infer<typeof generationRequestSchema>;
export type GenerationState =
  | "QUEUED"
  | "SUBMITTING"
  | "PENDING"
  | "CANCEL_REQUESTED"
  | "OUTPUT_READY"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELED"
  | "UNKNOWN";
export type GenerationRecord = {
  id: string;
  organizationId: string;
  requestKey: string;
  requestHash: string;
  request: GenerationRequest;
  provider: string;
  state: GenerationState;
  version: number;
  providerJobId?: string;
  outputRef?: string;
  assetId?: string;
  actualCostUsd?: number;
  error?: string;
};

// Implement with a durable tenant-scoped store. No runtime in-memory fallback.
export interface GenerationStore {
  read(organizationId: string, id: string): Promise<GenerationRecord>;
  compareAndSet(
    previous: GenerationRecord,
    changes: Partial<GenerationRecord>,
  ): Promise<GenerationRecord | null>;
}
const providerResultSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("pending") }).strict(),
  z
    .object({
      state: z.literal("succeeded"),
      outputRef: z.string().min(1).max(2000),
      actualCostUsd: z.number().finite().nonnegative().optional(),
    })
    .strict(),
  z
    .object({
      state: z.literal("failed"),
      code: z.string().min(1).max(120),
      actualCostUsd: z.number().finite().nonnegative().optional(),
    })
    .strict(),
  z
    .object({
      state: z.literal("canceled"),
      actualCostUsd: z.number().finite().nonnegative().optional(),
    })
    .strict(),
]);
export type GenerationResult = z.infer<typeof providerResultSchema>;
export interface GenerationProvider {
  name: string;
  capabilities: GenerationRequest["kind"][];
  quote(request: GenerationRequest): number | undefined;
  submit(
    request: GenerationRequest,
    idempotencyKey: string,
  ): Promise<{ providerJobId: string }>;
  poll(providerJobId: string): Promise<GenerationResult>;
  // true confirms cancellation; false means still pending. Never assume an abort cancels billing.
  cancel(providerJobId: string): Promise<boolean>;
}

export function generationHash(request: GenerationRequest) {
  return createHash("sha256")
    .update(stableJson(generationRequestSchema.parse(request)))
    .digest("hex");
}
export function assertGenerationReplay(
  record: GenerationRecord,
  organizationId: string,
  request: GenerationRequest,
) {
  if (
    record.organizationId !== organizationId ||
    record.requestHash !== generationHash(request)
  )
    throw new Error(
      "Generation request key conflicts with its saved workspace/payload.",
    );
}
const terminal = new Set<GenerationState>([
  "SUCCEEDED",
  "FAILED",
  "CANCELED",
  "UNKNOWN",
]);

// Persist SUBMITTING before the paid boundary. A crash at that boundary must be
// reconciled with provider evidence; a later worker must never submit it again.
export class GenerationLifecycle {
  constructor(
    private store: GenerationStore,
    private provider: GenerationProvider,
  ) {}
  private async record(org: string, id: string) {
    const record = await this.store.read(org, id);
    if (record.organizationId !== org || record.id !== id)
      throw new Error("Generation is unavailable in this workspace.");
    if (record.provider !== this.provider.name)
      throw new Error(
        "The saved provider cannot be changed during generation.",
      );
    return record;
  }
  async submit(org: string, id: string) {
    const record = await this.record(org, id);
    if (record.state !== "QUEUED") return record;
    const request = generationRequestSchema.parse(record.request);
    if (record.requestHash !== generationHash(request))
      throw new Error("Generation input was modified.");
    const quote = this.provider.quote(request);
    if (
      !this.provider.capabilities.includes(request.kind) ||
      quote === undefined ||
      !Number.isFinite(quote) ||
      quote < 0 ||
      quote > request.maxCostUsd
    )
      throw new Error("Generation capability or bounded cost is unavailable.");
    const claimed = await this.store.compareAndSet(record, {
      state: "SUBMITTING",
    });
    if (!claimed) return this.record(org, id);
    let accepted;
    try {
      accepted = z
        .object({ providerJobId: z.string().min(1).max(200) })
        .strict()
        .parse(await this.provider.submit(request, `${org}:${record.id}`));
    } catch {
      return (
        (await this.store.compareAndSet(claimed, {
          state: "UNKNOWN",
          error:
            "Submission outcome is unknown. Reconcile provider evidence before another paid request.",
        })) || this.record(org, id)
      );
    }
    // A persistence failure here deliberately escapes. SUBMITTING remains a
    // reconciliation gate; it is never automatically resubmitted or refunded.
    return (
      (await this.store.compareAndSet(claimed, {
        state: "PENDING",
        providerJobId: accepted.providerJobId,
      })) || this.record(org, id)
    );
  }
  async poll(org: string, id: string) {
    const record = await this.record(org, id);
    if (!["PENDING", "CANCEL_REQUESTED"].includes(record.state)) return record;
    if (!record.providerJobId) throw new Error("Provider evidence is missing.");
    let result: GenerationResult;
    try {
      result = providerResultSchema.parse(
        await this.provider.poll(record.providerJobId),
      );
    } catch {
      return record;
    } // Poll failures may be retried; submissions may not.
    if (result.state === "pending") return record;
    const changes: Partial<GenerationRecord> = {
      state:
        result.state === "succeeded"
          ? "OUTPUT_READY"
          : result.state === "failed"
            ? "FAILED"
            : "CANCELED",
      actualCostUsd: result.actualCostUsd,
      ...(result.state === "succeeded" ? { outputRef: result.outputRef } : {}),
      ...(result.state === "failed" ? { error: result.code } : {}),
    };
    return (
      (await this.store.compareAndSet(record, changes)) || this.record(org, id)
    );
  }
  async cancel(org: string, id: string) {
    const record = await this.record(org, id);
    if (terminal.has(record.state) || record.state === "OUTPUT_READY")
      return record;
    if (record.state === "SUBMITTING") return record; // An in-flight accepted ID could otherwise be lost.
    if (record.state === "QUEUED")
      return (
        (await this.store.compareAndSet(record, { state: "CANCELED" })) ||
        this.record(org, id)
      );
    const requested =
      record.state === "CANCEL_REQUESTED"
        ? record
        : await this.store.compareAndSet(record, { state: "CANCEL_REQUESTED" });
    if (!requested) return this.record(org, id);
    let confirmed = false;
    try {
      confirmed = await this.provider.cancel(requested.providerJobId!);
    } catch {}
    return confirmed
      ? (await this.store.compareAndSet(requested, { state: "CANCELED" })) ||
          this.record(org, id)
      : requested;
  }
  async commitPrivateAsset(org: string, id: string, assetId: string) {
    z.string().uuid().parse(assetId);
    const record = await this.record(org, id);
    if (record.state === "SUCCEEDED" && record.assetId === assetId)
      return record;
    if (record.state !== "OUTPUT_READY")
      throw new Error("A validated private output is required before success.");
    // Caller must verify tenant ownership, bytes/type, provenance and rights in
    // the same durable asset transaction. An opaque provider ref is not a URL.
    return (
      (await this.store.compareAndSet(record, {
        state: "SUCCEEDED",
        assetId,
      })) || this.record(org, id)
    );
  }
}
