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
