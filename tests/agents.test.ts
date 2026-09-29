import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agentRoles,
  buildAgentPlan,
  contextArtifact,
  freezeAgentContext,
  mappedAgentRoles,
  reviewAgentOutput,
} from "../packages/core/agents";

test("all 18 specified agents have explicit responsibilities and are mapped into a task graph", () => {
  assert.equal(agentRoles.length, 18);
  const mapped = mappedAgentRoles();
  for (const role of agentRoles) assert.equal(mapped.has(role), true, role);
  for (const task of ["strategy", "content", "scene"] as const) {
    const plan = buildAgentPlan(task);
    assert.equal(plan.steps.at(-1)?.kind, "human");
    assert.equal(
      plan.steps.filter((node) => node.kind === "generate").length,
      1,
    );
    const seen = new Set<string>();
    for (const node of plan.steps) {
      assert.ok(node.responsibility.length > 20);
      assert.ok(node.dependsOn.every((id) => seen.has(id)));
      seen.add(node.id);
    }
  }
});

test("agent context is frozen and research/community agents disclose absent external evidence", () => {
  const source = {
    input: { prompt: "Build a campaign for product launch" },
    brand: {
      revision: 4,
      profile: { audience: "Operators" },
      creativeDna: {},
      approvedContent: [{ id: "approved-1", title: "Known good" }],
    },
  };
  const frozen = freezeAgentContext(source);
  source.brand.profile.audience = "Changed later";
  assert.equal(frozen.brand.profile.audience, "Operators");
  const research = buildAgentPlan("strategy").steps.find(
    (node) => node.role === "research",
  )!;
  assert.equal(
    contextArtifact(research, frozen).inputs.externalEvidence,
    "not_supplied",
  );
  const ideation = buildAgentPlan("content").steps.find(
    (node) => node.role === "content-ideation",
  )!;
  assert.equal(
    contextArtifact(ideation, frozen).inputs.approvedContent.length,
    1,
  );
});

test("agent critique blocks obvious guarantees and always requires a human gate", () => {
  const content = {
    title: "Campaign",
    platform: "LinkedIn" as const,
    format: "Text" as const,
    hook: "Guaranteed results",
    body: "This will go viral for every business.",
    cta: "Start now",
    scenes: [],
  };
  const review = reviewAgentOutput("content", content);
  assert.equal(review.passed, false);
  assert.equal(review.requiresHumanReview, true);
  assert.ok(review.findings.some((finding) => finding.severity === "block"));
});
