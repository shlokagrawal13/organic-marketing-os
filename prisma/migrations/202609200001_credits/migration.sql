CREATE TABLE "CreditAccount" (
  "organizationId" TEXT PRIMARY KEY REFERENCES "Organization"(id) ON DELETE RESTRICT,
  available INTEGER NOT NULL DEFAULT 0 CHECK (available >= 0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "CreditEntry" (
  id TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE RESTRICT,
  "operationKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('GRANT','ADJUSTMENT','RESERVE','CONSUME','RELEASE')),
  "availableDelta" INTEGER NOT NULL,
  "reservedDelta" INTEGER NOT NULL,
  "availableAfter" INTEGER NOT NULL CHECK ("availableAfter" >= 0),
  "reservedAfter" INTEGER NOT NULL CHECK ("reservedAfter" >= 0),
  sequence INTEGER NOT NULL,
  reference TEXT NOT NULL,
  reason TEXT NOT NULL,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CreditEntry_organizationId_operationKey_key" ON "CreditEntry"("organizationId","operationKey");
CREATE UNIQUE INDEX "CreditEntry_organizationId_sequence_key" ON "CreditEntry"("organizationId",sequence);
CREATE INDEX "CreditEntry_organizationId_createdAt_idx" ON "CreditEntry"("organizationId","createdAt");
CREATE FUNCTION immutable_credit_entry() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Credit entries are immutable; append a correcting entry'; END;
$$;
CREATE TRIGGER credit_entry_immutable BEFORE UPDATE OR DELETE ON "CreditEntry" FOR EACH ROW EXECUTE FUNCTION immutable_credit_entry();
CREATE TABLE "CreditReservation" (
  id TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE RESTRICT,
  reference TEXT NOT NULL,
  credits INTEGER NOT NULL CHECK (credits > 0),
  consumed INTEGER NOT NULL DEFAULT 0 CHECK (consumed >= 0 AND consumed <= credits),
  state TEXT NOT NULL DEFAULT 'RESERVED' CHECK (state IN ('RESERVED','REVIEW','SETTLED','RELEASED')),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "CreditReservation_organizationId_reference_key" ON "CreditReservation"("organizationId",reference);
CREATE INDEX "CreditReservation_organizationId_state_idx" ON "CreditReservation"("organizationId",state);
ALTER TABLE "AIJob" ADD COLUMN "creditReservationId" TEXT REFERENCES "CreditReservation"(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX "AIJob_creditReservationId_key" ON "AIJob"("creditReservationId");
