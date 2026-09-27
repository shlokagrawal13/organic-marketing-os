CREATE TABLE "BillingPlan" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  "monthlyCredits" INTEGER NOT NULL DEFAULT 0 CHECK ("monthlyCredits" >= 0 AND "monthlyCredits" <= 1000000),
  entitlements JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "BillingSubscription" (
  id TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE RESTRICT,
  "planId" TEXT NOT NULL REFERENCES "BillingPlan"(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL,
  "externalCustomerId" TEXT,
  "externalSubscriptionId" TEXT,
  status TEXT NOT NULL CHECK (status IN ('TRIALING','ACTIVE','PAST_DUE','CANCELED','UNPAID','PAUSED')),
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "lastEventCreatedAt" TIMESTAMP(3),
  "lastEventId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "BillingSubscription_organizationId_key" ON "BillingSubscription"("organizationId");
CREATE UNIQUE INDEX "BillingSubscription_externalSubscriptionId_key" ON "BillingSubscription"("externalSubscriptionId");
CREATE INDEX "BillingSubscription_planId_status_idx" ON "BillingSubscription"("planId",status);
CREATE TABLE "BillingEvent" (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  type TEXT NOT NULL,
  "organizationId" TEXT REFERENCES "Organization"(id) ON DELETE RESTRICT,
  "providerCreatedAt" TIMESTAMP(3) NOT NULL,
  payload JSONB NOT NULL,
  "payloadHash" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED','PROCESSED','FAILED')),
  applied BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "BillingEvent_provider_externalId_key" ON "BillingEvent"(provider,"externalId");
CREATE INDEX "BillingEvent_status_receivedAt_idx" ON "BillingEvent"(status,"receivedAt");
CREATE INDEX "BillingEvent_organizationId_receivedAt_idx" ON "BillingEvent"("organizationId","receivedAt");

INSERT INTO "BillingPlan" (id,name,active,"monthlyCredits",entitlements,"updatedAt") VALUES
  ('free','Free',true,0,'{"workspaceSeats":1,"monthlyCredits":0,"publishing":false}'::jsonb,CURRENT_TIMESTAMP),
  ('starter','Starter',true,100,'{"workspaceSeats":5,"monthlyCredits":100,"publishing":true}'::jsonb,CURRENT_TIMESTAMP),
  ('growth','Growth',true,500,'{"workspaceSeats":20,"monthlyCredits":500,"publishing":true}'::jsonb,CURRENT_TIMESTAMP);
