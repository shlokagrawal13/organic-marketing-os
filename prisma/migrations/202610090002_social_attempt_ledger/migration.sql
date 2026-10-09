CREATE TYPE "SocialProvider" AS ENUM ('YOUTUBE');
CREATE TYPE "PublicationAttemptStatus" AS ENUM ('RESERVED', 'SUBMITTING', 'UNKNOWN', 'CONFIRMED', 'REJECTED', 'BLOCKED');

CREATE TABLE "SocialConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "accountLabel" TEXT NOT NULL,
    "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "accessTokenCiphertext" TEXT NOT NULL,
    "refreshTokenCiphertext" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SocialConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublicationAttempt" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "contentRevision" INTEGER NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" "PublicationAttemptStatus" NOT NULL DEFAULT 'RESERVED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "providerRequestId" TEXT,
    "providerPostId" TEXT,
    "outcomeCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "PublicationAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialConnection_organizationId_provider_externalAccountId_key" ON "SocialConnection"("organizationId", "provider", "externalAccountId");
CREATE INDEX "SocialConnection_organizationId_revokedAt_idx" ON "SocialConnection"("organizationId", "revokedAt");
CREATE UNIQUE INDEX "PublicationAttempt_intentId_key" ON "PublicationAttempt"("intentId");
CREATE UNIQUE INDEX "PublicationAttempt_organizationId_requestKey_key" ON "PublicationAttempt"("organizationId", "requestKey");
CREATE INDEX "PublicationAttempt_organizationId_contentId_contentRevision_status_idx" ON "PublicationAttempt"("organizationId", "contentId", "contentRevision", "status");
CREATE INDEX "PublicationAttempt_status_startedAt_idx" ON "PublicationAttempt"("status", "startedAt");
ALTER TABLE "SocialConnection" ADD CONSTRAINT "SocialConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationAttempt" ADD CONSTRAINT "PublicationAttempt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationAttempt" ADD CONSTRAINT "PublicationAttempt_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "PublicationIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationAttempt" ADD CONSTRAINT "PublicationAttempt_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SocialConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
