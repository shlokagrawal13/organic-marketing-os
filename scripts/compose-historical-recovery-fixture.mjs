// Runs only in the owned disposable Compose runtime. No live cloud/provider calls.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
export async function runHistoricalRecovery({
  project,
  databasePoint,
  store,
  s3,
  objectsGate,
  effectsGate,
  applicationBinding,
  bindApplication,
  applicationKey,
}) {
  assert.match(project, /^omos-compose-verify-[a-f0-9]{16}$/);
  assert.equal(project.length, 36);
  if (applicationBinding)
    assert.equal(
      databasePoint,
      `logical-sha256:${applicationBinding.snapshotSha256}`,
    );
  else assert.match(databasePoint, /^[0-9A-F]+\/[0-9A-F]+$/);
  const bucket = `omos-history-${project.slice(-16)}`;
  const send = (Command, input = {}) =>
    store.client.send(new Command({ Bucket: bucket, ...input }));
  const sha = (b) => createHash("sha256").update(b).digest("hex");
  const expectedVersions = [];
  let created = false;
  const remember = (key, result, marker = false) => {
    assert.ok(result.VersionId && result.VersionId !== "null");
    assert.ok(!expectedVersions.some((v) => v.VersionId === result.VersionId));
    expectedVersions.push({ Key: key, VersionId: result.VersionId, marker });
    return result.VersionId;
  };
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
  const references = [];
  const checks = {};
  const metadata = { fixture: project, point: databasePoint };
  const provider = "http://fixture-provider:4999/historical-effects";
  const operationId = `history-${project.slice(-16)}`;
  try {
    await assert.rejects(
      send(s3.HeadBucketCommand),
      (e) => e.$metadata?.httpStatusCode === 404,
    );
    await send(s3.CreateBucketCommand);
    created = true;
    await send(s3.PutBucketTaggingCommand, {
      Tagging: { TagSet: [{ Key: "omos-fixture", Value: project }] },
    });
    await send(s3.PutBucketVersioningCommand, {
      VersioningConfiguration: { Status: "Enabled" },
    });
    assert.equal((await send(s3.GetBucketVersioningCommand)).Status, "Enabled");
    checks.dedicatedOwnedBucketVersioningEnabled = true;
    const entries = applicationBinding
      ? [...new Set(applicationBinding.expected.map((r) => r.key))]
          .sort()
          .map((sourceKey) => {
            const o = applicationBinding.objects.find(
              (o) => o.key === sourceKey,
            );
            assert.ok(o);
            return { ...o, key: applicationKey(sourceKey), sourceKey };
          })
      : ["synthetic/overwritten", "synthetic/deleted"].map((key) => ({
          key,
          contentType: "application/octet-stream",
          cacheControl: "private, no-store",
          metadata,
        }));
    assert.ok(entries.length >= 2);
    for (const entry of entries) {
      const { key } = entry;
      const bytes = applicationBinding
        ? await store.read(entry.sourceKey, 64 * 1024 * 1024)
        : Buffer.from(`Synthetic historical bytes for ${key}`);
      if (applicationBinding) {
        assert.equal(bytes.length, entry.bytes);
        assert.equal(sha(bytes), entry.sha256);
      }
      const versionId = remember(
        key,
        await send(s3.PutObjectCommand, {
          Key: key,
          Body: bytes,
          ContentType: entry.contentType,
          CacheControl: entry.cacheControl ?? undefined,
          Metadata: entry.metadata,
        }),
      );
      references.push({
        key,
        ...(entry.sourceKey ? { sourceKey: entry.sourceKey } : {}),
        versionId,
        bytes: bytes.length,
        sha256: sha(bytes),
        contentType: entry.contentType,
        cacheControl: entry.cacheControl ?? null,
        metadata: entry.metadata ?? {},
      });
    }
    assert.equal((await fetch(provider + "/" + operationId)).status, 404);
    const historicalManifest = JSON.stringify({
      databasePoint,
      bucket,
      references,
    });
    for (const r of references)
      remember(
        r.key,
        await send(s3.PutObjectCommand, {
          Key: r.key,
          Body: Buffer.from("Synthetic later overwrite"),
          ContentType: "text/plain",
          Metadata: { fixture: project, phase: "later" },
        }),
      );
    const marker = await send(s3.DeleteObjectCommand, {
      Key: references[1].key,
    });
    assert.equal(marker.DeleteMarker, true);
    remember(references[1].key, marker, true);
    await assert.rejects(
      read({ key: references[1].key }),
      (e) => e.$metadata?.httpStatusCode === 404,
    );
    assert.notEqual(
      sha((await read({ key: references[0].key })).bytes),
      references[0].sha256,
    );
    checks.currentReadsDoNotRepresentHistoricalPoint = true;
    const requestHash = sha(
      Buffer.from("Synthetic external effect after checkpoint"),
    );
    const submitted = await fetch(provider, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operationId, requestHash }),
    });
    assert.equal(submitted.status, 201);
    const accepted = await submitted.json();
    assert.equal(accepted.acceptedCalls, 1);
    assert.equal(accepted.submissionAttempts, 1);
    assert.equal(accepted.status, "CONFIRMED");
    const confirmed = await (await fetch(provider + "/" + operationId)).json();
    assert.deepEqual(confirmed, accepted);
    const effect = {
      operationId,
      requestHash,
      provider: confirmed.provider,
      providerOperationId: confirmed.providerOperationId,
      happenedAfterPoint: true,
    };
    const receipt = {
      ...effect,
      databasePoint,
      disposition: "DO_NOT_REPLAY",
      evidenceKind: "PROVIDER_CONFIRMED",
      reviewed: true,
    };
    const inventory = {
      databasePoint,
      inventoryComplete: true,
      effects: [effect],
    };
    let callbacks = 0;
    const ready = async () => {
      callbacks++;
    };
    const objectEvidence = { project, bucket, references, read };
    let bindingResult;
    if (applicationBinding) {
      const evidence = { ...applicationBinding, versions: references };
      const invalid = [
        { recovered: applicationBinding.recovered.slice(1) },
        ...["organizationId", "id", "key", "field"].map((field) => ({
          recovered: applicationBinding.recovered.map((r, i) =>
            i ? r : { ...r, [field]: "wrong" },
          ),
        })),
        { snapshotSha256: "0".repeat(64) },
        { versions: references.slice(1) },
        { versions: [...references, references[0]] },
        {
          versions: references.map((r, i) =>
            i ? r : { ...r, sha256: "0".repeat(64) },
          ),
        },
      ];
      for (const change of invalid)
        assert.throws(() => bindApplication({ ...evidence, ...change }));
      bindingResult = bindApplication(evidence);
      checks.restoredApplicationRowsAndExactHistoricalManifestBound = true;
      checks.wrongTenantRowFieldKeySnapshotAndIncompleteManifestRejected = true;
    }
    await assert.rejects(
      objectsGate(
        { ...objectEvidence, read: ({ key }) => read({ key }) },
        ready,
      ),
    );
    await assert.rejects(
      objectsGate(
        {
          ...objectEvidence,
          references: [
            {
              ...references[0],
              versionId: expectedVersions[references.length].VersionId,
            },
          ],
        },
        ready,
      ),
    );
    await assert.rejects(
      objectsGate(
        {
          ...objectEvidence,
          references: [{ ...references[0], versionId: randomUUID() }],
        },
        ready,
      ),
      (error) => error.$metadata?.httpStatusCode === 404,
    );
    await assert.rejects(
      objectsGate(objectEvidence, () =>
        effectsGate({ ...inventory, receipts: [] }, ready),
      ),
      /Missing external-effect/,
    );
    await assert.rejects(
      objectsGate(objectEvidence, () =>
        effectsGate(
          {
            ...inventory,
            receipts: [{ ...receipt, requestHash: "f".repeat(64) }],
          },
          ready,
        ),
      ),
      /requestHash mismatch/,
    );
    assert.equal(callbacks, 0);
    checks.wrongCurrentMissingVersionsAndUnreconciledEffectsBlockReadiness = true;
    if (applicationBinding)
      bindApplication({ ...applicationBinding, versions: references });
    await objectsGate(objectEvidence, () =>
      effectsGate({ ...inventory, receipts: [receipt] }, ready),
    );
    assert.equal(callbacks, 1);
    assert.deepEqual(
      await (await fetch(provider + "/" + operationId)).json(),
      accepted,
    );
    checks.exactHistoricalVersionBytesAndMetadataRecovered = true;
    checks.providerConfirmedEffectReviewedWithoutReplay = true;
    const anonymous = await fetch(
      `${process.env.S3_ENDPOINT}/${bucket}/${references[0].key}?versionId=${encodeURIComponent(references[0].versionId)}`,
    );
    assert.equal(anonymous.status, 403);
    checks.historicalVersionRemainsPrivate = true;
    // Retention loss is irreversible: a manifest cannot manufacture absent bytes.
    await send(s3.DeleteObjectCommand, {
      Key: references[0].key,
      VersionId: references[0].versionId,
    });
    expectedVersions.splice(
      expectedVersions.findIndex(
        (v) => v.VersionId === references[0].versionId,
      ),
      1,
    );
    await assert.rejects(
      objectsGate(objectEvidence, ready),
      (error) => error.$metadata?.httpStatusCode === 404,
    );
    assert.equal(callbacks, 1);
    await objectsGate(
      { ...objectEvidence, references: [references[1]] },
      async () => {},
    );
    assert.equal(
      (await read({ key: references[0].key })).bytes.toString(),
      "Synthetic later overwrite",
    );
    assert.equal(
      JSON.stringify({ databasePoint, bucket, references }),
      historicalManifest,
    );
    checks.permanentlyMissingHistoricalVersionRejectsReadiness = true;
    checks.otherVersionsAndSavedManifestPreserved = true;
    return {
      checks,
      objectsAtHistoricalPoint: references.length,
      ...(bindingResult
        ? {
            applicationBinding: bindingResult,
            databaseSnapshotSha256: applicationBinding.snapshotSha256,
          }
        : {}),
      syntheticExternalEffects: 1,
      acceptedProviderCalls: 1,
      providerSubmissionAttempts: 1,
      readinessCallbacks: callbacks,
      databasePoint,
      databasePointMeaning: applicationBinding
        ? "Logical dump digest binds source/restored application reference inventories; historical copies are created after logical restore. No physical recovery target binding."
        : "Sampled source LSN used only as a fixture correlation label; objects are created afterwards.",
      coordinatedRecoveryPointEstablished: false,
      physicalPitrCombined: false,
      productionRetentionClaimed: false,
    };
  } finally {
    if (created) {
      assert.deepEqual((await send(s3.GetBucketTaggingCommand)).TagSet, [
        { Key: "omos-fixture", Value: project },
      ]);
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
        [...a].sort((x, y) =>
          JSON.stringify(x).localeCompare(JSON.stringify(y)),
        );
      assert.deepEqual(order(actual), order(expectedVersions));
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
      checks.ownedHistoricalBucketAndAllVersionsRemoved = true;
    }
  }
}
