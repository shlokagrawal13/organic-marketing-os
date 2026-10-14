import { test } from "node:test";
import assert from "node:assert/strict";
import {
  claimPolicyVersion,
  detectClaimSignals,
  evaluateClaimPolicy,
} from "../packages/core/claim-policy";

const content = {
  title: "Research-backed growth",
  hook: "Grow leads by 35% in 3 months",
  body: "Our award-winning workflow is more effective than spreadsheets.",
  cta: "See why teams choose the #1 planning workflow.",
  scenes: [
    {
      voiceover: "Trusted by 500 customers",
      onScreenText: "2x ROI",
      caption: "Scientifically proven",
      cta: "Start now",
    },
  ],
};

test("bounded claim policy detects deterministic field-bound signals", () => {
  const first = evaluateClaimPolicy(content);
  const second = evaluateClaimPolicy(content);
  assert.equal(first.policyVersion, claimPolicyVersion);
  assert.deepEqual(first, second);
  assert.ok(first.claims.some((claim) => claim.kind === "NUMERIC_RESULT"));
  assert.ok(first.claims.some((claim) => claim.kind === "COMPARATIVE"));
  assert.ok(first.claims.some((claim) => claim.kind === "PROOF_ASSERTION"));
  assert.ok(
    first.claims.some((claim) => claim.location === "scenes[0].onScreenText"),
  );
  assert.match(first.claimSetFingerprint, /^[a-f0-9]{64}$/u);
  assert.equal(
    new Set(first.claims.map((claim) => claim.id)).size,
    first.claims.length,
  );
});

test("ordinary unquantified copy remains claim-review free", () => {
  assert.deepEqual(
    detectClaimSignals({
      title: "Plan content together",
      hook: "Give your team a shared starting point",
      body: "Organize ideas, drafts and feedback in one workspace.",
      cta: "Explore the workflow",
      scenes: [],
    }),
    [],
  );
});
