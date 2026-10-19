import assert from "node:assert/strict";
import { resolve } from "node:path";

// A registered loopback port and a generated private package are required before
// launching Prisma. This harness never accepts a caller-supplied database URL.
export function assertUpgradeFixture({
  project,
  root,
  caseRoot,
  port,
  url,
  kind,
}) {
  assert.match(project, /^omos-upgrade-verify-[0-9a-f]{16}$/);
  assert.equal(project.length, 36);
  assert.ok(["upgrade", "fault-default", "fault-atomic"].includes(kind));
  assert.ok(Number.isInteger(port) && port > 0 && port < 65536);
  assert.equal(
    caseRoot,
    resolve(root, ".local/native-upgrade", project.slice(-16), kind),
  );
  const target = new URL(url);
  assert.equal(target.protocol, "postgresql:");
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.port, String(port));
  assert.equal(target.username, "fixture");
  assert.match(target.password, /^[0-9a-f]{64}$/);
  assert.equal(
    target.pathname,
    kind === "upgrade" ? "/fixture_upgrade" : "/fixture_fault",
  );
  assert.equal(target.search, "?schema=public");
  assert.equal(target.hash, "");
}

// New nullable/defaulted columns are allowed; every old row and old value must
// survive. Callers SELECT all fixture rows in stable order.
export function assertPreservedRows(before, after) {
  for (const [table, rows] of Object.entries(before)) {
    assert.ok(Array.isArray(after[table]), `Missing legacy table ${table}`);
    assert.equal(
      after[table].length,
      rows.length,
      `Legacy row count changed: ${table}`,
    );
    rows.forEach((row, index) => {
      for (const [column, value] of Object.entries(row)) {
        assert.ok(
          Object.hasOwn(after[table][index], column),
          `Missing ${table}.${column}`,
        );
        assert.deepEqual(
          after[table][index][column],
          value,
          `Changed ${table}.${column}`,
        );
      }
    });
  }
}
