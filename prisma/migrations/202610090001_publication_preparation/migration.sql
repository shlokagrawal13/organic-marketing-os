CREATE TYPE "PublicationIntentStatus" AS ENUM ('PREPARED', 'INVALIDATED', 'CANCELED');

CREATE TABLE "PublicationIntent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "contentRevision" INTEGER NOT NULL,
    "renderId" TEXT,
    "platform" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" "PublicationIntentStatus" NOT NULL DEFAULT 'PREPARED',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invalidatedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    CONSTRAINT "PublicationIntent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PublicationIntent_organizationId_requestKey_key" ON "PublicationIntent"("organizationId", "requestKey");
CREATE INDEX "PublicationIntent_organizationId_createdAt_idx" ON "PublicationIntent"("organizationId", "createdAt");
CREATE INDEX "PublicationIntent_organizationId_contentId_status_idx" ON "PublicationIntent"("organizationId", "contentId", "status");
ALTER TABLE "PublicationIntent" ADD CONSTRAINT "PublicationIntent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationIntent" ADD CONSTRAINT "PublicationIntent_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
