import "../support/isolated";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { actor, base, db, until } from "../support/http";
import { captureResearchSnapshot, resolveResearchContext } from "../../packages/core/research-context";
import { reviewStrategyReferences } from "../../packages/core/strategy-references";
const orgs: string[] = [], users: string[] = [];
after(async () => { await db.organization.deleteMany({ where: { id: { in: orgs } } }); await db.user.deleteMany({ where: { id: { in: users } } }); await db.$disconnect(); });
async function workspace(withEvidence = true) {
  const org = await db.organization.create({ data: { name: "Synthetic citation fixture" } });orgs.push(org.id);
  const owner = await actor(org.id);users.push(owner.id);const root = `/workspaces/${org.id}`;
  await db.brandBrain.create({ data: { organizationId: org.id, profile: { name: "Synthetic brand", audience: "Synthetic audience" }, creativeDna: {} } });
  const input = { title: "Synthetic citation source", category: "AUDIENCE", temporalScope: "CURRENT", summary: "Synthetic audience asked for a clear example; this is test evidence only.",
    sourceUrl: "https://public.org/citation-fixture", sourceLabel: "Synthetic publication", observedAt: new Date(Date.now() - 60000).toISOString(), market: "India", language: "English", authorizedSource: true };
  let source: any;
  if (withEvidence) {
    const created = await owner.call(root + "/research", "POST", input);assert.equal(created.status, 201);
    const accepted = await owner.call(root + `/research/${created.body.id}/review`, "POST", { expectedRevision: 1, decision: "ACCEPTED", sourcesReviewed: true, note: "Synthetic reviewed observation." });assert.equal(accepted.status, 201);source = accepted.body;
  }
  return { org, owner, root, source, input };
}
async function generate(w: Awaited<ReturnType<typeof workspace>>, prefix = "Valid citations:") {
  const prompt = prefix + " synthetic strategy " + randomUUID();
  const queued = await w.owner.call(w.root + "/ai/jobs", "POST", { task: "strategy", requestKey: randomUUID(), prompt });assert.equal(queued.status, 201);
  const job = await until(() => db.aIJob.findUniqueOrThrow({ where: { id: queued.body.id } }), row => ["SUCCEEDED", "FAILED"].includes(row.status), 30000);assert.equal(job.status, "SUCCEEDED", job.error || "");
  const trace = await w.owner.call(w.root + `/ai/jobs/${job.id}/trace`);assert.equal(trace.status, 200);
  return { job, trace: trace.body };
}
const reviewPath = (w: Awaited<ReturnType<typeof workspace>>, id: string) => w.root + `/ai/jobs/${id}/review`;

test("actual strategy provider references reach trace, canonical citations and tenant/role-bound approval", async () => {
  const w = await workspace(), foreign = await workspace(false);const otherJob = await generate(foreign);const { job, trace } = await generate(w);
  const citations = trace.finalReview.citationReview;
  assert.equal(citations.passed, true);assert.equal(citations.recommendations[0].references[0].sourceId, w.source.id);
  assert.equal(citations.recommendations[0].references[0].sourceUrl, w.source.sourceUrl);
  assert.deepEqual((job.output as any).recommendations[0].sourceRefs[0], { sourceId: w.source.id, revision: 2, quote: w.source.summary });
  assert.equal((await foreign.owner.call(reviewPath(w, job.id), "POST", { decision: "approve" })).status, 404);
  const editor = await actor(w.org.id, "CREATOR");users.push(editor.id);
  assert.equal((await editor.call(reviewPath(w, job.id), "POST", { decision: "approve" })).status, 403);
  assert.equal((await w.owner.call(reviewPath(w, job.id), "POST", { decision: "approve", citationReview: { passed: true } })).status, 400);
  const approved = await w.owner.call(reviewPath(w, job.id), "POST", { decision: "approve", note: "Synthetic relevance and assumptions reviewed" });assert.equal(approved.status, 201);
  const saved = await db.aIAgentRun.findUniqueOrThrow({ where: { jobId: job.id } });assert.equal(saved.state, "APPROVED");
  assert.ok((saved.finalReview as any).sourceApprovalRevalidatedAt);assert.equal((saved.finalReview as any).citationReview.passed, true);
  const exported = await fetch(base + w.root + "/operations/export", { headers: w.owner.headers });assert.equal(exported.status, 200);
  const records = (await exported.text()).trim().split("\n").map(line => JSON.parse(line));
  assert.deepEqual(records.find(row => row.type === "aiAgentRun" && row.data.id === saved.id).data.finalReview, saved.finalReview);
  assert.deepEqual(records.find(row => row.type === "aiJob" && row.data.id === job.id).data.output, job.output);
  assert.ok(records.some(row => row.type === "aiAgentStep" && row.data.runId === saved.id));
  assert.ok(!records.some(row => row.type === "aiAgentRun" && row.data.organizationId !== w.org.id));
  assert.ok(!records.some(row => row.type === "aiAgentStep" && row.data.runId === otherJob.trace.id));
});
test("unknown, fabricated and missing provider references remain reviewable but cannot be approved", async () => {
  const w = await workspace();
  for (const [prefix, code] of [["REF_UNKNOWN:", "UNKNOWN_SOURCE"], ["REF_QUOTE:", "QUOTE_NOT_FOUND"], ["REF_MISSING:", "MISSING_RECOMMENDATIONS"]]) {
    const { job, trace } = await generate(w, prefix);assert.equal(trace.finalReview.passed, false);
    assert.ok(JSON.stringify(trace.finalReview.citationReview).includes(code));
    assert.equal((await w.owner.call(reviewPath(w, job.id), "POST", { decision: "approve" })).status, 409);
    // Legacy/inconsistent saved metadata must not bypass recomputation from frozen output/context.
    await db.aIAgentRun.update({ where: { jobId: job.id }, data: { finalReview: { ...trace.finalReview, passed: true, citationReview: { passed: true } } } });
    assert.equal((await w.owner.call(reviewPath(w, job.id), "POST", { decision: "approve" })).status, 409);
    assert.equal((await w.owner.call(reviewPath(w, job.id), "POST", { decision: "reject" })).status, 201);
  }
});
test("approval rechecks cited edits/withdrawal but permits changes to uncited observations", async () => {
  for (const action of ["edit", "withdraw", "uncited"]) {
    const w = await workspace();let uncited: any;
    if (action === "uncited") {
      uncited = await db.researchRecord.create({ data: { ...w.input, title: "Older uncited synthetic observation", organizationId: w.org.id, createdBy: w.owner.id,
        observedAt: new Date(w.input.observedAt), collectedAt: new Date(Date.now() - 1000), reviewedAt: new Date(), reviewedBy: w.owner.id, reviewStatus: "ACCEPTED", reviewNote: "Synthetic fixture source reviewed", updatedAt: new Date(Date.now() - 10000) } });
    }
    const { job, trace } = await generate(w);assert.equal(trace.finalReview.passed, true);
    assert.equal((job.output as any).recommendations[0].sourceRefs[0].sourceId, w.source.id);
    const target = action === "uncited" ? uncited : w.source;
    const changed = action === "withdraw" ? await w.owner.call(w.root + `/research/${target.id}/review`, "POST", { expectedRevision: 2, decision: "REJECTED", sourcesReviewed: true, note: "Withdraw synthetic observation" })
      : await w.owner.call(w.root + `/research/${target.id}`, "PUT", { ...w.input, summary: "Edited synthetic observation after generation", expectedRevision: target.revision });
    assert.ok([200, 201].includes(changed.status));
    assert.equal((await w.owner.call(reviewPath(w, job.id), "POST", { decision: "approve" })).status, action === "uncited" ? 201 : 409);
  }
});
test("expired historical results and stale reviewer roles cannot bypass approval; explicit assumptions stay usable", async () => {
  const w = await workspace();const { job, trace } = await generate(w);
  // Deterministic historical completed-job fixture: model a month passing without sleeping.
  const past = new Date(Date.now() - 31 * 86400000);
  const old = await db.researchRecord.update({ where: { id: w.source.id }, data: { observedAt: new Date(past.getTime() - 60000), collectedAt: new Date(past.getTime() - 50000), reviewedAt: new Date(past.getTime() - 40000) } });
  const snapshot = captureResearchSnapshot(w.org.id, [old], past);const research = resolveResearchContext(snapshot, w.org.id, [old], past);
  assert.equal(reviewStrategyReferences(job.output as any, research, w.org.id, past).passed, true);
  await db.aIAgentRun.update({ where: { jobId: job.id }, data: { frozenContext: { ...trace.frozenContext, brand: { ...trace.frozenContext.brand, research } } } });
  assert.equal((await w.owner.call(reviewPath(w, job.id), "POST", { decision: "approve" })).status, 409);
  const empty = await workspace(false);const assumption = await generate(empty);
  assert.equal(assumption.trace.finalReview.citationReview.recommendations[0].status, "ASSUMPTION");
  const { AIController } = createRequire(import.meta.url)("../../dist/apps/api/src/ai.js");const controller = new AIController(db, {});
  await db.membership.update({ where: { userId_organizationId: { userId: empty.owner.id, organizationId: empty.org.id } }, data: { role: "CREATOR" } });
  await assert.rejects(() => controller.reviewAgentRun({ userId: empty.owner.id, organizationId: empty.org.id, role: "OWNER" }, assumption.job.id, { decision: "approve" }), (error: any) => error.getStatus?.() === 403);
  await db.membership.update({ where: { userId_organizationId: { userId: empty.owner.id, organizationId: empty.org.id } }, data: { role: "OWNER" } });
  assert.equal((await empty.owner.call(reviewPath(empty, assumption.job.id), "POST", { decision: "approve" })).status, 201);
});
