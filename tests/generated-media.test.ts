import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  GenerationLifecycle,
  GenerationProvider,
  GenerationRecord,
  GenerationStore,
  GenerationRequest,
  generationHash,
  generationRequestSchema,
  assertGenerationReplay,
} from "../packages/core/generated-media";

function fixture(overrides: Partial<GenerationProvider> = {}) {
  const org = randomUUID(),
    id = randomUUID();
  const request: GenerationRequest = {
    kind: "image",
    prompt: "Product on a green background",
    model: "fixture-image",
    rightsConfirmed: true,
    rightsNote: "Synthetic test-only product",
    sourceAssetIds: [],
    maxCostUsd: 1,
  };
  let record: GenerationRecord = {
    id,
    organizationId: org,
    requestKey: randomUUID(),
    requestHash: generationHash(request),
    request,
    provider: "fixture",
    state: "QUEUED",
    version: 1,
  };
  let submits = 0,
    persistenceFailure = false;
  const store: GenerationStore = {
    async read(tenant, job) {
      if (tenant !== org || job !== id) throw Error("Not found");
      return structuredClone(record);
    },
    async compareAndSet(previous, changes) {
      if (persistenceFailure && changes.state === "PENDING")
        throw Error("DB unavailable");
      if (
        previous.version !== record.version ||
        previous.state !== record.state
      )
        return null;
      record = { ...record, ...changes, version: record.version + 1 };
      return structuredClone(record);
    },
  };
  const provider: GenerationProvider = {
    name: "fixture",
    capabilities: ["image", "video", "voice"],
    quote: () => 0.4,
    async submit(_, key) {
      submits++;
      assert.equal(key, `${org}:${id}`);
      return { providerJobId: "provider-test-1" };
    },
    async poll() {
      return { state: "succeeded", outputRef: "opaque-test-output" };
    },
    async cancel() {
      return false;
    },
    ...overrides,
  };
  return {
    org,
    id,
    request,
    lifecycle: new GenerationLifecycle(store, provider),
    get record() {
      return record;
    },
    get submits() {
      return submits;
    },
    failPersistence() {
      persistenceFailure = true;
    },
  };
}

test("concurrent generation workers submit once and polling does not invent zero cost or bypass private ingestion", async () => {
  const f = fixture();
  await Promise.all([
    f.lifecycle.submit(f.org, f.id),
    f.lifecycle.submit(f.org, f.id),
  ]);
  assert.equal(f.submits, 1);
  assert.equal(f.record.state, "PENDING");
  await f.lifecycle.poll(f.org, f.id);
  assert.equal(f.record.state, "OUTPUT_READY");
  assert.equal(f.record.actualCostUsd, undefined);
  const asset = randomUUID();
  await f.lifecycle.commitPrivateAsset(f.org, f.id, asset);
  assert.equal(f.record.state, "SUCCEEDED");
  assert.equal(f.record.assetId, asset);
  await f.lifecycle.commitPrivateAsset(f.org, f.id, asset);
  await assert.rejects(
    f.lifecycle.commitPrivateAsset(f.org, f.id, randomUUID()),
  );
});
test("ambiguous provider acceptance and failed persistence cannot replay an expensive generation", async () => {
  let calls = 0;
  const a = fixture({
    async submit() {
      calls++;
      throw Error("Connection closed after acceptance");
    },
  });
  await a.lifecycle.submit(a.org, a.id);
  await a.lifecycle.submit(a.org, a.id);
  assert.equal(calls, 1);
  assert.equal(a.record.state, "UNKNOWN");
  const b = fixture();
  b.failPersistence();
  await assert.rejects(b.lifecycle.submit(b.org, b.id));
  assert.equal(b.record.state, "SUBMITTING");
  await b.lifecycle.submit(b.org, b.id);
  assert.equal(b.submits, 1);
});
test("generation capability, unknown quote and cost ceiling stop before the paid boundary", async () => {
  for (const overrides of [
    { capabilities: ["voice"] as const },
    { quote: () => undefined },
    { quote: () => 2 },
    { quote: () => NaN },
  ]) {
    const f = fixture(overrides as Partial<GenerationProvider>);
    await assert.rejects(f.lifecycle.submit(f.org, f.id));
    assert.equal(f.submits, 0);
    assert.equal(f.record.state, "QUEUED");
  }
});
test("cancellation requires provider confirmation and a completed race retains the billable result", async () => {
  const queued = fixture();
  await queued.lifecycle.cancel(queued.org, queued.id);
  await queued.lifecycle.submit(queued.org, queued.id);
  assert.equal(queued.submits, 0);
  assert.equal(queued.record.state, "CANCELED");
  const pending = fixture();
  await pending.lifecycle.submit(pending.org, pending.id);
  await pending.lifecycle.cancel(pending.org, pending.id);
  assert.equal(pending.record.state, "CANCEL_REQUESTED");
  await pending.lifecycle.poll(pending.org, pending.id);
  assert.equal(pending.record.state, "OUTPUT_READY");
  const confirmed = fixture({
    async cancel() {
      return true;
    },
  });
  await confirmed.lifecycle.submit(confirmed.org, confirmed.id);
  await confirmed.lifecycle.cancel(confirmed.org, confirmed.id);
  assert.equal(confirmed.record.state, "CANCELED");
  assert.equal(confirmed.record.actualCostUsd, undefined);
});
test("poll transport errors retry only polling and malformed output cannot become ready", async () => {
  let polls = 0;
  const f = fixture({
    async poll() {
      polls++;
      if (polls === 1) throw Error("timeout");
      return { state: "succeeded", outputRef: "ok", actualCostUsd: 0.7 };
    },
  });
  await f.lifecycle.submit(f.org, f.id);
  await f.lifecycle.poll(f.org, f.id);
  assert.equal(f.record.state, "PENDING");
  await f.lifecycle.poll(f.org, f.id);
  assert.equal(f.record.actualCostUsd, 0.7);
  assert.equal(f.submits, 1);
  const invalid = fixture({
    async poll() {
      return { state: "succeeded", outputRef: "", actualCostUsd: -1 };
    },
  });
  await invalid.lifecycle.submit(invalid.org, invalid.id);
  await invalid.lifecycle.poll(invalid.org, invalid.id);
  assert.equal(invalid.record.state, "PENDING");
});
test("generation payloads retain targeted revision, reject rights/component mismatch and isolate replay", async () => {
  const f = fixture();
  assertGenerationReplay(f.record, f.org, f.request);
  assert.throws(() =>
    assertGenerationReplay(f.record, randomUUID(), f.request),
  );
  assert.throws(() =>
    assertGenerationReplay(f.record, f.org, {
      ...f.request,
      prompt: "Different scene",
    }),
  );
  assert.throws(() =>
    generationRequestSchema.parse({ ...f.request, rightsConfirmed: false }),
  );
  const target = {
    contentId: randomUUID(),
    revision: 3,
    sceneId: "scene-2",
    component: "visual" as const,
  };
  assert.equal(
    generationRequestSchema.parse({ ...f.request, target }).target?.revision,
    3,
  );
  assert.throws(() =>
    generationRequestSchema.parse({ ...f.request, kind: "voice", target }),
  );
  await assert.rejects(f.lifecycle.submit(randomUUID(), f.id));
  assert.equal(f.submits, 0);
});
