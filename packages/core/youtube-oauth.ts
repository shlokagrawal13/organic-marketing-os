import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

// Provider endpoints are fixed. Credentials and redirect URI come from server secrets;
// callers cannot supply an arbitrary token or channel URL.
const authorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
const tokenEndpoint = "https://oauth2.googleapis.com/token";
const revocationEndpoint = "https://oauth2.googleapis.com/revoke";
const channelsEndpoint = "https://www.googleapis.com/youtube/v3/channels";
export const youtubeScopes = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.upload",
] as const;

export type YoutubeOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export function youtubeOAuthConfig(env = process.env): YoutubeOAuthConfig {
  const clientId = env.YOUTUBE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = env.YOUTUBE_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri = env.YOUTUBE_OAUTH_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri)
    throw new Error(
      "YouTube OAuth client credentials and redirect URI are required.",
    );
  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    throw new Error("YouTube OAuth redirect URI is invalid.");
  }
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/api/social/youtube/callback" ||
    (parsed.protocol !== "https:" &&
      !(
        env.NODE_ENV !== "production" &&
        parsed.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(parsed.hostname)
      ))
  )
    throw new Error(
      "YouTube OAuth redirect URI must be the registered callback on HTTPS (or local HTTP).",
    );
  return { clientId, clientSecret, redirectUri };
}

export function newYoutubeOAuthProof() {
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  return {
    state,
    verifier,
    challenge: createHash("sha256").update(verifier).digest("base64url"),
  };
}

export function youtubeAuthorizationUrl(
  config: YoutubeOAuthConfig,
  proof: ReturnType<typeof newYoutubeOAuthProof>,
) {
  const url = new URL(authorizationEndpoint);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: youtubeScopes.join(" "),
    access_type: "offline",
    state: proof.state,
    code_challenge: proof.challenge,
    code_challenge_method: "S256",
    prompt: "consent",
  }).toString();
  return url.toString();
}

const tokens = z.object({
  access_token: z.string().min(1),
  token_type: z.literal("Bearer"),
  expires_in: z.number().int().positive().max(86400),
  refresh_token: z.string().min(1).optional(),
  refresh_token_expires_in: z.number().int().positive().optional(),
  scope: z.string().optional(),
});
export type YoutubeTokens = z.infer<typeof tokens>;

async function boundedJson(response: Response) {
  if (!response.ok) throw new Error("Google authorization request failed.");
  const body = await response.text();
  if (body.length > 16384)
    throw new Error("Google authorization response is too large.");
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error("Google authorization response is invalid.");
  }
}

async function tokenRequest(
  config: YoutubeOAuthConfig,
  fields: Record<string, string>,
  fetchImpl: typeof fetch,
) {
  const response = await fetchImpl(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      ...fields,
    }),
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  const parsed = tokens.safeParse(await boundedJson(response));
  if (!parsed.success)
    throw new Error(
      "Google authorization response lacks required token fields.",
    );
  return parsed.data;
}

export async function exchangeYoutubeCode(
  config: YoutubeOAuthConfig,
  code: string,
  verifier: string,
  fetchImpl: typeof fetch = fetch,
) {
  if (!code || !verifier)
    throw new Error("YouTube authorization code and proof are required.");
  const granted = await tokenRequest(
    config,
    {
      code,
      code_verifier: verifier,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    },
    fetchImpl,
  );
  if (!granted.refresh_token)
    throw new Error(
      "Google did not grant offline access; reconnect with consent.",
    );
  const grantedScopes = granted.scope?.split(/\s+/) || [];
  if (!youtubeScopes.every((scope) => grantedScopes.includes(scope)))
    throw new Error("Google did not grant both required YouTube scopes.");
  return granted;
}

export async function refreshYoutubeToken(
  config: YoutubeOAuthConfig,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
) {
  if (!refreshToken) throw new Error("An offline YouTube grant is required.");
  const refreshed = await tokenRequest(
    config,
    {
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    },
    fetchImpl,
  );
  if (
    refreshed.scope &&
    !youtubeScopes.every((scope) =>
      refreshed.scope!.split(/\s+/).includes(scope),
    )
  )
    throw new Error("Google no longer grants the required YouTube scopes.");
  return refreshed;
}

export async function youtubeOwnChannel(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
) {
  if (!accessToken) throw new Error("An access token is required.");
  const url = new URL(channelsEndpoint);
  url.search = new URLSearchParams({
    part: "snippet",
    mine: "true",
    maxResults: "2",
  }).toString();
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  const parsed = z
    .object({
      items: z
        .array(
          z.object({
            id: z.string().min(1).max(128),
            snippet: z.object({ title: z.string().min(1).max(256) }),
          }),
        )
        .max(2),
    })
    .safeParse(await boundedJson(response));
  if (!parsed.success || parsed.data.items.length !== 1)
    throw new Error("Select one authorized YouTube channel before connecting.");
  const channel = parsed.data.items[0];
  return { id: channel.id, label: channel.snippet.title };
}

export async function revokeYoutubeGrant(
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
) {
  if (!refreshToken) throw new Error("An offline YouTube grant is required.");
  const response = await fetchImpl(revocationEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: refreshToken }),
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error("Google token revocation was not confirmed.");
}
