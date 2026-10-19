import { test } from "node:test";
import assert from "node:assert/strict";
import { fixtureProject, checksum } from "../scripts/compose-verification.mjs";
import {
  fixtureWriters,
  sealFixtureBackup,
  validateFixtureBackup,
  withValidatedFixtureBackup,
  invalidFixtureBackupCases,
} from "../scripts/cross-store-backup-verification.mjs";
function fixture() {
  const source = fixtureProject("0123456789abcdef"),
    target = source + "-restore",
    dump = Buffer.alloc(1200);
  dump.write("PGDMP");
  const bytes = Buffer.from("Synthetic private media");
  const objects = [
    {
      key: "synthetic/private.png",
      body: bytes.toString("base64"),
      sha256: checksum(bytes),
      contentType: "image/png",
      metadata: { rights: "synthetic" },
    },
  ];
  const input = {
    source,
    target,
    dump,
    objects,
    stoppedWriters: fixtureWriters,
    references: [
      { key: objects[0].key, bytes: bytes.length, sha256: checksum(bytes) },
    ],
  };
  return { ...input, manifest: sealFixtureBackup(input) };
}
test("Corrupt or incomplete cross-store backup never reaches destructive callbacks", async () => {
  for (const item of invalidFixtureBackupCases(fixture())) {
    let calls = 0;
    await assert.rejects(
      withValidatedFixtureBackup(item.input, () => {
        calls++;
      }),
      item.name,
    );
    assert.equal(calls, 0, item.name);
  }
});
test("Backup preflight binds the source, separate restore identity and every stopped writer", () => {
  for (const change of [
    { source: "organic-marketing-os" },
    { target: fixtureProject("fedcba9876543210", true) },
    { stoppedWriters: ["api", "worker"] },
    { stoppedWriters: [...fixtureWriters, "worker"] },
    { references: [{ key: "missing/object" }] },
  ])
    assert.throws(() => sealFixtureBackup({ ...fixture(), ...change }));
});
test("Valid sealed cross-store backup permits exactly one action and preserves metadata", async () => {
  const input = fixture();
  let calls = 0;
  assert.deepEqual(validateFixtureBackup(input), input.manifest);
  assert.equal(
    await withValidatedFixtureBackup(input, () => {
      calls++;
      return "performed";
    }),
    "performed",
  );
  assert.equal(calls, 1);
  input.objects[0].contentType = "text/plain";
  assert.throws(() => validateFixtureBackup(input));
});
test("Backup sealing rejects duplicate keys and malformed private object encodings", () => {
  const input = fixture();
  input.objects.push({ ...input.objects[0] });
  assert.throws(() => sealFixtureBackup(input));
  input.objects.pop();
  input.objects[0].body += "!";
  assert.throws(() => sealFixtureBackup(input));
});
