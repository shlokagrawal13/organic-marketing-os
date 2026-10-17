import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes } from "node:crypto";
import { evaluateYoutubeLiveReadiness } from "../packages/core/youtube-live-readiness";
import { youtubePolicySourceFingerprint, youtubePolicyVersion } from "../packages/core/youtube-policy";

const now = new Date("2026-10-13T16:40:00.000Z");

function readyEnv() {
  return {
    NODE_ENV: "production",
    WEB_ORIGIN: "https://app.example.test",
    COOKIE_SECURE: "true",
    YOUTUBE_LIVE_DISPATCH_ENABLED: "true",
    YOUTUBE_POLICY_REVIEWED_VERSION: youtubePolicyVersion,
    YOUTUBE_POLICY_SOURCE_FINGERPRINT: youtubePolicySourceFingerprint,
    YOUTUBE_POLICY_REVIEWED_AT: "2026-10-13T16:35:00Z",
    YOUTUBE_OAUTH_CLIENT_ID: "youtube-client-id",
    YOUTUBE_OAUTH_CLIENT_SECRET: "youtube-client-secret",
    YOUTUBE_OAUTH_REDIRECT_URI: "https://api.example.test/api/social/youtube/callback",
    SOCIAL_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    DATABASE_URL: "postgresql://marketing:example@db.example.test:5432/marketing",
    REDIS_URL: "redis://redis.example.test:6379",
    S3_ENDPOINT: "https://objects.example.test",
    S3_BUCKET: "marketing-assets",
    S3_ACCESS_KEY: "readiness-access",
    S3_SECRET_KEY: "readiness-secret",
  };
}

test("YouTube live readiness passes only with current policy, OAuth, storage and secure production config", () => {
  const result = evaluateYoutubeLiveReadiness(readyEnv(), now);
  assert.equal(result.ok, true);
  assert.equal(result.checkedAt, now.toISOString());
  assert.equal(result.policyVersion, youtubePolicyVersion);
  assert.equal(result.policySourceFingerprint, youtubePolicySourceFingerprint);
  assert.deepEqual(result.checks.map((item) => [item.id, item.ok]), [
    ["live-dispatch-enabled", true],
    ["operator-policy-review-current", true],
    ["youtube-oauth-config", true],
    ["social-token-encryption", true],
    ["database-url", true],
    ["redis-url", true],
    ["private-object-storage", true],
    ["production-web-origin", true],
    ["secure-production-cookie", true],
  ]);
});

test("YouTube live readiness fails closed without exposing secret values", () => {
  const result = evaluateYoutubeLiveReadiness({
    NODE_ENV: "production",
    WEB_ORIGIN: "http://app.example.test",
    COOKIE_SECURE: "false",
    YOUTUBE_LIVE_DISPATCH_ENABLED: "false",
    YOUTUBE_POLICY_REVIEWED_VERSION: youtubePolicyVersion,
    YOUTUBE_POLICY_SOURCE_FINGERPRINT: "stale-source-manifest",
    YOUTUBE_POLICY_REVIEWED_AT: "2026-09-01T00:00:00Z",
    YOUTUBE_OAUTH_CLIENT_ID: "client",
    YOUTUBE_OAUTH_CLIENT_SECRET: "bad-secret-value",
    YOUTUBE_OAUTH_REDIRECT_URI: "https://evil.example.test/callback",
    SOCIAL_TOKEN_ENCRYPTION_KEY: "not-base64",
    DATABASE_URL: "",
    REDIS_URL: "",
    S3_ENDPOINT: "",
    S3_BUCKET: "",
    S3_ACCESS_KEY: "access-value",
    S3_SECRET_KEY: "secret-value",
  }, now);
  assert.equal(result.ok, false);
  assert.equal(result.checks.every((item) => !item.ok), true);
  assert.doesNotMatch(JSON.stringify(result), /bad-secret-value|access-value|secret-value|not-base64/u);
});
