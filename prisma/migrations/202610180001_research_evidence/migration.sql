CREATE TYPE "ResearchCategory" AS ENUM ('INDUSTRY', 'AUDIENCE', 'COMPETITOR', 'SEARCH', 'SEASONAL', 'COMMUNITY');
CREATE TYPE "ResearchTemporalScope" AS ENUM ('CURRENT', 'HISTORICAL', 'EVERGREEN', 'EMERGING', 'EXPIRED');
CREATE TYPE "ResearchReviewStatus" AS ENUM ('UNREVIEWED', 'ACCEPTED', 'REJECTED');
CREATE TYPE "ResearchProvenance" AS ENUM ('MANUAL');

CREATE TABLE "ResearchRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "category" "ResearchCategory" NOT NULL,
    "temporalScope" "ResearchTemporalScope" NOT NULL,
    "summary" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceLabel" TEXT,
    "observedAt" TIMESTAMP(3),
    "market" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT '',
    "authorizedSource" BOOLEAN NOT NULL,
    "provenance" "ResearchProvenance" NOT NULL DEFAULT 'MANUAL',
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewStatus" "ResearchReviewStatus" NOT NULL DEFAULT 'UNREVIEWED',
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    CONSTRAINT "ResearchRecord_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ResearchRecord_revision_check" CHECK ("revision" > 0),
    CONSTRAINT "ResearchRecord_authorizedSource_check" CHECK ("authorizedSource"),
    CONSTRAINT "ResearchRecord_review_check" CHECK (
      ("reviewStatus" = 'UNREVIEWED' AND "reviewedAt" IS NULL AND "reviewedBy" IS NULL AND "reviewNote" IS NULL)
      OR ("reviewStatus" <> 'UNREVIEWED' AND "reviewedAt" IS NOT NULL AND "reviewedBy" IS NOT NULL AND "reviewNote" IS NOT NULL)
    )
);

CREATE INDEX "ResearchRecord_organizationId_updatedAt_id_idx"
ON "ResearchRecord"("organizationId", "updatedAt" DESC, "id" DESC);

ALTER TABLE "ResearchRecord" ADD CONSTRAINT "ResearchRecord_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
