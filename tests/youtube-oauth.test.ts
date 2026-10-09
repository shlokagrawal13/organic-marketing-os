import { test } from "node:test";
import assert from "node:assert/strict";
import {
  exchangeYoutubeCode,
  newYoutubeOAuthProof,
  refreshYoutubeToken,
  revokeYoutubeGrant,
  youtubeAuthorizationUrl,
  youtubeOAuthConfig,
  youtubeOwnChannel,
  youtubeScopes,
} from "../packages/core/youtube-oauth";

const config = {
  clientId: "fixture-client",
  clientSecret: "fixture-secret",
  redirectUri: "https://api.example.test/api/social/youtube/callback",
};
const token = {
  access_token: "fixture-access",
  token_type: "Bearer",
  expires_in: 3600,
  refresh_token: "fixture-refresh",
  scope: youtubeScopes.join(" "),
};
function fake(
  body: unknown,
  status = 200,
  check?: (url: URL, options: RequestInit) => void,
): typeof fetch {
  return (async (url: URL | RequestInfo, options: RequestInit = {}) => {
    check?.(new URL(String(url)), options);
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
}

test("YouTube OAuth uses a fixed registered callback, offline consent, state and PKCE", () => {
  assert.deepEqual(
    youtubeOAuthConfig({
      NODE_ENV: "production",
      YOUTUBE_OAUTH_CLIENT_ID: config.clientId,
      YOUTUBE_OAUTH_CLIENT_SECRET: config.clientSecret,
      YOUTUBE_OAUTH_REDIRECT_URI: config.redirectUri,
    }),
    config,
  );
  for (const uri of [
    "http://api.example.test/api/social/youtube/callback",
    "https://api.example.test/other",
    "https://api.example.test/api/social/youtube/callback?next=evil",
    "https://evil@api.example.test/api/social/youtube/callback",
  ])
    assert.throws(() =>
      youtubeOAuthConfig({
        ...{
          NODE_ENV: "production",
          YOUTUBE_OAUTH_CLIENT_ID: config.clientId,
          YOUTUBE_OAUTH_CLIENT_SECRET: config.clientSecret,
        },
        YOUTUBE_OAUTH_REDIRECT_URI: uri,
      }),
    );
  const proof = newYoutubeOAuthProof(),
    other = newYoutubeOAuthProof();
  assert.notEqual(proof.state, other.state);
  assert.notEqual(proof.verifier, other.verifier);
  const url = new URL(youtubeAuthorizationUrl(config, proof));
  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(url.searchParams.get("state"), proof.state);
  assert.equal(url.searchParams.get("code_challenge"), proof.challenge);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.deepEqual(url.searchParams.get("scope")?.split(" "), [
    ...youtubeScopes,
  ]);
  assert.equal(url.searchParams.get("client_secret"), null);
});

test("code exchange validates granted scopes/offline token and sends proof only to Google", async () => {
  const result = await exchangeYoutubeCode(
    config,
    "one-time-code",
    "private-proof",
    fake(token, 200, (url, options) => {
      assert.equal(url.href, "https://oauth2.googleapis.com/token");
      assert.equal(options.method, "POST");
      assert.equal(options.redirect, "error");
      const body = new URLSearchParams(String(options.body));
      assert.equal(body.get("code_verifier"), "private-proof");
      assert.equal(body.get("redirect_uri"), config.redirectUri);
      assert.equal(body.get("grant_type"), "authorization_code");
    }),
  );
  assert.equal(result.refresh_token, token.refresh_token);
  await assert.rejects(
    () =>
      exchangeYoutubeCode(
        config,
        "code",
        "proof",
        fake({ ...token, refresh_token: undefined }),
      ),
    /offline access/,
  );
  await assert.rejects(
    () =>
      exchangeYoutubeCode(
        config,
        "code",
        "proof",
        fake({ ...token, scope: youtubeScopes[1] }),
      ),
    /both required/,
  );
  await assert.rejects(
    () =>
      exchangeYoutubeCode(
        config,
        "code",
        "proof",
        fake({ error: "invalid_grant", access_token: "secret" }, 400),
      ),
    /authorization request failed/,
  );
});

test("refresh handles rotation and rejects scope downgrade", async () => {
  const refreshed = await refreshYoutubeToken(
    config,
    "old-refresh",
    fake(
      {
        ...token,
        refresh_token: "rotated-refresh",
      },
      200,
      (url, options) => {
        assert.equal(url.href, "https://oauth2.googleapis.com/token");
        const body = new URLSearchParams(String(options.body));
        assert.equal(body.get("grant_type"), "refresh_token");
        assert.equal(body.get("refresh_token"), "old-refresh");
      },
    ),
  );
  assert.equal(refreshed.refresh_token, "rotated-refresh");
  await assert.rejects(
    () =>
      refreshYoutubeToken(
        config,
        "old",
        fake({
          ...token,
          scope: youtubeScopes[0],
        }),
      ),
    /no longer grants/,
  );
});

test("channel lookup rejects ambiguity and revocation requires a confirmed response", async () => {
  const own = await youtubeOwnChannel(
    "access",
    fake(
      {
        items: [{ id: "UCfixture", snippet: { title: "A channel" } }],
      },
      200,
      (url, options) => {
        assert.equal(
          url.href,
          "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&maxResults=2",
        );
        assert.equal(
          (options.headers as Record<string, string>).Authorization,
          "Bearer access",
        );
      },
    ),
  );
  assert.deepEqual(own, { id: "UCfixture", label: "A channel" });
  await assert.rejects(
    () => youtubeOwnChannel("access", fake({ items: [] })),
    /Select one/,
  );
  await assert.rejects(
    () =>
      youtubeOwnChannel(
        "access",
        fake({
          items: [
            { id: "one", snippet: { title: "One" } },
            { id: "two", snippet: { title: "Two" } },
          ],
        }),
      ),
    /Select one/,
  );
  await revokeYoutubeGrant(
    "refresh",
    fake({}, 200, (url, options) => {
      assert.equal(url.href, "https://oauth2.googleapis.com/revoke");
      assert.equal(
        new URLSearchParams(String(options.body)).get("token"),
        "refresh",
      );
    }),
  );
  await assert.rejects(
    () => revokeYoutubeGrant("refresh", fake({}, 400)),
    /not confirmed/,
  );
});
