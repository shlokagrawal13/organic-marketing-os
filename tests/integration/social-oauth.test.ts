import "../support/isolated";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { INestApplication } from "@nestjs/common";
// Nest parameter decorators require the reviewed TypeScript build output.
import { AppModule } from "../../dist/apps/api/src/main.js";
import {
  ApiErrors,
  Cache,
  installSecurity,
} from "../../dist/apps/api/src/common.js";
import { YoutubeOAuthProvider } from "../../dist/apps/api/src/social-connections.js";
import { decryptSocialToken } from "../../packages/core/social-tokens";
import { youtubeScopes } from "../../packages/core/youtube-oauth";
import { actor, db } from "../support/http";

let app: INestApplication, base: string;
const orgs: string[] = [],
  users: string[] = [];
const key = randomBytes(32).toString("base64");
let exchanges = 0,
  channelLookups = 0,
  rejectExchange = false;
before(async () => {
  process.env.YOUTUBE_OAUTH_CLIENT_ID = "isolated-client";
  process.env.YOUTUBE_OAUTH_CLIENT_SECRET = "isolated-secret";
  process.env.YOUTUBE_OAUTH_REDIRECT_URI =
    "http://127.0.0.1:4000/api/social/youtube/callback";
  process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = key;
  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix("api");
  app.use(cookieParser());
  installSecurity(app, app.get(Cache));
  app.useGlobalFilters(new ApiErrors());
  const provider = app.get(YoutubeOAuthProvider);
  provider.exchange = async (code, verifier) => {
    exchanges++;
    assert.equal(code, "fixture-code");
    assert.match(verifier, /^[A-Za-z0-9_-]{64}$/);
    if (rejectExchange)
      throw new Error("fixture provider denied authorization");
    return {
      access_token: "fixture-access-token",
      refresh_token: "fixture-refresh-token",
      token_type: "Bearer" as const,
      expires_in: 3600,
      refresh_token_expires_in: 7200,
      scope: youtubeScopes.join(" "),
    };
  };
  provider.channel = async (access) => {
    channelLookups++;
    assert.equal(access, "fixture-access-token");
    return { id: "UC-isolated-channel", label: "Fixture Channel" };
  };
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
});
after(async () => {
  if (app) await app.close();
  await db.socialConnection.deleteMany({
    where: { organizationId: { in: orgs } },
  });
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});

type Actor = Awaited<ReturnType<typeof actor>>;
async function request(path: string, by: Actor, method = "GET") {
  return fetch(base + "/api" + path, {
    method,
    headers: by.headers,
    redirect: "manual",
  });
}
async function begin(org: string, by: Actor) {
  const response = await request(
    `/workspaces/${org}/social-connections/youtube/authorize`,
    by,
    "POST",
  );
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  const url = new URL(body.authorizationUrl);
  assert.equal(url.hostname, "accounts.google.com");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(
    url.searchParams.get("redirect_uri"),
    process.env.YOUTUBE_OAUTH_REDIRECT_URI,
  );
  assert.deepEqual(url.searchParams.get("scope")?.split(" "), [
    ...youtubeScopes,
  ]);
  assert.equal(url.searchParams.get("client_secret"), null);
  assert.equal(body.expiresInSeconds, 600);
  return url.searchParams.get("state")!;
}
async function callback(
  state: string,
  by: Actor,
  suffix = "code=fixture-code",
) {
  return request(
    `/social/youtube/callback?state=${encodeURIComponent(state)}&${suffix}`,
    by,
  );
}

test("OAuth callback binds owner session, consumes state once and saves encrypted channel tokens", async () => {
  const org = await db.organization.create({ data: { name: "OAuth fixture" } });
  const other = await db.organization.create({
    data: { name: "Other OAuth fixture" },
  });
  orgs.push(org.id, other.id);
  const owner = await actor(org.id),
    second = await actor(org.id),
    editor = await actor(org.id, "EDITOR"),
    outsider = await actor(other.id);
  users.push(owner.id, second.id, editor.id, outsider.id);
  assert.equal(
    (
      await request(
        `/workspaces/${org.id}/social-connections/youtube/authorize`,
        editor,
        "POST",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        `/workspaces/${org.id}/social-connections/youtube/authorize`,
        outsider,
        "POST",
      )
    ).status,
    404,
  );
  const state = await begin(org.id, owner);
  const wrongSession = await callback(state, second);
  assert.equal(wrongSession.status, 303);
  assert.equal(
    new URL(wrongSession.headers.get("location")!).searchParams.get("youtube"),
    "failed",
  );
  assert.equal(exchanges, 0);
  const first = await callback(state, owner);
  assert.equal(first.status, 303);
  const destination = new URL(first.headers.get("location")!);
  assert.equal(destination.origin, "http://localhost:3000");
  assert.equal(destination.searchParams.get("youtube"), "connected");
  assert.equal(destination.searchParams.has("code"), false);
  assert.equal(destination.searchParams.has("state"), false);
  assert.equal(first.headers.get("referrer-policy"), "no-referrer");
  assert.equal(exchanges, 1);
  assert.equal(channelLookups, 1);
  const stored = await db.socialConnection.findFirstOrThrow({
    where: { organizationId: org.id, externalAccountId: "UC-isolated-channel" },
  });
  const context = {
    organizationId: org.id,
    provider: "YOUTUBE" as const,
    externalAccountId: "UC-isolated-channel",
  };
  assert.notEqual(stored.accessTokenCiphertext, "fixture-access-token");
  assert.equal(
    decryptSocialToken(stored.accessTokenCiphertext, context, key),
    "fixture-access-token",
  );
  assert.equal(
    decryptSocialToken(stored.refreshTokenCiphertext!, context, key),
    "fixture-refresh-token",
  );
  assert.ok(stored.tokenExpiresAt! > new Date());
  assert.ok(stored.refreshTokenExpiresAt! > stored.tokenExpiresAt!);
  assert.deepEqual(stored.scopes, [...youtubeScopes]);
  const listed = await request(
    `/workspaces/${org.id}/social-connections`,
    owner,
  );
  assert.equal(listed.status, 200);
  const safe = await listed.json();
  assert.equal(safe[0].externalAccountId, stored.externalAccountId);
  assert.equal(JSON.stringify(safe).includes("Ciphertext"), false);
  assert.equal(JSON.stringify(safe).includes("fixture-access-token"), false);
  assert.equal((await callback(state, owner)).status, 303);
  assert.equal(exchanges, 1);

  const concurrent = await begin(org.id, second);
  const parallel = await Promise.all([
    callback(concurrent, second),
    callback(concurrent, second),
  ]);
  assert.deepEqual(
    parallel
      .map((r) =>
        new URL(r.headers.get("location")!).searchParams.get("youtube"),
      )
      .sort(),
    ["connected", "failed"],
  );
  assert.equal(exchanges, 2);
  assert.equal(
    (
      await db.socialConnection.findFirstOrThrow({
        where: {
          organizationId: org.id,
          externalAccountId: "UC-isolated-channel",
        },
      })
    ).id,
    stored.id,
  );

  const denied = await begin(org.id, owner);
  const denial = await callback(denied, owner, "error=access_denied");
  assert.equal(
    new URL(denial.headers.get("location")!).searchParams.get("youtube"),
    "failed",
  );
  assert.equal((await callback(denied, owner)).status, 303);
  assert.equal(exchanges, 2);

  const changedRole = await begin(org.id, owner);
  await db.membership.update({
    where: {
      userId_organizationId: { userId: owner.id, organizationId: org.id },
    },
    data: { role: "EDITOR" },
  });
  assert.equal(
    new URL(
      (await callback(changedRole, owner)).headers.get("location")!,
    ).searchParams.get("youtube"),
    "failed",
  );
  assert.equal(exchanges, 2);
});

test("provider failure does not overwrite a connected channel or leak the code", async () => {
  const org = await db.organization.create({
    data: { name: "OAuth failure fixture" },
  });
  orgs.push(org.id);
  const owner = await actor(org.id);
  users.push(owner.id);
  const configured = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
  delete process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
  assert.equal(
    (
      await request(
        `/workspaces/${org.id}/social-connections/youtube/authorize`,
        owner,
        "POST",
      )
    ).status,
    503,
  );
  process.env.YOUTUBE_OAUTH_CLIENT_SECRET = configured;
  const state = await begin(org.id, owner);
  rejectExchange = true;
  const response = await callback(state, owner);
  assert.equal(response.status, 303);
  const location = response.headers.get("location")!;
  assert.equal(new URL(location).searchParams.get("youtube"), "failed");
  assert.equal(location.includes("fixture-code"), false);
  assert.equal(
    await db.socialConnection.count({ where: { organizationId: org.id } }),
    0,
  );
  assert.equal(exchanges, 3);
  rejectExchange = false;

  const expiredSessionState = await begin(org.id, owner);
  await db.session.deleteMany({ where: { userId: owner.id } });
  const unauthenticated = await callback(expiredSessionState, owner);
  assert.equal(unauthenticated.status, 401);
  assert.equal(unauthenticated.headers.get("referrer-policy"), "no-referrer");
  assert.equal(unauthenticated.headers.get("cache-control"), "no-store");
  assert.equal(exchanges, 3);
});

test("owner refresh rotates encrypted grants and provider revocation blocks reconnect until confirmed", async () => {
  const org = await db.organization.create({ data: { name: "Lifecycle fixture" } });
  const other = await db.organization.create({ data: { name: "Lifecycle outsider" } });
  orgs.push(org.id, other.id);
  const owner = await actor(org.id), editor = await actor(org.id, "EDITOR"),
    outsider = await actor(other.id);
  users.push(owner.id, editor.id, outsider.id);
  const state = await begin(org.id, owner);
  assert.equal(new URL((await callback(state, owner)).headers.get("location")!).searchParams.get("youtube"), "connected");
  const connected = await db.socialConnection.findFirstOrThrow({
    where: { organizationId: org.id, externalAccountId: "UC-isolated-channel" },
  });
  const route = `/workspaces/${org.id}/social-connections/${connected.id}`;
  const context = { organizationId: org.id, provider: "YOUTUBE" as const,
    externalAccountId: connected.externalAccountId };
  const provider = app.get(YoutubeOAuthProvider);
  let failRefresh = false, failRevoke = true, refreshCalls = 0, revokeCalls = 0;
  provider.refresh = async (token) => {
    refreshCalls++;
    assert.equal(token, "fixture-refresh-token");
    if (failRefresh) throw new Error("provider unavailable");
    return { access_token: "rotated-access", refresh_token: "rotated-refresh",
      token_type: "Bearer" as const, expires_in: 3600,
      refresh_token_expires_in: 7200, scope: youtubeScopes.join(" ") };
  };
  provider.revoke = async (token) => {
    revokeCalls++;
    assert.equal(token, "rotated-refresh");
    if (failRevoke) throw new Error("unconfirmed");
  };
  assert.equal((await request(route + "/refresh", editor, "POST")).status, 403);
  assert.equal((await request(route + "/refresh", outsider, "POST")).status, 404);
  failRefresh = true;
  assert.equal((await request(route + "/refresh", owner, "POST")).status, 503);
  const ambiguous = await db.socialConnection.findUniqueOrThrow({ where: { id: connected.id } });
  assert.equal(ambiguous.accessTokenCiphertext, connected.accessTokenCiphertext);
  assert.ok(ambiguous.refreshPendingAt, "durable marker survives a remote error");
  failRefresh = false;
  assert.equal((await request(route + "/refresh", owner, "POST")).status, 409);
  assert.equal(refreshCalls, 1, "an uncertain grant must never be retried");
  const reconnectState = await begin(org.id, owner);
  assert.equal(new URL((await callback(reconnectState, owner)).headers.get("location")!).searchParams.get("youtube"), "connected");
  assert.equal((await db.socialConnection.findUniqueOrThrow({ where: { id: connected.id } })).refreshPendingAt, null);
  const refreshed = await request(route + "/refresh", owner, "POST");
  assert.equal(refreshed.status, 201);
  const safe = await refreshed.json();
  assert.equal(JSON.stringify(safe).includes("Ciphertext"), false);
  assert.equal(safe.externalAccountId, connected.externalAccountId);
  const rotated = await db.socialConnection.findUniqueOrThrow({ where: { id: connected.id } });
  assert.equal(decryptSocialToken(rotated.accessTokenCiphertext, context, key), "rotated-access");
  assert.equal(decryptSocialToken(rotated.refreshTokenCiphertext!, context, key), "rotated-refresh");
  assert.notEqual(rotated.refreshTokenCiphertext, connected.refreshTokenCiphertext);
  assert.equal(rotated.refreshPendingAt, null);
  assert.equal(refreshCalls, 2);
  assert.equal((await request(route + "/revoke-provider", editor, "POST")).status, 403);
  assert.equal((await request(route + "/revoke-provider", owner, "POST")).status, 503);
  const pending = await db.socialConnection.findUniqueOrThrow({ where: { id: connected.id } });
  assert.ok(pending.revokedAt);
  assert.equal(pending.refreshTokenCiphertext, rotated.refreshTokenCiphertext);
  assert.equal((await request(route + "/refresh", owner, "POST")).status, 409);
  assert.equal((await request(`/workspaces/${org.id}/social-connections/youtube/authorize`, owner, "POST")).status, 409);
  failRevoke = false;
  const confirmed = await request(route + "/revoke-provider", owner, "POST");
  assert.equal(confirmed.status, 201);
  assert.deepEqual(await confirmed.json(), { ok: true, providerRevocation: "CONFIRMED" });
  const cleared = await db.socialConnection.findUniqueOrThrow({ where: { id: connected.id } });
  assert.equal(cleared.refreshTokenCiphertext, null);
  assert.equal(cleared.tokenExpiresAt, null);
  assert.equal(revokeCalls, 2);
  assert.equal((await request(route + "/revoke-provider", owner, "POST")).status, 201);
  const reconnect = await begin(org.id, owner);
  assert.equal(new URL((await callback(reconnect, owner)).headers.get("location")!).searchParams.get("youtube"), "connected");
});

test("remote refresh success followed by local authorization failure remains blocked until a fresh grant", async () => {
  const org = await db.organization.create({ data: { name: "Ambiguous rotation fixture" } });
  orgs.push(org.id);
  const owner = await actor(org.id);
  users.push(owner.id);
  const state = await begin(org.id, owner);
  assert.equal(new URL((await callback(state, owner)).headers.get("location")!).searchParams.get("youtube"), "connected");
  const connected = await db.socialConnection.findFirstOrThrow({ where: { organizationId: org.id } });
  const route = `/workspaces/${org.id}/social-connections/${connected.id}`;
  const provider = app.get(YoutubeOAuthProvider);
  let calls = 0;
  provider.refresh = async () => {
    calls++;
    await db.membership.update({
      where: { userId_organizationId: { userId: owner.id, organizationId: org.id } },
      data: { role: "EDITOR" },
    });
    return { access_token: "remote-rotated-access", refresh_token: "remote-rotated-refresh",
      token_type: "Bearer" as const, expires_in: 3600, scope: youtubeScopes.join(" ") };
  };
  assert.equal((await request(route + "/refresh", owner, "POST")).status, 503);
  const uncertain = await db.socialConnection.findUniqueOrThrow({ where: { id: connected.id } });
  assert.ok(uncertain.refreshPendingAt);
  assert.equal(uncertain.refreshTokenCiphertext, connected.refreshTokenCiphertext);
  await db.membership.update({
    where: { userId_organizationId: { userId: owner.id, organizationId: org.id } },
    data: { role: "OWNER" },
  });
  assert.equal((await request(route + "/refresh", owner, "POST")).status, 409);
  assert.equal(calls, 1);
  const reconnect = await begin(org.id, owner);
  assert.equal(new URL((await callback(reconnect, owner)).headers.get("location")!).searchParams.get("youtube"), "connected");
  const recovered = await db.socialConnection.findUniqueOrThrow({ where: { id: connected.id } });
  assert.equal(recovered.refreshPendingAt, null);
  assert.notEqual(recovered.refreshTokenCiphertext, connected.refreshTokenCiphertext);
});
