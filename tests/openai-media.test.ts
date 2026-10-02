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
        prompt: request.prompt,
        n: 1,
        size: "1024x1024",
        quality: "medium",
        output_format: "png",
      });
      return new Response(JSON.stringify(result));
    }) as typeof fetch;
    const provider = new OpenAIMediaProvider(config);
    const generated = await provider.submit(
      request,
      "test-key",
      new AbortController().signal,
    );
    assert.equal(generated.state, "output");
    result = { data: [{ url: "http://169.254.169.254/private" }] };
    await assert.rejects(
      provider.submit(request, "test-key", new AbortController().signal),
    );
    result = { data: [{ b64_json: "!!!!" }] };
    await assert.rejects(
      provider.submit(request, "test-key", new AbortController().signal),
    );
    assert.equal(calls, 3);
    process.env.OPENAI_MEDIA_BASE_URL = "https://untrusted.example/v1";
    assert.throws(() => mediaConfiguration("image"));
  } finally {
    globalThis.fetch = originalFetch;
    process.env = previous;
  }
});
