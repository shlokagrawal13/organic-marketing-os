import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { youtubePolicyFingerprint, youtubeReviewInput, youtubeUploadMetadata } from "../packages/core/youtube-policy";

const review = youtubeReviewInput.parse({
  connectionId: randomUUID(),
  privacyStatus: "private",
  selfDeclaredMadeForKids: false,
  containsSyntheticMedia: true,
  metadataReviewed: true,
  audienceReviewed: true,
  syntheticMediaReviewed: true,
  rightsAndPlatformRulesReviewed: true,
});
const draft = {
  title: "Approved title",
  platform: "YouTube",
  format: "Video",
  hook: "Approved hook",
  body: "Approved body",
  cta: "Approved CTA",
  scenes: [],
};

test("YouTube upload metadata is derived only from approved snapshot and explicit disclosures", () => {
  const metadata = youtubeUploadMetadata(draft, review);
  assert.deepEqual(metadata, {
    snippet: { title: "Approved title", description: "Approved hook\n\nApproved body\n\nApproved CTA" },
    status: { privacyStatus: "private", selfDeclaredMadeForKids: false, containsSyntheticMedia: true },
  });
  const keys = { intentId: randomUUID(), connectionId: review.connectionId, contentRevision: 1, renderId: randomUUID() };
  assert.equal(youtubePolicyFingerprint({ ...keys, metadata }), youtubePolicyFingerprint({
    ...keys,
    metadata: { status: { containsSyntheticMedia: true, selfDeclaredMadeForKids: false, privacyStatus: "private" },
      snippet: { description: metadata.snippet.description, title: metadata.snippet.title } },
  }));
  assert.equal(youtubeReviewInput.safeParse({ ...review, metadataReviewed: false }).success, false);
  assert.equal(youtubeReviewInput.safeParse({ ...review, privacyStatus: "scheduled" }).success, false);
  assert.throws(() => youtubeUploadMetadata({ ...draft, title: "x".repeat(101) }, review), /title/);
  assert.throws(() => youtubeUploadMetadata({ ...draft, body: "界".repeat(1700) }, review), /5000 UTF-8 bytes/);
  assert.throws(() => youtubeUploadMetadata({ ...draft, title: "<unapproved>" }, review), /title/);
  assert.throws(() => youtubeUploadMetadata({ ...draft, platform: "LinkedIn" }, review), /Only approved YouTube videos/);
});
