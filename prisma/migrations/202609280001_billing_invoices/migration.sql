CREATE TABLE "BillingInvoice" (
  id TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE RESTRICT,
  "subscriptionId" TEXT REFERENCES "BillingSubscription"(id) ON DELETE RESTRICT,
  "billingEventId" TEXT NOT NULL REFERENCES "BillingEvent"(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL,
  "externalInvoiceId" TEXT,
  "externalSubscriptionId" TEXT,
  status TEXT NOT NULL,
  currency TEXT,
  "amountDue" INTEGER CHECK ("amountDue" IS NULL OR "amountDue" >= 0),
  "amountPaid" INTEGER CHECK ("amountPaid" IS NULL OR "amountPaid" >= 0),
  "hostedInvoiceUrl" TEXT,
  "invoicePdfUrl" TEXT,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "creditsGranted" INTEGER NOT NULL DEFAULT 0 CHECK ("creditsGranted" >= 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "BillingInvoice_billingEventId_key" ON "BillingInvoice"("billingEventId");
CREATE UNIQUE INDEX "BillingInvoice_provider_externalInvoiceId_key" ON "BillingInvoice"(provider,"externalInvoiceId");
CREATE INDEX "BillingInvoice_organizationId_periodEnd_idx" ON "BillingInvoice"("organizationId","periodEnd");
CREATE INDEX "BillingInvoice_subscriptionId_periodEnd_idx" ON "BillingInvoice"("subscriptionId","periodEnd");
