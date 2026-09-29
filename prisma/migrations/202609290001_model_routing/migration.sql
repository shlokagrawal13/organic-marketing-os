ALTER TABLE "AIUsage"
  ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "qualityTier" TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN "failureCode" TEXT,
  ADD COLUMN "providerRequestId" TEXT,
  ADD COLUMN "unknownOutcome" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "routingMetadata" JSONB NOT NULL DEFAULT '{}';
