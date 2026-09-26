-- Additive recovery metadata. Existing queued jobs can use their current Brand Brain.
ALTER TABLE "AIJob" ADD COLUMN "brandContext" JSONB;
ALTER TABLE "AIJob" ADD COLUMN "runToken" TEXT;
ALTER TABLE "AIJob" ADD COLUMN "heartbeatAt" TIMESTAMP(3);
CREATE INDEX "AIJob_status_heartbeatAt_idx" ON "AIJob"("status", "heartbeatAt");
