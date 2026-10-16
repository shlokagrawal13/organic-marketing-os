import { isIP } from "node:net";

export const claimEvidencePolicyVersion = "claim-evidence-source-2026-10-15";
export const claimEvidenceMaximumAgeDays = 30;
export const claimEvidenceMaximumAgeMs = claimEvidenceMaximumAgeDays * 86400000;
export const claimEvidenceFutureSkewMs = 5 * 60000;

export class EvidenceSourcePolicyError extends Error {}

/** A syntactic source-reference gate; no DNS lookup or URL fetch is performed. */
export function canonicalEvidenceSourceUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new EvidenceSourcePolicyError("Enter a valid evidence URL.");
  }
  if (url.protocol !== "https:")
    throw new EvidenceSourcePolicyError("Evidence links must use HTTPS.");
  if (url.username || url.password)
    throw new EvidenceSourcePolicyError(
      "Evidence links cannot contain credentials.",
    );
  if (url.port)
    throw new EvidenceSourcePolicyError(
      "Evidence links cannot use a custom port.",
    );
  const host = url.hostname
    .toLowerCase()
    .replace(/^\[|\]$/gu, "")
    .replace(/\.$/u, "");
  if (
    isIP(host) ||
    !host.includes(".") ||
    host.length > 253 ||
    host
      .split(".")
      .some(
        (label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label),
      ) ||
    host === "home.arpa" ||
    host.endsWith(".home.arpa") ||
    [
      "example",
      "internal",
      "invalid",
      "local",
      "localhost",
      "onion",
      "test",
    ].some((suffix) => host === suffix || host.endsWith("." + suffix))
  )
    throw new EvidenceSourcePolicyError(
      "Evidence links must use a public domain name.",
    );
  url.hash = "";
  return url.href;
}

export function claimEvidenceTimeStatus(
  checkedAt: string | Date,
  now = new Date(),
) {
  const checked = new Date(checkedAt).getTime();
  if (!Number.isFinite(checked) || !Number.isFinite(now.getTime()))
    return "EXPIRED";
  if (checked > now.getTime() + claimEvidenceFutureSkewMs) return "FUTURE";
  return checked < now.getTime() - claimEvidenceMaximumAgeMs
    ? "EXPIRED"
    : "CURRENT";
}

export function claimEvidenceExpiresAt(checkedAt: string | Date) {
  return new Date(
    new Date(checkedAt).getTime() + claimEvidenceMaximumAgeMs,
  ).toISOString();
}
