import "../support/isolated";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { actor, base, db, until } from "../support/http";
import { captureResearchSnapshot } from "../../packages/core/research-context";

const orgs: string[] = [], users: string[] = [];
const redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
const queue = new Queue("marketing-ai", { connection: redis as any });
after(async () => {
  await queue.resume(); await queue.close(); await redis.quit();
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  await db.user.deleteMany({ where: { id: { in: users } } }); await db.$disconnect();
});
async function workspace(name: string) {
  const org = await db.organization.create({ data: { name } }); orgs.push(org.id);
  const owner = await actor(org.id); users.push(owner.id);
  await db.brandBrain.create({ data: { organizationId: org.id, profile: { name, audience: "Synthetic audience" }, creativeDna: {} } });
  return { org, owner, root: `/workspaces/${org.id}` };
}
function input(title: string) { return { title, category: "AUDIENCE" as const, temporalScope: "CURRENT" as const,
  summary: `Synthetic evidence: ${title}`, sourceUrl: "https://public.org/" + encodeURIComponent(title),
  sourceLabel: "Synthetic source", observedAt: new Date(Date.now() - 60000).toISOString(),
  market: "India", language: "English", authorizedSource: true }; }
async function accepted(w: Awaited<ReturnType<typeof workspace>>, title: string) {
  const record = await w.owner.call(w.root + "/research", "POST", input(title)); assert.equal(record.status, 201);
  const review = await w.owner.call(w.root + `/research/${record.body.id}/review`, "POST", {
    expectedRevision: 1, decision: "ACCEPTED", sourcesReviewed: true, note: "Synthetic source and observation reviewed.",
  }); assert.equal(review.status, 201); return review.body;
}
async function enqueue(w: Awaited<ReturnType<typeof workspace>>, label: string, task = "strategy") {
  const data = { task, requestKey: randomUUID(), prompt: `Synthetic research integration ${label} ${randomUUID()}` };
  const result = await w.owner.call(w.root + "/ai/jobs", "POST", data); assert.equal(result.status, 201);
  return { job: result.body, data };
}
async function result(w: Awaited<ReturnType<typeof workspace>>, id: string, prompt: string) {
  const job = await until(() => db.aIJob.findUniqueOrThrow({ where: { id } }), j => ["SUCCEEDED", "FAILED"].includes(j.status), 30000);
  assert.equal(job.status, "SUCCEEDED", job.error || "");
  const trace = await w.owner.call(w.root + `/ai/jobs/${id}/trace`); assert.equal(trace.status, 200);
  const response = await fetch("http://127.0.0.1:4999/research-input?prompt=" + encodeURIComponent(prompt));
  assert.equal(response.status, 200);
  const sent = await response.json();
  assert.deepEqual(sent.research, trace.body.frozenContext.brand.research);
  const step = trace.body.steps.find((s: any) => s.role === "research");
  assert.deepEqual(step.output.inputs.externalEvidence, sent.research);
  assert.match(sent.system, /untrusted data/); assert.match(sent.system, /research gaps/);
  return { trace: trace.body, sent, job };
}

test("strategy queue captures only this workspace's accepted evidence and sends identical citations to provider and trace", async () => {
  const w = await workspace("Strategy research fixture"), other = await workspace("Other strategy research fixture");
  const record = await accepted(w, "Eligible synthetic observation");
  const foreign = await accepted(other, "Private other-tenant observation");
  await w.owner.call(w.root + "/research", "POST", input("Unreviewed observation"));
  await queue.pause();
  const requested = await enqueue(w, "current");
  const saved = await db.aIJob.findUniqueOrThrow({ where: { id: requested.job.id } });
  const snapshot = (saved.brandContext as any).researchSnapshot;
  assert.deepEqual(snapshot.evidence.map((r: any) => r.id), [record.id]);
  assert.equal(snapshot.organizationId, w.org.id);
  const replay = await w.owner.call(w.root + "/ai/jobs", "POST", requested.data);
  assert.equal(replay.body.id, requested.job.id);
  assert.deepEqual((await db.aIJob.findUniqueOrThrow({ where: { id: requested.job.id } })).brandContext, saved.brandContext);
  assert.equal((await other.owner.call(w.root + `/ai/jobs/${requested.job.id}/trace`)).status, 404);
  assert.equal((await w.owner.call(w.root + "/ai/jobs", "POST", { ...requested.data, requestKey: randomUUID(), researchSnapshot: snapshot })).status, 400);
  await queue.resume();
  const { sent } = await result(w, requested.job.id, requested.data.prompt);
  assert.equal(sent.research.status, "AVAILABLE"); assert.equal(sent.research.evidence[0].sourceUrl, record.sourceUrl);
  assert.equal(sent.research.evidence[0].revision, record.revision);
  assert.ok(!JSON.stringify(sent.research).includes(foreign.id));
  const exported = await fetch(base + w.root + "/operations/export", { headers: w.owner.headers });
  assert.equal(exported.status, 200);
  const rows = (await exported.text()).trim().split("\n").map(line => JSON.parse(line));
  const exportedJob = rows.find(row => row.type === "aiJob" && row.data.id === requested.job.id);
  assert.deepEqual(exportedJob.data.brandContext.researchSnapshot, snapshot);
  assert.equal("runToken" in exportedJob.data, false);
});

test("queued strategy retains frozen versions and excludes edited or rejected evidence before actual generation", async () => {
  const w = await workspace("Changed strategy evidence fixture");
  const kept = await accepted(w, "Keep this observation"), edited = await accepted(w, "Edit this observation"), rejected = await accepted(w, "Reject this observation");
  await queue.pause(); const requested = await enqueue(w, "changed");
  const before = await db.aIJob.findUniqueOrThrow({ where: { id: requested.job.id } });
  assert.equal((before.brandContext as any).researchSnapshot.evidence.length, 3);
  assert.equal((await w.owner.call(w.root + `/research/${edited.id}`, "PUT", { ...input("New uncaptured observation text"), expectedRevision: 2 })).status, 200);
  assert.equal((await w.owner.call(w.root + `/research/${rejected.id}/review`, "POST", { expectedRevision: 2, decision: "REJECTED", note: "Withdraw synthetic evidence.", sourcesReviewed: true })).status, 201);
  assert.deepEqual((await db.aIJob.findUniqueOrThrow({ where: { id: requested.job.id } })).brandContext, before.brandContext);
  await queue.resume();
  const { sent } = await result(w, requested.job.id, requested.data.prompt);
  assert.deepEqual(sent.research.evidence.map((r: any) => r.id), [kept.id]);
  assert.equal(sent.research.excluded.length, 2);
  assert.ok(!JSON.stringify(sent.research).includes("New uncaptured observation text"));
});

test("delayed, empty and legacy strategy jobs disclose missing evidence without acquiring newer observations", async () => {
  const w = await workspace("Delayed evidence fixture"), empty = await workspace("No research fixture");
  const current = await accepted(w, "Current observation not available to legacy job");
  const past = new Date(Date.now() - 31 * 86400000);
  const old = await db.researchRecord.create({ data: { ...input("Expired queued observation"), organizationId: w.org.id,
    createdBy: w.owner.id, reviewStatus: "ACCEPTED", reviewedBy: w.owner.id, reviewNote: "Synthetic historical queue receipt",
    observedAt: new Date(past.getTime() - 86400000), collectedAt: new Date(past.getTime() - 3600000), reviewedAt: new Date(past.getTime() - 60000) } });
  const oldSnapshot = captureResearchSnapshot(w.org.id, [old], past); assert.equal(oldSnapshot.evidence.length, 1);
  await queue.pause(); const delayed = await enqueue(w, "expired");
  const queued = await db.aIJob.findUniqueOrThrow({ where: { id: delayed.job.id } });
  await db.aIJob.update({ where: { id: queued.id }, data: { createdAt: past,
    brandContext: { ...(queued.brandContext as any), researchSnapshot: oldSnapshot } } });
  const legacyPrompt = "Synthetic legacy strategy " + randomUUID();
  const legacy = await db.aIJob.create({ data: { organizationId: w.org.id, actorId: w.owner.id, task: "strategy",
    requestKey: randomUUID(), input: { prompt: legacyPrompt }, brandContext: { revision: 1, profile: {}, creativeDna: {}, approvedContent: [] } } });
  const absent = await enqueue(empty, "empty"); await queue.resume();
  const staleResult = await result(w, delayed.job.id, delayed.data.prompt);
  assert.equal(staleResult.sent.research.status, "MISSING"); assert.equal(staleResult.sent.research.excluded[0].reason, "STALE");
  const legacyResult = await result(w, legacy.id, legacyPrompt);
  assert.equal(legacyResult.sent.research.reason, "LEGACY_NOT_CAPTURED");
  assert.ok(!JSON.stringify(legacyResult.sent.research).includes(current.id));
  assert.equal((await result(empty, absent.job.id, absent.data.prompt)).sent.research.reason, "NO_ELIGIBLE_EVIDENCE");
  const content = await enqueue(w, "content is separate", "content");
  await until(() => db.aIJob.findUniqueOrThrow({ where: { id: content.job.id } }), j => j.status === "SUCCEEDED", 30000);
  const contentInput = await (await fetch("http://127.0.0.1:4999/research-input?prompt=" + encodeURIComponent(content.data.prompt))).json();
  assert.equal(contentInput.research, null);
  assert.ok(!contentInput.system.includes("Return 1–12 recommendations"));
});

test("strategy enqueue rechecks current writer membership before capturing private research", async () => {
  const w = await workspace("Revoked generation role fixture");
  await accepted(w, "Research not available after role revocation");
  const { AIController } = createRequire(import.meta.url)("../../dist/apps/api/src/ai.js");
  const controller = new AIController(db, {});
  const staleRequest = { organizationId: w.org.id, userId: w.owner.id, role: "OWNER" };
  await db.membership.update({ where: { userId_organizationId: { userId: w.owner.id, organizationId: w.org.id } }, data: { role: "ANALYST" } });
  await assert.rejects(() => controller.create(staleRequest, { task: "strategy", requestKey: randomUUID(), prompt: "Do not generate after writer-role removal" }),
    (error: any) => error.getStatus?.() === 403);
  assert.equal(await db.aIJob.count({ where: { organizationId: w.org.id } }), 0);
});
