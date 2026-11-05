import "../support/isolated";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db, actor, base } from "../support/http";
import { resetFixtureRateBudget } from "../support/fixture-rate-budget";
import { randomUUID } from "node:crypto";

const orgs: string[] = [];
const users: string[] = [];

after(async () => {
  if (orgs.length) {
    await db.auditLog.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.invitation.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.membership.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.creditReservation.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.creditEntry.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.publicationAttempt.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.publicationSchedule.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.publicationPolicyReview.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.publicationIntent.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.socialConnection.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.renderJob.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.contentItem.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.creditAccount.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.organization.deleteMany({ where: { id: { in: orgs } } });
  }
  if (users.length) {
    await db.session.deleteMany({ where: { userId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
  }
  await db.$disconnect();
});

/** Fetch the NDJSON export as raw text (can't use actor.call which parses JSON). */
async function fetchExport(
  orgId: string,
  headers: Record<string, string>,
): Promise<{ status: number; rawBody: string }> {
  const res = await fetch(`${base}/workspaces/${orgId}/operations/export`, {
    headers,
  });
  const rawBody = await res.text();
  return { status: res.status, rawBody };
}

test("export: OWNER can download NDJSON with manifest and complete record", async () => {
  await resetFixtureRateBudget();
  const org = await db.organization.create({ data: { name: "Export Org" } });
  orgs.push(org.id);
  const owner = await actor(org.id, "OWNER");
  users.push(owner.id);

  const { status, rawBody } = await fetchExport(org.id, owner.headers);
  assert.equal(status, 200);

  const lines = rawBody.trim().split("\n");
  const parsed = lines.map((l) => JSON.parse(l));

  // First line is manifest
  assert.equal(parsed[0].type, "manifest");
  assert.equal(parsed[0].data.organizationId, org.id);

  // Last line is complete with sha256
  const last = parsed[parsed.length - 1];
  assert.equal(last.type, "complete");
  assert.ok(
    typeof last.data.sha256 === "string" && last.data.sha256.length === 64,
    "sha256 should be 64 hex chars",
  );
  assert.ok(typeof last.data.counts === "object");

  // workspace record present
  const workspace = parsed.find((r: { type: string }) => r.type === "workspace");
  assert.ok(workspace);
  assert.equal(workspace.data.id, org.id);
});

test("export: EDITOR role is forbidden; ADMIN is allowed", async () => {
  await resetFixtureRateBudget();
  const org = await db.organization.create({ data: { name: "Roles Export Org" } });
  orgs.push(org.id);
  const editor = await actor(org.id, "EDITOR");
  const admin = await actor(org.id, "ADMIN");
  users.push(editor.id, admin.id);

  // EDITOR is blocked (TenantGuard @Roles returns 403)
  const editorRes = await fetchExport(org.id, editor.headers);
  assert.ok(
    [403, 404].includes(editorRes.status),
    `Expected 403/404, got ${editorRes.status}`,
  );

  // ADMIN is allowed
  const adminRes = await fetchExport(org.id, admin.headers);
  assert.equal(adminRes.status, 200);
});

test("export: tenant isolation — cannot export another workspace", async () => {
  await resetFixtureRateBudget();
  const orgA = await db.organization.create({ data: { name: "Tenant A Export" } });
  const orgB = await db.organization.create({ data: { name: "Tenant B Export" } });
  orgs.push(orgA.id, orgB.id);
  const ownerA = await actor(orgA.id, "OWNER");
  users.push(ownerA.id);

  // ownerA cannot access orgB's export
  const res = await fetchExport(orgB.id, ownerA.headers);
  assert.ok([403, 404].includes(res.status), `Expected 403/404, got ${res.status}`);
});

test("export: rate-limited to one request per minute per user/workspace", async () => {
  await resetFixtureRateBudget();
  const org = await db.organization.create({ data: { name: "RateLimit Export Org" } });
  orgs.push(org.id);
  const owner = await actor(org.id, "OWNER");
  users.push(owner.id);

  // First request succeeds
  const first = await fetchExport(org.id, owner.headers);
  assert.equal(first.status, 200);

  // Second request immediately after is rate-limited (same user/org key)
  const second = await fetchExport(org.id, owner.headers);
  assert.equal(second.status, 429);
});

test("export: no credential ciphertexts appear in NDJSON output", async () => {
  await resetFixtureRateBudget();
  const org = await db.organization.create({ data: { name: "Secrets Export Org" } });
  orgs.push(org.id);
  const owner = await actor(org.id, "OWNER");
  users.push(owner.id);

  // Populate records containing sensitive credentials, hashes, and idempotency keys
  const content = await db.contentItem.create({
    data: {
      organizationId: org.id,
      title: "Export Test Content",
      platform: "YOUTUBE",
      format: "VIDEO",
      createdBy: owner.id,
    },
  });

  const connection = await db.socialConnection.create({
    data: {
      organizationId: org.id,
      provider: "YOUTUBE",
      externalAccountId: "channel-export-123",
      accountLabel: "Export Test Channel",
      scopes: ["upload"],
      accessTokenCiphertext: "secret-access-token-ciphertext-raw-value",
      refreshTokenCiphertext: "secret-refresh-token-ciphertext-raw-value",
    },
  });

  const intent = await db.publicationIntent.create({
    data: {
      organizationId: org.id,
      contentId: content.id,
      contentRevision: 1,
      platform: "YOUTUBE",
      snapshot: { title: "Export Test Content" },
      requestKey: "secret-intent-request-key-xyz-789",
      requestHash: "secret-intent-request-hash-sha256-456",
      createdBy: owner.id,
    },
  });

  await db.publicationAttempt.create({
    data: {
      organizationId: org.id,
      intentId: intent.id,
      connectionId: connection.id,
      contentId: content.id,
      contentRevision: 1,
      requestKey: "secret-attempt-request-key-abc-123",
      requestHash: "secret-attempt-request-hash-sha256-999",
      uploadSessionCiphertext: "secret-upload-session-ciphertext-val-000",
    },
  });

  await db.publicationSchedule.create({
    data: {
      organizationId: org.id,
      intentId: intent.id,
      connectionId: connection.id,
      actorId: owner.id,
      requestKey: "secret-sched-request-key-def-555",
      dueAt: new Date(Date.now() + 3600000),
    },
  });

  const { status, rawBody } = await fetchExport(org.id, owner.headers);
  assert.equal(status, 200);

  const lines = rawBody.trim().split("\n");
  const parsed = lines.map((l) => JSON.parse(l));

  // Verify the records were actually exported
  assert.ok(parsed.some((r) => r.type === "socialConnection"), "socialConnection must be in export");
  assert.ok(parsed.some((r) => r.type === "publicationIntent"), "publicationIntent must be in export");
  assert.ok(parsed.some((r) => r.type === "publicationAttempt"), "publicationAttempt must be in export");
  assert.ok(parsed.some((r) => r.type === "publicationSchedule"), "publicationSchedule must be in export");

  // Credential and secret key fields must never appear in the export body
  assert.ok(!rawBody.includes("secret-access-token-ciphertext-raw-value"), "accessTokenCiphertext raw value must be redacted");
  assert.ok(!rawBody.includes("secret-refresh-token-ciphertext-raw-value"), "refreshTokenCiphertext raw value must be redacted");
  assert.ok(!rawBody.includes("secret-intent-request-key-xyz-789"), "publicationIntent requestKey must be redacted");
  assert.ok(!rawBody.includes("secret-intent-request-hash-sha256-456"), "publicationIntent requestHash must be redacted");
  assert.ok(!rawBody.includes("secret-attempt-request-key-abc-123"), "publicationAttempt requestKey must be redacted");
  assert.ok(!rawBody.includes("secret-attempt-request-hash-sha256-999"), "publicationAttempt requestHash must be redacted");
  assert.ok(!rawBody.includes("secret-upload-session-ciphertext-val-000"), "uploadSessionCiphertext raw value must be redacted");
  assert.ok(!rawBody.includes("secret-sched-request-key-def-555"), "publicationSchedule requestKey must be redacted");

  assert.ok(!rawBody.includes('"accessTokenCiphertext"'), "accessTokenCiphertext property must be stripped");
  assert.ok(!rawBody.includes('"refreshTokenCiphertext"'), "refreshTokenCiphertext property must be stripped");
  assert.ok(!rawBody.includes('"uploadSessionCiphertext"'), "uploadSessionCiphertext property must be stripped");
  assert.ok(!rawBody.includes('"tokenHash"'), "tokenHash must be stripped");
  assert.ok(!rawBody.includes('"runToken"'), "runToken must be stripped");
  assert.ok(!rawBody.includes('"requestHash"'), "requestHash must be stripped");
  assert.ok(!rawBody.includes('"requestKey"'), "requestKey must be stripped");
});

test("member revocation: removes membership and sessions, preserves audit log", async () => {
  await resetFixtureRateBudget();
  const org = await db.organization.create({ data: { name: "Revoke Org" } });
  orgs.push(org.id);
  const owner = await actor(org.id, "OWNER");
  const member = await actor(org.id, "EDITOR");
  users.push(owner.id, member.id);

  // Verify member exists before revocation
  const before = await db.membership.findUnique({
    where: { userId_organizationId: { userId: member.id, organizationId: org.id } },
  });
  assert.ok(before, "membership should exist before revocation");

  const res = await owner.call(
    `/workspaces/${org.id}/operations/members/${member.id}`,
    "DELETE",
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.revokedUserId, member.id);

  // Membership removed
  const after = await db.membership.findUnique({
    where: { userId_organizationId: { userId: member.id, organizationId: org.id } },
  });
  assert.equal(after, null, "membership should be removed");

  // Sessions deleted
  const sessions = await db.session.count({ where: { userId: member.id } });
  assert.equal(sessions, 0, "sessions should be deleted");

  // Audit log written
  const audit = await db.auditLog.findFirst({
    where: { organizationId: org.id, action: "member.revoked", entityId: member.id },
  });
  assert.ok(audit, "revocation audit log must be written");
});

test("member revocation: EDITOR cannot revoke; OWNER/ADMIN can", async () => {
  await resetFixtureRateBudget();
  const org = await db.organization.create({ data: { name: "Revoke Role Org" } });
  orgs.push(org.id);
  const owner = await actor(org.id, "OWNER");
  const editor = await actor(org.id, "EDITOR");
  const target = await actor(org.id, "CREATOR");
  users.push(owner.id, editor.id, target.id);

  // EDITOR cannot revoke
  const editorRes = await editor.call(
    `/workspaces/${org.id}/operations/members/${target.id}`,
    "DELETE",
  );
  assert.ok([403, 404].includes(editorRes.status), `Expected 403/404, got ${editorRes.status}`);

  // OWNER can revoke
  const ownerRes = await owner.call(
    `/workspaces/${org.id}/operations/members/${target.id}`,
    "DELETE",
  );
  assert.equal(ownerRes.status, 200);
});

test("member revocation: self-revoke is forbidden", async () => {
  await resetFixtureRateBudget();
  const org = await db.organization.create({ data: { name: "Self Revoke Org" } });
  orgs.push(org.id);
  const owner = await actor(org.id, "OWNER");
  users.push(owner.id);

  const res = await owner.call(
    `/workspaces/${org.id}/operations/members/${owner.id}`,
    "DELETE",
  );
  assert.equal(res.status, 403);
});

test("member revocation: non-existent member returns 404", async () => {
  await resetFixtureRateBudget();
  const org = await db.organization.create({ data: { name: "NotFound Revoke Org" } });
  orgs.push(org.id);
  const owner = await actor(org.id, "OWNER");
  users.push(owner.id);

  const res = await owner.call(
    `/workspaces/${org.id}/operations/members/${randomUUID()}`,
    "DELETE",
  );
  assert.equal(res.status, 404);
});

test("member revocation: cross-tenant call returns 403/404", async () => {
  await resetFixtureRateBudget();
  const orgA = await db.organization.create({ data: { name: "Tenant A Revoke" } });
  const orgB = await db.organization.create({ data: { name: "Tenant B Revoke" } });
  orgs.push(orgA.id, orgB.id);
  const ownerA = await actor(orgA.id, "OWNER");
  const memberB = await actor(orgB.id, "EDITOR");
  users.push(ownerA.id, memberB.id);

  // ownerA cannot revoke from orgB (not their workspace)
  const res = await ownerA.call(
    `/workspaces/${orgB.id}/operations/members/${memberB.id}`,
    "DELETE",
  );
  assert.ok([403, 404].includes(res.status), `Expected 403/404, got ${res.status}`);
});

test("retention pruning: OWNER can preview candidates in dry-run mode and prune while preserving financial records", async () => {
  await resetFixtureRateBudget();
  const org = await db.organization.create({ data: { name: "Prune Org" } });
  orgs.push(org.id);
  const owner = await actor(org.id, "OWNER");
  const editor = await actor(org.id, "EDITOR");
  users.push(owner.id, editor.id);

  // 1. Create an expired invitation (1 hour in the past)
  const expiredInv = await db.invitation.create({
    data: {
      organizationId: org.id,
      email: "expired-candidate@example.com",
      role: "CREATOR",
      tokenHash: "expired-candidate-token-hash-123",
      expiresAt: new Date(Date.now() - 3600000),
    },
  });

  // 2. Create an unexpired invitation (1 hour in the future)
  const activeInv = await db.invitation.create({
    data: {
      organizationId: org.id,
      email: "active-candidate@example.com",
      role: "CREATOR",
      tokenHash: "active-candidate-token-hash-456",
      expiresAt: new Date(Date.now() + 3600000),
    },
  });

  // 3. Create a CreditAccount and CreditEntry (financial records that must NEVER be pruned)
  const creditAcct = await db.creditAccount.create({
    data: {
      organizationId: org.id,
      balance: 500,
    },
  });
  const creditEntry = await db.creditEntry.create({
    data: {
      organizationId: org.id,
      accountId: creditAcct.id,
      amount: 500,
      balanceAfter: 500,
      operationKey: "initial-grant-key",
      requestHash: "initial-grant-hash",
      reason: "Initial Grant",
    },
  });

  // 4. Test non-privileged role (EDITOR) receives 403 Forbidden
  const editorRes = await editor.call(
    `/workspaces/${org.id}/operations/retention-prune`,
    "POST",
  );
  assert.equal(editorRes.status, 403);

  // 5. Test dry-run: preview candidates without deleting
  const dryRes = await owner.call(
    `/workspaces/${org.id}/operations/retention-prune?dryRun=true`,
    "POST",
  );
  assert.equal(dryRes.status, 201);
  const dryBody = await dryRes.json();
  assert.equal(dryBody.dryRun, true);
  assert.equal(dryBody.pruned, false);
  assert.equal(dryBody.candidates.expiredInvitations, 1);

  // Assert expired invitation still exists in DB after dry-run
  const invStillExists = await db.invitation.findUnique({ where: { id: expiredInv.id } });
  assert.ok(invStillExists);

  // 6. Test real prune execution
  const pruneRes = await owner.call(
    `/workspaces/${org.id}/operations/retention-prune`,
    "POST",
  );
  assert.equal(pruneRes.status, 201);
  const pruneBody = await pruneRes.json();
  assert.equal(pruneBody.dryRun, false);
  assert.equal(pruneBody.pruned, true);
  assert.equal(pruneBody.summary.expiredInvitations, 1);

  // Assert expired invitation is deleted
  const invDeleted = await db.invitation.findUnique({ where: { id: expiredInv.id } });
  assert.equal(invDeleted, null);

  // Assert active invitation is PRESERVED
  const invActiveKept = await db.invitation.findUnique({ where: { id: activeInv.id } });
  assert.ok(invActiveKept);

  // Assert financial records are IMMUTABLE and PRESERVED
  const creditEntryKept = await db.creditEntry.findUnique({ where: { id: creditEntry.id } });
  assert.ok(creditEntryKept);

  // Assert audit trail records retention.pruned event
  const pruneAudit = await db.auditLog.findFirst({
    where: { organizationId: org.id, action: "retention.pruned" },
  });
  assert.ok(pruneAudit);
  assert.equal((pruneAudit.detail as any).expiredInvitations, 1);
});

