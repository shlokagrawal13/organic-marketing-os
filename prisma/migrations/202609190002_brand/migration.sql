-- CreateTable
CREATE TABLE "BrandBrain" (
    "organizationId" TEXT NOT NULL,
    "profile" JSONB NOT NULL,
    "creativeDna" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandBrain_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "BrandVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "profile" JSONB NOT NULL,
    "creativeDna" JSONB NOT NULL,
    "revision" INTEGER NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandVersion_organizationId_revision_key" ON "BrandVersion"("organizationId", "revision");

-- AddForeignKey
ALTER TABLE "BrandBrain" ADD CONSTRAINT "BrandBrain_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandVersion" ADD CONSTRAINT "BrandVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

