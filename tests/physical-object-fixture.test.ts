import assert from "node:assert/strict";
import { test } from "node:test";
import * as s3 from "@aws-sdk/client-s3";
import { runPhysicalObjects } from "../scripts/physical-object-fixture.mjs";
import * as binding from "../scripts/physical-object-binding.mjs";
import * as applicationGate from "../scripts/application-object-binding.mjs";
import { withVerifiedHistoricalObjects as objectsGate } from "../scripts/historical-object-verification.mjs";

for (const count of [1, 3])
  test(`Physical historical fixture retains per-key overwrites and cleans exact versions for ${count} objects`, async () => {
    const project = "omos-compose-verify-0123456789abcdef",
      bucket = "omos-history-0123456789abcdef";
    let exists = false,
      tags = [],
      enabled = false,
      counter = 0;
    const versions = new Map<string, any[]>();
    const notFound = () =>
      Object.assign(new Error("Missing synthetic version"), {
        $metadata: { httpStatusCode: 404 },
      });
    const client = {
      send: async (command: any) => {
        const x = command.input,
          name = command.constructor.name;
        assert.equal(x.Bucket, bucket);
        if (name === "HeadBucketCommand") {
          if (!exists) throw notFound();
          return {};
        }
        if (name === "CreateBucketCommand") {
          assert.equal(exists, false);
          exists = true;
          return {};
        }
        if (name === "PutBucketTaggingCommand") {
          tags = x.Tagging.TagSet;
          return {};
        }
        if (name === "GetBucketTaggingCommand") return { TagSet: tags };
        if (name === "PutBucketVersioningCommand") {
          enabled = true;
          return {};
        }
        if (name === "GetBucketVersioningCommand")
          return { Status: enabled ? "Enabled" : "Suspended" };
        if (name === "PutObjectCommand") {
          const VersionId = `version-${++counter}`;
          versions.set(x.Key, [
            ...(versions.get(x.Key) ?? []),
            { ...x, VersionId },
          ]);
          return { VersionId };
        }
        if (name === "GetObjectCommand") {
          const all = versions.get(x.Key) ?? [],
            v = x.VersionId
              ? all.find((v) => v.VersionId === x.VersionId)
              : all.at(-1);
          if (!v || v.DeleteMarker) throw notFound();
          return { ...v, Body: { transformToByteArray: async () => v.Body } };
        }
        if (name === "DeleteObjectCommand") {
          const all = versions.get(x.Key) ?? [];
          if (x.VersionId) {
            versions.set(
              x.Key,
              all.filter((v) => v.VersionId !== x.VersionId),
            );
            return {};
          }
          const VersionId = `version-${++counter}`;
          versions.set(x.Key, [
            ...all,
            { Key: x.Key, VersionId, DeleteMarker: true },
          ]);
          return { VersionId, DeleteMarker: true };
        }
        if (name === "ListObjectVersionsCommand") {
          const all = [...versions.entries()].flatMap(([Key, rows]) =>
            rows.map((r) => ({
              Key,
              VersionId: r.VersionId,
              DeleteMarker: r.DeleteMarker,
            })),
          );
          return {
            IsTruncated: false,
            Versions: all.filter((v) => !v.DeleteMarker),
            DeleteMarkers: all.filter((v) => v.DeleteMarker),
          };
        }
        if (name === "DeleteBucketCommand") {
          assert.ok([...versions.values()].every((v) => v.length === 0));
          exists = false;
          return {};
        }
        assert.fail(`Unexpected synthetic command ${name}`);
      },
    };
    const additionalObjects = Array.from({ length: count - 1 }, (_, i) => {
      const bytes = Buffer.from(`original-${i}`);
      return {
        key: `pitr-a/other-${i}/historical.png`,
        body: bytes.toString("base64"),
        bytes: bytes.length,
        sha256: binding.bytesHash(bytes),
        contentType: "image/png",
      };
    });
    const objects = [
      {
        key: "pitr-a/historical.png",
        bytes: 3,
        sha256: binding.bytesHash(Buffer.from("old")),
      },
      ...additionalObjects,
    ];
    const applicationSnapshot = {
      rows: {
        Asset: objects.map((o, i) => ({
          id: `asset-${i}`,
          organizationId: "pitr-a",
          objectKey: o.key,
          bytes: o.bytes,
          sha256: o.sha256,
        })),
        RenderSegment: [],
        RenderJob: [],
        MediaGeneration: [],
      },
      schema: [],
    };
    const capture = {
      physicalProject: "omos-pitr-verify-0123456789abcdef",
      targetName: "omos_fixture_target",
      baseBackupManifestSha256: "a".repeat(64),
      applicationSnapshot,
    };
    const run = (mode, state) =>
      runPhysicalObjects({
        mode,
        state,
        store: { client },
        s3,
        binding,
        applicationGate,
        objectsGate,
      });
    const state = {
      project,
      ...(await run("physical-capture", {
        project,
        capture,
        additionalObjects,
      })),
      applicationSnapshot,
    };
    state.pointReceipt = {
      ...capture,
      applicationSnapshot: undefined,
      captureSha256: state.captureSha256,
      targetLsn: "0/ABC",
      capturedBeforeNamedTarget: true,
    };
    state.expectedPointReceiptSha256 = binding.physicalCaptureHash(
      state.pointReceipt,
    );
    Object.assign(state, await run("physical-later", state));
    const fetchBefore = globalThis.fetch;
    try {
      globalThis.fetch = async (url) => {
        assert.ok(String(url).includes(bucket));
        return new Response(null, { status: 403 });
      };
      const result = await run("physical-verify", state);
      assert.equal(result.report.passed, true);
      assert.deepEqual(result.report.bound, {
        references: count,
        objects: count,
      });
      assert.equal(result.report.readinessCallbacks, 1);
      assert.equal(result.expectedVersions.length, count * 3 - 1);
      Object.assign(state, result);
      assert.equal(
        (await run("physical-cleanup", state))
          .ownedPhysicalHistoricalVersionsCleaned,
        true,
      );
      assert.equal(exists, false);
    } finally {
      globalThis.fetch = fetchBefore;
    }
  });
