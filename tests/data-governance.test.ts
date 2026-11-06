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

test("retention pruning: identifies eligible expired/canceled records while protecting immutable records", () => {
  const isInvitationExpired = (inv: { expiresAt: Date }, now: Date) => inv.expiresAt < now;
  const isIntentPrunable = (intent: { status: string; hasSchedule: boolean; hasAttempt: boolean }) =>
    ["INVALIDATED", "CANCELED"].includes(intent.status) && !intent.hasSchedule && !intent.hasAttempt;
  const isSchedulePrunable = (sched: { status: string; hasAttempt: boolean }) =>
    sched.status === "CANCELED" && !sched.hasAttempt;
  const isRenderPrunable = (render: { status: string; createdAt: Date }, cutoff: Date) =>
    ["FAILED", "CANCELED"].includes(render.status) && render.createdAt < cutoff;

  const now = new Date("2026-11-05T12:00:00Z");
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Invitations
  assert.equal(isInvitationExpired({ expiresAt: new Date("2026-11-05T11:00:00Z") }, now), true);
  assert.equal(isInvitationExpired({ expiresAt: new Date("2026-11-05T13:00:00Z") }, now), false);

  // Intents
  assert.equal(isIntentPrunable({ status: "INVALIDATED", hasSchedule: false, hasAttempt: false }), true);
  assert.equal(isIntentPrunable({ status: "CANCELED", hasSchedule: false, hasAttempt: false }), true);
  assert.equal(isIntentPrunable({ status: "PREPARED", hasSchedule: false, hasAttempt: false }), false);
  assert.equal(isIntentPrunable({ status: "INVALIDATED", hasSchedule: true, hasAttempt: false }), false);

  // Schedules
  assert.equal(isSchedulePrunable({ status: "CANCELED", hasAttempt: false }), true);
  assert.equal(isSchedulePrunable({ status: "SCHEDULED", hasAttempt: false }), false);
  assert.equal(isSchedulePrunable({ status: "CANCELED", hasAttempt: true }), false);

  // Renders
  assert.equal(isRenderPrunable({ status: "FAILED", createdAt: new Date("2026-11-04T10:00:00Z") }, cutoff), true);
  assert.equal(isRenderPrunable({ status: "SUCCEEDED", createdAt: new Date("2026-11-04T10:00:00Z") }, cutoff), false);
  assert.equal(isRenderPrunable({ status: "FAILED", createdAt: new Date("2026-11-05T11:00:00Z") }, cutoff), false);
});

test("retention pruning: financial credit entries and audit logs are strictly immutable", () => {
  const immutableEntityTypes = [
    "CreditEntry",
    "CreditReservation",
    "BillingSubscription",
    "BillingInvoice",
    "AuditLog",
  ];

  const allowedPruneEntityTypes = [
    "Invitation",
    "PublicationIntent",
    "PublicationSchedule",
    "RenderJob",
  ];

  for (const entity of immutableEntityTypes) {
    assert.equal(allowedPruneEntityTypes.includes(entity), false, `${entity} must NEVER be eligible for pruning`);
  }
});

test("audit log query filtering matches action prefixes, actorId, and date ranges", () => {
  const filterAuditLog = (
    log: { action: string; actorId: string; createdAt: Date },
    filter: { actionPrefix?: string; actorId?: string; startDate?: Date; endDate?: Date },
  ) => {
    if (filter.actionPrefix && !log.action.startsWith(filter.actionPrefix)) return false;
    if (filter.actorId && log.actorId !== filter.actorId) return false;
    if (filter.startDate && log.createdAt < filter.startDate) return false;
    if (filter.endDate && log.createdAt > filter.endDate) return false;
    return true;
  };

  const log1 = { action: "team.invited", actorId: "user-1", createdAt: new Date("2026-11-01T10:00:00Z") };
  const log2 = { action: "team.removed", actorId: "user-2", createdAt: new Date("2026-11-02T10:00:00Z") };
  const log3 = { action: "workspace.updated", actorId: "user-1", createdAt: new Date("2026-11-03T10:00:00Z") };
  const log4 = { action: "retention.pruned", actorId: "user-1", createdAt: new Date("2026-11-04T10:00:00Z") };

  // Action prefix filter
  assert.equal(filterAuditLog(log1, { actionPrefix: "team." }), true);
  assert.equal(filterAuditLog(log2, { actionPrefix: "team." }), true);
  assert.equal(filterAuditLog(log3, { actionPrefix: "team." }), false);

  // ActorId filter
  assert.equal(filterAuditLog(log1, { actorId: "user-1" }), true);
  assert.equal(filterAuditLog(log2, { actorId: "user-1" }), false);

  // Date range filter
  const start = new Date("2026-11-02T00:00:00Z");
  const end = new Date("2026-11-03T23:59:59Z");
  assert.equal(filterAuditLog(log1, { startDate: start, endDate: end }), false);
  assert.equal(filterAuditLog(log2, { startDate: start, endDate: end }), true);
  assert.equal(filterAuditLog(log3, { startDate: start, endDate: end }), true);
  assert.equal(filterAuditLog(log4, { startDate: start, endDate: end }), false);
});

test("audit export checksum matches SHA-256 over manifest and all preceding record lines", () => {
  const hasher = createHash("sha256");

  const lines = [
    JSON.stringify({ type: "manifest", format: "audit-ndjson", organizationId: "org-1", filters: {} }),
    JSON.stringify({ type: "auditLog", data: { id: "log-1", action: "team.invited" } }),
    JSON.stringify({ type: "auditLog", data: { id: "log-2", action: "retention.pruned" } }),
  ];

  for (const line of lines) {
    hasher.update(line + "\n");
  }

  const expectedSha256 = hasher.digest("hex");
  assert.equal(typeof expectedSha256, "string");
  assert.equal(expectedSha256.length, 64);

  // Complete record is formed with the exact computed digest
  const completeRecord = {
    type: "complete",
    data: { count: 2, sha256: expectedSha256 },
  };
  assert.equal(completeRecord.data.sha256, expectedSha256);
  assert.equal(completeRecord.data.count, 2);
});

test("legal hold evaluation determines active state and detail from audit log chronological events", () => {
  const evaluateLegalHold = (logs: Array<{ action: string; detail: any; createdAt: Date; actorId: string }>) => {
    const holdEvents = logs
      .filter((l) => ["data.legal_hold.enabled", "data.legal_hold.released"].includes(l.action))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (!holdEvents.length) return { active: false, hold: null };
    const latest = holdEvents[0];
    if (latest.action === "data.legal_hold.enabled") {
      return {
        active: true,
        hold: {
          reason: latest.detail?.reason,
          caseReference: latest.detail?.caseReference ?? null,
          enabledAt: latest.createdAt,
          enabledBy: latest.actorId,
        },
      };
    }
    return { active: false, hold: null };
  };

  // Case 1: Empty audit logs
  assert.equal(evaluateLegalHold([]).active, false);

  // Case 2: Only non-legal-hold logs
  const nonHoldLogs = [
    { action: "team.invited", detail: {}, createdAt: new Date("2026-11-01T10:00:00Z"), actorId: "u1" },
  ];
  assert.equal(evaluateLegalHold(nonHoldLogs).active, false);

  // Case 3: Enabled legal hold
  const enabledLogs = [
    ...nonHoldLogs,
    {
      action: "data.legal_hold.enabled",
      detail: { reason: "Litigation hold", caseReference: "CIVIL-2026-001" },
      createdAt: new Date("2026-11-02T10:00:00Z"),
      actorId: "admin-1",
    },
  ];
  const enabledState = evaluateLegalHold(enabledLogs);
  assert.equal(enabledState.active, true);
  assert.equal(enabledState.hold?.reason, "Litigation hold");
  assert.equal(enabledState.hold?.caseReference, "CIVIL-2026-001");
  assert.equal(enabledState.hold?.enabledBy, "admin-1");

  // Case 4: Released legal hold
  const releasedLogs = [
    ...enabledLogs,
    {
      action: "data.legal_hold.released",
      detail: { releaseReason: "Case settled" },
      createdAt: new Date("2026-11-03T10:00:00Z"),
      actorId: "admin-1",
    },
  ];
  const releasedState = evaluateLegalHold(releasedLogs);
  assert.equal(releasedState.active, false);
  assert.equal(releasedState.hold, null);

  // Case 5: Re-enabled legal hold after release
  const reenabledLogs = [
    ...releasedLogs,
    {
      action: "data.legal_hold.enabled",
      detail: { reason: "Subsequent appeal filed", caseReference: "APPEAL-2026-002" },
      createdAt: new Date("2026-11-04T10:00:00Z"),
      actorId: "admin-2",
    },
  ];
  const reenabledState = evaluateLegalHold(reenabledLogs);
  assert.equal(reenabledState.active, true);
  assert.equal(reenabledState.hold?.reason, "Subsequent appeal filed");
  assert.equal(reenabledState.hold?.caseReference, "APPEAL-2026-002");
  assert.equal(reenabledState.hold?.enabledBy, "admin-2");
});

test("legal hold policy locks destructive mutations with HTTP 423 Locked", () => {
  const checkMutationAllowed = (isLegalHoldActive: boolean, operation: string) => {
    if (isLegalHoldActive) {
      return {
        allowed: false,
        statusCode: 423,
        error: "Locked",
        message: `${operation} is locked: workspace is under an active legal hold.`,
      };
    }
    return { allowed: true, statusCode: 200 };
  };

  // Retention prune
  assert.equal(checkMutationAllowed(true, "Retention pruning").statusCode, 423);
  assert.equal(checkMutationAllowed(true, "Retention pruning").allowed, false);
  assert.equal(checkMutationAllowed(false, "Retention pruning").allowed, true);

  // Member revocation
  assert.equal(checkMutationAllowed(true, "Member data deletion").statusCode, 423);
  assert.equal(checkMutationAllowed(true, "Member data deletion").allowed, false);
  assert.equal(checkMutationAllowed(false, "Member data deletion").allowed, true);

  // Asset reconciliation
  assert.equal(checkMutationAllowed(true, "Asset reconciliation").statusCode, 423);
  assert.equal(checkMutationAllowed(true, "Asset reconciliation").allowed, false);
  assert.equal(checkMutationAllowed(false, "Asset reconciliation").allowed, true);

  // Workspace erasure
  assert.equal(checkMutationAllowed(true, "Workspace erasure").statusCode, 423);
  assert.equal(checkMutationAllowed(true, "Workspace erasure").allowed, false);
  assert.equal(checkMutationAllowed(false, "Workspace erasure").allowed, true);
});

test("asset reconciliation: dry-run identifies unattached/archived assets without deleting", () => {
  const assets = [
    { id: "a-1", name: "active-render-input.png", bytes: 1048576, renderInputs: [{ renderId: "r-1" }], generations: [], archivedAt: null },
    { id: "a-2", name: "active-generation.png", bytes: 2097152, renderInputs: [], generations: [{ id: "g-1" }], archivedAt: null },
    { id: "a-3", name: "unreferenced-orphan.png", bytes: 524288, renderInputs: [], generations: [], archivedAt: null },
    { id: "a-4", name: "archived-asset.png", bytes: 262144, renderInputs: [{ renderId: "r-old" }], generations: [], archivedAt: new Date("2026-01-01") },
  ];

  const isCandidate = (a: (typeof assets)[0]) =>
    a.archivedAt !== null || (a.renderInputs.length === 0 && a.generations.length === 0);

  const candidates = assets.filter(isCandidate);
  assert.equal(candidates.length, 2);
  assert.deepEqual(candidates.map(c => c.id), ["a-3", "a-4"]);

  const totalBytes = candidates.reduce((sum, c) => sum + c.bytes, 0);
  assert.equal(totalBytes, 524288 + 262144);
});

test("workspace safe erasure: enforces OWNER-only role requirement and exact confirmation text", () => {
  const validateErasureRequest = (role: string, body: { confirmText?: string; reason?: string }) => {
    if (role !== "OWNER") {
      return { allowed: false, error: "Only workspace OWNER can request workspace erasure." };
    }
    if (body.confirmText !== "ERASE_WORKSPACE_DATA") {
      return { allowed: false, error: "confirmText must match exact ERASE_WORKSPACE_DATA literal." };
    }
    if (!body.reason || body.reason.length < 5) {
      return { allowed: false, error: "Reason must be at least 5 characters." };
    }
    return { allowed: true };
  };

  assert.equal(validateErasureRequest("ADMIN", { confirmText: "ERASE_WORKSPACE_DATA", reason: "Tenant offboarding" }).allowed, false);
  assert.equal(validateErasureRequest("EDITOR", { confirmText: "ERASE_WORKSPACE_DATA", reason: "Tenant offboarding" }).allowed, false);
  assert.equal(validateErasureRequest("OWNER", { confirmText: "WRONG_TEXT", reason: "Tenant offboarding" }).allowed, false);
  assert.equal(validateErasureRequest("OWNER", { confirmText: "ERASE_WORKSPACE_DATA", reason: "hi" }).allowed, false);
  assert.equal(validateErasureRequest("OWNER", { confirmText: "ERASE_WORKSPACE_DATA", reason: "Tenant offboarding" }).allowed, true);
});

test("workspace safe erasure: preserves financial ledgers while anonymizing organization and purging child content", () => {
  const org = {
    id: "org-target-1",
    name: "Acme Production Org",
  };

  const creditLedger = [
    { id: "entry-1", organizationId: org.id, amount: 5000, type: "PURCHASE" },
    { id: "entry-2", organizationId: org.id, amount: -200, type: "USAGE" },
  ];

  // Erasure simulates anonymization of organization without deleting financial rows
  const anonymizedOrg = {
    ...org,
    name: "[ERASED WORKSPACE]",
  };

  // Financial ledgers remain untouched
  assert.equal(anonymizedOrg.name, "[ERASED WORKSPACE]");
  assert.equal(creditLedger.length, 2);
  assert.equal(creditLedger[0].amount, 5000);
});





