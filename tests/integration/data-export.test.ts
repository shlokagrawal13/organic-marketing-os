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

