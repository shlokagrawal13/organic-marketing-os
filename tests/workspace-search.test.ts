import test from "node:test";
import assert from "node:assert/strict";
import {
  workspaceSearchQuery,
  workspaceSearchSql,
} from "../apps/api/src/search-query";

test("workspace search accepts bounded plain text and rejects unbounded or forged filters", () => {
  assert.equal(
    workspaceSearchQuery.parse({ q: "  नमस्ते launch  " }).q,
    "नमस्ते launch",
  );
  for (const input of [
    { q: " " },
    { q: "x" },
    { q: "x".repeat(201) },
    { q: "launch", take: 51 },
    { q: "launch", skip: 1001 },
    { q: "launch", skip: -1 },
    { q: "launch", kind: "users" },
    { q: "launch", includeArchived: "yes" },
    { q: "launch", organizationId: "other" },
  ])
    assert.equal(workspaceSearchQuery.safeParse(input).success, false);
});
test("search SQL binds malicious input and tenant identifiers without interpolating them", () => {
  const q = "'); DROP TABLE secret; --";
  const sql = workspaceSearchSql(
    "tenant-marker",
    workspaceSearchQuery.parse({ q }),
  );
  assert.equal(sql.text.includes(q), false);
  assert.equal(sql.text.includes("tenant-marker"), false);
  assert.equal(
    sql.values.filter((value) => value === "tenant-marker").length,
    4,
  );
  assert.ok(sql.values.includes(q));
  assert.ok(sql.text.includes("plainto_tsquery"));
});

test("publication search uses frozen text with null defaults and excludes internal snapshot fields", () => {
  const input = workspaceSearchQuery.parse({
    q: "saved title",
    kind: "publication",
  });
  assert.equal(input.kind, "publication");
  const sql = workspaceSearchSql("tenant", input);
  assert.ok(sql.text.includes('FROM "PublicationIntent", needle'));
  for (const field of ["title", "body", "hook"])
    assert.ok(sql.text.includes(`coalesce(snapshot->>'${field}', '')`));
  for (const field of [
    "requestHash",
    "requestKey",
    "claimReview",
    "uploadSessionCiphertext",
    "accessTokenCiphertext",
  ])
    assert.equal(sql.text.includes(field), false);
});
