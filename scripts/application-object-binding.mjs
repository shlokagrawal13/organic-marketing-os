// Fixture-only logical snapshot binding. Does not administer production backups.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
export const historicalApplicationKey = (key) =>
  "synthetic/" + createHash("sha256").update(key).digest("hex");
export function assertApplicationObjectBinding({
  snapshotSha256,
  expectedSnapshotSha256,
  expected,
  recovered,
  objects,
  versions,
}) {
  assert.match(snapshotSha256, /^[a-f0-9]{64}$/);
  assert.equal(
    snapshotSha256,
    expectedSnapshotSha256,
    "Database snapshot mismatch",
  );
  const fields = {
    Asset: ["objectKey"],
    RenderSegment: ["objectKey"],
    RenderJob: ["outputKey", "thumbnailKey", "captionsKey"],
    MediaGeneration: ["outputKey"],
  };
  const normalize = (rows) => {
    assert.ok(Array.isArray(rows) && rows.length > 0 && rows.length <= 1000);
    const seen = new Set();
    return rows
      .map((r) => {
        assert.ok(
          fields[r.entity]?.includes(r.field),
          "Unknown application reference field",
        );
        for (const value of [r.id, r.organizationId, r.key])
          assert.ok(
            typeof value === "string" &&
              value.length > 0 &&
              value.length <= 1024,
          );
        const identity = JSON.stringify([r.entity, r.id, r.field]);
        assert.ok(
          !seen.has(identity),
          "Duplicate application reference identity",
        );
        seen.add(identity);
        if (r.bytes !== undefined)
          assert.ok(Number.isSafeInteger(r.bytes) && r.bytes > 0);
        if (r.sha256 !== undefined) assert.match(r.sha256, /^[a-f0-9]{64}$/);
        assert.deepEqual(
          Object.keys(r).sort(),
          [
            "entity",
            "id",
            "field",
            "organizationId",
            "key",
            ...(r.bytes === undefined ? [] : ["bytes"]),
            ...(r.sha256 === undefined ? [] : ["sha256"]),
          ].sort(),
        );
        return { identity, row: r };
      })
      .sort((a, b) => a.identity.localeCompare(b.identity));
  };
  const rows = normalize(expected);
  assert.deepEqual(
    normalize(recovered),
    rows,
    "Recovered application references differ from sealed snapshot",
  );
  const keys = new Set(rows.map(({ row }) => row.key));
  assert.ok(Array.isArray(objects));
  const sealed = new Map(objects.map((o) => [o.key, o]));
  assert.equal(sealed.size, objects.length, "Duplicate sealed object");
  assert.ok(Array.isArray(versions));
  assert.equal(
    versions.length,
    keys.size,
    "Historical manifest must cover exactly the referenced keys",
  );
  const mappedObjects = new Map();
  for (const v of versions) {
    assert.ok(
      keys.has(v.sourceKey) && !mappedObjects.has(v.sourceKey),
      "Unknown or duplicate historical source key",
    );
    assert.equal(
      v.key,
      historicalApplicationKey(v.sourceKey),
      "Historical key mapping mismatch",
    );
    assert.ok(
      typeof v.versionId === "string" &&
        v.versionId.length > 0 &&
        v.versionId !== "null",
    );
    assert.ok(Number.isSafeInteger(v.bytes) && v.bytes > 0);
    assert.match(v.sha256, /^[a-f0-9]{64}$/);
    const o = sealed.get(v.sourceKey);
    assert.ok(o, "Application object absent from sealed object inventory");
    for (const field of ["bytes", "sha256", "contentType"])
      assert.equal(v[field], o[field], `Sealed object ${field} mismatch`);
    assert.equal(v.cacheControl ?? null, o.cacheControl ?? null);
    assert.deepEqual(v.metadata ?? {}, o.metadata ?? {});
    mappedObjects.set(v.sourceKey, v);
  }
  for (const { row } of rows) {
    const v = mappedObjects.get(row.key);
    assert.ok(v, "Missing application object version");
    if (row.bytes !== undefined)
      assert.equal(v.bytes, row.bytes, "Application object length mismatch");
    if (row.sha256 !== undefined)
      assert.equal(v.sha256, row.sha256, "Application object hash mismatch");
  }
  return { references: rows.length, objects: keys.size };
}
