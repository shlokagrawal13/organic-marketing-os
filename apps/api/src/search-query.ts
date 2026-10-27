import { Prisma } from "@prisma/client";
import { z } from "zod";

export const workspaceSearchQuery = z
  .object({
    q: z.string().trim().min(2).max(200),
    kind: z.enum(["all", "content", "campaign", "asset"]).default("all"),
    includeArchived: z.enum(["true", "false"]).default("false"),
    skip: z.coerce.number().int().min(0).max(1000).default(0),
    take: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export type SearchRow = {
  kind: "content" | "campaign" | "asset";
  id: string;
  title: string;
  summary: string;
  status: string;
  archived: boolean;
  updatedAt: Date;
};

// Every branch constrains the tenant before ranking. Values are bound by Prisma;
// result projections deliberately exclude storage keys, credentials and full bodies.
export function workspaceSearchSql(
  organizationId: string,
  input: z.output<typeof workspaceSearchQuery>,
) {
  const { q, kind, skip, take } = input;
  const archived = input.includeArchived === "true";
  return Prisma.sql`
    WITH needle AS (SELECT plainto_tsquery('simple', ${q}) AS query), matches AS (
      SELECT 'content'::text AS kind, id, left(title, 240) AS title,
        left(body, 240) AS summary, status::text AS status,
        (status = 'ARCHIVED') AS archived, "updatedAt",
        ts_rank(to_tsvector('simple', title || ' ' || body || ' ' || hook), needle.query) AS rank
      FROM "ContentItem", needle
      WHERE "organizationId" = ${organizationId} AND (${kind} IN ('all', 'content'))
        AND (${archived} OR status <> 'ARCHIVED')
        AND to_tsvector('simple', title || ' ' || body || ' ' || hook) @@ needle.query
      UNION ALL
      SELECT 'campaign', id, left(name, 240), left(goal || ' ' || description, 240),
        'CAMPAIGN', false, "createdAt",
        ts_rank(to_tsvector('simple', name || ' ' || goal || ' ' || audience || ' ' || description), needle.query)
      FROM "Campaign", needle
      WHERE "organizationId" = ${organizationId} AND (${kind} IN ('all', 'campaign'))
        AND to_tsvector('simple', name || ' ' || goal || ' ' || audience || ' ' || description) @@ needle.query
      UNION ALL
      SELECT 'asset', id, left(name, 240), left(array_to_string(tags, ', '), 240),
        kind::text, ("archivedAt" IS NOT NULL), "createdAt",
        ts_rank(to_tsvector('simple', name || ' ' || array_to_string(tags, ' ')), needle.query)
      FROM "Asset", needle
      WHERE "organizationId" = ${organizationId} AND (${kind} IN ('all', 'asset'))
        AND (${archived} OR "archivedAt" IS NULL)
        AND to_tsvector('simple', name || ' ' || array_to_string(tags, ' ')) @@ needle.query
    )
    SELECT kind, id, title, summary, status, archived, "updatedAt"
    FROM matches ORDER BY rank DESC, "updatedAt" DESC, kind ASC, id ASC
    LIMIT ${take + 1} OFFSET ${skip}`;
}
