-- Optional interpretation of an existing cited source. Historical records stay NULL.
ALTER TABLE "ResearchRecord" ADD COLUMN "insight" JSONB;
