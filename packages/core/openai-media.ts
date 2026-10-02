import { z } from "zod";
import { GenerationRequest } from "./generated-media";
import { MAX_UPLOAD_BYTES } from "./media";

export const mediaPlanSchema = z.enum([
  "free",
  "starter",
  "growth",
  "self_hosted",
]);
export type MediaPlan = z.infer<typeof mediaPlanSchema>;
const defaultPlans: MediaPlan[] = ["free", "starter", "growth", "self_hosted"];

// No model, price or live provider is enabled implicitly. Prices are operator
// estimates for the fixed preset, not provider-enforced spending limits.
export const mediaConfigurationSchema = z
  .object({
    version: z.literal(1),
    provider: z.literal("openai"),
    baseUrl: z.string().url(),
    kind: z.enum(["image", "video", "voice"]),
    model: z.string().min(1).max(160),
    estimatedCostUsd: z.number().finite().positive().max(100),
    credits: z.number().int().min(1).max(10000),
    allowedPlans: z.array(mediaPlanSchema).min(1).max(defaultPlans.length),
  })
  .strict();
export type MediaConfiguration = z.infer<typeof mediaConfigurationSchema>;
function parsePlans(value: string | undefined): MediaPlan[] {
  if (!value) return defaultPlans;
  const plans = [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
  return z.array(mediaPlanSchema).min(1).max(defaultPlans.length).parse(plans);
}
export function mediaConfiguration(
  kind: GenerationRequest["kind"],
): MediaConfiguration | null {
  if (
    process.env.MEDIA_GENERATION_ENABLED !== "true" ||
    !process.env.OPENAI_MEDIA_API_KEY
  )
    return null;
  const prefix = `MEDIA_${kind.toUpperCase()}`;
  const model = process.env[`${prefix}_MODEL`];
  if (!model) return null;
  const baseUrl =
    process.env.OPENAI_MEDIA_BASE_URL || "https://api.openai.com/v1";
  assertMediaOrigin(baseUrl);
  return mediaConfigurationSchema.parse({
    version: 1,
    provider: "openai",
    baseUrl,
    kind,
    model,
    estimatedCostUsd: Number(process.env[`${prefix}_ESTIMATE_USD`]),
    credits: Number(process.env[`${prefix}_CREDITS`]),
    allowedPlans: parsePlans(process.env[`${prefix}_PLANS`]),
  });
}
function assertMediaOrigin(baseUrl: string) {
  const official = baseUrl === "https://api.openai.com/v1";
  const fixture =
    process.env.MOS_ISOLATED_TEST_HARNESS === "true" &&
    process.env.NODE_ENV !== "production" &&
    baseUrl === "http://127.0.0.1:4998/v1";
  if (!official && !fixture)
    throw new Error("Unsupported media provider origin.");
}
export function validateMediaPreset(
  request: GenerationRequest,
  config: MediaConfiguration,
  plan: MediaPlan = "self_hosted",
) {
  if (
    request.kind !== config.kind ||
    request.model !== config.model ||
    request.maxCostUsd < config.estimatedCostUsd
  )
    throw new Error("Choose a configured model and accept its estimated cost.");
  if (!config.allowedPlans.includes(plan))
    throw new Error(
      "Configured media model is unavailable for this workspace plan.",
    );
  if (request.sourceAssetIds.length)
    throw new Error("This provider preset does not support source assets yet.");
}
export function mediaPreset(kind: GenerationRequest["kind"]) {
  return kind === "image"
    ? { size: "1024x1024", quality: "medium", output_format: "png", n: 1 }
    : kind === "voice"
      ? {
          voice: "alloy",
          response_format: "wav",
          disclosure: "AI-generated voice",
        }
      : { size: "720x1280", seconds: "4" };
}
export async function boundedResponse(
  response: Response,
  limit: number,
): Promise<Buffer> {
  if (!response.body) throw new Error("Provider output is empty.");
  const reader = response.body.getReader();
  const parts: Buffer[] = [];
  let length = 0;
  try {
    if (Number(response.headers.get("content-length")) > limit)
      throw new Error("Provider output is too large.");
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) throw new Error("Provider output is too large.");
      parts.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  if (!length) throw new Error("Provider output is empty.");
  return Buffer.concat(parts);
}
const receiptSchema = z.object({
  id: z.string().regex(/^video_[A-Za-z0-9_-]{1,190}$/),
  status: z.enum(["queued", "in_progress", "completed", "failed"]),
});
export type MediaResponse = { requestId?: string } & (
  | { state: "output"; bytes: Buffer }
  | { state: "pending"; providerJobId: string }
  | { state: "failed" }
);
export class OpenAIMediaProvider {
  private key: string;
  constructor(readonly config: MediaConfiguration) {
    mediaConfigurationSchema.parse(config);
    assertMediaOrigin(config.baseUrl);
    const active = mediaConfiguration(config.kind);
    if (
      !active ||
      active.model !== config.model ||
      active.baseUrl !== config.baseUrl
    )
      throw new Error("Saved media provider is no longer configured.");
    this.key = process.env.OPENAI_MEDIA_API_KEY!;
  }
  private async call(
    path: string,
    signal: AbortSignal,
    init: RequestInit = {},
  ) {
    const response = await fetch(this.config.baseUrl + path, {
      ...init,
      signal,
      redirect: "error",
      headers: { Authorization: `Bearer ${this.key}`, ...init.headers },
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new Error(`Media provider returned HTTP ${response.status}.`);
    }
    return response;
  }
  async submit(
    request: GenerationRequest,
    idempotencyKey: string,
    signal: AbortSignal,
  ): Promise<MediaResponse> {
    validateMediaPreset(request, this.config);
    const headers = { "Idempotency-Key": idempotencyKey };
    if (request.kind === "video") {
      const form = new FormData();
      for (const [key, value] of Object.entries({
        model: request.model,
        prompt: request.prompt,
        size: "720x1280",
        seconds: "4",
      }))
        form.set(key, value);
      const response = await this.call("/videos", signal, {
        method: "POST",
        body: form,
        headers,
      });
      const receipt = receiptSchema.parse(
        JSON.parse((await boundedResponse(response, 65536)).toString()),
      );
      // Even completed receipts are persisted before downloading; never resubmit.
      return {
        state: "pending",
        providerJobId: receipt.id,
        requestId: this.requestId(response),
      };
    }
    const payload =
      request.kind === "image"
        ? {
            model: request.model,
            prompt: request.prompt,
            n: 1,
            size: "1024x1024",
            quality: "medium",
            output_format: "png",
          }
        : {
            model: request.model,
            input: request.prompt,
            voice: "alloy",
            response_format: "wav",
          };
    const response = await this.call(
      request.kind === "image" ? "/images/generations" : "/audio/speech",
      signal,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (request.kind === "voice")
      return {
        state: "output",
        bytes: await boundedResponse(response, MAX_UPLOAD_BYTES),
        requestId: this.requestId(response),
      };
    const result = z
      .object({
        data: z
          .array(
            z.object({
              b64_json: z
                .string()
                .min(4)
                .max(Math.ceil((MAX_UPLOAD_BYTES * 4) / 3) + 4),
            }),
          )
          .length(1),
      })
      .parse(
        JSON.parse(
          (await boundedResponse(response, 36 * 1024 * 1024)).toString(),
        ),
      );
    const encoded = result.data[0].b64_json;
    if (encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))
      throw new Error("Invalid image encoding.");
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length > MAX_UPLOAD_BYTES)
      throw new Error("Provider image is too large.");
    return { state: "output", bytes, requestId: this.requestId(response) };
  }
  async poll(id: string, signal: AbortSignal): Promise<MediaResponse> {
    receiptSchema.shape.id.parse(id);
    const response = await this.call(`/videos/${id}`, signal);
    const receipt = receiptSchema.parse(
      JSON.parse((await boundedResponse(response, 65536)).toString()),
    );
    if (receipt.id !== id) throw new Error("Provider receipt changed.");
    if (receipt.status === "failed")
      return { state: "failed", requestId: this.requestId(response) };
    if (receipt.status !== "completed")
      return { state: "pending", providerJobId: id };
    const file = await this.call(`/videos/${id}/content`, signal);
    return {
      state: "output",
      bytes: await boundedResponse(file, MAX_UPLOAD_BYTES),
      requestId: this.requestId(file),
    };
  }
  private requestId(response: Response) {
    const id = response.headers.get("x-request-id");
    return id && /^[A-Za-z0-9_-]{1,200}$/.test(id) ? id : undefined;
  }
}
