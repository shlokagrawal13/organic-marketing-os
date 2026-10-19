// Harness-only operations. The host must validate the saved backup and owned
// restore project before supplying these callbacks. No production repair API.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
export const controlledObjectFailure =
  "Controlled fixture failure after first acknowledged private-object PUT.";
function checked(objects) {
  assert.ok(Array.isArray(objects) && objects.length > 0);
  const keys = new Set();
  return objects
    .map((object) => {
      assert.ok(typeof object.key === "string" && object.key.length > 0);
      assert.ok(!keys.has(object.key));
      keys.add(object.key);
      const bytes = Buffer.from(object.body, "base64");
      assert.ok(bytes.length > 0);
      assert.equal(bytes.toString("base64"), object.body);
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        object.sha256,
      );
      return {
        key: object.key,
        sha256: object.sha256,
        contentType: object.contentType,
        cacheControl: object.cacheControl ?? null,
        metadata: object.metadata ?? {},
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}
export async function restorePrivateObjects({
  objects,
  ready,
  put,
  list,
  failAfterFirstPut = false,
}) {
  const expected = checked(objects); // Whole set before any write.
  await ready();
  for (const [index, object] of objects.entries()) {
    await put(object);
    if (failAfterFirstPut && index === 0)
      throw new Error(controlledObjectFailure);
  }
  const restored = await list();
  assert.deepEqual(checked(restored), expected);
  return {
    objectsRestored: restored.length,
    allObjectBytesAndMetadataMatch: true,
  };
}
export async function clearPartialPrivateObjects({ expected, list, remove }) {
  // Read and validate the ENTIRE residual set before the first deletion. An
  // unexpected key, body or metadata aborts instead of broad bucket cleanup.
  const saved = checked(expected),
    actual = await list();
  assert.deepEqual(checked(actual), saved);
  for (const object of actual) await remove(object.key);
  assert.deepEqual(await list(), []);
  return {
    partialObjectsRemoved: actual.length,
    restoreBucketEmptyAfterCleanup: true,
  };
}
