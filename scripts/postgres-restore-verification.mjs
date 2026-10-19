// Native interruption probes for generated, isolated restore targets only.
// No application migration or production data is created/changed by this module.
import assert from "node:assert/strict";
import { assertFixtureRestoreProject } from "./compose-verification.mjs";

export const restoreApplicationName = "omos_fixture_restore_probe";
export const restoreBarrierSql = `
CREATE SCHEMA omos_restore_fixture;
CREATE FUNCTION omos_restore_fixture.pause_restore() RETURNS boolean
LANGUAGE plpgsql VOLATILE AS $$
BEGIN
  IF current_setting('omos.fixture_restore_pause', true) = 'on' THEN
    PERFORM pg_sleep(120);
  END IF;
  RETURN true;
END;
$$;
CREATE TABLE omos_restore_fixture.barrier (
  id integer PRIMARY KEY,
  CONSTRAINT synthetic_restore_barrier CHECK (omos_restore_fixture.pause_restore())
);
INSERT INTO omos_restore_fixture.barrier VALUES (1);
`;
const targetStateSql = `SELECT json_build_object(
  'tables', (SELECT count(*)::int FROM pg_tables WHERE schemaname IN ('public','omos_restore_fixture')),
  'barrierVisible', to_regclass('omos_restore_fixture.barrier') IS NOT NULL
);`;
const pausedSql = `SELECT count(*)::int FROM pg_stat_activity
WHERE datname=current_database() AND application_name='${restoreApplicationName}'
AND state='active' AND wait_event='PgSleep';`;
const terminateSql = `SELECT coalesce(json_agg(pg_terminate_backend(pid)), '[]'::json)
FROM pg_stat_activity WHERE datname=current_database()
AND application_name='${restoreApplicationName}';`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Adapter operations must target the same generated restore project. reset()
// recreates only its empty disposable database; the source DB is never reset.
export async function verifyInterruptedRestore({
  project,
  query,
  reset,
  setPause,
  restore,
  progress = () => {},
}) {
  assertFixtureRestoreProject(project);
  const cases = [];
  for (const atomic of [false, true]) {
    assertFixtureRestoreProject(project);
    await reset();
    assert.deepEqual(JSON.parse(await query(targetStateSql)), {
      tables: 0,
      barrierVisible: false,
    });
    await setPause(true);
    progress(
      atomic
        ? "interrupt atomic restore"
        : "interrupt non-atomic negative control",
    );
    let settled;
    // Attach the rejection handler immediately: backend termination is an
    // expected non-zero exit, not an unhandled host promise rejection.
    const pending = restore(atomic).then(
      () => (settled = { succeeded: true }),
      (error) => (settled = { succeeded: false, error }),
    );
    try {
      let paused = false;
      for (let i = 0; i < 150; i++) {
        if (settled)
          throw new Error(
            `Restore exited before the native barrier: ${settled.error?.message || "unexpected success"}`,
          );
        const count = Number((await query(pausedSql)).trim());
        assert.ok(
          count === 0 || count === 1,
          "Only one fixture restore connection may exist.",
        );
        if (count === 1) {
          paused = true;
          break;
        }
        await sleep(200);
      }
      assert.ok(
        paused,
        "The actual pg_restore backend did not reach its COPY barrier.",
      );
      const during = JSON.parse(await query(targetStateSql));
      if (atomic)
        assert.deepEqual(during, { tables: 0, barrierVisible: false });
      else
        assert.ok(
          during.tables > 0 && during.barrierVisible,
          "Negative control must expose partially restored schema.",
        );
      assert.deepEqual(JSON.parse(await query(terminateSql)), [true]);
      await pending;
      assert.equal(
        settled.succeeded,
        false,
        "Interrupted pg_restore must exit non-zero.",
      );
      const after = JSON.parse(await query(targetStateSql));
      if (atomic)
        assert.deepEqual(
          after,
          { tables: 0, barrierVisible: false },
          "Atomic interruption must roll back every restored relation.",
        );
      else
        assert.ok(
          after.tables > 0 && after.barrierVisible,
          "The negative control must retain partial state after interruption.",
        );
      cases.push({
        atomic,
        reachedNativeCopyBarrier: true,
        backendTerminated: true,
        restoreExitedNonZero: true,
        visibleTablesDuringRestore: during.tables,
        visibleTablesAfterInterruption: after.tables,
        rollbackToEmptyTarget: after.tables === 0,
      });
    } finally {
      if (!settled) {
        await query(terminateSql);
        await pending;
      }
    }
  }
  await reset();
  await setPause(false);
  assert.deepEqual(JSON.parse(await query(targetStateSql)), {
    tables: 0,
    barrierVisible: false,
  });
  return {
    cases,
    checks: {
      nonAtomicInterruptionLeavesPartialState: true,
      atomicInterruptionRollsBackSchemaAndData: true,
      cleanEmptyTargetPreparedForRetry: true,
    },
  };
}
