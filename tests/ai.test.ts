import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MemoryProviderHealthStore,
  ModelRouter,
  ProviderConfig,
  RedisProviderHealthStore,
  draftSchema,
  Usage,
} from "../packages/core/ai";
import { checkContent } from "../packages/core/content";
const draft = {
  title: "Test draft",
  platform: "LinkedIn",
  format: "Text",
  hook: "A practical idea",
  body: "Useful and factual content.",
  cta: "Tell us your experience.",
  scenes: [],
};
test("model router validates output and records primary failure, fallback, tokens and estimates", async () => {
  const attempts: Usage[] = [];
  let calls = 0;
  const fake = (async () => {
    calls++;
    if (calls === 1) return new Response("{}", { status: 503 });
    return Response.json({
      choices: [{ message: { content: JSON.stringify(draft) } }],
      usage: { prompt_tokens: 200, completion_tokens: 100 },
    });
  }) as typeof fetch;
  const providers = [
    {
      name: "primary",
      url: "https://primary.example/v1",
      key: "test-only",
      model: "test",
    },
    {
      name: "fallback",
      url: "https://fallback.example/v1",
      key: "test-only",
      model: "test",
      inputPrice: 2,
      outputPrice: 5,
    },
  ];
  const result = await new ModelRouter(providers, fake).run(
    "content",
    { prompt: "test" },
    {},
    async (u) => {
      attempts.push(u);
    },
  );
  assert.equal(result.title, "Test draft");
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].success, false);
  assert.equal(attempts[1].fallback, true);
  assert.equal(attempts[1].estimatedCostUsd, 0.0009);
});
test("invalid model output never becomes successful generated content", async () => {
  const fake = (async () =>
    Response.json({
      choices: [{ message: { content: '{"fabricated":true}' } }],
    })) as typeof fetch;
  await assert.rejects(
    () =>
      new ModelRouter(
        [
          {
            name: "p",
            url: "https://example.test",
            key: "test-only",
            model: "test",
          },
        ],
        fake,
      ).run("content", {}, {}, async () => {}),
    /valid output/,
  );
});
test("invalid task output does not disable the provider for the next job, but an outage does", async () => {
  const attempts: Usage[] = [];
  const responses = ['{"fabricated":true}', "not JSON", JSON.stringify(draft)];
  let calls = 0;
  const router = new ModelRouter(
    [
      {
        name: "p",
        url: "https://example.test",
        key: "test-only",
        model: "test",
      },
    ],
    (async () => {
      const content = responses[calls++];
      return content === undefined
        ? new Response("unavailable", { status: 503 })
        : Response.json({ choices: [{ message: { content } }] });
    }) as typeof fetch,
  );
  const run = () =>
    router.run("content", {}, {}, async (usage) => {
      attempts.push(usage);
    });
  await assert.rejects(run(), /valid output/);
  await assert.rejects(run(), /valid output/);
  assert.equal((await run()).title, draft.title);
  assert.equal(calls, 3);
  assert.deepEqual(
    attempts.map((usage) => usage.success),
    [false, false, true],
  );
  await assert.rejects(run(), /valid output/);
  await assert.rejects(run(), /policy/);
  assert.equal(
    calls,
    4,
    "service outages still prevent repeated immediate calls",
  );
});
test("empty content and unsupported guarantees block approval; structural passes still require human review", () => {
  const base = draftSchema.parse(draft);
  assert.equal(checkContent(base).passed, true);
  assert.equal(checkContent({ ...base, body: "" }).passed, false);
  assert.equal(
    checkContent({ ...base, body: "Guaranteed viral results." }).passed,
    false,
  );
  assert.ok(
    checkContent(base).checks.some((c) => c.label.includes("Human review")),
  );
});

test("usage-record failure cannot trigger another paid provider request", async () => {
  let calls = 0;
  const provider: ProviderConfig = {
    name: "primary",
    url: "https://example.test",
    key: "test",
    model: "test",
  };
  const router = new ModelRouter(
    [provider, { ...provider, name: "fallback" }],
    (async () => {
      calls++;
      return Response.json({
        choices: [{ message: { content: JSON.stringify(draft) } }],
      });
    }) as typeof fetch,
  );
  await assert.rejects(
    router.run("content", {}, {}, async () => {
      throw new Error("Accounting unavailable");
    }),
    /Accounting unavailable/,
  );
  assert.equal(calls, 1);
  await assert.rejects(
    router.run(
      "content",
      {},
      {},
      async () => {},
      undefined,
      async () => {
        throw new Error("Reservation unavailable");
      },
    ),
    /Reservation unavailable/,
  );
  assert.equal(
    calls,
    1,
    "a failed pre-request accounting hook cannot send a request",
  );
});

test("aborted jobs cannot start a fallback and oversized provider output is rejected", async () => {
  const abort = new AbortController();
  const provider: ProviderConfig = {
    name: "primary",
    url: "https://example.test",
    key: "test",
    model: "test",
  };
  let calls = 0;
  const router = new ModelRouter(
    [provider, { ...provider, name: "fallback" }],
    (async () => {
      calls++;
      abort.abort();
      throw new Error("Disconnected");
    }) as typeof fetch,
  );
  await assert.rejects(
    router.run("content", {}, {}, async () => {}, abort.signal),
  );
  assert.equal(calls, 1);
  const large = new ModelRouter(
    [provider],
    (async () => new Response(" ".repeat(1024 * 1024 + 1))) as typeof fetch,
  );
  await assert.rejects(
    large.run("content", {}, {}, async () => {}),
    /valid output/,
  );
});

test("critical routing never downgrades quality and ambiguous transport failures never duplicate a paid call", async () => {
  const attempts: Usage[] = [];
  let calls = 0;
  const providers = [
    {
      name: "premium",
      url: "https://premium.example/v1",
      key: "test",
      model: "premium-model",
      qualityTier: "premium" as const,
    },
    {
      name: "standard-fallback",
      url: "https://standard.example/v1",
      key: "test",
      model: "standard-model",
      qualityTier: "standard" as const,
    },
  ];
  const router = new ModelRouter(providers, (async () => {
    calls++;
    throw new Error("connection ended after request write");
  }) as typeof fetch);
  await assert.rejects(
    router.run("strategy", {}, {}, async (usage) => attempts.push(usage)),
    /valid output/,
  );
  assert.equal(calls, 1);
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].qualityTier, "premium");
  assert.equal(attempts[0].failureCode, "transport_unknown");
  assert.equal(attempts[0].unknownOutcome, true);
});

test("routing enforces plan, capability and maximum estimated cost before calling a provider", async () => {
  let calls = 0;
  const provider: ProviderConfig = {
    name: "restricted",
    url: "https://provider.example/v1",
    key: "test",
    model: "test",
    qualityTier: "premium" as const,
    capabilities: ["text", "json", "strategy"],
    allowedPlans: ["growth"],
    inputPrice: 100,
    outputPrice: 100,
  };
  const router = new ModelRouter([provider], (async () => {
    calls++;
    return Response.json({});
  }) as typeof fetch);
  await assert.rejects(
    router.run("strategy", {}, {}, async () => {}, undefined, undefined, {
      plan: "starter",
    }),
    /policy/,
  );
  await assert.rejects(
    router.run("strategy", {}, {}, async () => {}, undefined, undefined, {
      plan: "growth",
      maxEstimatedCostUsd: 0.01,
    }),
    /policy/,
  );
  assert.equal(calls, 0);
});

test("shared health removes an unavailable provider from selection and records the configured fallback", async () => {
  const health = new MemoryProviderHealthStore();
  await health.recordFailure(
    "primary",
    50,
    "provider_unavailable",
    Date.now() + 30_000,
  );
  const attempts: Usage[] = [];
  const providers = [
    {
      name: "primary",
      url: "https://primary.example/v1",
      key: "test",
      model: "test",
    },
    {
      name: "fallback",
      url: "https://fallback.example/v1",
      key: "test",
      model: "test",
    },
  ];
  const result = await new ModelRouter(
    providers,
    (async () =>
      Response.json({
        choices: [{ message: { content: JSON.stringify(draft) } }],
      })) as typeof fetch,
    health,
  ).run("content", {}, {}, async (usage) => attempts.push(usage));
  assert.equal(result.title, draft.title);
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].provider, "fallback");
  assert.equal(attempts[0].fallback, true);
  assert.equal(attempts[0].retryCount, 0);
});

test("Redis health adapter shares failure cooldown and clears it after success", async () => {
  const hashes = new Map<string, Record<string, string>>();
  const backend = {
    async hgetall(key: string) {
      return { ...(hashes.get(key) || {}) };
    },
    async eval(
      _script: string,
      _keys: number,
      key: string,
      success: string,
      latency: string,
      failureCode: string,
      unavailableUntil: string,
    ) {
      const value = hashes.get(key) || {};
      const attempts = Number(value.attempts || 0) + 1;
      const oldLatency = Number(value.averageLatencyMs || latency);
      value.attempts = String(attempts);
      value.averageLatencyMs = String(
        Math.floor((oldLatency * 4 + Number(latency)) / 5),
      );
      if (success === "1") {
        value.consecutiveFailures = "0";
        value.unavailableUntil = "0";
        value.lastFailureCode = "";
      } else {
        value.failures = String(Number(value.failures || 0) + 1);
        value.consecutiveFailures = String(
          Number(value.consecutiveFailures || 0) + 1,
        );
        value.unavailableUntil = unavailableUntil;
        value.lastFailureCode = failureCode;
      }
      hashes.set(key, value);
      return 1;
    },
  };
  const first = new RedisProviderHealthStore(backend);
  const second = new RedisProviderHealthStore(backend);
  const until = Date.now() + 30_000;
  await first.recordFailure("shared", 100, "rate_limited", until);
  const failed = await second.get("shared");
  assert.equal(failed.attempts, 1);
  assert.equal(failed.failures, 1);
  assert.equal(failed.lastFailureCode, "rate_limited");
  assert.equal(failed.unavailableUntil, until);
  await second.recordSuccess("shared", 50);
  const recovered = await first.get("shared");
  assert.equal(recovered.attempts, 2);
  assert.equal(recovered.consecutiveFailures, 0);
  assert.equal(recovered.unavailableUntil, 0);
});
