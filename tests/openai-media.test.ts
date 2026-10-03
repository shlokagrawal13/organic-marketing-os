import test from "node:test";
import assert from "node:assert/strict";
import {
  mediaConfiguration,
  mediaConfigurationSchema,
  validateMediaPreset,
  boundedResponse,
  OpenAIMediaProvider,
} from "../packages/core/openai-media";
import { generationRequestSchema } from "../packages/core/generated-media";
import { loadGenerationSourceImages } from "../packages/core/media-generation-runtime";
import { sha256 } from "../packages/core/media";

const config = {
  version: 1 as const,
  provider: "openai" as const,
  baseUrl: "https://api.openai.com/v1",
  kind: "image" as const,
  model: "operator-selected",
  estimatedCostUsd: 0.2,
  credits: 2,
  allowedPlans: ["starter", "growth", "self_hosted"],
};
const request = generationRequestSchema.parse({
  kind: "image",
  model: config.model,
  prompt: "Synthetic test",
  rightsConfirmed: true,
  rightsNote: "Test fixture",
  maxCostUsd: 0.2,
});
test("media configuration requires explicit prices; presets reject unsupported references and budget/model mismatch", () => {
  assert.equal(mediaConfiguration("image"), null);
  assert.throws(() =>
    mediaConfigurationSchema.parse({ ...config, estimatedCostUsd: NaN }),
  );
  assert.throws(() =>
    mediaConfigurationSchema.parse({ ...config, credits: 0 }),
  );
  validateMediaPreset(request, config);
  validateMediaPreset(request, config, "growth");
  assert.throws(() => validateMediaPreset(request, config, "free"));
  assert.throws(() =>
    validateMediaPreset({ ...request, maxCostUsd: 0.1 }, config),
  );
  assert.throws(() =>
    validateMediaPreset({ ...request, model: "another" }, config),
  );
  assert.throws(() =>
    generationRequestSchema.parse({
      ...request,
      options: { voice: { voice: "alloy" } },
    }),
  );
  assert.throws(() =>
    validateMediaPreset(
      { ...request, sourceAssetIds: ["8d1adcca-5c32-4467-a5bf-111111111111"] },
      config,
    ),
  );
});
test("bounded provider reads enforce declared and streamed size without trusting headers", async () => {
  await assert.rejects(
    boundedResponse(
      new Response("abc", { headers: { "content-length": "100" } }),
      4,
    ),
  );
  await assert.rejects(boundedResponse(new Response("12345"), 4));
  await assert.rejects(boundedResponse(new Response(""), 4));
  assert.equal(
    (await boundedResponse(new Response("1234"), 4)).toString(),
    "1234",
  );
});
test("image editing uses a separately quoted preset and sends owned bytes as multipart", async () => {
  const previous = { ...process.env };
  const originalFetch = globalThis.fetch;
  const editConfig = {
    ...config,
    model: "gpt-image-1.5",
    allowedPlans: ["starter" as const],
    imageEdit: { estimatedCostUsd: 0.4, credits: 5 },
  };
  const editRequest = {
    ...request,
    model: editConfig.model,
    sourceAssetIds: [
      "8d1adcca-5c32-4467-a5bf-111111111111",
      "b8fe2ce9-17c6-49ab-ae83-222222222222",
    ],
    maxCostUsd: 0.4,
  };
  try {
    Object.assign(process.env, {
      MEDIA_GENERATION_ENABLED: "true",
      OPENAI_MEDIA_API_KEY: "unit-test-only",
      MEDIA_IMAGE_MODEL: editConfig.model,
      MEDIA_IMAGE_ESTIMATE_USD: "0.2",
      MEDIA_IMAGE_CREDITS: "2",
      MEDIA_IMAGE_PLANS: "starter",
      MEDIA_IMAGE_EDIT_ESTIMATE_USD: "0.4",
      MEDIA_IMAGE_EDIT_CREDITS: "5",
    });
    delete process.env.OPENAI_MEDIA_BASE_URL;
    assert.deepEqual(
      mediaConfiguration("image")?.imageEdit,
      editConfig.imageEdit,
    );
    validateMediaPreset(editRequest, editConfig, "starter");
    assert.throws(() =>
      validateMediaPreset({ ...editRequest, maxCostUsd: 0.2 }, editConfig),
    );
    assert.throws(() => validateMediaPreset(editRequest, editConfig, "growth"));
    assert.throws(() =>
      validateMediaPreset(
        {
          ...editRequest,
          sourceAssetIds: Array.from({ length: 5 }, () =>
            crypto.randomUUID(),
          ),
        },
        editConfig,
      ),
    );
    let calls = 0;
    globalThis.fetch = (async (url, options) => {
      calls++;
      assert.equal(url, "https://api.openai.com/v1/images/edits");
      assert.equal(options?.redirect, "error");
      assert.equal(
        (options?.headers as Record<string, string>)["Idempotency-Key"],
        "edit-key",
      );
      const form = options?.body as FormData;
      assert.equal(form.get("model"), editConfig.model);
      assert.equal(form.get("prompt"), editRequest.prompt);
      assert.equal(form.get("quality"), "medium");
      const files = form.getAll("image[]") as File[];
      assert.equal(files.length, 2);
      assert.deepEqual(files.map((file) => file.name), [
        "source-1.png",
        "source-2.webp",
      ]);
      assert.deepEqual(
        await Promise.all(
          files.map(async (file) => Buffer.from(await file.arrayBuffer()).toString()),
        ),
        ["owned-image", "second-image"],
      );
      return new Response(
        JSON.stringify({
          data: [{ b64_json: Buffer.from("result").toString("base64") }],
        }),
      );
    }) as typeof fetch;
    const provider = new OpenAIMediaProvider(editConfig);
    await assert.rejects(
      provider.submit(editRequest, "edit-key", new AbortController().signal),
    );
    assert.equal(calls, 0);
    const result = await provider.submit(
      editRequest,
      "edit-key",
      new AbortController().signal,
      [
        { bytes: Buffer.from("owned-image"), mimeType: "image/png" },
        { bytes: Buffer.from("second-image"), mimeType: "image/webp" },
      ],
    );
    assert.equal(result.state, "output");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    process.env = previous;
  }
});
test("source preflight checks tenant ownership and private byte integrity before submission", async () => {
  const org = "workspace-a";
  const bytes = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    Buffer.from("fixture-image"),
  ]);
  const job = {
    organizationId: org,
    request: {
      ...request,
      sourceAssetIds: ["8d1adcca-5c32-4467-a5bf-111111111111"],
    },
  } as any;
  const asset = {
    id: job.request.sourceAssetIds[0],
    organizationId: org,
    objectKey: `${org}/assets/image`,
    bytes: bytes.length,
    sha256: sha256(bytes),
    mimeType: "image/png",
  };
  let found = true;
  const db = {
    asset: {
      findMany: async ({ where }: any) => {
        assert.equal(where.organizationId, org);
        assert.equal(where.archivedAt, null);
        return found ? [asset] : [];
      },
    },
  } as any;
  const store = {
    read: async (key: string, max: number) => {
      assert.equal(key, asset.objectKey);
      assert.equal(max, 8 * 1024 * 1024);
      return bytes;
    },
  } as any;
  assert.deepEqual(await loadGenerationSourceImages(db, store, job), [
    { bytes, mimeType: "image/png" },
  ]);
  found = false;
  await assert.rejects(
    loadGenerationSourceImages(db, store, job),
    /unavailable/,
  );
  found = true;
  await assert.rejects(
    loadGenerationSourceImages(
      db,
      { read: async () => Buffer.concat([bytes, Buffer.from("x")]) } as any,
      job,
    ),
    /integrity/,
  );
});
test("provider adapter fixes request shape, disables redirects and refuses remote URLs or malformed image encodings", async () => {
  const previous = { ...process.env },
    originalFetch = globalThis.fetch;
  try {
    Object.assign(process.env, {
      MEDIA_GENERATION_ENABLED: "true",
      OPENAI_MEDIA_API_KEY: "unit-test-only",
      MEDIA_IMAGE_MODEL: config.model,
      MEDIA_IMAGE_ESTIMATE_USD: "0.2",
      MEDIA_IMAGE_CREDITS: "2",
      MEDIA_IMAGE_PLANS: "starter,growth,self_hosted",
    });
    delete process.env.OPENAI_MEDIA_BASE_URL;
    const configuredRequest = generationRequestSchema.parse({
      ...request,
      options: {
        image: {
          size: "1536x1024",
          quality: "high",
          background: "transparent",
        },
      },
    });
    let result: any = {
      data: [
        { b64_json: Buffer.alloc(2 * 1024 * 1024, 127).toString("base64") },
      ],
    };
    let calls = 0;
    globalThis.fetch = (async (url, options) => {
      calls++;
      assert.equal(url, "https://api.openai.com/v1/images/generations");
      assert.equal(options?.redirect, "error");
      assert.deepEqual(JSON.parse(String(options?.body)), {
        model: config.model,
        prompt: configuredRequest.prompt,
        n: 1,
        size: "1536x1024",
        quality: "high",
        background: "transparent",
        output_format: "png",
      });
      return new Response(JSON.stringify(result));
    }) as typeof fetch;
    const provider = new OpenAIMediaProvider(config);
    const generated = await provider.submit(
      configuredRequest,
      "test-key",
      new AbortController().signal,
    );
    assert.equal(generated.state, "output");
    result = { data: [{ url: "http://169.254.169.254/private" }] };
    await assert.rejects(
      provider.submit(
        configuredRequest,
        "test-key",
        new AbortController().signal,
      ),
    );
    result = { data: [{ b64_json: "!!!!" }] };
    await assert.rejects(
      provider.submit(
        configuredRequest,
        "test-key",
        new AbortController().signal,
      ),
    );
    assert.equal(calls, 3);
    process.env.OPENAI_MEDIA_BASE_URL = "https://untrusted.example/v1";
    assert.throws(() => mediaConfiguration("image"));
  } finally {
    globalThis.fetch = originalFetch;
    process.env = previous;
  }
});
test("voice options are bounded and sent in the saved provider request", async () => {
  const previous = { ...process.env };
  const originalFetch = globalThis.fetch;
  const voiceConfig = {
    version: 1 as const,
    provider: "openai" as const,
    baseUrl: "https://api.openai.com/v1",
    kind: "voice" as const,
    model: "gpt-4o-mini-tts",
    estimatedCostUsd: 0.1,
    credits: 1,
    allowedPlans: ["starter" as const],
  };
  const voiceRequest = generationRequestSchema.parse({
    kind: "voice",
    model: voiceConfig.model,
    prompt: "Synthetic narration",
    rightsConfirmed: true,
    rightsNote: "Test fixture",
    maxCostUsd: 0.1,
    options: {
      voice: { voice: "cedar", responseFormat: "mp3", speed: 1.25 },
    },
  });
  try {
    Object.assign(process.env, {
      MEDIA_GENERATION_ENABLED: "true",
      OPENAI_MEDIA_API_KEY: "unit-test-only",
      MEDIA_VOICE_MODEL: voiceConfig.model,
      MEDIA_VOICE_ESTIMATE_USD: "0.1",
      MEDIA_VOICE_CREDITS: "1",
      MEDIA_VOICE_PLANS: "starter",
    });
    delete process.env.OPENAI_MEDIA_BASE_URL;
    globalThis.fetch = (async (url, options) => {
      assert.equal(url, "https://api.openai.com/v1/audio/speech");
      assert.deepEqual(JSON.parse(String(options?.body)), {
        model: voiceConfig.model,
        input: voiceRequest.prompt,
        voice: "cedar",
        response_format: "mp3",
        speed: 1.25,
      });
      return new Response(Buffer.from("synthetic-audio"));
    }) as typeof fetch;
    const result = await new OpenAIMediaProvider(voiceConfig).submit(
      voiceRequest,
      "voice-key",
      new AbortController().signal,
    );
    assert.equal(result.state, "output");
    assert.throws(() =>
      generationRequestSchema.parse({
        ...voiceRequest,
        options: { voice: { ...voiceRequest.options.voice, speed: 4.25 } },
      }),
    );
  } finally {
    globalThis.fetch = originalFetch;
    process.env = previous;
  }
});
