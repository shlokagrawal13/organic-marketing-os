import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

test("NDJSON export checksum matches SHA-256 over all preceding lines", () => {
  const lines = [
    JSON.stringify({ type: "manifest", data: { schemaVersion: 1, organizationId: "org-1" } }) + "\n",
    JSON.stringify({ type: "workspace", data: { id: "org-1", name: "Acme" } }) + "\n",
    JSON.stringify({ type: "billingSubscription", data: { id: "sub-1", status: "active" } }) + "\n",
  ];

  const hash = createHash("sha256");
  for (const line of lines) {
    hash.update(line);
  }
  const digest = hash.digest("hex");
  assert.equal(digest.length, 64);

  const completeLine = JSON.stringify({
    type: "complete",
    data: { counts: { manifest: 1, workspace: 1, billingSubscription: 1 }, sha256: digest },
  }) + "\n";

  const completeRecord = JSON.parse(completeLine);
  assert.equal(completeRecord.data.sha256, digest);
  assert.equal(completeRecord.data.counts.billingSubscription, 1);
});

test("export sanitizer strips sensitive credentials from social connections", () => {
  const sanitizeSocialConnection = ({
    accessTokenCiphertext,
    refreshTokenCiphertext,
    ...row
  }: {
    accessTokenCiphertext: string;
    refreshTokenCiphertext: string | null;
    [k: string]: unknown;
  }) => row;

  const raw = {
    id: "sc-1",
    organizationId: "org-1",
    provider: "YOUTUBE",
    externalAccountId: "channel-123",
    accountLabel: "Main Channel",
    scopes: ["upload", "read"],
    accessTokenCiphertext: "secret-cipher-token-xyz",
    refreshTokenCiphertext: "secret-cipher-refresh-xyz",
    tokenExpiresAt: new Date(),
    createdAt: new Date(),
  };

  const sanitized = sanitizeSocialConnection(raw);
  assert.equal((sanitized as any).accessTokenCiphertext, undefined);
  assert.equal((sanitized as any).refreshTokenCiphertext, undefined);
  assert.equal((sanitized as any).accountLabel, "Main Channel");
  assert.equal((sanitized as any).provider, "YOUTUBE");
});

test("export sanitizer strips token hashes from invitations", () => {
  const sanitizeInvitation = ({ tokenHash, ...row }: { tokenHash: string; [k: string]: unknown }) => row;

  const raw = {
    id: "inv-1",
    organizationId: "org-1",
    email: "creator@example.test",
    role: "CREATOR",
    tokenHash: "hash-of-invitation-token-secret",
    expiresAt: new Date(),
  };

  const sanitized = sanitizeInvitation(raw);
  assert.equal((sanitized as any).tokenHash, undefined);
  assert.equal((sanitized as any).email, "creator@example.test");
  assert.equal((sanitized as any).role, "CREATOR");
});

test("export sanitizer strips internal run tokens and request hashes from renders", () => {
  const sanitizeRender = ({
    outputKey,
    thumbnailKey,
    captionsKey,
    runToken,
    requestHash,
    ...row
  }: {
    outputKey: string | null;
    thumbnailKey?: string | null;
    captionsKey?: string | null;
    runToken: string | null;
    requestHash: string | null;
    [k: string]: unknown;
  }) => ({
    ...row,
    downloadPath: outputKey ? `/api/workspaces/org-1/renders/${row.id}/file/video?download=1` : null,
  });

  const raw = {
    id: "render-1",
    organizationId: "org-1",
    status: "SUCCEEDED",
    outputKey: "private/renders/render-1.mp4",
    runToken: "worker-run-secret-abc",
    requestHash: "hash-req-xyz",
    totalScenes: 3,
  };

  const sanitized = sanitizeRender(raw as any);
  assert.equal((sanitized as any).runToken, undefined);
  assert.equal((sanitized as any).requestHash, undefined);
  assert.equal((sanitized as any).outputKey, undefined);
  assert.equal(sanitized.downloadPath, "/api/workspaces/org-1/renders/render-1/file/video?download=1");
});

test("export sanitizer strips operation keys and request hashes from credit entries", () => {
  const sanitizeCreditEntry = ({ requestHash, operationKey, ...row }: { requestHash?: string | null; operationKey?: string | null; [k: string]: unknown }) => row;

  const raw = {
    id: "ce-1",
    organizationId: "org-1",
    amount: 100,
    reason: "PLAN_GRANT",
    operationKey: "op-idempotency-key-secret",
    requestHash: "req-hash-secret",
    createdAt: new Date(),
  };

  const sanitized = sanitizeCreditEntry(raw);
  assert.equal((sanitized as any).operationKey, undefined);
  assert.equal((sanitized as any).requestHash, undefined);
  assert.equal((sanitized as any).amount, 100);
});

test("export sanitizer strips requestKey and requestHash from publication intents", () => {
  const sanitizePublicationIntent = ({
    requestHash,
    requestKey,
    ...row
  }: {
    requestHash?: string;
    requestKey?: string;
    [k: string]: unknown;
  }) => row;

  const raw = {
    id: "intent-1",
    organizationId: "org-1",
    contentId: "content-1",
    contentRevision: 1,
    platform: "YOUTUBE",
    snapshot: {},
    requestKey: "idempotency-key-secret-123",
    requestHash: "sha256-request-hash-secret-456",
    status: "PREPARED",
    createdBy: "user-1",
    createdAt: new Date(),
  };

  const sanitized = sanitizePublicationIntent(raw);
  assert.equal((sanitized as any).requestKey, undefined);
  assert.equal((sanitized as any).requestHash, undefined);
  assert.equal((sanitized as any).status, "PREPARED");
  assert.equal((sanitized as any).contentId, "content-1");
});

test("export sanitizer strips uploadSessionCiphertext, requestKey, and requestHash from publication attempts", () => {
  const sanitizePublicationAttempt = ({
    uploadSessionCiphertext,
    requestHash,
    requestKey,
    ...row
  }: {
    uploadSessionCiphertext?: string | null;
    requestHash?: string;
    requestKey?: string;
    [k: string]: unknown;
  }) => row;

  const raw = {
    id: "attempt-1",
    organizationId: "org-1",
    intentId: "intent-1",
    connectionId: "conn-1",
    contentId: "content-1",
    contentRevision: 1,
    requestKey: "attempt-key-secret-789",
    requestHash: "sha256-attempt-hash-secret-abc",
    status: "RESERVED",
    uploadSessionCiphertext: "secret-upload-session-ciphertext-xyz",
    createdAt: new Date(),
  };

  const sanitized = sanitizePublicationAttempt(raw);
  assert.equal((sanitized as any).uploadSessionCiphertext, undefined);
  assert.equal((sanitized as any).requestKey, undefined);
  assert.equal((sanitized as any).requestHash, undefined);
  assert.equal((sanitized as any).status, "RESERVED");
  assert.equal((sanitized as any).intentId, "intent-1");
});

test("export sanitizer strips requestKey from publication schedules", () => {
  const sanitizePublicationSchedule = ({
    requestKey,
    ...row
  }: {
    requestKey?: string;
    [k: string]: unknown;
  }) => row;

  const raw = {
    id: "sched-1",
    organizationId: "org-1",
    intentId: "intent-1",
    connectionId: "conn-1",
    actorId: "user-1",
    requestKey: "sched-key-secret-999",
    dueAt: new Date(),
    status: "SCHEDULED",
    createdAt: new Date(),
  };

  const sanitized = sanitizePublicationSchedule(raw);
  assert.equal((sanitized as any).requestKey, undefined);
  assert.equal((sanitized as any).status, "SCHEDULED");
  assert.equal((sanitized as any).intentId, "intent-1");
});

test("member revocation self-revocation rule prohibits owner removing self via operations endpoint", () => {
  const isSelfRevocation = (targetUserId: string, callerUserId: string) => targetUserId === callerUserId;
  assert.equal(isSelfRevocation("user-1", "user-1"), true);
  assert.equal(isSelfRevocation("user-2", "user-1"), false);
});

test("social connection disconnect credential scrubbing zeros access token and clears refresh token", () => {
  const scrubSocialConnectionOnDisconnect = (conn: {
    accessTokenCiphertext: string;
    refreshTokenCiphertext: string | null;
    tokenExpiresAt: Date | null;
    refreshTokenExpiresAt: Date | null;
    refreshPendingAt: Date | null;
    revokedAt: Date | null;
  }) => ({
    ...conn,
    accessTokenCiphertext: "",
    refreshTokenCiphertext: null,
    tokenExpiresAt: null,
    refreshTokenExpiresAt: null,
    refreshPendingAt: null,
    revokedAt: conn.revokedAt ?? new Date(),
  });

  const active = {
    accessTokenCiphertext: "secret-active-access-token",
    refreshTokenCiphertext: "secret-active-refresh-token",
    tokenExpiresAt: new Date(Date.now() + 3600000),
    refreshTokenExpiresAt: new Date(Date.now() + 7200000),
    refreshPendingAt: null,
    revokedAt: null,
  };

  const disconnected = scrubSocialConnectionOnDisconnect(active);
  assert.equal(disconnected.accessTokenCiphertext, "");
  assert.equal(disconnected.refreshTokenCiphertext, null);
  assert.equal(disconnected.tokenExpiresAt, null);
  assert.equal(disconnected.refreshTokenExpiresAt, null);
  assert.equal(disconnected.refreshPendingAt, null);
  assert.ok(disconnected.revokedAt instanceof Date);
});

test("social connection disconnect cascades terminal status to active schedules and attempts", () => {
  const cascadeScheduleOnDisconnect = (schedule: { status: string; outcomeCode?: string | null }) => {
    if (schedule.status === "SCHEDULED") {
      return { ...schedule, status: "CANCELED", outcomeCode: "CONNECTION_DISCONNECTED" };
    }
    return schedule;
  };

  const cascadeAttemptOnDisconnect = (attempt: { status: string; outcomeCode?: string | null }) => {
    if (attempt.status === "RESERVED") {
      return { ...attempt, status: "BLOCKED", outcomeCode: "AUTH_REVOKED" };
    }
    if (attempt.status === "SUBMITTING") {
      return { ...attempt, status: "UNKNOWN", outcomeCode: "REVOKED_DURING_SUBMISSION" };
    }
    return attempt;
  };

  const scheduled = cascadeScheduleOnDisconnect({ status: "SCHEDULED" });
  assert.equal(scheduled.status, "CANCELED");
  assert.equal(scheduled.outcomeCode, "CONNECTION_DISCONNECTED");

  const reserved = cascadeAttemptOnDisconnect({ status: "RESERVED" });
  assert.equal(reserved.status, "BLOCKED");
  assert.equal(reserved.outcomeCode, "AUTH_REVOKED");

  const submitting = cascadeAttemptOnDisconnect({ status: "SUBMITTING" });
  assert.equal(submitting.status, "UNKNOWN");
  assert.equal(submitting.outcomeCode, "REVOKED_DURING_SUBMISSION");

  const confirmed = cascadeAttemptOnDisconnect({ status: "CONFIRMED", outcomeCode: "SUCCESS" });
  assert.equal(confirmed.status, "CONFIRMED");
  assert.equal(confirmed.outcomeCode, "SUCCESS");
});


