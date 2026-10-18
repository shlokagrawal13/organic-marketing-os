import { Prisma, PrismaClient } from "@prisma/client";
import { assertResearchContextCurrent, readResearchSnapshot, resolveResearchContext, ResearchContext } from "../../../packages/core/research-context";
type Database = PrismaClient | Prisma.TransactionClient;

export async function strategyResearchContext(db: Database, organizationId: string, snapshot: unknown, now = new Date()) {
  const saved = readResearchSnapshot(snapshot, organizationId);
  const rows = saved?.evidence.length ? await db.researchRecord.findMany({
    where: { organizationId, id: { in: saved.evidence.map((item) => item.id) } },
  }) : [];
  return resolveResearchContext(snapshot, organizationId, rows, now);
}

export async function checkStrategyResearchBoundary(db: Database, organizationId: string, context: ResearchContext) {
  if (!context.evidence.length) return;
  const rows = await db.researchRecord.findMany({
    where: { organizationId, id: { in: context.evidence.map((item) => item.id) } },
  });
  assertResearchContextCurrent(context, organizationId, rows, new Date());
}
