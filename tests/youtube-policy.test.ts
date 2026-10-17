import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { youtubePolicyFingerprint, youtubeReviewInput, youtubeUploadMetadata } from "../packages/core/youtube-policy";
import { createYoutubeMetadataPolicy, createWorkspaceYoutubeMetadataPolicy, youtubeMetadataPolicy } from "../packages/core/youtube-rules";
import configuredRules from "../packages/core/youtube-rules.json";

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

test("declarative YouTube rules tighten metadata and disclosure without changing application code", () => {
  const policy = createYoutubeMetadataPolicy({ ...configuredRules,
    titleMaxCharacters: 20, descriptionMaxUtf8Bytes: 12,
    allowedPrivacyStatuses: ["private"], requireSyntheticMediaDeclaration: true });
  assert.deepEqual(policy.baseMetadata({ ...draft, title: "Short", hook: "界界界界", body: "", cta: "" }),
    { title: "Short", description: "界界界界" });
  assert.throws(() => policy.baseMetadata({ ...draft, title: "x".repeat(21) }), /title/);
  assert.throws(() => policy.baseMetadata({ ...draft, hook: "界界界界界", body: "", cta: "" }), /12 UTF-8 bytes/);
  assert.throws(() => policy.checkDeclarations({ privacyStatus: "public", containsSyntheticMedia: true }), /visibility/);
  assert.throws(() => policy.checkDeclarations({ privacyStatus: "private", containsSyntheticMedia: false }), /synthetic-media/);
  policy.checkDeclarations({ privacyStatus: "private", containsSyntheticMedia: true });
  assert.notEqual(policy.fingerprint, youtubeMetadataPolicy.fingerprint);
});

test("invalid rules fail closed and every meaningful rule change changes policy identity", () => {
  for (const change of [
    { titleMaxCharacters: 101 }, { titleMaxCharacters: 0 }, { titleMaxCharacters: 1.5 },
    { descriptionMaxUtf8Bytes: 5001 }, { allowedPrivacyStatuses: [] },
    { allowedPrivacyStatuses: ["private", "private"] }, { allowedPrivacyStatuses: ["scheduled"] },
    { platform: "TikTok" }, { format: "Image" }, { requireSyntheticMediaDeclaration: "false" },
    { unknownRule: true }, { revision: "" },
  ]) assert.throws(() => createYoutubeMetadataPolicy({ ...configuredRules, ...change }));
  for (const change of [
    { revision: "new-revision" }, { titleMaxCharacters: 99 }, { descriptionMaxUtf8Bytes: 4999 },
    { allowedPrivacyStatuses: ["private"] }, { requireSyntheticMediaDeclaration: true },
  ]) assert.notEqual(createYoutubeMetadataPolicy({ ...configuredRules, ...change }).fingerprint,
    youtubeMetadataPolicy.fingerprint);
  assert.equal(createYoutubeMetadataPolicy({ ...configuredRules,
    allowedPrivacyStatuses: [...configuredRules.allowedPrivacyStatuses].reverse() }).fingerprint,
    youtubeMetadataPolicy.fingerprint);
  assert.equal(Object.isFrozen(youtubeMetadataPolicy.rules.allowedPrivacyStatuses), true);
});

test("workspace rules may tighten but never loosen deployment metadata or disclosures", () => {
  const deployment = createYoutubeMetadataPolicy({ ...configuredRules, titleMaxCharacters: 80,
    descriptionMaxUtf8Bytes: 4000, allowedPrivacyStatuses: ["private"],
    requireSyntheticMediaDeclaration: true });
  const allowed = { ...deployment.rules, titleMaxCharacters: 60 };
  assert.equal(createWorkspaceYoutubeMetadataPolicy(allowed, deployment).rules.titleMaxCharacters, 60);
  for (const change of [{ titleMaxCharacters: 81 }, { descriptionMaxUtf8Bytes: 4001 },
    { allowedPrivacyStatuses: ["public"] }, { requireSyntheticMediaDeclaration: false }])
    assert.throws(() => createWorkspaceYoutubeMetadataPolicy({ ...allowed, ...change }, deployment), /cannot loosen/);
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
