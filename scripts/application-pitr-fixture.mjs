// Synthetic records only, loaded exclusively by the owned native PITR harness.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checksum } from "./compose-verification.mjs";

export function applicationMigrations(root) {
  const directory = join(root, "prisma/migrations");
  const migrations = readdirSync(directory)
    .filter((n) => /^\d/.test(n))
    .sort()
    .map((name) => ({
      name,
      sql: readFileSync(join(directory, name, "migration.sql"), "utf8"),
    }));
  assert.equal(
    migrations.length,
    24,
    "Review physical fixture when migrations change",
  );
  return migrations.map((m) => ({
    ...m,
    sha256: checksum(Buffer.from(m.sql)),
  }));
}

export const applicationSeed = `
INSERT INTO "User" (id,email,name,"passwordHash") VALUES
 ('pitr-owner','pitr-owner@example.test','Synthetic owner','fixture-only'),
 ('pitr-client','pitr-client@example.test','Synthetic client','fixture-only');
INSERT INTO "Organization" (id,name) VALUES ('pitr-a','Synthetic A'),('pitr-b','Synthetic B');
INSERT INTO "Membership" ("userId","organizationId",role) VALUES
 ('pitr-owner','pitr-a','OWNER'),('pitr-client','pitr-b','CLIENT');
INSERT INTO "ContentItem" (id,"organizationId",title,platform,format,body,"createdBy","updatedAt") VALUES
 ('pitr-draft','pitr-a','Synthetic draft','LinkedIn','Text','base body','pitr-owner',now()),
 ('pitr-other','pitr-b','Other tenant draft','LinkedIn','Text','other tenant','pitr-client',now());
INSERT INTO "CreditAccount" ("organizationId",available,reserved,revision,"updatedAt") VALUES ('pitr-a',7,3,2,now());
INSERT INTO "CreditEntry" (id,"organizationId","operationKey","requestHash",kind,"availableDelta","reservedDelta","availableAfter","reservedAfter",sequence,reference,reason) VALUES
 ('pitr-grant','pitr-a','grant','fixture','GRANT',10,0,10,0,1,'fixture','Synthetic grant'),
 ('pitr-reserve','pitr-a','reserve','fixture','RESERVE',-3,3,7,3,2,'pitr-job','Synthetic reservation');
INSERT INTO "CreditReservation" (id,"organizationId",reference,credits) VALUES ('pitr-reservation','pitr-a','pitr-job',3);
INSERT INTO "AIJob" (id,"organizationId","actorId","requestKey",task,input,"creditReservationId") VALUES
 ('pitr-job','pitr-a','pitr-owner','queued','content','{"prompt":"Synthetic queued work"}','pitr-reservation'),
 ('pitr-uncertain','pitr-a','pitr-owner','uncertain','content','{"prompt":"Synthetic ambiguous external effect"}',NULL);
UPDATE "AIJob" SET status='RUNNING',attempts=1,"startedAt"=now() WHERE id='pitr-uncertain';
INSERT INTO "Asset" (id,"organizationId",name,kind,"mimeType",bytes,sha256,"objectKey","createdBy") VALUES
 ('pitr-asset','pitr-a','Synthetic historical reference','IMAGE','image/png',3,'${checksum(Buffer.from("old"))}','pitr-a/historical.png','pitr-owner');
INSERT INTO "ResearchRecord" (id,"organizationId",title,category,"temporalScope",summary,"authorizedSource","createdBy","updatedAt") VALUES
 ('pitr-research','pitr-a','Synthetic history','INDUSTRY','HISTORICAL','Historical observation',true,'pitr-owner',now());
`;

export const applicationAtTarget = `
UPDATE "ContentItem" SET body='approved target body',revision=2,status='APPROVED',"approvedBy"='pitr-owner',"approvedAt"=now() WHERE id='pitr-draft';
`;
export const applicationAfterTarget = `
UPDATE "ContentItem" SET body='later unapproved edit',revision=3,status='DRAFT',"approvedBy"=NULL,"approvedAt"=NULL WHERE id='pitr-draft';
UPDATE "AIJob" SET status='FAILED',error='later failure' WHERE id='pitr-job';
DELETE FROM "Asset" WHERE id='pitr-asset';
INSERT INTO "ResearchRecord" (id,"organizationId",title,category,"temporalScope",summary,"authorizedSource","createdBy","updatedAt") VALUES
 ('pitr-late','pitr-a','Later synthetic observation','INDUSTRY','HISTORICAL','Must not replay',true,'pitr-owner',now());
`;

export async function applicationSnapshot(query) {
  const tables = JSON.parse(
    await query(
      `SELECT json_agg(tablename ORDER BY tablename) FROM pg_tables WHERE schemaname='public' AND tablename <> 'synthetic_pitr_record';`,
    ),
  );
  assert.ok(tables.length >= 37);
  // Preserve the complete projections/order while avoiding one Docker round trip per table.
  for (const table of tables) assert.match(table, /^[A-Za-z_][A-Za-z_0-9]*$/);
  const pairs = tables
    .map(
      (table) =>
        `'${table}',(SELECT coalesce(json_agg(t ORDER BY to_jsonb(t)::text),'[]'::json) FROM "${table}" t)`,
    )
    .join(",");
  const snapshot = JSON.parse(
    await query(`SELECT json_build_object('rows',json_build_object(${pairs}),'schema',(
    SELECT json_agg(t ORDER BY t::text) FROM (
      SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public'
    ) t
  ));`),
  );
  assert.deepEqual(Object.keys(snapshot.rows), tables);
  for (const table of tables) assert.ok(Array.isArray(snapshot.rows[table]));
  assert.ok(Array.isArray(snapshot.schema));
  return snapshot;
}

export async function verifyRestoredApplication(query) {
  for (const sql of [
    `UPDATE "CreditEntry" SET reason='tamper' WHERE id='pitr-grant';`,
    `DELETE FROM "CreditEntry" WHERE id='pitr-grant';`,
  ])
    await assert.rejects(query(sql), /Credit entries are immutable/);
  await assert.rejects(
    query(
      `INSERT INTO "Membership" ("userId","organizationId",role) VALUES ('pitr-owner','missing-org','OWNER');`,
    ),
    /foreign key/i,
  );
  await assert.rejects(
    query(
      `INSERT INTO "AIJob" (id,"organizationId","actorId","requestKey",task,input) VALUES ('duplicate','pitr-a','pitr-owner','queued','content','{}');`,
    ),
    /unique/i,
  );
  assert.equal(
    (
      await query(
        `SELECT count(*) FROM "ContentItem" c JOIN "Membership" m ON m."organizationId"=c."organizationId" WHERE m."userId"='pitr-client' AND c.id='pitr-draft';`,
      )
    ).trim(),
    "0",
  );
  assert.equal(
    (
      await query(
        `SELECT count(*) FROM "Membership" WHERE "userId"='pitr-client' AND role IN ('OWNER','ADMIN');`,
      )
    ).trim(),
    "0",
  );
  await query(
    `UPDATE "ContentItem" SET body='restored independent edit',revision=revision+1,status='DRAFT',"approvedBy"=NULL,"approvedAt"=NULL WHERE id='pitr-draft' AND revision=2;`,
  );
  assert.equal(
    (
      await query(
        `WITH stale AS (UPDATE "ContentItem" SET body='stale overwrite' WHERE id='pitr-draft' AND revision=2 RETURNING id) SELECT count(*) FROM stale;`,
      )
    ).trim(),
    "0",
  );
  assert.equal(
    (
      await query(
        `SELECT count(*) FROM "ContentItem" WHERE id='pitr-draft' AND revision=3 AND status='DRAFT' AND "approvedAt" IS NULL AND "approvedBy" IS NULL;`,
      )
    ).trim(),
    "1",
  );
}
