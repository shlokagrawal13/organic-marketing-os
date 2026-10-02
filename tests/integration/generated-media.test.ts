import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { actor, db, draft, scene, until } from "../support/http";
import { grantCredits } from "../../packages/core/credits";

test(
  "generated media: durable provider jobs, tenant controls, private ingestion, fixed credits and targeted revisions",
  { timeout: 180000 },
  async () => {
    const api = spawn("node", ["dist/apps/api/src/main.js"], {
      env: { ...process.env, API_PORT: "4003", BILLING_MODE: "credits" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const log = createWriteStream(".local/media-credit-api.log");
    api.stdout.pipe(log);
    api.stderr.pipe(log);
    let stopped = false;
    try {
      await until(async () => {
        try {
          return (await fetch("http://127.0.0.1:4003/api/health")).ok;
        } catch {
          return false;
        }
      }, Boolean);
      const org = await db.organization.create({
        data: { name: "Generated media isolated fixture" },
      });
      const otherOrg = await db.organization.create({
        data: { name: "Other media fixture" },
      });
      const owner = await actor(org.id),
        viewer = await actor(org.id, "ANALYST"),
        outsider = await actor(otherOrg.id);
      const call = async (
        path: string,
        method = "GET",
        body?: unknown,
        user = owner,
      ) => {
        const response = await fetch(
          `http://127.0.0.1:4003/api/workspaces/${org.id}${path}`,
          {
            method,
            headers: { ...user.headers, "Content-Type": "application/json" },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          },
        );
        return { status: response.status, body: await response.json() };
      };
      const path = "/media-generations";
      await db.$transaction((tx) =>
        grantCredits(
          tx,
          org.id,
          40,
          randomUUID(),
          "Synthetic isolated media test grant",
          owner.id,
        ),
      );
      assert.equal((await call(path + "/status")).body.models.length, 3);
      const content = await call("/content", "POST", {
        ...draft,
        scenes: [
          scene,
          { ...scene, id: "second", onScreenText: "Preserve this scene" },
        ],
      });
      assert.equal(content.status, 201);
      await db.contentItem.update({
        where: { id: content.body.id },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
          approvedBy: owner.id,
        },
      });
      const envelope = (
        kind = "image",
        prompt = "Synthetic image",
        target?: any,
      ) => ({
        requestKey: randomUUID(),
        maxCredits: 2,
        request: {
          kind,
          model: `fixture-${kind}`,
          prompt,
          rightsConfirmed: true,
          rightsNote: "Synthetic automated fixture with no real people",
          maxCostUsd: 0.1,
          ...(target ? { target } : {}),
        },
      });
      const target = {
        contentId: content.body.id,
        revision: 1,
        sceneId: scene.id,
        component: "visual",
      };
      const input = envelope("image", "Synthetic image", target);
      assert.equal((await call(path, "POST", input, viewer)).status, 403);
      assert.equal((await call(path, "POST", input, outsider)).status, 404);
      assert.equal(
        (await call(path, "POST", { ...input, maxCredits: 1 })).status,
        409,
      );
      assert.equal(
        (
          await call(path, "POST", {
            ...input,
            request: { ...input.request, maxCostUsd: 0 },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await call(path, "POST", {
            ...input,
            request: { ...input.request, sourceAssetIds: [randomUUID()] },
          })
        ).status,
        400,
      );
      const sourceAsset = await db.asset.create({
        data: {
          organizationId: org.id,
          name: "Reference image fixture.png",
          kind: "IMAGE",
          mimeType: "image/png",
          bytes: 128,
          sha256: `reference-${randomUUID()}`,
          objectKey: `${org.id}/reference/${randomUUID()}`,
          rightsNote: "Synthetic owned reference fixture",
          createdBy: owner.id,
        },
      });
      const sourceResponse = await call(path, "POST", {
        ...input,
        request: { ...input.request, sourceAssetIds: [sourceAsset.id] },
      });
      assert.equal(sourceResponse.status, 400);
      assert.match(sourceResponse.body.error.message, /source assets/i);
      const created = await Promise.all([
        call(path, "POST", input),
        call(path, "POST", input),
      ]);
      assert.equal(created[0].status, 201);
      assert.equal(created[1].status, 201);
      assert.equal(created[0].body.id, created[1].body.id);
      const id = created[0].body.id;
      assert.equal(
        (
          await call(path, "POST", {
            ...input,
            request: { ...input.request, prompt: "Conflicting request" },
          })
        ).status,
        409,
      );
      assert.equal(
        (await call(`${path}/${id}`, "GET", undefined, outsider)).status,
        404,
      );
      assert.equal(
        (
          await outsider.call(
            `/workspaces/${otherOrg.id}/media-generations/${id}`,
          )
        ).status,
        404,
      );
      const waitJob = async (jobId: string, state: string) =>
        (
          await until(
            () => call(`${path}/${jobId}`),
            (r) => r.body.state === state,
            45000,
          )
        ).body;
      const generated = await waitJob(id, "SUCCEEDED");
      assert.equal(generated.actualCostUsd, null);
      assert.equal(generated.costStatus, "unknown");
      assert.equal(generated.outputKey, undefined);
      assert.equal(generated.runToken, undefined);
      const file = await fetch(
        `http://127.0.0.1:4003/api/workspaces/${org.id}/assets/${generated.assetId}/file`,
        { headers: owner.headers },
      );
      assert.equal(file.status, 200);
      assert.equal(file.headers.get("content-type"), "image/png");
      assert.ok((await file.arrayBuffer()).byteLength > 100);
      const reservation = await db.creditReservation.findUniqueOrThrow({
        where: { id: generated.creditReservationId },
      });
      assert.equal(reservation.state, "SETTLED");
      assert.equal(reservation.consumed, 2);
      assert.equal(
        (await call(`${path}/${id}/attach`, "POST", { revision: 1 }, viewer))
          .status,
        403,
      );
      assert.equal(
        (await call(`${path}/${id}/attach`, "POST", { revision: 1 })).status,
        201,
      );
      assert.equal(
        (await call(`${path}/${id}/attach`, "POST", { revision: 1 })).body
          .alreadyAttached,
        true,
      );
      let updated = await db.contentItem.findUniqueOrThrow({
        where: { id: content.body.id },
      });
      assert.equal(updated.revision, 2);
      assert.equal(updated.status, "DRAFT");
      assert.equal(updated.approvedAt, null);
      assert.equal((updated.scenes as any)[0].visualAssetId, generated.assetId);
      assert.deepEqual((updated.scenes as any)[1], {
        ...scene,
        id: "second",
        onScreenText: "Preserve this scene",
      });
      const stale = await call(
        path,
        "POST",
        envelope("image", "Synthetic stale image", { ...target, revision: 2 }),
      );
      await waitJob(stale.body.id, "SUCCEEDED");
      assert.equal(
        (
          await call(`/content/${content.body.id}`, "PUT", {
            ...draft,
            revision: 2,
            scenes: updated.scenes,
            body: "Edited while the provider worked",
          })
        ).status,
        200,
      );
      assert.equal(
        (await call(`${path}/${stale.body.id}/attach`, "POST", { revision: 2 }))
          .status,
        409,
      );
      const voice = await call(
        path,
        "POST",
        envelope("voice", "Synthetic voice", {
          ...target,
          revision: 3,
          component: "narration",
        }),
      );
      const audio = await waitJob(voice.body.id, "SUCCEEDED");
      assert.equal(
        (await call(`${path}/${voice.body.id}/attach`, "POST", { revision: 3 }))
          .status,
        201,
      );
      updated = await db.contentItem.findUniqueOrThrow({
        where: { id: content.body.id },
      });
      assert.equal((updated.scenes as any)[0].audioAssetId, audio.assetId);
      assert.equal((updated.scenes as any)[0].visualAssetId, generated.assetId);
      const video = await call(
        path,
        "POST",
        envelope("video", "POLL_ERROR: synthetic video"),
      );
      await waitJob(video.body.id, "PENDING");
      const cancel = await call(`${path}/${video.body.id}/cancel`, "POST", {});
      assert.equal(cancel.body.state, "PENDING");
      assert.ok(cancel.body.cancellationNotice);
      const videoResult = await waitJob(video.body.id, "SUCCEEDED");
      assert.ok(videoResult.cancellationRequestedAt);
      assert.equal(
        (
          await db.asset.findUniqueOrThrow({
            where: { id: videoResult.assetId },
          })
        ).kind,
        "VIDEO",
      );
      const invalid = await call(
        path,
        "POST",
        envelope("image", "INVALID: test invalid bytes"),
      );
      const invalidResult = await waitJob(invalid.body.id, "FAILED");
      assert.equal(invalidResult.assetId, null);
      assert.equal(
        (
          await db.creditReservation.findUniqueOrThrow({
            where: { id: invalidResult.creditReservationId },
          })
        ).state,
        "REVIEW",
      );
      const dropInput = envelope(
        "image",
        "DROP: ambiguous provider acceptance",
      );
      const dropped = await call(path, "POST", dropInput);
      const unknown = await waitJob(dropped.body.id, "UNKNOWN");
      assert.equal((await call(path, "POST", dropInput)).body.id, unknown.id);
      assert.equal(
        (
          await db.creditReservation.findUniqueOrThrow({
            where: { id: unknown.creditReservationId },
          })
        ).state,
        "REVIEW",
      );
      // Stop only the isolated media worker so the cancellation is definitely pre-submit.
      process.kill(Number(process.env.TEST_MEDIA_WORKER_PID), "SIGSTOP");
      stopped = true;
      const queued = await call(
        path,
        "POST",
        envelope("image", "Must never reach provider"),
      );
      const canceled = await call(
        `${path}/${queued.body.id}/cancel`,
        "POST",
        {},
      );
      assert.equal(canceled.body.state, "CANCELED");
      assert.equal(canceled.body.actualCostUsd, 0);
      assert.equal(
        (
          await db.creditReservation.findUniqueOrThrow({
            where: { id: canceled.body.creditReservationId },
          })
        ).state,
        "RELEASED",
      );
      process.kill(Number(process.env.TEST_MEDIA_WORKER_PID), "SIGCONT");
      stopped = false;
      const calls = await (await fetch("http://127.0.0.1:4998/stats")).json();
      for (const prompt of [
        "Synthetic image",
        "Synthetic stale image",
        "Synthetic voice",
        "POLL_ERROR: synthetic video",
        "DROP: ambiguous provider acceptance",
      ])
        assert.equal(calls[prompt], 1);
      assert.equal(calls["Must never reach provider"], undefined);
      assert.equal(
        await db.mediaGeneration.count({ where: { organizationId: org.id } }),
        7,
      );
      const exported = await fetch(
        `http://127.0.0.1:4003/api/workspaces/${org.id}/operations/export`,
        { headers: owner.headers },
      );
      assert.equal(exported.status, 200);
      const text = await exported.text();
      const mediaRecords = text
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
        .filter((row) => row.type === "mediaGeneration");
      assert.equal(mediaRecords.length, 7);
      assert.equal(
        mediaRecords.find((row) => row.data.id === id).data.assetId,
        generated.assetId,
      );
      assert.ok(!text.includes("isolated-media-fixture"));
      assert.ok(
        mediaRecords.every(
          (row) =>
            row.data.outputKey === undefined && row.data.runToken === undefined,
        ),
      );
    } finally {
      if (stopped)
        process.kill(Number(process.env.TEST_MEDIA_WORKER_PID), "SIGCONT");
      api.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        if (api.exitCode !== null) return resolve();
        api.once("exit", () => resolve());
      });
      await db.$disconnect();
    }
  },
);
