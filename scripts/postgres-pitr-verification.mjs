import assert from "node:assert/strict";
export function assertPitrProject(project) {
  assert.equal(typeof project, "string");
  assert.match(project, /^omos-pitr-verify-[0-9a-f]{16}$/);
  assert.equal(project.length, 33);
}
export function assertPitrCase(project, kind, directory) {
  assertPitrProject(project);
  assert.ok(["corrupt", "missing-wal", "unreachable", "retry"].includes(kind));
  assert.equal(directory, `/fixture/${kind}`);
}
export async function withVerifiedPhysicalBackup(verify, start) {
  const result = await verify();
  assert.match(result, /backup successfully verified/);
  return await start();
}
export function nativeStartExit(output) {
  const matches = [...output.matchAll(/^OMOS_NATIVE_START_EXIT=(\d+)\r?$/gm)];
  assert.equal(
    matches.length,
    1,
    "Missing or ambiguous native startup exit marker",
  );
  const code = Number(matches[0][1]);
  assert.ok(Number.isInteger(code) && code >= 0 && code <= 255);
  return code;
}

// pg_ctl can report startup before a promoted hot_standby=off cluster admits SQL.
// This positive-path gate never replaces native exit or negative-target checks.
export async function waitForPromotedSql(
  probe,
  { attempts = 40, delay = () => new Promise((r) => setTimeout(r, 250)) } = {},
) {
  assert.ok(Number.isInteger(attempts) && attempts > 0 && attempts <= 100);
  for (let i = 0; i < attempts; i++) {
    try {
      const result = (await probe()).trim();
      assert.ok(["t", "f"].includes(result), "Unexpected SQL promotion result");
      if (result === "t")
        return { attempts: i + 1, sqlAcceptedAndPromoted: true };
    } catch (error) {
      if (
        !/FATAL:\s+the database system is (?:not accepting connections|starting up)/.test(
          error.message,
        )
      )
        throw error;
    }
    if (i + 1 < attempts) await delay();
  }
  throw new Error(
    "Recovered cluster did not admit promoted SQL within the bounded readiness check",
  );
}
