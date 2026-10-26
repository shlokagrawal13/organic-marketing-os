// Host orchestration for owned one-off containers only. No production entrypoint hooks.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertFixtureProject } from "./compose-verification.mjs";
import { applicationSnapshot } from "./application-pitr-fixture.mjs";
import { physicalCaptureHash } from "./physical-object-binding.mjs";
export async function interruptPhysicalWorkers({
  project,
  nonce,
  appState,
  compose,
  command,
  node,
  query,
  preparePoint,
  capturePoint,
}) {
  assertFixtureProject(project);
  assert.ok(project.endsWith("-restore"));
  assert.match(nonce, /^[a-f0-9]{16}$/);
  const names = [],
    containers = [];
  const inspect = async (name) =>
    JSON.parse(await command(["inspect", name], { quiet: true }))[0];
  const own = (value, kind) => {
    assert.equal(value.Config.Labels["com.docker.compose.project"], project);
    assert.equal(
      value.Config.Labels["com.docker.compose.service"],
      kind === "render" ? "render-worker" : "media-worker",
    );
    assert.equal(value.HostConfig.RestartPolicy.Name, "no");
  };
  try {
    const preparedPoint = preparePoint ? await preparePoint() : undefined;
    for (const kind of ["render", "media"]) {
      const name = project + "-crash-" + kind;
      const options = {
        nonce,
        kind,
        org: appState.ids["pitr-a"],
        retainedKey: appState.mediaFixture.outputKey,
      };
      const script =
        readFileSync(
          new URL("./physical-worker-barrier.cjs", import.meta.url),
          "utf8",
        ) +
        "\nPromise.resolve(installPhysicalWorkerBarrier(" +
        JSON.stringify(options) +
        ")).then(()=>require(" +
        JSON.stringify(
          "/app/dist/apps/api/src/" +
            (kind === "render" ? "render-worker" : "media-generation-worker") +
            ".js",
        ) +
        ")).catch(e=>{console.error(e.message);process.exit(1)});";
      await compose(
        project,
        [
          "run",
          "-d",
          "--no-deps",
          "-T",
          "--name",
          name,
          "-e",
          "MOS_ISOLATED_TEST_HARNESS=true",
          "-e",
          "NODE_ENV=development",
          ...(kind === "media"
            ? [
                "-e",
                "MEDIA_GENERATION_ENABLED=true",
                "-e",
                "OPENAI_MEDIA_API_KEY=synthetic-isolated-media",
                "-e",
                "OPENAI_MEDIA_BASE_URL=http://127.0.0.1:4998/v1",
                "-e",
                "MEDIA_IMAGE_MODEL=fixture-image",
                "-e",
                "MEDIA_IMAGE_ESTIMATE_USD=0.1",
                "-e",
                "MEDIA_IMAGE_CREDITS=2",
              ]
            : []),
          kind === "render" ? "render-worker" : "media-worker",
          "node",
          "-e",
          script,
        ],
        { quiet: true },
      );
      names.push({ name, kind });
      const value = await inspect(name);
      own(value, kind);
      assert.equal(value.State.Running, true);
      containers.push({
        kind,
        id: value.Id,
        pidBeforeKill: value.State.Pid,
        entrypoint: value.Config.Cmd[0],
      });
    }
    const barrier = await node(
      project,
      "physical-media-process-barriers",
      { ...appState, nonce },
      false,
    );
    let physicalPoint;
    if (capturePoint) {
      const paused = [];
      try {
        for (const { name, kind } of names) {
          const before = await inspect(name);
          own(before, kind);
          assert.equal(before.State.Running, true);
          await command(["pause", name], { quiet: true });
          paused.push({ name, kind });
          const after = await inspect(name);
          own(after, kind);
          assert.equal(after.State.Paused, true);
        }
        physicalPoint = await capturePoint(barrier, preparedPoint);
        physicalPoint.pausedActualWorkerProcesses = paused.length;
      } finally {
        for (const { name, kind } of paused.reverse()) {
          const value = await inspect(name);
          own(value, kind);
          if (value.State.Paused)
            await command(["unpause", name], { quiet: true });
          assert.equal((await inspect(name)).State.Paused, false);
        }
      }
    }
    for (const { name, kind } of names) {
      const before = await inspect(name);
      own(before, kind);
      assert.equal(before.State.Running, true);
      assert.ok(before.State.Pid > 0);
      await command(["kill", "--signal", "KILL", name], { quiet: true });
      const after = await inspect(name);
      own(after, kind);
      assert.equal(after.State.Running, false);
      assert.equal(after.State.ExitCode, 137);
      assert.equal(after.RestartCount, 0);
      Object.assign(
        containers.find((x) => x.kind === kind),
        {
          exitCode: after.State.ExitCode,
          restartCount: after.RestartCount,
          finishedAt: after.State.FinishedAt,
        },
      );
    }
    const killedSnapshot = await applicationSnapshot(query);
    const expiry = await node(
      project,
      "physical-media-process-expiry",
      { ...appState, nonce, barrier },
      false,
    );
    assert.deepEqual(
      await applicationSnapshot(query),
      killedSnapshot,
      "Rows changed while killed writers were absent",
    );
    // This is an owned recovery stack. Queue state is deliberately discarded only
    // after all real writer processes are confirmed dead; DB leases are never edited.
    const cfg = JSON.parse(
      await compose(
        project,
        ["config", "--no-env-resolution", "--format", "json"],
        { quiet: true },
      ),
    );
    const redis = JSON.parse(
      await command(["volume", "inspect", cfg.volumes.redis_data.name], {
        quiet: true,
      }),
    )[0];
    assert.equal(redis.Labels["com.docker.compose.project"], project);
    const beforeKeys = Number(
      (
        await compose(project, ["exec", "-T", "redis", "redis-cli", "DBSIZE"], {
          quiet: true,
        })
      ).trim(),
    );
    assert.ok(beforeKeys > 0);
    await compose(project, ["exec", "-T", "redis", "redis-cli", "FLUSHALL"], {
      quiet: true,
    });
    assert.equal(
      (
        await compose(project, ["exec", "-T", "redis", "redis-cli", "DBSIZE"], {
          quiet: true,
        })
      ).trim(),
      "0",
    );
    assert.deepEqual(await applicationSnapshot(query), killedSnapshot);
    return {
      containers,
      barrier,
      ...(physicalPoint ? { physicalPoint } : {}),
      expiry,
      rowsAfterKillSha256: physicalCaptureHash(killedSnapshot),
      redisKeysDiscarded: beforeKeys,
      redisKeysBeforeRestart: 0,
      checks: {
        actualWorkerProcessesKilledAtAcknowledgedBoundaries: true,
        encodedPrivateRenderSegmentVerifiedBeforeKill: true,
        retainedPrivateMediaReadBeforeProcessKill: true,
        acceptedMediaResponseLostBeforeWorkerReceipt: true,
        naturalDatabaseLeasesExpiredWithoutEdits: true,
        killedWorkerRowsPreservedUntilRecovery: true,
        freshRedisReconstructionAfterKilledWriters: true,
      },
    };
  } finally {
    for (const { name, kind } of names) {
      const value = await inspect(name);
      own(value, kind);
      await command(["rm", "-f", name], { quiet: true });
    }
  }
}
