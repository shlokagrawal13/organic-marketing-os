import { test } from "node:test";
import assert from "node:assert/strict";
import { withReconciledHistoricalEffects } from "../scripts/historical-effect-reconciliation.mjs";

function fixture() {
  const databasePoint = "0/100";
  const effects = [
    {
      operationId: "synthetic-generation",
      requestHash: "fixture-request-generation",
      provider: "synthetic-generation-provider",
      providerOperationId: "synthetic-provider-generation-1",
      happenedAfterPoint: true,
    },
    {
      operationId: "synthetic-publication",
      requestHash: "fixture-request-publication",
      provider: "synthetic-publication-provider",
      providerOperationId: "synthetic-provider-publication-1",
      happenedAfterPoint: true,
    },
  ];
  return {
    databasePoint,
    inventoryComplete: true,
    effects,
    receipts: effects.map(({ happenedAfterPoint, ...effect }) => ({
      ...effect,
      databasePoint,
      disposition: "DO_NOT_REPLAY",
      evidenceKind: "PROVIDER_CONFIRMED",
      reviewed: true,
    })),
  };
}

async function refuses(evidence: unknown, message: RegExp) {
  let starts = 0;
  await assert.rejects(
    withReconciledHistoricalEffects(evidence, async () => {
      starts++;
    }),
    message,
  );
  assert.equal(starts, 0, "Invalid reconciliation must never start recovery");
}

test("Historical effect reconciliation accepts complete reviewed receipts in any order and returns the callback result", async () => {
  const evidence = fixture();
  evidence.receipts.reverse();
  const before = structuredClone(evidence);
  const result = { started: true };
  let starts = 0;
  assert.equal(
    await withReconciledHistoricalEffects(evidence, async () => {
      starts++;
      return result;
    }),
    result,
  );
  assert.equal(starts, 1);
  assert.deepEqual(evidence, before);
});

test("Historical effect reconciliation accepts an explicitly complete empty inventory only with no receipts", async () => {
  const evidence = {
    databasePoint: "0/100",
    inventoryComplete: true,
    effects: [],
    receipts: [],
  };
  let starts = 0;
  await withReconciledHistoricalEffects(evidence, async () => {
    starts++;
  });
  assert.equal(starts, 1);
  await refuses(
    { ...evidence, inventoryComplete: false },
    /Complete.*inventory/,
  );
  await refuses(
    { ...evidence, inventoryComplete: undefined },
    /Complete.*inventory/,
  );
  await refuses(
    { ...evidence, receipts: [fixture().receipts[0]] },
    /Unknown external-effect receipt/,
  );
});

test("Historical effect reconciliation rejects missing recovery points, incomplete inventories and invalid collections before startup", async () => {
  for (const databasePoint of [undefined, null, "", " ", "0/100\n"])
    await refuses({ ...fixture(), databasePoint }, /Database recovery point/);
  for (const inventoryComplete of [undefined, false, "true"])
    await refuses({ ...fixture(), inventoryComplete }, /Complete.*inventory/);
  await refuses({ ...fixture(), effects: undefined }, /Effect inventory/);
  await refuses({ ...fixture(), receipts: {} }, /Reconciliation receipts/);
});

test("Historical effect reconciliation rejects duplicate or ambiguous effects and unobserved provider operations", async () => {
  const valid = fixture();
  await refuses(
    { ...valid, effects: [...valid.effects, valid.effects[0]] },
    /Duplicate external-effect operation ID/,
  );
  await refuses(
    {
      ...valid,
      effects: [
        valid.effects[0],
        { ...valid.effects[0], operationId: "another-operation" },
      ],
    },
    /Ambiguous provider operation/,
  );
  for (const key of [
    "operationId",
    "requestHash",
    "provider",
    "providerOperationId",
  ])
    for (const value of [undefined, "", " "])
      await refuses(
        {
          ...valid,
          effects: [{ ...valid.effects[0], [key]: value }, valid.effects[1]],
        },
        /Effect .* required|Effect .* string/,
      );
  for (const happenedAfterPoint of [undefined, false, "true"])
    await refuses(
      {
        ...valid,
        effects: [
          { ...valid.effects[0], happenedAfterPoint },
          valid.effects[1],
        ],
      },
      /Post-target external effect/,
    );
});

test("Historical effect reconciliation rejects missing, unknown and duplicate receipts even when one receipt is valid", async () => {
  const valid = fixture();
  await refuses(
    { ...valid, receipts: [valid.receipts[0]] },
    /Missing external-effect reconciliation receipt/,
  );
  await refuses(
    {
      ...valid,
      receipts: [
        valid.receipts[0],
        { ...valid.receipts[1], operationId: "unknown-operation" },
      ],
    },
    /Unknown external-effect receipt/,
  );
  await refuses(
    { ...valid, receipts: [valid.receipts[0], valid.receipts[0]] },
    /Duplicate external-effect receipt/,
  );
});

test("Historical effect reconciliation rejects mismatched, ambiguous, unreviewed and replay-permitting receipts", async () => {
  const valid = fixture();
  for (const [change, message] of [
    [{ databasePoint: "0/200" }, /recovery point mismatch/],
    [{ requestHash: "another-request" }, /requestHash mismatch/],
    [{ provider: "another-provider" }, /provider mismatch/],
    [
      { providerOperationId: "another-operation" },
      /providerOperationId mismatch/,
    ],
    [{ providerOperationId: undefined }, /providerOperationId mismatch/],
    [{ disposition: "RETRY" }, /must not be replayed/],
    [{ evidenceKind: "UNKNOWN" }, /Provider-confirmed/],
    [{ evidenceKind: "LOCAL_ASSUMPTION" }, /Provider-confirmed/],
    [{ reviewed: false }, /receipt review required/],
    [{ reviewed: "true" }, /receipt review required/],
  ] as const)
    await refuses(
      {
        ...valid,
        receipts: [valid.receipts[0], { ...valid.receipts[1], ...change }],
      },
      message,
    );
});

test("Historical effect reconciliation propagates a callback failure without retrying it", async () => {
  const failure = new Error("Synthetic startup failure");
  let starts = 0;
  await assert.rejects(
    withReconciledHistoricalEffects(fixture(), async () => {
      starts++;
      throw failure;
    }),
    (error) => error === failure,
  );
  assert.equal(starts, 1);
});
