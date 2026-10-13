import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluatePostingPolicy } from "../packages/core/posting-policy";

const config = {
  metadataSimilarityPercent: 70,
  topicOverlapPercent: 60,
  topicRepeatCount: 2,
  ctaRepeatCount: 2,
  minTopicTokens: 3,
};

function metadata(title: string, description: string) {
  return { snippet: { title, description } };
}

test("semantic posting policy flags metadata, topic and CTA repetition", () => {
  const result = evaluatePostingPolicy({
    config,
    currentMetadata: metadata(
      "Sunscreen and cleanser routine for summer skin",
      "Learn more about the daily skincare routine.",
    ),
    priors: [
      { id: "a", intentId: "intent-a", status: "SCHEDULED", at: new Date("2026-10-13T10:00:00Z"),
        metadata: metadata("Sunscreen cleanser routine for summer skin", "Learn more today.") },
      { id: "b", intentId: "intent-b", status: "CONFIRMED", at: new Date("2026-10-13T11:00:00Z"),
        metadata: metadata("Summer skin routine with sunscreen", "Learn more before you shop.") },
    ],
  });
  assert.deepEqual(result.warnings.map((warning) => warning.code), [
    "SIMILAR_METADATA",
    "REPEATED_TOPIC_CLUSTER",
    "REPEATED_CTA_PATTERN",
  ]);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("sunscreen and cleanser routine"), false);
  assert.equal(serialized.includes("Learn more about"), false);
  assert.deepEqual(result.signals.matches.similarMetadata, ["intent-a"]);
  assert.deepEqual(result.signals.matches.repeatedTopics, ["intent-a", "intent-b"]);
  assert.deepEqual(result.signals.matches.repeatedCtas, ["learn-more"]);
});

test("posting policy normalizes URLs, punctuation and filler words", () => {
  const result = evaluatePostingPolicy({
    config: { ...config, ctaRepeatCount: 1 },
    currentMetadata: metadata(
      "Visit: https://example.test Clean growth plan",
      "Book now for the plan, and visit www.example.test",
    ),
    priors: [
      { id: "prior", intentId: "intent-prior", status: "CONFIRMED",
        at: new Date("2026-10-13T09:00:00Z"),
        metadata: metadata("Clean growth plan", "Book now for details") },
    ],
  });
  assert.ok(result.warnings.some((warning) => warning.code === "SIMILAR_METADATA"));
  assert.ok(result.warnings.some((warning) => warning.code === "REPEATED_CTA_PATTERN"));
  assert.equal(JSON.stringify(result).includes("example.test"), false);
  assert.deepEqual(result.signals.matches.repeatedCtas, ["book-now"]);
});
