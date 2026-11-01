-- Existing workspaces start at revision zero. Every acknowledged settings write
-- advances this value, so a stale editor cannot overwrite a newer save.
ALTER TABLE "Organization" ADD COLUMN "settingsRevision" INTEGER NOT NULL DEFAULT 0;
