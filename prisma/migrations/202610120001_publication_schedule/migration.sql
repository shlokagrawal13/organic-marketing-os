CREATE TYPE "PublicationScheduleStatus" AS ENUM ('SCHEDULED', 'CLAIMED', 'CANCELED', 'NEEDS_REVIEW', 'CONFIRMED', 'REJECTED');

CREATE TABLE "PublicationSchedule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "PublicationScheduleStatus" NOT NULL DEFAULT 'SCHEDULED',
    "claimedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "outcomeCode" TEXT,
    "attemptId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublicationSchedule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PublicationSchedule_intentId_key" ON "PublicationSchedule"("intentId");
CREATE UNIQUE INDEX "PublicationSchedule_organizationId_requestKey_key" ON "PublicationSchedule"("organizationId", "requestKey");
CREATE INDEX "PublicationSchedule_status_dueAt_idx" ON "PublicationSchedule"("status", "dueAt");
CREATE INDEX "PublicationSchedule_organizationId_connectionId_dueAt_idx" ON "PublicationSchedule"("organizationId", "connectionId", "dueAt");
ALTER TABLE "PublicationSchedule" ADD CONSTRAINT "PublicationSchedule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationSchedule" ADD CONSTRAINT "PublicationSchedule_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "PublicationIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationSchedule" ADD CONSTRAINT "PublicationSchedule_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SocialConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
