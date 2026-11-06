import "../support/isolated";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db, actor, base } from "../support/http";
import { resetFixtureRateBudget } from "../support/fixture-rate-budget";
import { randomUUID, createHash } from "node:crypto";

const orgs: string[] = [];
const users: string[] = [];

after(async () => {
  if (orgs.length) {
    await db.auditLog.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.invitation.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.membership.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.creditReservation.deleteMany({ where: { organizationId: { in: orgs } } });
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

/** Fetch the audit NDJSON export as raw text. */
async function fetchAuditExport(
  orgId: string,
  headers: Record<string, string>,
  query = "",
): Promise<{ status: number; rawBody: string }> {
  const res = await fetch(
    `${base}/workspaces/${orgId}/operations/audit-export${query}`,
    { headers },
  );
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

  // 3. Create a CreditAccount (financial record that must NEVER be pruned)
  const creditAcct = await db.creditAccount.create({
    data: {
      organizationId: org.id,
      available: 500,
      reserved: 0,
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
  const dryBody = dryRes.body as any;
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
  const pruneBody = pruneRes.body as any;
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
  const creditAcctKept = await db.creditAccount.findUnique({
    where: { organizationId: org.id },
  });
  assert.ok(creditAcctKept);
  assert.equal(creditAcctKept.available, 500);

  // Assert audit trail records retention.pruned event
  const pruneAudit = await db.auditLog.findFirst({
    where: { organizationId: org.id, action: "retention.pruned" },
  });
  assert.ok(pruneAudit);
  assert.equal((pruneAudit.detail as any).expiredInvitations, 1);
});

test("audit querying: OWNER can filter audit logs with pagination and role enforcement", async () => {
  await resetFixtureRateBudget();
  const org = await db.organization.create({ data: { name: "Audit Query Org" } });
  orgs.push(org.id);
  const owner = await actor(org.id, "OWNER");
  const editor = await actor(org.id, "EDITOR");
  users.push(owner.id, editor.id);

  // Seed multiple audit entries
  await db.auditLog.createMany({
    data: [
      { organizationId: org.id, actorId: owner.id, action: "team.invited", detail: { role: "ADMIN" } },
      { organizationId: org.id, actorId: owner.id, action: "team.removed", detail: { target: "user-x" } },
      { organizationId: org.id, actorId: owner.id, action: "workspace.updated", detail: { revision: 1 } },
      { organizationId: org.id, actorId: editor.id, action: "content.created", detail: { title: "Draft 1" } },
    ],
  });

  // 1. Non-privileged role (EDITOR) is rejected with 403 Forbidden
  const forbiddenRes = await editor.call(
    `/workspaces/${org.id}/operations/audit`,
    "GET",
  );
  assert.equal(forbiddenRes.status, 403);

  // 2. OWNER can query all audit logs
  const allRes = await owner.call(
    `/workspaces/${org.id}/operations/audit`,
    "GET",
  );
  assert.equal(allRes.status, 200);
  const allBody = allRes.body as any;
  assert.equal(allBody.organizationId, org.id);
  assert.ok(allBody.totalCount >= 4);

  // 3. OWNER can filter by action prefix
  const teamRes = await owner.call(
    `/workspaces/${org.id}/operations/audit?action=team.`,
    "GET",
  );
  assert.equal(teamRes.status, 200);
  const teamBody = teamRes.body as any;
  assert.equal(teamBody.items.length, 2);
  for (const item of teamBody.items) {
    assert.ok(item.action.startsWith("team."));
  }

  // 4. Bounded pagination with cursor
  const pageRes = await owner.call(
    `/workspaces/${org.id}/operations/audit?take=2`,
    "GET",
  );
  assert.equal(pageRes.status, 200);
  const pageBody = pageRes.body as any;
  assert.equal(pageBody.items.length, 2);
  assert.ok(pageBody.nextCursor !== null);
});

test("audit export: OWNER can download compliance audit NDJSON with tamper-evident checksum", async () => {
  await resetFixtureRateBudget();
  const org = await db.organization.create({ data: { name: "Audit Export Org" } });
  orgs.push(org.id);
  const owner = await actor(org.id, "OWNER");
  const editor = await actor(org.id, "EDITOR");
  users.push(owner.id, editor.id);

  // Seed sample audit events
  await db.auditLog.createMany({
    data: [
      { organizationId: org.id, actorId: owner.id, action: "team.invited", detail: { target: "user-1" } },
      { organizationId: org.id, actorId: owner.id, action: "workspace.updated", detail: { settingsRevision: 2 } },
    ],
  });

  // 1. Non-privileged role is rejected with 403
  const forbiddenRes = await fetchAuditExport(org.id, editor.headers);
  assert.equal(forbiddenRes.status, 403);

  // 2. OWNER downloads audit export
  const { status, rawBody } = await fetchAuditExport(org.id, owner.headers);
  assert.equal(status, 200);

  const lines = rawBody.trim().split("\n");
  assert.ok(lines.length >= 3, "Export should have manifest, audit records, and complete record");

  const manifest = JSON.parse(lines[0]);
  assert.equal(manifest.type, "manifest");
  assert.equal(manifest.format, "audit-ndjson");
  assert.equal(manifest.organizationId, org.id);

  // Verify SHA-256 integrity over all preceding lines
  const hash = createHash("sha256");
  for (let i = 0; i < lines.length - 1; i++) {
    hash.update(lines[i] + "\n");
  }
  const expectedSha256 = hash.digest("hex");

  const complete = JSON.parse(lines[lines.length - 1]);
  assert.equal(complete.type, "complete");
  assert.equal(complete.data.sha256, expectedSha256);
  assert.equal(complete.data.count, lines.length - 2);

  // 3. Verify audit.exported record is logged in database
  const exportAudit = await db.auditLog.findFirst({
    where: { organizationId: org.id, action: "audit.exported" },
  });
  assert.ok(exportAudit);
  assert.equal((exportAudit.detail as any).sha256, expectedSha256);
});

test("legal hold: OWNER can enable, inspect, and release legal hold with role authorization and audit logging", async () => {
  await resetFixtureRateBudget();
  const orgA = await db.organization.create({ data: { name: "Legal Hold Org A" } });
  const orgB = await db.organization.create({ data: { name: "Legal Hold Org B" } });
  orgs.push(orgA.id, orgB.id);

  const ownerA = await actor(orgA.id, "OWNER");
  const editorA = await actor(orgA.id, "EDITOR");
  const ownerB = await actor(orgB.id, "OWNER");
  users.push(ownerA.id, editorA.id, ownerB.id);

  // 1. Initial state is inactive
  const initialRes = await ownerA.call(`/workspaces/${orgA.id}/operations/legal-hold`, "GET");
  assert.equal(initialRes.status, 200);
  assert.equal((initialRes.body as any).active, false);
  assert.equal((initialRes.body as any).hold, null);

  // 2. Non-privileged role (EDITOR) receives 403 Forbidden
  const editorEnable = await editorA.call(
    `/workspaces/${orgA.id}/operations/legal-hold`,
    "POST",
    { reason: "Unauthorized attempt" },
  );
  assert.equal(editorEnable.status, 403);

  // 3. OWNER enables legal hold
  const enableRes = await ownerA.call(
    `/workspaces/${orgA.id}/operations/legal-hold`,
    "POST",
    { reason: "SEC compliance audit", caseReference: "SEC-2026-789" },
  );
  assert.equal(enableRes.status, 201);
  const enableBody = enableRes.body as any;
  assert.equal(enableBody.active, true);
  assert.equal(enableBody.hold.reason, "SEC compliance audit");
  assert.equal(enableBody.hold.caseReference, "SEC-2026-789");
  assert.equal(enableBody.hold.enabledBy, ownerA.id);

  // 4. Duplicate enable attempt returns 409 Conflict
  const dupEnable = await ownerA.call(
    `/workspaces/${orgA.id}/operations/legal-hold`,
    "POST",
    { reason: "Second duplicate attempt" },
  );
  assert.equal(dupEnable.status, 409);

  // 5. GET returns active hold details
  const getRes = await ownerA.call(`/workspaces/${orgA.id}/operations/legal-hold`, "GET");
  assert.equal(getRes.status, 200);
  const getBody = getRes.body as any;
  assert.equal(getBody.active, true);
  assert.equal(getBody.hold.caseReference, "SEC-2026-789");

  // 6. Tenant isolation: Owner B cannot access Org A's legal hold (404)
  const crossTenantGet = await ownerB.call(`/workspaces/${orgA.id}/operations/legal-hold`, "GET");
  assert.equal(crossTenantGet.status, 404);

  // 7. Non-privileged role cannot release legal hold (403)
  const editorRelease = await editorA.call(
    `/workspaces/${orgA.id}/operations/legal-hold`,
    "DELETE",
    { releaseReason: "Unauthorized release" },
  );
  assert.equal(editorRelease.status, 403);

  // 8. OWNER releases legal hold
  const releaseRes = await ownerA.call(
    `/workspaces/${orgA.id}/operations/legal-hold`,
    "DELETE",
    { releaseReason: "Audit completed with no findings" },
  );
  assert.equal(releaseRes.status, 200);
  assert.equal((releaseRes.body as any).active, false);

  // 9. Releasing when inactive returns 409 Conflict
  const dupRelease = await ownerA.call(
    `/workspaces/${orgA.id}/operations/legal-hold`,
    "DELETE",
    { releaseReason: "Redundant release" },
  );
  assert.equal(dupRelease.status, 409);

  // 10. Audit log entries are recorded for both enable and release
  const enableAudit = await db.auditLog.findFirst({
    where: { organizationId: orgA.id, action: "data.legal_hold.enabled" },
  });
  assert.ok(enableAudit);
  assert.equal((enableAudit.detail as any).reason, "SEC compliance audit");

  const releaseAudit = await db.auditLog.findFirst({
    where: { organizationId: orgA.id, action: "data.legal_hold.released" },
  });
  assert.ok(releaseAudit);
  assert.equal((releaseAudit.detail as any).releaseReason, "Audit completed with no findings");
});

test("legal hold: active legal hold locks retention pruning and member data revocation with HTTP 423 Locked", async () => {
  await resetFixtureRateBudget();
  const org = await db.organization.create({ data: { name: "Legal Hold Lock Org" } });
  orgs.push(org.id);

  const owner = await actor(org.id, "OWNER");
  const member = await actor(org.id, "EDITOR");
  users.push(owner.id, member.id);

  // Create an expired invitation candidate for pruning
  await db.invitation.create({
    data: {
      organizationId: org.id,
      email: "prune-target@example.com",
      role: "CREATOR",
      tokenHash: "prune-target-hash-123",
      expiresAt: new Date(Date.now() - 3600000),
    },
  });

  // Enable legal hold
  const holdRes = await owner.call(
    `/workspaces/${org.id}/operations/legal-hold`,
    "POST",
    { reason: "Pending court order discovery", caseReference: "DISCOVERY-001" },
  );
  assert.equal(holdRes.status, 201);

  // 1. Attempt retention pruning while legal hold is active -> HTTP 423 Locked
  const pruneAttempt = await owner.call(
    `/workspaces/${org.id}/operations/retention-prune`,
    "POST",
  );
  assert.equal(pruneAttempt.status, 423);
  assert.match(
    (pruneAttempt.body as any)?.error?.message || (pruneAttempt.body as any)?.message,
    /retention pruning is locked/i,
  );

  // 2. Attempt member data revocation while legal hold is active -> HTTP 423 Locked
  const revokeAttempt = await owner.call(
    `/workspaces/${org.id}/operations/members/${member.id}`,
    "DELETE",
  );
  assert.equal(revokeAttempt.status, 423);
  assert.match(
    (revokeAttempt.body as any)?.error?.message || (revokeAttempt.body as any)?.message,
    /member data deletion is locked/i,
  );

  // Verify membership was NOT deleted
  const membership = await db.membership.findUnique({
    where: { userId_organizationId: { userId: member.id, organizationId: org.id } },
  });
  assert.ok(membership);

  // 3. Release legal hold
  const releaseRes = await owner.call(
    `/workspaces/${org.id}/operations/legal-hold`,
    "DELETE",
    { releaseReason: "Court order discovery complete" },
  );
  assert.equal(releaseRes.status, 200);

  // 4. Now retention pruning succeeds
  const pruneAfterRelease = await owner.call(
    `/workspaces/${org.id}/operations/retention-prune`,
    "POST",
  );
  assert.equal(pruneAfterRelease.status, 201);
  assert.equal((pruneAfterRelease.body as any).pruned, true);
});

test("DATA-01F: asset reconciliation and workspace safe erasure contracts", async () => {
  await resetFixtureRateBudget();
  const org = await db.organization.create({ data: { name: "Asset Reconcile & Erasure Org" } });
  orgs.push(org.id);

  const owner = await actor(org.id, "OWNER");
  const member = await actor(org.id, "EDITOR");
  users.push(owner.id, member.id);

  // Seed an unattached asset
  const orphanAsset = await db.asset.create({
    data: {
      organizationId: org.id,
      name: "orphan-sample.png",
      kind: "IMAGE",
      mimeType: "image/png",
      bytes: 12345,
      sha256: "sha256-sample-orphan-asset-12345",
      objectKey: `assets/${org.id}/orphan-sample.png`,
      createdBy: owner.id,
    },
  });

  // 1. Dry run asset reconciliation
  const dryRunRes = await owner.call(
    `/workspaces/${org.id}/operations/reconcile-assets?dryRun=true`,
    "POST",
  );
  assert.equal(dryRunRes.status, 201);
  assert.equal((dryRunRes.body as any).dryRun, true);
  assert.ok((dryRunRes.body as any).totalCandidates >= 1);

  // Asset should still exist after dry-run
  const assetStillExists = await db.asset.findUnique({ where: { id: orphanAsset.id } });
  assert.ok(assetStillExists);

  // 2. Real asset reconciliation
  const realReconcileRes = await owner.call(
    `/workspaces/${org.id}/operations/reconcile-assets`,
    "POST",
  );
  assert.equal(realReconcileRes.status, 201);
  assert.equal((realReconcileRes.body as any).reconciled, true);
  assert.ok((realReconcileRes.body as any).prunedCount >= 1);

  // 3. Workspace erasure authorization: non-owner role rejected with HTTP 403
  const memberErasure = await member.call(
    `/workspaces/${org.id}/operations/erasure`,
    "POST",
    { confirmText: "ERASE_WORKSPACE_DATA", reason: "Attempted by member" },
  );
  assert.equal(memberErasure.status, 403);

  // 4. Invalid confirmText rejected with HTTP 400
  const invalidConfirm = await owner.call(
    `/workspaces/${org.id}/operations/erasure`,
    "POST",
    { confirmText: "INVALID_CONFIRMATION", reason: "Wrong confirm string" },
  );
  assert.equal(invalidConfirm.status, 400);

  // 5. Legal hold lock prevents erasure
  await owner.call(
    `/workspaces/${org.id}/operations/legal-hold`,
    "POST",
    { reason: "Audit in progress", caseReference: "LEGAL-001" },
  );

  const lockedErasure = await owner.call(
    `/workspaces/${org.id}/operations/erasure`,
    "POST",
    { confirmText: "ERASE_WORKSPACE_DATA", reason: "Attempt under legal hold" },
  );
  assert.equal(lockedErasure.status, 423);
  assert.match(
    (lockedErasure.body as any)?.error?.message || (lockedErasure.body as any)?.message,
    /workspace erasure is prohibited/i,
  );

  // Release legal hold
  await owner.call(
    `/workspaces/${org.id}/operations/legal-hold`,
    "DELETE",
    { releaseReason: "Audit completed" },
  );

  // 6. Successful erasure by OWNER
  const erasureRes = await owner.call(
    `/workspaces/${org.id}/operations/erasure`,
    "POST",
    { confirmText: "ERASE_WORKSPACE_DATA", reason: "GDPR right to be forgotten request" },
  );
  assert.equal(erasureRes.status, 201);
  assert.equal((erasureRes.body as any).status, "erased");

  // Verify Organization is anonymized and memberships revoked
  const erasedOrg = await db.organization.findUnique({ where: { id: org.id } });
  assert.equal(erasedOrg?.name, "[ERASED WORKSPACE]");

  const membershipsCount = await db.membership.count({ where: { organizationId: org.id } });
  assert.equal(membershipsCount, 0);
});



