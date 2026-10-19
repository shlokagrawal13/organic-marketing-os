import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import {
  assertUpgradeFixture,
  assertPreservedRows,
} from "../scripts/prisma-upgrade-verification.mjs";

test("Native Prisma upgrade accepts only its registered loopback database and private package", () => {
  const valid = {
    project: "omos-upgrade-verify-0123456789abcdef",
    root: resolve("/workspace/project"),
    caseRoot: resolve(
      "/workspace/project/.local/native-upgrade/0123456789abcdef/upgrade",
    ),
    port: 54321,
    kind: "upgrade",
    url: `postgresql://fixture:${"a".repeat(64)}@127.0.0.1:54321/fixture_upgrade?schema=public`,
  };
  assert.doesNotThrow(() => assertUpgradeFixture(valid));
  for (const change of [
    { project: "organic-marketing-os" },
    { project: valid.project + "\n" },
    { caseRoot: valid.root },
    { caseRoot: valid.caseRoot + "/../upgrade" },
    { port: 5432 },
    { kind: "production" },
    { url: valid.url.replace("127.0.0.1", "database.example.test") },
    { url: valid.url.replace("fixture_upgrade", "populated") },
    { url: valid.url + "&options=-csearch_path=other" },
    { url: valid.url.replace("fixture:", "postgres:") },
  ])
    assert.throws(() => assertUpgradeFixture({ ...valid, ...change }));
});

test("Populated upgrade preservation rejects missing rows, columns and changed legacy values", () => {
  const before = {
    ContentItem: [{ id: "synthetic", body: "Saved", meta: { revision: 1 } }],
  };
  assert.doesNotThrow(() =>
    assertPreservedRows(before, {
      ContentItem: [{ ...before.ContentItem[0], newColumn: null }],
    }),
  );
  for (const after of [
    {},
    { ContentItem: [] },
    { ContentItem: [{ id: "synthetic", meta: { revision: 1 } }] },
    { ContentItem: [{ ...before.ContentItem[0], body: "Lost" }] },
    { ContentItem: [{ ...before.ContentItem[0], meta: { revision: 2 } }] },
  ])
    assert.throws(() => assertPreservedRows(before, after));
});
