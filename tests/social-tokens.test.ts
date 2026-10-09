import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  encryptSocialToken,
  decryptSocialToken,
} from "../packages/core/social-tokens";

test("social tokens are authenticated to a workspace and exact external account", () => {
  const key = randomBytes(32).toString("base64");
  const otherKey = randomBytes(32).toString("base64");
  const context = {
    organizationId: "workspace-a",
    provider: "YOUTUBE" as const,
    externalAccountId: "channel-a",
  };
  const secret = "fixture-only-access-token";
  const one = encryptSocialToken(secret, context, key);
  const two = encryptSocialToken(secret, context, key);
  assert.notEqual(one, two);
  assert.equal(one.includes(secret), false);
  assert.equal(decryptSocialToken(one, context, key), secret);
  for (const altered of [
    { ...context, organizationId: "workspace-b" },
    { ...context, externalAccountId: "channel-b" },
  ])
    assert.throws(
      () => decryptSocialToken(one, altered, key),
      /authentication failed/,
    );
  assert.throws(
    () => decryptSocialToken(one, context, otherKey),
    /authentication failed/,
  );
  const parts = one.split(":");
  parts[3] = (parts[3][0] === "A" ? "B" : "A") + parts[3].slice(1);
  assert.throws(
    () => decryptSocialToken(parts.join(":"), context, key),
    /authentication failed/,
  );
  assert.throws(
    () => encryptSocialToken(secret, context, "short"),
    /32 base64-encoded bytes/,
  );
  assert.throws(
    () => encryptSocialToken("", context, key),
    /empty social token/,
  );
});
