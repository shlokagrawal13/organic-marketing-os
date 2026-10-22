// Isolated Compose bucket only; original three-byte fixture retained.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
export async function runPhysicalObjects({
  mode,
  state,
  store,
  s3,
  binding,
  applicationGate,
  objectsGate,
}) {
  const project = state.project;
  assert.match(project, /^omos-compose-verify-[a-f0-9]{16}$/);
  assert.equal(project.length, 36);
  const bucket = `omos-history-${project.slice(-16)}`;
  const send = (Command, input = {}) =>
    store.client.send(new Command({ Bucket: bucket, ...input }));
  const read = async ({ key, versionId }) => {
    const r = await send(s3.GetObjectCommand, {
      Key: key,
      ...(versionId ? { VersionId: versionId } : {}),
    });
    return {
      versionId: r.VersionId,
      bytes: Buffer.from(await r.Body.transformToByteArray()),
      contentType: r.ContentType,
      cacheControl: r.CacheControl,
      metadata: r.Metadata,
    };
  };
  const remember = (key, result, marker = false) => {
    assert.ok(result.VersionId && result.VersionId !== "null");
    state.expectedVersions.push({
      Key: key,
      VersionId: result.VersionId,
      marker,
    });
    return result.VersionId;
  };
  if (mode === "physical-capture") {
    await assert.rejects(
      send(s3.HeadBucketCommand),
      (e) => e.$metadata?.httpStatusCode === 404,
    );
    const {
      physicalProject,
      targetName,
      baseBackupManifestSha256,
      applicationSnapshot,
    } = state.capture;
    assert.match(physicalProject, /^omos-pitr-verify-[a-f0-9]{16}$/);
    assert.equal(physicalProject.length, 33);
    assert.equal(targetName, "omos_fixture_target");
    assert.match(baseBackupManifestSha256, /^[a-f0-9]{64}$/);
    const references =
      binding.physicalApplicationReferences(applicationSnapshot);
    const entries = [
      {
        key: state.applicationKey ?? "pitr-a/historical.png",
        body: Buffer.from("old").toString("base64"),
        bytes: 3,
        sha256: binding.bytesHash(Buffer.from("old")),
        contentType: "image/png",
      },
      ...(state.additionalObjects ?? []),
    ];
    assert.equal(references.length, entries.length);
    assert.equal(new Set(entries.map((o) => o.key)).size, entries.length);
    for (const o of entries) {
      const reference = references.find((r) => r.key === o.key);
      assert.ok(reference);
      const bytes = Buffer.from(o.body, "base64");
      assert.equal(bytes.length, o.bytes);
      assert.equal(binding.bytesHash(bytes), o.sha256);
      if (reference.bytes !== undefined) assert.equal(reference.bytes, o.bytes);
      if (reference.sha256 !== undefined)
        assert.equal(reference.sha256, o.sha256);
    }
    await send(s3.CreateBucketCommand);
    await send(s3.PutBucketTaggingCommand, {
      Tagging: { TagSet: [{ Key: "omos-fixture", Value: project }] },
    });
    await send(s3.PutBucketVersioningCommand, {
      VersioningConfiguration: { Status: "Enabled" },
    });
    assert.equal((await send(s3.GetBucketVersioningCommand)).Status, "Enabled");
    state.expectedVersions = [];
    const versions = [];
    for (const o of entries) {
      const key = applicationGate.historicalApplicationKey(o.key);
      const metadata = {
        fixture: project,
        physical: physicalProject,
        target: targetName,
      };
      const versionId = remember(
        key,
        await send(s3.PutObjectCommand, {
          Key: key,
          Body: Buffer.from(o.body, "base64"),
          ContentType: o.contentType,
          CacheControl: "private, no-store",
          Metadata: metadata,
        }),
      );
      versions.push({
        key,
        sourceKey: o.key,
        versionId,
        bytes: o.bytes,
        sha256: o.sha256,
        contentType: o.contentType,
        cacheControl: "private, no-store",
        metadata,
      });
    }
    const objects = versions.map(({ sourceKey, versionId, ...r }) => ({
      ...r,
      key: sourceKey,
    }));
    const manifest = {
      physicalProject,
      targetName,
      baseBackupManifestSha256,
      applicationSnapshotSha256:
        binding.physicalCaptureHash(applicationSnapshot),
      references,
      objects,
      versions,
    };
    await objectsGate(
      { project, bucket, references: versions, read },
      async () => {},
    );
    return {
      manifest,
      captureSha256: binding.physicalCaptureHash(manifest),
      expectedVersions: state.expectedVersions,
    };
  }
  assert.deepEqual((await send(s3.GetBucketTaggingCommand)).TagSet, [
    { Key: "omos-fixture", Value: project },
  ]);
  const { manifest } = state;
  const evidence = { project, bucket, references: manifest.versions, read };
  if (mode === "physical-export-objects") {
    await objectsGate(evidence, async () => {});
    const objects = [];
    for (const v of manifest.versions) {
      const r = await read(v);
      objects.push({
        ...v,
        key: v.sourceKey,
        body: r.bytes.toString("base64"),
      });
    }
    return { objects };
  }
  if (mode === "physical-later") {
    await objectsGate(evidence, async () => {});
    for (const v of manifest.versions) {
      remember(
        v.key,
        await send(s3.PutObjectCommand, {
          Key: v.key,
          Body: Buffer.from("new"),
          ContentType: "text/plain",
          Metadata: { fixture: project, phase: "later" },
        }),
      );
      const marker = await send(s3.DeleteObjectCommand, { Key: v.key });
      assert.equal(marker.DeleteMarker, true);
      remember(v.key, marker, true);
      await assert.rejects(
        read({ key: v.key }),
        (e) => e.$metadata?.httpStatusCode === 404,
      );
    }
    return { expectedVersions: state.expectedVersions };
  }
  if (mode === "physical-verify") {
    const packet = {
      manifest,
      pointReceipt: state.pointReceipt,
      expectedPointReceiptSha256: state.expectedPointReceiptSha256,
      applicationSnapshot: state.applicationSnapshot,
    };
    for (const change of [
      { pointReceipt: { ...state.pointReceipt, targetName: "wrong" } },
      { pointReceipt: { ...state.pointReceipt, targetLsn: "0/DEAD" } },
      {
        pointReceipt: {
          ...state.pointReceipt,
          baseBackupManifestSha256: "0".repeat(64),
        },
      },
      { manifest: { ...manifest, references: [] } },
    ])
      assert.throws(() =>
        binding.assertPhysicalCapture({ ...packet, ...change }),
      );
    binding.assertPhysicalCapture(packet);
    const bound = applicationGate.assertApplicationObjectBinding({
      snapshotSha256: binding.physicalCaptureHash(state.applicationSnapshot),
      expectedSnapshotSha256: manifest.applicationSnapshotSha256,
      expected: manifest.references,
      recovered: binding.physicalApplicationReferences(
        state.applicationSnapshot,
      ),
      objects: manifest.objects,
      versions: manifest.versions,
    });
    let callbacks = 0;
    const ready = async () => {
      callbacks++;
    };
    await assert.rejects(
      objectsGate({ ...evidence, read: ({ key }) => read({ key }) }, ready),
    );
    await assert.rejects(
      objectsGate(
        {
          ...evidence,
          references: manifest.versions.map((v) => ({
            ...v,
            versionId: randomUUID(),
          })),
        },
        ready,
      ),
      (e) => e.$metadata?.httpStatusCode === 404,
    );
    assert.equal(callbacks, 0);
    await objectsGate(evidence, ready);
    assert.equal(callbacks, 1);
    const v = manifest.versions[0];
    assert.equal(
      (
        await fetch(
          `${process.env.S3_ENDPOINT}/${bucket}/${v.key}?versionId=${encodeURIComponent(v.versionId)}`,
        )
      ).status,
      403,
    );
    const saved = JSON.stringify(manifest);
    await send(s3.DeleteObjectCommand, { Key: v.key, VersionId: v.versionId });
    state.expectedVersions = state.expectedVersions.filter(
      (r) => r.VersionId !== v.versionId,
    );
    await assert.rejects(
      objectsGate(evidence, ready),
      (e) => e.$metadata?.httpStatusCode === 404,
    );
    assert.equal(callbacks, 1);
    assert.equal(JSON.stringify(manifest), saved);
    for (const original of manifest.versions) {
      const later = state.expectedVersions.find(
        (r) =>
          r.Key === original.key &&
          !r.marker &&
          r.VersionId !== original.versionId,
      );
      assert.ok(later, "Each original must retain its later overwrite version");
      assert.equal(
        (
          await read({ key: later.Key, versionId: later.VersionId })
        ).bytes.toString(),
        "new",
      );
    }
    return {
      expectedVersions: state.expectedVersions,
      report: {
        passed: true,
        bound,
        capturedManifest: manifest,
        pointReceipt: state.pointReceipt,
        pointReceiptSha256: state.expectedPointReceiptSha256,
        captureSha256: state.captureSha256,
        applicationSnapshotSha256: manifest.applicationSnapshotSha256,
        targetLsn: state.pointReceipt.targetLsn,
        readinessCallbacks: callbacks,
        checks: {
          capturedBeforePhysicalTarget: true,
          exactRecoveredApplicationSnapshotBound: true,
          wrongPointBaseManifestAndInventoryRejected: true,
          historicalBytesRemainReadableAfterLaterOverwriteAndDeleteMarker: true,
          currentAndMissingVersionsDenyReadiness: true,
          anonymousHistoricalReadDenied: true,
          permanentlyLostVersionDeniesReadiness: true,
          savedManifestAndLaterVersionPreserved: true,
        },
        coordinatedRedisRecoveryClaimed: false,
        productionRetentionClaimed: false,
        applicationStartedFromHistoricalObjects: false,
      },
    };
  }
  assert.equal(mode, "physical-cleanup");
  const listing = await send(s3.ListObjectVersionsCommand);
  assert.ok(!listing.IsTruncated);
  const actual = [
    ...(listing.Versions ?? []).map((v) => ({
      Key: v.Key,
      VersionId: v.VersionId,
      marker: false,
    })),
    ...(listing.DeleteMarkers ?? []).map((v) => ({
      Key: v.Key,
      VersionId: v.VersionId,
      marker: true,
    })),
  ];
  const order = (a) =>
    [...a].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  assert.deepEqual(order(actual), order(state.expectedVersions));
  for (const { Key, VersionId } of actual)
    await send(s3.DeleteObjectCommand, { Key, VersionId });
  const empty = await send(s3.ListObjectVersionsCommand);
  assert.equal(
    (empty.Versions ?? []).length + (empty.DeleteMarkers ?? []).length,
    0,
  );
  await send(s3.DeleteBucketCommand);
  await assert.rejects(
    send(s3.HeadBucketCommand),
    (e) => e.$metadata?.httpStatusCode === 404,
  );
  return { ownedPhysicalHistoricalVersionsCleaned: true };
}
