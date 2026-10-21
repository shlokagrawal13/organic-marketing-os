// Harness-only reconciliation contract. It does not contact providers, prove
// inventory completeness, or authorize a deployed recovery or remote replay.
import assert from "node:assert/strict";

function requireText(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.ok(value.length > 0 && value.trim() === value, `${label} is required`);
}

function requireRecord(value, label) {
  assert.ok(
    value && typeof value === "object" && !Array.isArray(value),
    `${label} must be a record`,
  );
}

export async function withReconciledHistoricalEffects(evidence, start) {
  requireRecord(evidence, "Reconciliation evidence");
  requireText(evidence.databasePoint, "Database recovery point");
  assert.equal(
    evidence.inventoryComplete,
    true,
    "Complete external-effect inventory required",
  );
  assert.ok(Array.isArray(evidence.effects), "Effect inventory required");
  assert.ok(
    Array.isArray(evidence.receipts),
    "Reconciliation receipts required",
  );
  assert.equal(typeof start, "function", "Start callback required");

  const effects = new Map();
  const providerOperations = new Set();
  for (const effect of evidence.effects) {
    requireRecord(effect, "External effect");
    for (const key of [
      "operationId",
      "requestHash",
      "provider",
      "providerOperationId",
    ])
      requireText(effect[key], `Effect ${key}`);
    assert.equal(
      effect.happenedAfterPoint,
      true,
      "Post-target external effect must be established",
    );
    assert.equal(
      effects.has(effect.operationId),
      false,
      "Duplicate external-effect operation ID",
    );
    const providerOperation = JSON.stringify([
      effect.provider,
      effect.providerOperationId,
    ]);
    assert.equal(
      providerOperations.has(providerOperation),
      false,
      "Ambiguous provider operation appears in multiple effects",
    );
    effects.set(effect.operationId, effect);
    providerOperations.add(providerOperation);
  }

  const reconciled = new Set();
  for (const receipt of evidence.receipts) {
    requireRecord(receipt, "Reconciliation receipt");
    requireText(receipt.operationId, "Receipt operation ID");
    const effect = effects.get(receipt.operationId);
    assert.ok(effect, "Unknown external-effect receipt");
    assert.equal(
      reconciled.has(receipt.operationId),
      false,
      "Duplicate external-effect receipt",
    );
    assert.equal(
      receipt.databasePoint,
      evidence.databasePoint,
      "Receipt recovery point mismatch",
    );
    for (const key of ["requestHash", "provider", "providerOperationId"])
      assert.equal(receipt[key], effect[key], `Receipt ${key} mismatch`);
    assert.equal(
      receipt.disposition,
      "DO_NOT_REPLAY",
      "Reconciled external effects must not be replayed",
    );
    assert.equal(
      receipt.evidenceKind,
      "PROVIDER_CONFIRMED",
      "Provider-confirmed external-effect evidence required",
    );
    assert.equal(
      receipt.reviewed,
      true,
      "External-effect receipt review required",
    );
    reconciled.add(receipt.operationId);
  }
  assert.equal(
    reconciled.size,
    effects.size,
    "Missing external-effect reconciliation receipt",
  );
  return await start();
}
