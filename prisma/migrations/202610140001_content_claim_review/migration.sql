CREATE TABLE "ContentClaimReview" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "contentRevision" INTEGER NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "claimSetFingerprint" TEXT NOT NULL,
    "resolutions" JSONB NOT NULL,
    "reviewedBy" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentClaimReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentClaimReview_contentId_contentRevision_key"
ON "ContentClaimReview"("contentId", "contentRevision");

CREATE INDEX "ContentClaimReview_organizationId_contentId_contentRevision_idx"
ON "ContentClaimReview"("organizationId", "contentId", "contentRevision");

ALTER TABLE "ContentClaimReview"
ADD CONSTRAINT "ContentClaimReview_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentClaimReview"
ADD CONSTRAINT "ContentClaimReview_contentId_fkey"
FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
