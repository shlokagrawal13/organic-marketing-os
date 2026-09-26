import { test } from "node:test";
import assert from "node:assert/strict";
import { ModelRouter, draftSchema, Usage } from "../packages/core/ai";
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
  await assert.rejects(run(), /valid output/);
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
  const provider = {
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
  const provider = {
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
