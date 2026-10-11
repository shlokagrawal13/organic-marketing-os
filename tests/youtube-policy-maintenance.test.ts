import { test } from "node:test";
import assert from "node:assert/strict";
import {
  youtubePolicyMaintenanceCurrent,
  youtubePolicyMaintenanceLifetimeMs,
  youtubePolicyVersion,
} from "../packages/core/youtube-policy";

test("live YouTube dispatch needs a current, exact policy maintenance receipt", () => {
  const now = new Date("2026-10-11T12:00:00.000Z");
  const config = { YOUTUBE_POLICY_REVIEWED_VERSION: youtubePolicyVersion,
    YOUTUBE_POLICY_REVIEWED_AT: "2026-10-11T11:59:59Z" };
  assert.equal(youtubePolicyMaintenanceCurrent(config, now), true);
  assert.equal(youtubePolicyMaintenanceCurrent({}, now), false);
  assert.equal(youtubePolicyMaintenanceCurrent({ ...config,
    YOUTUBE_POLICY_REVIEWED_VERSION: "older-rule" }, now), false);
  for (const at of ["2026-10-11", "invalid", "2026-10-11T12:00:01Z",
    "2026-02-30T10:00:00Z", new Date(now.getTime() - youtubePolicyMaintenanceLifetimeMs).toISOString()]) {
    assert.equal(youtubePolicyMaintenanceCurrent({ ...config, YOUTUBE_POLICY_REVIEWED_AT: at }, now), false, at);
  }
});
