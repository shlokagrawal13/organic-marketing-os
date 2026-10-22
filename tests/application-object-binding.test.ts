import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertApplicationObjectBinding as bind,
  historicalApplicationKey,
} from "../scripts/application-object-binding.mjs";
const hash = "a".repeat(64);
const row = {
  entity: "Asset",
  id: "asset-1",
  organizationId: "tenant-1",
  field: "objectKey",
  key: "private/asset-1",
  bytes: 10,
  sha256: hash,
};
const object = {
  key: row.key,
  bytes: 10,
  sha256: hash,
  contentType: "image/png",
  cacheControl: "private",
  metadata: { kind: "test" },
};
const version = {
  ...object,
  sourceKey: row.key,
  key: historicalApplicationKey(row.key),
  versionId: "old-version",
};
const evidence = {
  snapshotSha256: hash,
  expectedSnapshotSha256: hash,
  expected: [row],
  recovered: [row],
  objects: [object],
  versions: [version],
};
test("Application binding preserves shared-key row identities and ignores database enumeration order", () => {
  const second = { ...row, entity: "RenderSegment", id: "segment-1" };
  assert.deepEqual(
    bind({ ...evidence, expected: [row, second], recovered: [second, row] }),
    { references: 2, objects: 1 },
  );
});
test("Application binding rejects missing, extra, duplicate or tenant/row/field/key-altered recovered references", () => {
  const changed = [
    [],
    [row, { ...row, id: "extra" }],
    [row, row],
    ...["id", "organizationId", "field", "key", "entity"].map((field) => [
      { ...row, [field]: "wrong" },
    ]),
  ];
  for (const recovered of changed)
    assert.throws(() => bind({ ...evidence, recovered }));
  assert.throws(() => bind({ ...evidence, expected: [row, row] }));
});
test("Application binding requires complete exact version inventory and sealed object metadata", () => {
  for (const versions of [
    [],
    [version, version],
    ...[
      { sourceKey: "other" },
      { key: "synthetic/wrong" },
      { versionId: "null" },
      { bytes: 11 },
      { sha256: "f".repeat(64) },
      { contentType: "text/plain" },
      { cacheControl: "public" },
      { metadata: {} },
    ].map((change) => [{ ...version, ...change }]),
  ])
    assert.throws(() => bind({ ...evidence, versions }));
  assert.throws(() => bind({ ...evidence, objects: [] }));
  assert.throws(() => bind({ ...evidence, objects: [object, object] }));
});
test("Application binding rejects wrong dump identity, malformed rows and database hash/length disagreement", () => {
  assert.throws(() => bind({ ...evidence, snapshotSha256: "b".repeat(64) }));
  assert.throws(() => bind({ ...evidence, snapshotSha256: "not-a-digest" }));
  for (const change of [
    { bytes: 11 },
    { sha256: "b".repeat(64) },
    { id: "" },
    { bytes: null },
    { entity: "Unknown" },
    { unexpected: true },
  ]) {
    const altered = { ...row, ...change };
    assert.throws(() =>
      bind({ ...evidence, expected: [altered], recovered: [altered] }),
    );
  }
});
test("Application binding covers every supported nullable output field without requiring absent database hashes", () => {
  const expected = ["outputKey", "thumbnailKey", "captionsKey"].map(
    (field) => ({
      entity: "RenderJob",
      id: "render-1",
      organizationId: "tenant-1",
      field,
      key: row.key,
    }),
  );
  expected.push({
    entity: "MediaGeneration",
    id: "media-1",
    organizationId: "tenant-1",
    field: "outputKey",
    key: row.key,
  });
  assert.deepEqual(bind({ ...evidence, expected, recovered: expected }), {
    references: 4,
    objects: 1,
  });
});
