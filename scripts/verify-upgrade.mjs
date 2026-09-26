// Isolated PGlite recovery exercise. This does not certify native pg_dump/restore.
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import assert from "node:assert/strict";
const db = await PGlite.create();
let restored;
try {
  const dirs = (await readdir("prisma/migrations"))
    .filter((n) => /^\d/.test(n))
    .sort();
  for (const dir of dirs.slice(0, 4))
    await db.exec(
      await readFile(`prisma/migrations/${dir}/migration.sql`, "utf8"),
    );
  const user = randomUUID(),
    org = randomUUID(),
    content = randomUUID(),
    job = randomUUID();
  await db.query(
    'INSERT INTO "User" (id,email,name,"passwordHash") VALUES ($1,$2,$3,$4)',
    [user, "upgrade@example.test", "Preserved user", "test-only-hash"],
  );
  await db.query('INSERT INTO "Organization" (id,name) VALUES ($1,$2)', [
    org,
    "Preserved workspace",
  ]);
  await db.query(
    'INSERT INTO "Membership" ("userId","organizationId",role) VALUES ($1,$2,$3)',
    [user, org, "OWNER"],
  );
  await db.query(
    'INSERT INTO "ContentItem" (id,"organizationId",title,platform,format,body,"createdBy","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,now())',
    [
      content,
      org,
      "Preserved draft",
      "LinkedIn",
      "Text",
      "Saved work before upgrade",
      user,
    ],
  );
  await db.query(
    'INSERT INTO "AIJob" (id,"organizationId","actorId","requestKey",task,input) VALUES ($1,$2,$3,$4,$5,$6)',
    [
      job,
      org,
      user,
      randomUUID(),
      "content",
      JSON.stringify({ prompt: "An existing queued request" }),
    ],
  );
  const before = (
    await db.query(
      'SELECT row_to_json(c) AS row FROM "ContentItem" c WHERE id=$1',
      [content],
    )
  ).rows[0].row;
  for (const dir of dirs.slice(4))
    await db.exec(
      await readFile(`prisma/migrations/${dir}/migration.sql`, "utf8"),
    );
  assert.deepEqual(
    (
      await db.query(
        'SELECT row_to_json(c) AS row FROM "ContentItem" c WHERE id=$1',
        [content],
      )
    ).rows[0].row,
    before,
  );
  assert.equal(
    (await db.query('SELECT "brandContext" FROM "AIJob" WHERE id=$1', [job]))
      .rows[0].brandContext,
    null,
  );
  const creditOrg = randomUUID(),
    creditEntry = randomUUID();
  await db.query('INSERT INTO "Organization" (id,name) VALUES ($1,$2)', [
    creditOrg,
    "Preserved credit ledger",
  ]);
  await db.query(
    'INSERT INTO "CreditAccount" ("organizationId",available,revision,"updatedAt") VALUES ($1,10,1,now())',
    [creditOrg],
  );
  await db.query(
    'INSERT INTO "CreditEntry" (id,"organizationId","operationKey","requestHash",kind,"availableDelta","reservedDelta","availableAfter","reservedAfter",sequence,reference,reason) VALUES ($1,$2,$3,$4,$5,10,0,10,0,1,$6,$7)',
    [
      creditEntry,
      creditOrg,
      "restore-grant",
      "test-hash",
      "GRANT",
      "restore-test",
      "Synthetic restore verification grant",
    ],
  );
  await assert.rejects(
    db.query('UPDATE "CreditEntry" SET "availableDelta"=99 WHERE id=$1', [
      creditEntry,
    ]),
    /immutable/,
  );
  await assert.rejects(
    db.query('DELETE FROM "CreditEntry" WHERE id=$1', [creditEntry]),
    /immutable/,
  );
  const backup = await db.dumpDataDir();
  await db.query('DELETE FROM "Organization" WHERE id=$1', [org]);
  assert.equal(
    (await db.query('SELECT count(*)::int AS n FROM "ContentItem"')).rows[0].n,
    0,
  );
  restored = await PGlite.create({ loadDataDir: backup });
  assert.deepEqual(
    (
      await restored.query(
        'SELECT row_to_json(c) AS row FROM "ContentItem" c WHERE id=$1',
        [content],
      )
    ).rows[0].row,
    before,
  );
  assert.equal(
    (await restored.query('SELECT count(*)::int AS n FROM "Membership"'))
      .rows[0].n,
    1,
  );
  assert.equal(
    (
      await restored.query(
        'SELECT available FROM "CreditAccount" WHERE "organizationId"=$1',
        [creditOrg],
      )
    ).rows[0].available,
    10,
  );
  assert.equal(
    (
      await restored.query(
        'SELECT "availableDelta" FROM "CreditEntry" WHERE id=$1',
        [creditEntry],
      )
    ).rows[0].availableDelta,
    10,
  );
  await assert.rejects(
    restored.query('UPDATE "CreditEntry" SET "availableDelta"=99 WHERE id=$1', [
      creditEntry,
    ]),
    /immutable/,
  );
  assert.equal(
    (await restored.query('SELECT count(*)::int AS n FROM "AIJob"')).rows[0].n,
    1,
  );
  await mkdir(".local", { recursive: true });
  const result = {
    passed: true,
    engine: "PGlite WASM PostgreSQL",
    migrations: dirs.length,
    populatedUpgrade:
      "v0.1 preserved user, membership, draft and queued AI job",
    restore:
      "Fresh database loaded from captured data-directory archive after deleting original test workspace",
    archiveBytes: backup.size,
    sha256: createHash("sha256")
      .update(Buffer.from(await backup.arrayBuffer()))
      .digest("hex"),
    nativePostgresRestoreVerified: false,
    creditLedgerRestoreAndImmutabilityVerified: true,
  };
  await writeFile(
    ".local/upgrade-restore-evidence.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await restored?.close();
  await db.close();
}
