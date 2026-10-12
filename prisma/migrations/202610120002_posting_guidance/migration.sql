-- Existing schedules have no reviewed guidance snapshot. The due worker
-- conservatively moves them to NEEDS_REVIEW instead of sending automatically.
ALTER TABLE "PublicationSchedule" ADD COLUMN "guidanceFingerprint" TEXT;
CREATE INDEX "PublicationAttempt_organizationId_connectionId_createdAt_idx"
  ON "PublicationAttempt"("organizationId", "connectionId", "createdAt");
