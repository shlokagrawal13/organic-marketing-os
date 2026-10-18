import "../support/isolated";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { actor, base, db, until } from "../support/http";
import { captureResearchSnapshot } from "../../packages/core/research-context";
import { competitorInsight, searchInsight, audienceInsight, communityInsight, seasonalInsight } from "../support/research-insight";
import { resetFixtureRateBudget } from "../support/fixture-rate-budget";

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

test("audience/community/seasonal insights retain scoped assumptions in provider, three agent traces, replay and exported history", async () => {
  await resetFixtureRateBudget();
  const w = await workspace("Audience/community strategy fixture"), other = await workspace("Private community fixture");
  const sources: any[] = [];
  for (const insight of [audienceInsight(), communityInsight(), seasonalInsight()]) {
    const created = await w.owner.call(w.root + "/research", "POST", { ...input(insight.kind), category: insight.kind, insight });assert.equal(created.status, 201);
    const reviewed = await w.owner.call(w.root + `/research/${created.body.id}/review`, "POST", { expectedRevision: 1, decision: "ACCEPTED", sourcesReviewed: true, note: "Reviewed synthetic source, scope and assumptions." });
    assert.equal(reviewed.status, 201);sources.push(reviewed.body);
  }
  const privateSource = await other.owner.call(other.root + "/research", "POST", { ...input("Private community source"), category: "COMMUNITY", insight: { ...communityInsight(), topic: "Private tenant interaction theme" } });
  assert.equal(privateSource.status, 201);
  assert.equal((await other.owner.call(other.root + `/research/${privateSource.body.id}/review`, "POST", { expectedRevision: 1, decision: "ACCEPTED", sourcesReviewed: true, note: "Reviewed synthetic private source." })).status, 201);
  await queue.pause();const requested = await enqueue(w, "audience-community");
  const saved = await db.aIJob.findUniqueOrThrow({ where: { id: requested.job.id } });
  assert.equal((saved.brandContext as any).researchSnapshot.evidence.length, 3);
  assert.equal((await w.owner.call(w.root + "/ai/jobs", "POST", requested.data)).body.id, requested.job.id);
  await queue.resume();const done = await result(w, requested.job.id, requested.data.prompt);
  for (const source of sources) assert.deepEqual(done.sent.research.evidence.find((e: any) => e.id === source.id).insight, source.insight);
  for (const role of ["research", "audience", "community-intelligence"])
    assert.deepEqual(done.trace.steps.find((s: any) => s.role === role).output.inputs.externalEvidence, done.sent.research);
  assert.match(done.sent.system, /Unknown dates or zones require verification/);assert.match(done.sent.system, /not population-wide facts/);assert.ok(!JSON.stringify(done.sent).includes("Private tenant interaction theme"));
  assert.equal((await other.owner.call(w.root + `/ai/jobs/${requested.job.id}/trace`)).status, 404);
  await queue.pause();const delayed = await enqueue(w, "community-edited-before-generation");
  const changed = await w.owner.call(w.root + `/research/${sources[1].id}`, "PUT", { ...input(sources[1].title), category: "COMMUNITY",
    insight: { ...communityInsight(), assumptions: "Edited scope after capture" }, expectedRevision: 2 });
  assert.equal(changed.status, 200);assert.equal(changed.body.reviewStatus, "UNREVIEWED");
  await queue.resume();const checked = await result(w, delayed.job.id, delayed.data.prompt);
  assert.deepEqual(checked.sent.research.evidence.map((e: any) => e.id).sort(), [sources[0].id, sources[2].id].sort());
  assert.ok(checked.sent.research.excluded.some((e: any) => e.id === sources[1].id));
  const trace = await w.owner.call(w.root + `/ai/jobs/${requested.job.id}/trace`);
  assert.deepEqual(trace.body.frozenContext.brand.research, done.sent.research);
  const exported = await fetch(base + w.root + "/operations/export", { headers: w.owner.headers });assert.equal(exported.status, 200);
  const rows = (await exported.text()).trim().split("\n").map(s => JSON.parse(s));
  assert.deepEqual(rows.find(r => r.type === "research" && r.data.id === sources[1].id).data.insight, changed.body.insight);
  assert.deepEqual(rows.find(r => r.type === "aiJob" && r.data.id === requested.job.id).data.brandContext, saved.brandContext);
  assert.deepEqual(rows.find(r => r.type === "aiAgentRun" && r.data.jobId === requested.job.id).data.frozenContext.brand.research, done.sent.research);
});

test("structured insights reach the actual strategy provider and frozen trace, retain export and exclude later edits", async () => {
  const w = await workspace("Structured strategy fixture"), other = await workspace("Private insight fixture");
  const records: any[] = [];
  for (const insight of [competitorInsight(), searchInsight()]) {
    const created = await w.owner.call(w.root + "/research", "POST", { ...input(insight.kind), category: insight.kind, insight });
    assert.equal(created.status, 201);
    const reviewed = await w.owner.call(w.root + `/research/${created.body.id}/review`, "POST", {
      expectedRevision: 1, decision: "ACCEPTED", sourcesReviewed: true, note: "Reviewed synthetic source and analyst interpretation.",
    }); assert.equal(reviewed.status, 201); records.push(reviewed.body);
  }
  const privateSource = await other.owner.call(other.root + "/research", "POST", { ...input("Private competitor"), category: "COMPETITOR", insight: { ...competitorInsight(), subject: "Private tenant subject" } });
  assert.equal(privateSource.status, 201);
  assert.equal((await other.owner.call(other.root + `/research/${privateSource.body.id}/review`, "POST", {
    expectedRevision: 1, decision: "ACCEPTED", sourcesReviewed: true, note: "Reviewed private synthetic analysis.",
  })).status, 201);
  await queue.pause(); const first = await enqueue(w, "structured-insights");
  const saved = await db.aIJob.findUniqueOrThrow({ where: { id: first.job.id } });
  assert.equal((saved.brandContext as any).researchSnapshot.evidence.length, 2);
  assert.equal((await w.owner.call(w.root + "/ai/jobs", "POST", first.data)).body.id, first.job.id);
  await queue.resume(); const completed = await result(w, first.job.id, first.data.prompt);
  for (const record of records) assert.deepEqual(completed.sent.research.evidence.find((s: any) => s.id === record.id).insight, record.insight);
  assert.match(completed.sent.system, /without copying/); assert.match(completed.sent.system, /not measured search demand/);
  assert.ok(!JSON.stringify(completed.sent).includes("Private tenant subject"));
  assert.equal((await other.owner.call(w.root + `/ai/jobs/${first.job.id}/trace`)).status, 404);
  await queue.pause(); const queued = await enqueue(w, "insight-withdrawal");
  const record = records[0];
  const edit = await w.owner.call(w.root + `/research/${record.id}`, "PUT", { ...input(record.title), category: record.category,
    insight: { ...record.insight, differentiation: "New original synthetic direction" }, expectedRevision: 2 });
  assert.equal(edit.status, 200); assert.equal(edit.body.reviewStatus, "UNREVIEWED");
  await queue.resume(); const afterEdit = await result(w, queued.job.id, queued.data.prompt);
  assert.deepEqual(afterEdit.sent.research.evidence.map((s: any) => s.id), [records[1].id]);
  assert.ok(afterEdit.sent.research.excluded.some((s: any) => s.id === record.id));
  const originalTrace = await w.owner.call(w.root + `/ai/jobs/${first.job.id}/trace`);
  assert.deepEqual(originalTrace.body.frozenContext.brand.research, completed.sent.research);
  const exported = await fetch(base + w.root + "/operations/export", { headers: w.owner.headers });
  assert.equal(exported.status, 200);
  const rows = (await exported.text()).trim().split("\n").map(s => JSON.parse(s));
  assert.deepEqual(rows.find(r => r.type === "research" && r.data.id === record.id).data.insight, edit.body.insight);
  assert.deepEqual(rows.find(r => r.type === "aiJob" && r.data.id === first.job.id).data.brandContext, saved.brandContext);
  assert.deepEqual(rows.find(r => r.type === "aiAgentRun" && r.data.jobId === first.job.id).data.frozenContext.brand.research, completed.sent.research);
});

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

test("strategy filters constrain the pre-limit query, freeze canonical choices, replay safely and disclose unmatched research", async () => {
  const w = await workspace("Selection fixture"), other = await workspace("Foreign selection fixture");
  const kept = await accepted(w, "Selected observation");
  await accepted(other, "Foreign matching observation");
  // A hundred newer mismatches must not crowd the matching source out of the query.
  await db.researchRecord.createMany({ data: Array.from({ length: 101 }, (_, i) => ({ ...input(`Different market ${i}`),
    organizationId: w.org.id, createdBy: w.owner.id, market: "US", observedAt: new Date() })) });
  const data = { requestKey: randomUUID(), task: "strategy", prompt: "Synthetic explicit selection " + randomUUID(),
    researchSelection: { categories: ["AUDIENCE"], market: " India ", language: " ENGLISH " } };
  await queue.pause();
  const posted = await w.owner.call(w.root + "/ai/jobs", "POST", data);assert.equal(posted.status, 201);
  const saved = await db.aIJob.findUniqueOrThrow({ where: { id: posted.body.id } });
  const selection = { categories: ["AUDIENCE"], market: "india", language: "english" };
  assert.deepEqual((saved.brandContext as any).researchSnapshot.selection, selection);
  assert.deepEqual((saved.brandContext as any).researchSnapshot.evidence.map((x: any) => x.id), [kept.id]);
  assert.deepEqual((saved.input as any).researchSelection, selection);
  assert.equal((await w.owner.call(w.root + "/ai/jobs", "POST", { ...data, researchSelection: selection })).body.id, saved.id);
  assert.equal((await w.owner.call(w.root + "/ai/jobs", "POST", { ...data, researchSelection: { ...selection, market: "US" } })).status, 409);
  assert.equal((await w.owner.call(w.root + "/ai/jobs", "POST", { ...data, task: "content", requestKey: randomUUID() })).status, 400);
  assert.equal((await w.owner.call(w.root + "/ai/jobs", "POST", { ...data, requestKey: randomUUID(), researchSelection: { ...selection, sourceIds: [kept.id] } })).status, 400);
  assert.equal((await w.owner.call(w.root + "/ai/jobs", "POST", { ...data, requestKey: randomUUID(), researchSelection: { ...selection, market: "İ".repeat(100) } })).status, 400);
  const analyst = await actor(w.org.id, "ANALYST");users.push(analyst.id);
  assert.equal((await analyst.call(w.root + "/ai/jobs", "POST", { ...data, requestKey: randomUUID() })).status, 403);
  await queue.resume();
  const completed = await result(w, saved.id, data.prompt);
  assert.deepEqual(completed.sent.research.selection, selection);
  assert.deepEqual(completed.sent.research.evidence.map((x: any) => x.id), [kept.id]);
  const emptyData = { ...data, requestKey: randomUUID(), prompt: "Synthetic missing filtered evidence " + randomUUID(),
    researchSelection: { ...selection, language: "Hindi" } };
  const empty = await w.owner.call(w.root + "/ai/jobs", "POST", emptyData);assert.equal(empty.status, 201);
  const absent = await result(w, empty.body.id, emptyData.prompt);
  assert.equal(absent.sent.research.status, "MISSING");assert.equal(absent.sent.research.selection.language, "hindi");
  // Literal wildcard labels: neither a wildcard match nor another tenant may supply evidence.
  await db.researchRecord.update({ where: { id: kept.id }, data: { market: "A_%\\B" } });
  const literalData = { ...data, requestKey: randomUUID(), prompt: "Synthetic literal filters " + randomUUID(),
    researchSelection: { ...selection, market: "a_%\\b" } };
  const literal = await w.owner.call(w.root + "/ai/jobs", "POST", literalData);assert.equal(literal.status, 201);
  assert.deepEqual((await db.aIJob.findUniqueOrThrow({ where: { id: literal.body.id } })).brandContext &&
    ((await db.aIJob.findUniqueOrThrow({ where: { id: literal.body.id } })).brandContext as any).researchSnapshot.evidence.map((x: any) => x.id), [kept.id]);
  await result(w, literal.body.id, literalData.prompt);
  const exported = await fetch(base + w.root + "/operations/export", { headers: w.owner.headers });
  const rows = (await exported.text()).trim().split("\n").map(x => JSON.parse(x));
  assert.deepEqual(rows.find(x => x.type === "aiJob" && x.data.id === saved.id).data.brandContext.researchSnapshot.selection, selection);
});

test("bounded coverage reaches the actual provider, preserves capture history and reports later category gaps without tenant leakage", async () => {
  const w = await workspace("Coverage fixture"), foreign = await workspace("Private coverage fixture");
  const kept = await accepted(w, "Coverage source retained"), withdrawn = await accepted(w, "Coverage source changed after capture");
  await db.researchRecord.update({ where: { id: withdrawn.id }, data: { category: "SEARCH" } });
  await w.owner.call(w.root + "/research", "POST", input("Unreviewed coverage observation"));
  await accepted(foreign, "Foreign coverage must not be counted");
  const data = { requestKey: randomUUID(), task: "strategy", prompt: "Synthetic coverage context " + randomUUID(),
    researchSelection: { categories: ["AUDIENCE", "SEARCH"], market: "India", language: "English" } };
  await queue.pause();
  const posted = await w.owner.call(w.root + "/ai/jobs", "POST", data);assert.equal(posted.status, 201);
  const saved = await db.aIJob.findUniqueOrThrow({ where: { id: posted.body.id } }), snapshot = (saved.brandContext as any).researchSnapshot;
  assert.equal(snapshot.coverage.examined, 3);assert.equal(snapshot.coverage.eligible, 2);
  assert.equal(snapshot.coverage.rejected.reviewRequired, 1);assert.equal(snapshot.coverage.candidateWindowTruncated, false);
  assert.equal((await w.owner.call(w.root + `/research/${withdrawn.id}/review`, "POST", { expectedRevision: 2, decision: "REJECTED", sourcesReviewed: true, note: "Withdraw synthetic coverage source." })).status, 201);
  assert.equal((await w.owner.call(w.root + "/ai/jobs", "POST", data)).body.id, saved.id);
  await queue.resume();
  const { sent, trace } = await result(w, saved.id, data.prompt);
  assert.deepEqual(sent.research.coverage.capture, snapshot.coverage);
  assert.deepEqual(sent.research.coverage.availableByCategory, [{ category: "AUDIENCE", sources: 1 }, { category: "SEARCH", sources: 0 }]);
  assert.deepEqual(sent.research.evidence.map((x: any) => x.id), [kept.id]);
  assert.equal((await foreign.owner.call(w.root + `/ai/jobs/${saved.id}/trace`)).status, 404);
  const exported = await fetch(base + w.root + "/operations/export", { headers: w.owner.headers });
  const rows = (await exported.text()).trim().split("\n").map(x => JSON.parse(x));
  assert.deepEqual(rows.find(x => x.type === "aiJob" && x.data.id === saved.id).data.brandContext.researchSnapshot.coverage, snapshot.coverage);
  assert.deepEqual(rows.find(x => x.type === "aiAgentRun" && x.data.jobId === saved.id).data.frozenContext.brand.research.coverage, trace.frozenContext.brand.research.coverage);

  // 101 matching records require a lookahead flag; only the newest 100 are assessed.
  await db.researchRecord.createMany({ data: Array.from({ length: 101 }, (_, index) => ({ ...input(`Bounded pending ${index}`),
    organizationId: w.org.id, createdBy: w.owner.id, observedAt: new Date() })) });
  const limitedData = { ...data, requestKey: randomUUID(), prompt: "Synthetic bounded coverage window " + randomUUID() };
  const limited = await w.owner.call(w.root + "/ai/jobs", "POST", limitedData);assert.equal(limited.status, 201);
  const limitResult = await result(w, limited.body.id, limitedData.prompt);
  assert.equal(limitResult.sent.research.coverage.capture.candidateWindowTruncated, true);
  assert.equal(limitResult.sent.research.coverage.capture.examined, 100);
  assert.equal(limitResult.sent.research.coverage.capture.rejected.reviewRequired, 100);
  assert.equal(limitResult.sent.research.coverage.capture.eligible, 0);
  assert.equal(limitResult.sent.research.status, "MISSING");
});
