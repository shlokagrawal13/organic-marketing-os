import "../support/isolated";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { actor, db, draft } from "../support/http";

const organizations: string[] = [];
const users: string[] = [];

after(async () => {
  await db.organization.deleteMany({ where: { id: { in: organizations } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});

test("claim evidence is tenant and revision bound, owner overrides are audited, and publication is sanitized", async () => {
  const organization = await db.organization.create({
    data: { name: "Claim policy QA" },
  });
  const otherOrganization = await db.organization.create({
    data: { name: "Claim policy outsider QA" },
  });
  organizations.push(organization.id, otherOrganization.id);
  const owner = await actor(organization.id);
  const editor = await actor(organization.id, "EDITOR");
  const outsider = await actor(otherOrganization.id);
  users.push(owner.id, editor.id, outsider.id);
  const root = `/workspaces/${organization.id}`;
  const created = await owner.call(root + "/content", "POST", {
    ...draft,
    title: "Research-backed workflow",
    hook: "Grow qualified leads by 35% in 3 months",
    body: "Our award-winning workflow is more effective than spreadsheets.",
  });
  assert.equal(created.status, 201);
  const contentId = created.body.id;
  assert.equal(
    (
      await owner.call(root + `/content/${contentId}/review`, "POST", {
        revision: 1,
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await owner.call(root + `/content/${contentId}/approve`, "POST", {
        revision: 1,
        factsAndRightsReviewed: true,
      })
    ).status,
    409,
  );

  const detail = await owner.call(root + `/content/${contentId}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.claimPolicy.complete, false);
  assert.ok(detail.body.claimPolicy.claims.length >= 3);
  assert.equal(detail.body.claimReview, null);
  const base = {
    revision: 1,
    policyVersion: detail.body.claimPolicy.policyVersion,
    claimSetFingerprint: detail.body.claimPolicy.claimSetFingerprint,
  };
  const evidence = detail.body.claimPolicy.claims.map(
    (claim: { id: string }) => ({
      claimId: claim.id,
      disposition: "EVIDENCE",
      sourceUrl: "https://example.test/source",
      sourceLabel: "Test-only source record",
      checkedAt: new Date().toISOString(),
      acknowledged: true,
    }),
  );
  const withOverride = evidence.map((resolution: any, index: number) =>
    index === 0
      ? {
          claimId: resolution.claimId,
          disposition: "OWNER_OVERRIDE",
          overrideReason:
            "The owner accepts responsibility pending a stronger source record.",
          acknowledged: true,
        }
      : resolution,
  );
  assert.equal(
    (
      await editor.call(root + `/content/${contentId}/claim-review`, "POST", {
        ...base,
        resolutions: withOverride,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await outsider.call(
        `/workspaces/${otherOrganization.id}/content/${contentId}/claim-review`,
        "POST",
        { ...base, resolutions: evidence },
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await owner.call(root + `/content/${contentId}/claim-review`, "POST", {
        ...base,
        resolutions: withOverride,
      })
    ).status,
    201,
  );
  const audit = await db.auditLog.findFirstOrThrow({
    where: {
      organizationId: organization.id,
      action: "content.claim_reviewed",
      entityId: contentId,
    },
    orderBy: { createdAt: "desc" },
  });
  assert.equal(JSON.stringify(audit.detail).includes("example.test"), false);
  assert.equal(
    JSON.stringify(audit.detail).includes("pending a stronger"),
    false,
  );
  assert.equal((audit.detail as any).ownerOverrideCount, 1);
  assert.equal(
    (
      await owner.call(root + `/content/${contentId}/approve`, "POST", {
        revision: 1,
        factsAndRightsReviewed: true,
      })
    ).status,
    201,
  );
  const prepared = await owner.call(root + "/publication-intents", "POST", {
    contentId,
    revision: 1,
    requestKey: randomUUID(),
  });
  assert.equal(prepared.status, 201);
  assert.equal(
    JSON.stringify(prepared.body.snapshot.claimReview).includes("sourceUrl"),
    false,
  );
  assert.equal(
    prepared.body.snapshot.claimReview.dispositions.length,
    evidence.length,
  );

  const edited = await owner.call(root + `/content/${contentId}`, "PUT", {
    ...draft,
    title: "Research-backed workflow updated",
    hook: "Grow qualified leads by 40% in 4 months",
    body: "Our award-winning workflow is more effective than spreadsheets.",
    revision: 1,
  });
  assert.equal(edited.status, 200);
  assert.equal(
    (
      await owner.call(root + `/content/${contentId}/review`, "POST", {
        revision: 2,
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await owner.call(root + `/content/${contentId}/approve`, "POST", {
        revision: 2,
        factsAndRightsReviewed: true,
      })
    ).status,
    409,
  );
  const revised = await owner.call(root + `/content/${contentId}`);
  assert.equal(revised.body.claimPolicy.complete, false);
  assert.equal(revised.body.claimReview, null);
});
