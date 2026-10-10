ALTER TABLE "PublicationAttempt" ADD COLUMN "policySnapshot" JSONB;

CREATE TABLE "PublicationPolicyReview" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "contentRevision" INTEGER NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "reviewedBy" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PublicationPolicyReview_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PublicationPolicyReview_intentId_key" ON "PublicationPolicyReview"("intentId");
CREATE INDEX "PublicationPolicyReview_organizationId_expiresAt_idx" ON "PublicationPolicyReview"("organizationId", "expiresAt");
ALTER TABLE "PublicationPolicyReview" ADD CONSTRAINT "PublicationPolicyReview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationPolicyReview" ADD CONSTRAINT "PublicationPolicyReview_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "PublicationIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationPolicyReview" ADD CONSTRAINT "PublicationPolicyReview_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SocialConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
