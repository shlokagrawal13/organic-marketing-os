CREATE TABLE "WorkspaceYoutubePolicy" (
    "organizationId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "rules" JSONB NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceYoutubePolicy_pkey" PRIMARY KEY ("organizationId"),
    CONSTRAINT "WorkspaceYoutubePolicy_revision_check" CHECK ("revision" > 0)
);

ALTER TABLE "WorkspaceYoutubePolicy"
ADD CONSTRAINT "WorkspaceYoutubePolicy_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
