import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  applicationMigrations,
  applicationSeed,
  applicationAtTarget,
  applicationSnapshot,
} from "../scripts/application-pitr-fixture.mjs";
import { physicalCaptureHash } from "../scripts/physical-object-binding.mjs";
import { fileURLToPath } from "node:url";
test("Batched physical snapshot equals legacy complete rows/columns and digest for all24 migrations", async () => {
  const db = await PGlite.create();
  try {
    for (const m of applicationMigrations(
      fileURLToPath(new URL("..", import.meta.url)),
    ))
      await db.exec(m.sql);
    await db.exec(applicationSeed + applicationAtTarget);
    await db.query('UPDATE "ContentItem" SET title=$1,body=$2 WHERE id=$3', [
      "Quotes ' \\\" / हिन्दी",
      "line1\nline2\tcontrol",
      "pitr-draft",
    ]);
    let calls = 0;
    const query = async (sql) => {
      calls++;
      const r = await db.query(sql);
      return JSON.stringify(Object.values(r.rows[0])[0]);
    };
    const batch = await applicationSnapshot(query);
    assert.equal(calls, 2);
    assert.equal(Object.keys(batch.rows).length, 37);
    const rows = {};
    for (const table of Object.keys(batch.rows))
      rows[table] = JSON.parse(
        await query(
          "SELECT coalesce(json_agg(t ORDER BY to_jsonb(t)::text),'[]'::json) FROM \"" +
            table +
            '" t;',
        ),
      );
    const schema = JSON.parse(
      await query(
        "SELECT json_agg(t ORDER BY t::text) FROM (SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public') t;",
      ),
    );
    assert.deepEqual(batch, { rows, schema });
    assert.equal(
      physicalCaptureHash(batch),
      physicalCaptureHash({ rows, schema }),
    );
    assert.equal(
      Object.values(batch.rows).reduce((n, r: any[]) => n + r.length, 0),
      19,
    );
    assert.ok(Object.values(batch.rows).some((r: any[]) => r.length === 0));
  } finally {
    await db.close();
  }
});
test("Batched snapshot rejects unsafe catalog names before submitting projection", async () => {
  let calls = 0;
  await assert.rejects(
    applicationSnapshot(async () => {
      calls++;
      return JSON.stringify([
        ...Array.from({ length: 36 }, (_, i) => "safe_" + i),
        'table\"; DROP SCHEMA public;--',
      ]);
    }),
  );
  assert.equal(calls, 1);
});
test("Batched snapshot propagates SQL errors and refuses incomplete projection", async () => {
  const names = Array.from({ length: 37 }, (_, i) => "safe_" + i);
  for (const failure of ["sql", "missing"]) {
    let calls = 0;
    await assert.rejects(
      applicationSnapshot(async () => {
        calls++;
        if (calls === 1) return JSON.stringify(names);
        if (failure === "sql") throw Error("snapshot SQL denied");
        return JSON.stringify({ rows: {}, schema: [] });
      }),
    );
    assert.equal(calls, 2);
  }
});
