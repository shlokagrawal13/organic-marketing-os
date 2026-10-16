import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canonicalEvidenceSourceUrl,
  claimEvidenceTimeStatus,
  claimEvidenceExpiresAt,
  claimEvidenceMaximumAgeMs,
  EvidenceSourcePolicyError,
} from "../packages/core/evidence-source";

test("evidence URLs canonicalize without changing path or query", () => {
  assert.equal(
    canonicalEvidenceSourceUrl(
      "  https://Example.COM:443/Report?q=One#section  ",
    ),
    "https://example.com/Report?q=One",
  );
});

test("evidence references reject credentials, IPs and special-use hosts", () => {
  for (const url of [
    "not a URL",
    "http://example.com",
    "https://u:p@example.com",
    "https://example.com:8443",
    "https://127.0.0.1",
    "https://2130706433",
    "https://[::1]",
    "https://intranet",
    "https://localhost.",
    "https://a.local..",
    "https://a..com",
    "https://-invalid.com",
    "https://invalid_.com",
    `https://${"a".repeat(64)}.com`,
    "https://home.arpa",
    "https://a.home.arpa",
    ...[
      "example",
      "internal",
      "invalid",
      "local",
      "localhost",
      "onion",
      "test",
    ].flatMap((s) => [`https://a.${s}`, `https://a.${s}.`]),
  ]) {
    assert.throws(
      () => canonicalEvidenceSourceUrl(url),
      EvidenceSourcePolicyError,
      url,
    );
  }
});

test("evidence review age and future skew are bounded at exact milliseconds", () => {
  const now = new Date("2026-10-15T12:00:00Z");
  for (const [offset, status] of [
    [0, "CURRENT"],
    [-claimEvidenceMaximumAgeMs, "CURRENT"],
    [-claimEvidenceMaximumAgeMs - 1, "EXPIRED"],
    [300000, "CURRENT"],
    [300001, "FUTURE"],
  ] as const) {
    assert.equal(
      claimEvidenceTimeStatus(new Date(now.getTime() + offset), now),
      status,
    );
  }
  assert.equal(claimEvidenceTimeStatus("invalid", now), "EXPIRED");
  assert.equal(
    claimEvidenceExpiresAt("2026-10-01T00:00:00Z"),
    "2026-10-31T00:00:00.000Z",
  );
});
