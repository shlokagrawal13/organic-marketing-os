import "../support/isolated";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { db, actor, base } from "../support/http";
import { researchMaximumAgeMs } from "../../packages/core/research";
import { competitorInsight, searchInsight } from "../support/research-insight";

const orgs: string[] = [],
  users: string[] = [];
const input = () => ({
  title: "Synthetic research observation",
  category: "INDUSTRY",
  temporalScope: "CURRENT",
  summary: "Verification fixture, not a real market finding.",
  sourceUrl: "https://public.org/research#fixture",
  sourceLabel: "Synthetic public source",
  observedAt: new Date(Date.now() - 60000).toISOString(),
  market: "India",
  language: "English",
  authorizedSource: true,
});
const review = (expectedRevision: number, decision = "ACCEPTED") => ({
  expectedRevision,
  decision,
  note: "Synthetic source review for verification.",
  sourcesReviewed: true,
});
async function workspace(name: string) {
  const org = await db.organization.create({ data: { name } });
  orgs.push(org.id);
  const owner = await member(org.id);
  return { org, owner, path: `/workspaces/${org.id}/research` };
}
async function member(
  org: string,
  role: Parameters<typeof actor>[1] = "OWNER",
) {
  const user = await actor(org, role);
  users.push(user.id);
  return user;
}
after(async () => {
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});

test("structured research HTTP persists both insight kinds, rejects invalid input and invalidates review on insight-only edits", async () => {
  const w = await workspace("Structured insight fixture");
  for (const insight of [competitorInsight(), searchInsight()]) {
    const payload = { ...input(), category: insight.kind, insight };
    const created = await w.owner.call(w.path, "POST", payload);
    assert.equal(created.status, 201); assert.deepEqual(created.body.insight, insight);
    const path = `${w.path}/${created.body.id}`;
    const accepted = await w.owner.call(path + "/review", "POST", review(1));
    assert.equal(accepted.status, 201); assert.equal(accepted.body.eligibleForStrategy, true);
    const changed = { ...insight, assumptions: "Changed synthetic analysis; still unverified." };
    const edit = await w.owner.call(path, "PUT", { ...payload, insight: changed, expectedRevision: 2 });
    assert.equal(edit.status, 200); assert.equal(edit.body.revision, 3);
    assert.equal(edit.body.reviewStatus, "UNREVIEWED"); assert.equal(edit.body.reviewedAt, null);
    assert.deepEqual((await w.owner.call(path)).body.insight, changed);
    assert.equal((await w.owner.call(path, "PUT", { ...payload, expectedRevision: 2 })).status, 409);
    const removed = await w.owner.call(path, "PUT", { ...payload, insight: null, expectedRevision: 3 });
    assert.equal(removed.status, 200); assert.equal(removed.body.insight, null);
    // Corrupt stored insights must not receive acceptance even when citation freshness passes.
    await db.researchRecord.update({ where: { id: created.body.id }, data: { insight: { ...insight, measuredVolume: 1000 } } });
    const invalid = await w.owner.call(path);
    assert.equal(invalid.body.eligibleForStrategy, false); assert.ok(invalid.body.insightIssue);
    assert.equal((await w.owner.call(path + "/review", "POST", review(4))).status, 400);
  }
  for (const change of [{ category: "AUDIENCE", insight: searchInsight() }, { category: "SEARCH", insight: competitorInsight() },
    { category: "SEARCH", insight: { ...searchInsight(), demand: 1000 } }, { category: "COMPETITOR", insight: { ...competitorInsight(), differentiation: "" } }])
    assert.equal((await w.owner.call(w.path, "POST", { ...input(), ...change })).status, 400);
});

test("research HTTP routes enforce tenant membership, all writer/reviewer roles and strict input", async () => {
  const { org, owner, path } = await workspace("Research role fixture");
  const other = await workspace("Other research fixture");
  assert.equal((await fetch(base + path)).status, 401);
  const created = await owner.call(path, "POST", input());
  assert.equal(created.status, 201);
  assert.equal(created.body.sourceUrl, "https://public.org/research");
  const recordPath = path + "/" + created.body.id;
  for (const role of [
    "ADMIN",
    "EDITOR",
    "CREATOR",
    "ANALYST",
    "CLIENT",
  ] as const) {
    const user = await member(org.id, role);
    assert.equal((await user.call(path)).status, 200);
    assert.equal((await user.call(recordPath)).status, 200);
    const writer = ["ADMIN", "EDITOR", "CREATOR"].includes(role);
    const own = await user.call(path, "POST", input());
    assert.equal(own.status, writer ? 201 : 403, role);
    const decision = await user.call(
      recordPath + "/review",
      "POST",
      review(created.body.revision),
    );
    if (role === "ADMIN") {
      assert.equal(decision.status, 201);
      created.body = decision.body;
    } else if (role === "EDITOR") {
      assert.equal(decision.status, 201);
      created.body = decision.body;
    } else assert.equal(decision.status, 403, role);
    if (!writer)
      assert.equal(
        (
          await user.call(recordPath, "PUT", {
            ...input(),
            expectedRevision: created.body.revision,
          })
        ).status,
        403,
      );
  }
  for (const suffix of ["", "/" + created.body.id])
    assert.equal((await other.owner.call(path + suffix)).status, 404);
  assert.equal(
    (
      await other.owner.call(recordPath, "PUT", {
        ...input(),
        expectedRevision: created.body.revision,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await other.owner.call(
        recordPath + "/review",
        "POST",
        review(created.body.revision),
      )
    ).status,
    404,
  );
  assert.equal(
    (await other.owner.call(other.path + "/" + created.body.id)).status,
    404,
  );
  assert.equal(
    (
      await other.owner.call(other.path + "/" + created.body.id, "PUT", {
        ...input(),
        expectedRevision: 1,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await other.owner.call(
        other.path + "/" + created.body.id + "/review",
        "POST",
        review(1),
      )
    ).status,
    404,
  );
  assert.deepEqual((await other.owner.call(other.path)).body.items, []);
  for (const change of [
    { sourceUrl: "https://localhost" },
    { sourceUrl: "http://public.org" },
    { observedAt: new Date(Date.now() + 3600000).toISOString() },
    { authorizedSource: false },
    { provenance: "MANUAL" },
    { collectedAt: new Date().toISOString() },
  ])
    assert.equal(
      (await owner.call(path, "POST", { ...input(), ...change })).status,
      400,
    );
  assert.equal((await owner.call(recordPath, "PUT", input())).status, 400);
  assert.equal(
    (
      await owner.call(recordPath + "/review", "POST", {
        ...review(created.body.revision),
        note: " ",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await owner.call(recordPath + "/review", "POST", {
        ...review(created.body.revision),
        sourcesReviewed: false,
      })
    ).status,
    400,
  );
});

test("research review and editing preserve provenance, invalidate acceptance and serialize concurrent changes", async () => {
  const { org, owner, path } = await workspace("Research revision fixture");
  const creator = await member(org.id, "CREATOR");
  const missing = await creator.call(path, "POST", {
    ...input(),
    sourceUrl: null,
    sourceLabel: null,
    observedAt: null,
  });
  assert.equal(missing.status, 201);
  assert.equal(missing.body.freshness, "MISSING");
  assert.equal(missing.body.eligibleForStrategy, false);
  assert.equal(
    (
      await owner.call(
        path + "/" + missing.body.id + "/review",
        "POST",
        review(1),
      )
    ).status,
    400,
  );
  const rejected = await owner.call(
    path + "/" + missing.body.id + "/review",
    "POST",
    review(1, "REJECTED"),
  );
  assert.equal(rejected.status, 201);
  assert.equal(rejected.body.reviewStatus, "REJECTED");
  assert.equal(rejected.body.eligibleForStrategy, false);

  const created = await creator.call(path, "POST", input());
  const recordPath = path + "/" + created.body.id;
  const accepted = await owner.call(recordPath + "/review", "POST", review(1));
  assert.equal(accepted.status, 201);
  assert.equal(accepted.body.revision, 2);
  assert.equal(accepted.body.reviewedBy, owner.id);
  assert.equal(accepted.body.eligibleForStrategy, true);
  assert.equal(
    (await creator.call(recordPath, "PUT", { ...input(), expectedRevision: 1 }))
      .status,
    409,
  );
  const edited = await creator.call(recordPath, "PUT", {
    ...input(),
    title: "Edited synthetic finding",
    expectedRevision: 2,
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.revision, 3);
  assert.equal(edited.body.reviewStatus, "UNREVIEWED");
  assert.equal(edited.body.eligibleForStrategy, false);
  for (const field of ["reviewedAt", "reviewedBy", "reviewNote"])
    assert.equal(edited.body[field], null);
  for (const field of ["provenance", "createdBy", "createdAt", "collectedAt"])
    assert.equal(edited.body[field], created.body[field]);
  assert.equal(
    (await owner.call(recordPath + "/review", "POST", review(2))).status,
    409,
  );

  const race = await creator.call(path, "POST", input());
  const racedPath = path + "/" + race.body.id;
  const concurrent = await Promise.all([
    creator.call(racedPath, "PUT", {
      ...input(),
      title: "Concurrent synthetic edit",
      expectedRevision: 1,
    }),
    owner.call(racedPath + "/review", "POST", review(1)),
  ]);
  assert.equal(
    concurrent.filter((r) => [200, 201].includes(r.status)).length,
    1,
  );
  assert.equal(concurrent.filter((r) => r.status === 409).length, 1);
  const winner = concurrent.find((r) => [200, 201].includes(r.status))!;
  const saved = await owner.call(racedPath);
  assert.equal(saved.body.revision, 2);
  assert.equal(saved.body.reviewStatus, winner.body.reviewStatus);
  const audits = await db.auditLog.findMany({
    where: { organizationId: org.id, entityId: race.body.id },
  });
  assert.equal(audits.length, 2);
  for (const entry of audits)
    assert.deepEqual(Object.keys(entry.detail as object).sort(), [
      "reviewStatus",
      "revision",
    ]);
});

test("research reads recalculate observation age, reject stale acceptance and keep historical evidence out of strategy", async () => {
  const { owner, path } = await workspace("Research age fixture");
  const created = await owner.call(path, "POST", input());
  const recordPath = path + "/" + created.body.id;
  const accepted = await owner.call(recordPath + "/review", "POST", review(1));
  const observedAt = new Date(Date.now() - researchMaximumAgeMs - 1000);
  await db.researchRecord.update({
    where: { id: created.body.id },
    data: { observedAt },
  });
  const aged = await owner.call(recordPath);
  assert.equal(aged.body.reviewStatus, "ACCEPTED");
  assert.equal(aged.body.freshness, "STALE");
  assert.equal(aged.body.eligibleForStrategy, false);
  assert.equal(
    aged.body.expiresAt,
    new Date(observedAt.getTime() + researchMaximumAgeMs).toISOString(),
  );
  assert.equal(
    (await owner.call(recordPath + "/review", "POST", review(2))).status,
    400,
  );
  const unchanged = await owner.call(recordPath);
  assert.equal(unchanged.body.revision, 2);
  assert.equal(unchanged.body.reviewedAt, accepted.body.reviewedAt);
  const historical = await owner.call(path, "POST", {
    ...input(),
    temporalScope: "HISTORICAL",
  });
  const historicalReview = await owner.call(
    path + "/" + historical.body.id + "/review",
    "POST",
    review(1),
  );
  assert.equal(historicalReview.status, 201);
  assert.equal(historicalReview.body.freshness, "CURRENT");
  assert.equal(historicalReview.body.eligibleForStrategy, false);
  const expired = await owner.call(path, "POST", {
    ...input(),
    temporalScope: "EXPIRED",
  });
  assert.equal(expired.body.freshness, "STALE");
  assert.equal(
    (
      await owner.call(
        path + "/" + expired.body.id + "/review",
        "POST",
        review(1),
      )
    ).status,
    400,
  );
  assert.equal(
    (await owner.call(path)).body.items.find(
      (r: any) => r.id === created.body.id,
    ).freshness,
    "STALE",
  );
});

test("research transaction rechecks a stale guard's membership before create, edit and review", async () => {
  const { org, owner, path } = await workspace(
    "Research revoked membership fixture",
  );
  const editor = await member(org.id, "EDITOR");
  const created = await owner.call(path, "POST", input());
  // Use the exact compiled controller served by the HTTP harness with an already
  // authorized request. This deterministically models revocation after TenantGuard,
  // without timing sleeps or depending on the HTTP guard rejecting it first.
  const { ResearchController } = createRequire(import.meta.url)(
    "../../dist/apps/api/src/research.js",
  );
  const controller = new ResearchController(db);
  const staleRequest = {
    organizationId: org.id,
    userId: editor.id,
    role: "EDITOR",
  };
  await db.membership.update({
    where: {
      userId_organizationId: { userId: editor.id, organizationId: org.id },
    },
    data: { role: "ANALYST" },
  });
  for (const action of [
    () => controller.create(staleRequest, input()),
    () =>
      controller.update(staleRequest, created.body.id, {
        ...input(),
        expectedRevision: 1,
      }),
    () => controller.review(staleRequest, created.body.id, review(1)),
  ])
    await assert.rejects(action, (error: any) => error.getStatus?.() === 403);
  await db.membership.delete({
    where: {
      userId_organizationId: { userId: editor.id, organizationId: org.id },
    },
  });
  await assert.rejects(
    () => controller.create(staleRequest, input()),
    (error: any) => error.getStatus?.() === 404,
  );
  assert.equal(
    await db.researchRecord.count({ where: { organizationId: org.id } }),
    1,
  );
  assert.equal(
    (
      await db.researchRecord.findUniqueOrThrow({
        where: { id: created.body.id },
      })
    ).revision,
    1,
  );
  assert.equal(
    await db.auditLog.count({
      where: { organizationId: org.id, action: { startsWith: "research." } },
    }),
    1,
  );
});

test("research list is bounded deterministically and workspace export includes tenant evidence and provenance", async () => {
  const { org, owner, path } = await workspace("Research export fixture");
  const other = await workspace("Other research export fixture");
  const created = await other.owner.call(other.path, "POST", input());
  assert.equal(created.status, 201);
  const stamp = new Date("2026-01-01T00:00:00Z");
  await db.researchRecord.createMany({
    data: Array.from({ length: 101 }, (_, index) => ({
      ...input(),
      id: randomUUID(),
      title: `Synthetic bounded list ${index}`,
      category: "INDUSTRY" as const,
      temporalScope: "CURRENT" as const,
      observedAt: stamp,
      updatedAt: stamp,
      organizationId: org.id,
      createdBy: owner.id,
    })),
  });
  const listed = await owner.call(path);
  assert.equal(listed.body.items.length, 100);
  const ids = listed.body.items.map((row: any) => row.id);
  assert.deepEqual(ids, [...ids].sort().reverse());
  assert.ok(
    listed.body.items.every((row: any) => row.organizationId === org.id),
  );
  const response = await fetch(
    base + `/workspaces/${org.id}/operations/export`,
    { headers: owner.headers },
  );
  assert.equal(response.status, 200);
  const records = (await response.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const research = records.filter((row) => row.type === "research");
  assert.equal(research.length, 101);
  assert.ok(
    research.every(
      ({ data }) =>
        data.organizationId === org.id &&
        data.provenance === "MANUAL" &&
        data.createdBy === owner.id,
    ),
  );
  assert.ok(
    research.every(
      ({ data }) =>
        data.sourceUrl &&
        data.sourceLabel &&
        data.observedAt &&
        data.collectedAt,
    ),
  );
  assert.equal(records.at(-1).data.counts.research, 101);
  assert.ok(!research.some(({ data }) => data.id === created.body.id));
});
