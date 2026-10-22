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
