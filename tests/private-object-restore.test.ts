import { test } from "node:test";
import assert from "node:assert/strict";
import { checksum } from "../scripts/compose-verification.mjs";
import {
  restorePrivateObjects,
  clearPartialPrivateObjects,
  controlledObjectFailure,
} from "../scripts/private-object-restore.mjs";
function objects() {
  return ["a", "b"].map((key) => ({
    key,
    body: Buffer.from(key).toString("base64"),
    sha256: checksum(Buffer.from(key)),
    contentType: "image/png",
    metadata: { fixture: "synthetic" },
  }));
}
test("Controlled object failure occurs after acknowledged write; cleanup and identical retry verify all objects", async () => {
  const saved = objects(),
    target = new Map();
  let acknowledgements = 0;
  const list = async () => [...target.values()];
  const put = async (object) => {
    await Promise.resolve();
    target.set(object.key, structuredClone(object));
    acknowledgements++;
  };
  const options = { objects: saved, ready: async () => {}, put, list };
  await assert.rejects(
    restorePrivateObjects({ ...options, failAfterFirstPut: true }),
    { message: controlledObjectFailure },
  );
  assert.equal(acknowledgements, 1);
  assert.deepEqual(await list(), saved.slice(0, 1));
  assert.deepEqual(
    await clearPartialPrivateObjects({
      expected: saved.slice(0, 1),
      list,
      remove: async (key) => {
        target.delete(key);
      },
    }),
    { partialObjectsRemoved: 1, restoreBucketEmptyAfterCleanup: true },
  );
  assert.deepEqual(await restorePrivateObjects(options), {
    objectsRestored: 2,
    allObjectBytesAndMetadataMatch: true,
  });
  assert.equal(acknowledgements, 3);
  assert.deepEqual(await list(), saved);
});
test("Object writer validates all bytes before any write and rejects incomplete verification", async () => {
  const saved = objects();
  let mutations = 0;
  const options = {
    ready: async () => {
      mutations++;
    },
    put: async () => {
      mutations++;
    },
    list: async () => saved.slice(0, 1),
  };
  const bad = structuredClone(saved);
  bad[1].body += "!";
  await assert.rejects(restorePrivateObjects({ ...options, objects: bad }));
  assert.equal(mutations, 0);
  await assert.rejects(restorePrivateObjects({ ...options, objects: saved }));
});
test("Residual cleanup rejects unexpected keys, bytes or metadata before deleting any object", async () => {
  const saved = objects();
  for (const change of [
    (x) => {
      x.push({ ...x[0], key: "unexpected" });
    },
    (x) => {
      x[0].body = Buffer.from("changed").toString("base64");
    },
    (x) => {
      x[0].metadata.fixture = "changed";
    },
  ]) {
    const actual = structuredClone(saved);
    change(actual);
    let deletions = 0;
    await assert.rejects(
      clearPartialPrivateObjects({
        expected: saved,
        list: async () => actual,
        remove: async () => {
          deletions++;
        },
      }),
    );
    assert.equal(deletions, 0);
  }
});
