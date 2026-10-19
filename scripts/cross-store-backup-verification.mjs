// Integrity preflight for generated, quiesced fixtures only. Not a production
// backup format, cryptographic signature, or automatic repair command.
import assert from "node:assert/strict";
import {
  assertFixtureProject,
  assertFixtureRestoreProject,
  checksum,
} from "./compose-verification.mjs";

export const fixtureWriters = [
  "api",
  "web",
  "worker",
  "render-worker",
  "media-worker",
];
function identity(source, target) {
  assertFixtureProject(source);
  assert.ok(!source.endsWith("-restore"));
  assertFixtureRestoreProject(target);
  assert.equal(target, source + "-restore");
}
function contents(dump, objects) {
  assert.ok(
    Buffer.isBuffer(dump) && dump.length > 1000,
    "Native dump is missing or truncated.",
  );
  assert.equal(
    dump.subarray(0, 5).toString(),
    "PGDMP",
    "Expected a native custom-format dump.",
  );
  assert.ok(
    Array.isArray(objects) && objects.length > 0 && objects.length <= 1000,
    "Private-object set is missing or too large.",
  );
  const keys = new Set();
  let total = 0;
  const entries = objects
    .map((object) => {
      assert.equal(typeof object.key, "string");
      assert.ok(
        object.key.length > 0 &&
          object.key.length <= 1024 &&
          !keys.has(object.key),
        "Missing or duplicate object key.",
      );
      keys.add(object.key);
      assert.equal(typeof object.body, "string");
      const bytes = Buffer.from(object.body, "base64");
      assert.equal(
        bytes.toString("base64"),
        object.body,
        "Object body is not canonical base64.",
      );
      assert.ok(bytes.length > 0);
      total += bytes.length;
      assert.ok(
        total <= 64 * 1024 * 1024,
        "Fixture object backup exceeds 64 MiB.",
      );
      assert.equal(
        checksum(bytes),
        object.sha256,
        "Private object hash mismatch.",
      );
      assert.equal(typeof object.contentType, "string");
      assert.ok(object.contentType.length > 0);
      assert.ok(
        object.cacheControl === undefined ||
          typeof object.cacheControl === "string",
      );
      assert.ok(
        object.metadata === undefined ||
          (object.metadata &&
            typeof object.metadata === "object" &&
            !Array.isArray(object.metadata)),
      );
      const metadata = Object.fromEntries(
        Object.entries(object.metadata ?? {}).sort(([a], [b]) =>
          a.localeCompare(b),
        ),
      );
      assert.ok(
        Object.values(metadata).every((value) => typeof value === "string"),
      );
      return {
        key: object.key,
        bytes: bytes.length,
        sha256: object.sha256,
        contentType: object.contentType,
        cacheControl: object.cacheControl ?? null,
        metadata,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
  return {
    database: { bytes: dump.length, sha256: checksum(dump) },
    objects: entries,
  };
}
export function sealFixtureBackup({
  source,
  target,
  dump,
  objects,
  stoppedWriters,
  references,
}) {
  identity(source, target);
  assert.deepEqual(
    [...stoppedWriters].sort(),
    [...fixtureWriters].sort(),
    "Every application writer must be stopped.",
  );
  const saved = contents(dump, objects);
  assert.ok(
    Array.isArray(references) && references.length > 0,
    "Database media references are missing.",
  );
  const keys = new Map(saved.objects.map((object) => [object.key, object]));
  for (const reference of references) {
    const object = keys.get(reference.key);
    assert.ok(
      object,
      "A database media reference is absent from the object backup.",
    );
    if (reference.bytes !== undefined)
      assert.equal(
        object.bytes,
        reference.bytes,
        "Database media length mismatch.",
      );
    if (reference.sha256 !== undefined)
      assert.equal(
        object.sha256,
        reference.sha256,
        "Database media hash mismatch.",
      );
  }
  return {
    version: 1,
    source,
    target,
    stoppedWriters: [...fixtureWriters],
    references: references
      .map((r) => ({ ...r }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    ...saved,
  };
}
export function validateFixtureBackup({
  source,
  target,
  dump,
  objects,
  manifest,
}) {
  identity(source, target);
  assert.equal(manifest?.version, 1);
  assert.equal(manifest.source, source);
  assert.equal(manifest.target, target);
  const current = sealFixtureBackup({
    source,
    target,
    dump,
    objects,
    stoppedWriters: manifest.stoppedWriters,
    references: manifest.references,
  });
  assert.deepEqual(
    current,
    manifest,
    "Sealed database/object set or metadata changed.",
  );
  return current;
}
export async function withValidatedFixtureBackup(input, action) {
  validateFixtureBackup(input); // Must precede source removal or target mutation.
  return await action();
}
export function fixtureApplicationStartGate(loadBackup) {
  let verifiedManifest = null;
  return {
    async restore(restoreObjects, verifyDatabase) {
      verifiedManifest = null;
      const before = validateFixtureBackup(loadBackup());
      const result = await restoreObjects();
      assert.equal(result.objectsRestored, before.objects.length);
      assert.equal(result.allObjectBytesAndMetadataMatch, true);
      await verifyDatabase();
      assert.deepEqual(validateFixtureBackup(loadBackup()), before);
      verifiedManifest = before;
      return result;
    },
    async start(action) {
      assert.ok(
        verifiedManifest,
        "Application start denied: restore is incomplete.",
      );
      assert.deepEqual(validateFixtureBackup(loadBackup()), verifiedManifest);
      return await action();
    },
  };
}
export function invalidFixtureBackupCases(input) {
  const clone = () => ({
    ...input,
    dump: Buffer.from(input.dump),
    objects: structuredClone(input.objects),
    manifest: structuredClone(input.manifest),
  });
  const cases = [];
  function add(name, mutate) {
    const value = clone();
    mutate(value);
    cases.push({ name, input: value });
  }
  add("truncated-native-dump", (v) => {
    v.dump = v.dump.subarray(0, 32);
  });
  add("modified-native-dump", (v) => {
    v.dump[v.dump.length - 1] ^= 1;
  });
  add("missing-private-object", (v) => {
    v.objects.pop();
  });
  add("modified-private-object", (v) => {
    const b = Buffer.from(v.objects[0].body, "base64");
    b[0] ^= 1;
    v.objects[0].body = b.toString("base64");
  });
  add("modified-private-metadata", (v) => {
    v.objects[0].metadata = {
      ...v.objects[0].metadata,
      fixtureCorruption: "synthetic",
    };
  });
  add("missing-writer-quiescence", (v) => {
    v.manifest.stoppedWriters.pop();
  });
  add("wrong-restore-project", (v) => {
    v.target = v.source;
  });
  return cases;
}
