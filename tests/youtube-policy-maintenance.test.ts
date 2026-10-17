import { test } from "node:test";
import assert from "node:assert/strict";
import {
  youtubePolicyMaintenanceCurrent,
  youtubePolicyMaintenanceLifetimeMs,
  youtubePolicySources,
  youtubePolicySourceFingerprint,
  youtubePolicyVersion,
} from "../packages/core/youtube-policy";

test("live YouTube dispatch needs a current, exact policy maintenance receipt", () => {
  const now = new Date("2026-10-11T12:00:00.000Z");
  const config = { YOUTUBE_POLICY_REVIEWED_VERSION: youtubePolicyVersion,
    YOUTUBE_POLICY_SOURCE_FINGERPRINT: youtubePolicySourceFingerprint,
    YOUTUBE_POLICY_REVIEWED_AT: "2026-10-11T11:59:59Z" };
  assert.equal(youtubePolicyMaintenanceCurrent(config, now), true);
  assert.equal(youtubePolicyMaintenanceCurrent({}, now), false);
  assert.equal(youtubePolicyMaintenanceCurrent({ ...config,
    YOUTUBE_POLICY_REVIEWED_VERSION: "older-rule" }, now), false);
  assert.equal(youtubePolicyMaintenanceCurrent({ ...config,
    YOUTUBE_POLICY_SOURCE_FINGERPRINT: "older-source-set" }, now), false);
  for (const at of ["2026-10-11", "invalid", "2026-10-11T12:00:01Z",
    "2026-02-30T10:00:00Z", new Date(now.getTime() - youtubePolicyMaintenanceLifetimeMs).toISOString()]) {
    assert.equal(youtubePolicyMaintenanceCurrent({ ...config, YOUTUBE_POLICY_REVIEWED_AT: at }, now), false, at);
  }
});

test("policy maintenance fingerprint binds the ordered official-source manifest", () => {
  assert.deepEqual(youtubePolicySources.map(({ id }) => id), [
    "videos-insert", "video-resource", "api-terms", "developer-policies",
    "required-minimum-functionality",
  ]);
  assert.match(youtubePolicySourceFingerprint, /^[a-f0-9]{64}$/u);
  assert.equal(new Set(youtubePolicySources.map(({ url }) => url)).size,
    youtubePolicySources.length);
  assert.equal(youtubePolicySources.every(({ url }) => {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "developers.google.com";
  }), true);
});
