-- CreateEnum
CREATE TYPE "MediaGenerationState" AS ENUM ('QUEUED', 'SUBMITTING', 'PENDING', 'OUTPUT_READY', 'SUCCEEDED', 'FAILED', 'CANCELED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "MediaGeneration" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "configuration" JSONB NOT NULL,
    "state" "MediaGenerationState" NOT NULL DEFAULT 'QUEUED',
    "providerJobId" TEXT,
    "providerRequestId" TEXT,
    "outputKey" TEXT,
    "assetId" TEXT,
    "creditReservationId" TEXT,
    "quotedCostUsd" DOUBLE PRECISION NOT NULL,
    "quotedCredits" INTEGER NOT NULL,
    "actualCostUsd" DOUBLE PRECISION,
    "runToken" TEXT,
    "heartbeatAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancellationRequestedAt" TIMESTAMP(3),
    "attachedRevision" INTEGER,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaGeneration_creditReservationId_key" ON "MediaGeneration"("creditReservationId");

-- CreateIndex
CREATE INDEX "MediaGeneration_organizationId_createdAt_idx" ON "MediaGeneration"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "MediaGeneration_state_nextAttemptAt_idx" ON "MediaGeneration"("state", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "MediaGeneration_state_heartbeatAt_idx" ON "MediaGeneration"("state", "heartbeatAt");

-- CreateIndex
CREATE UNIQUE INDEX "MediaGeneration_organizationId_requestKey_key" ON "MediaGeneration"("organizationId", "requestKey");

-- AddForeignKey
ALTER TABLE "MediaGeneration" ADD CONSTRAINT "MediaGeneration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaGeneration" ADD CONSTRAINT "MediaGeneration_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaGeneration" ADD CONSTRAINT "MediaGeneration_creditReservationId_fkey" FOREIGN KEY ("creditReservationId") REFERENCES "CreditReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

