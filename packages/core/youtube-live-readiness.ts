import { decryptSocialToken, encryptSocialToken, type SocialTokenContext } from "./social-tokens";
import { youtubeOAuthConfig } from "./youtube-oauth";
import { youtubePolicyMaintenanceCurrent, youtubePolicyVersion } from "./youtube-policy";

export type YoutubeLiveReadinessCheck = {
  id: string;
  ok: boolean;
  severity: "critical" | "warning";
  message: string;
};

export type YoutubeLiveReadiness = {
  ok: boolean;
  checkedAt: string;
  policyVersion: string;
  checks: YoutubeLiveReadinessCheck[];
};

type Env = Record<string, string | undefined>;

function present(value: string | undefined) {
  return Boolean(value?.trim());
}

function check(
  checks: YoutubeLiveReadinessCheck[],
  id: string,
  ok: boolean,
  message: string,
  severity: YoutubeLiveReadinessCheck["severity"] = "critical",
) {
  checks.push({ id, ok, severity, message });
}

function tokenRoundTrip(env: Env) {
  const context: SocialTokenContext = {
    organizationId: "00000000-0000-4000-8000-000000000001",
    provider: "YOUTUBE",
    externalAccountId: "readiness-channel",
  };
  const encrypted = encryptSocialToken("readiness-token", context, env.SOCIAL_TOKEN_ENCRYPTION_KEY);
  return decryptSocialToken(encrypted, context, env.SOCIAL_TOKEN_ENCRYPTION_KEY) === "readiness-token";
}

function httpsOrigin(value: string | undefined, production: boolean) {
  if (!production) return true;
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function evaluateYoutubeLiveReadiness(
  env: Env = process.env,
  now = new Date(),
): YoutubeLiveReadiness {
  const checks: YoutubeLiveReadinessCheck[] = [];
  const production = env.NODE_ENV === "production";

  check(
    checks,
    "live-dispatch-enabled",
    env.YOUTUBE_LIVE_DISPATCH_ENABLED === "true",
    "YOUTUBE_LIVE_DISPATCH_ENABLED must be true for an authorized live test.",
  );
  check(
    checks,
    "operator-policy-review-current",
    youtubePolicyMaintenanceCurrent(env, now),
    "YOUTUBE_POLICY_REVIEWED_VERSION and YOUTUBE_POLICY_REVIEWED_AT must record a current operator review.",
  );

  let oauthReady = true;
  try {
    youtubeOAuthConfig(env);
  } catch {
    oauthReady = false;
  }
  check(
    checks,
    "youtube-oauth-config",
    oauthReady,
    "YouTube OAuth client ID, secret and registered callback URI must be configured.",
  );

  let tokenKeyReady = true;
  try {
    tokenKeyReady = tokenRoundTrip(env);
  } catch {
    tokenKeyReady = false;
  }
  check(
    checks,
    "social-token-encryption",
    tokenKeyReady,
    "SOCIAL_TOKEN_ENCRYPTION_KEY must be a valid 32-byte base64 key and pass an AES-GCM round trip.",
  );

  check(checks, "database-url", present(env.DATABASE_URL), "DATABASE_URL must be configured.");
  check(checks, "redis-url", present(env.REDIS_URL), "REDIS_URL must be configured.");
  check(
    checks,
    "private-object-storage",
    ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY"].every((name) => present(env[name])),
    "Private S3-compatible object storage endpoint, bucket and credentials must be configured.",
  );
  check(
    checks,
    "production-web-origin",
    httpsOrigin(env.WEB_ORIGIN, production),
    "Production WEB_ORIGIN must be HTTPS.",
  );
  check(
    checks,
    "secure-production-cookie",
    !production || env.COOKIE_SECURE === "true",
    "COOKIE_SECURE must be true in production.",
  );

  const criticalFailures = checks.some((item) => item.severity === "critical" && !item.ok);
  return {
    ok: !criticalFailures,
    checkedAt: now.toISOString(),
    policyVersion: youtubePolicyVersion,
    checks,
  };
}
