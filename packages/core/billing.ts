import { Prisma } from "@prisma/client";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { applyBillingCredits, CreditError } from "./credits";

type Tx = Prisma.TransactionClient;
const externalId = z
  .string()
  .trim()
  .min(3)
  .max(200)
  .regex(/^[A-Za-z0-9_.:-]+$/);
const status = z.enum([
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "CANCELED",
  "UNPAID",
  "PAUSED",
]);
const subscriptionData = z
  .object({
    organizationId: z.string().uuid(),
    externalCustomerId: externalId.optional(),
    externalSubscriptionId: externalId,
    planId: z.string().trim().min(1).max(100),
    status,
    currentPeriodStart: z.string().datetime({ offset: true }).optional(),
    currentPeriodEnd: z.string().datetime({ offset: true }).optional(),
    cancelAtPeriodEnd: z.boolean().default(false),
  })
  .strict();
export const billingEventSchema = z.discriminatedUnion("type", [
  z
    .object({
      id: externalId,
      type: z.literal("subscription.upserted"),
      created: z.number().int().positive(),
      data: subscriptionData,
    })
    .strict(),
  z
    .object({
      id: externalId,
      type: z.literal("subscription.canceled"),
      created: z.number().int().positive(),
      data: z.object({ externalSubscriptionId: externalId }).strict(),
    })
    .strict(),
  z
    .object({
      id: externalId,
      type: z.literal("invoice.paid"),
      created: z.number().int().positive(),
      data: z
        .object({
          externalSubscriptionId: externalId,
          periodStart: z.string().datetime({ offset: true }),
          periodEnd: z.string().datetime({ offset: true }),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      id: externalId,
      type: z.enum(["credits.refunded", "credits.expired"]),
      created: z.number().int().positive(),
      data: z
        .object({
          organizationId: z.string().uuid(),
          credits: z.number().int().min(1).max(1_000_000),
          reference: z.string().trim().min(1).max(500),
        })
        .strict(),
    })
    .strict(),
]);
export type BillingEventInput = z.infer<typeof billingEventSchema>;

export function verifyBillingSignature(
  rawBody: Buffer,
  timestampHeader: string | undefined,
  signatureHeader: string | undefined,
  now = Date.now(),
) {
  const secret = process.env.BILLING_WEBHOOK_SECRET || "";
  if (secret.length < 32)
    throw new CreditError(503, "Billing webhook is not configured.");
  if (!timestampHeader || !/^\d{10}$/.test(timestampHeader))
    throw new CreditError(401, "Invalid billing signature timestamp.");
  const timestamp = Number(timestampHeader);
  if (Math.abs(Math.floor(now / 1000) - timestamp) > 300)
    throw new CreditError(401, "Billing signature timestamp is stale.");
  const supplied = (signatureHeader || "").replace(/^v1=/, "");
  if (!/^[a-f0-9]{64}$/i.test(supplied))
    throw new CreditError(401, "Invalid billing signature.");
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest();
  const actual = Buffer.from(supplied, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new CreditError(401, "Invalid billing signature.");
  return createHash("sha256").update(rawBody).digest("hex");
}

function eventIsNewer(
  created: Date,
  id: string,
  lastCreated: Date | null,
  lastId: string | null,
) {
  if (!lastCreated) return true;
  const delta = created.getTime() - lastCreated.getTime();
  return delta > 0 || (delta === 0 && id > (lastId || ""));
}

async function finish(
  tx: Tx,
  id: string,
  organizationId: string | null,
  applied: boolean,
) {
  return tx.billingEvent.update({
    where: { id },
    data: {
      organizationId,
      status: "PROCESSED",
      applied,
      error: null,
      processedAt: new Date(),
    },
  });
}

export async function processBillingEvent(tx: Tx, eventRecordId: string) {
  await tx.$queryRaw`SELECT id FROM "BillingEvent" WHERE id = ${eventRecordId} FOR UPDATE`;
  const record = await tx.billingEvent.findUniqueOrThrow({
    where: { id: eventRecordId },
  });
  if (record.status === "PROCESSED") return record;
  const event = billingEventSchema.parse(record.payload);
  const createdAt = new Date(event.created * 1000);
  if (event.type === "subscription.upserted") {
    const data = event.data;
    const [plan, other] = await Promise.all([
      tx.billingPlan.findUnique({ where: { id: data.planId } }),
      tx.billingSubscription.findUnique({
        where: { externalSubscriptionId: data.externalSubscriptionId },
      }),
    ]);
    if (!plan || !plan.active)
      throw new CreditError(409, "Billing plan is unavailable.");
    if (other && other.organizationId !== data.organizationId)
      throw new CreditError(
        409,
        "External subscription already belongs to another workspace.",
      );
    const current = await tx.billingSubscription.findUnique({
      where: { organizationId: data.organizationId },
    });
    if (
      current &&
      !eventIsNewer(
        createdAt,
        event.id,
        current.lastEventCreatedAt,
        current.lastEventId,
      )
    )
      return finish(tx, record.id, data.organizationId, false);
    const values = {
      planId: data.planId,
      provider: "test",
      externalCustomerId: data.externalCustomerId,
      externalSubscriptionId: data.externalSubscriptionId,
      status: data.status,
      currentPeriodStart: data.currentPeriodStart
        ? new Date(data.currentPeriodStart)
        : null,
      currentPeriodEnd: data.currentPeriodEnd
        ? new Date(data.currentPeriodEnd)
        : null,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd,
      lastEventCreatedAt: createdAt,
      lastEventId: event.id,
    };
    await tx.billingSubscription.upsert({
      where: { organizationId: data.organizationId },
      create: { organizationId: data.organizationId, ...values },
      update: values,
    });
    return finish(tx, record.id, data.organizationId, true);
  }
  if (event.type === "subscription.canceled") {
    const subscription = await tx.billingSubscription.findUnique({
      where: { externalSubscriptionId: event.data.externalSubscriptionId },
    });
    if (!subscription)
      throw new CreditError(409, "Billing subscription is unknown.");
    if (
      !eventIsNewer(
        createdAt,
        event.id,
        subscription.lastEventCreatedAt,
        subscription.lastEventId,
      )
    )
      return finish(tx, record.id, subscription.organizationId, false);
    await tx.billingSubscription.update({
      where: { id: subscription.id },
      data: {
        status: "CANCELED",
        cancelAtPeriodEnd: false,
        lastEventCreatedAt: createdAt,
        lastEventId: event.id,
      },
    });
    return finish(tx, record.id, subscription.organizationId, true);
  }
  if (event.type === "invoice.paid") {
    const subscription = await tx.billingSubscription.findUnique({
      where: { externalSubscriptionId: event.data.externalSubscriptionId },
      include: { plan: true },
    });
    if (!subscription || !["ACTIVE", "TRIALING"].includes(subscription.status))
      throw new CreditError(409, "Active billing subscription is required.");
    const periodStart = new Date(event.data.periodStart),
      periodEnd = new Date(event.data.periodEnd);
    if (periodEnd <= periodStart)
      throw new CreditError(400, "Invalid billing period.");
    if (subscription.plan.monthlyCredits > 0)
      await applyBillingCredits(
        tx,
        subscription.organizationId,
        subscription.plan.monthlyCredits,
        `test:${event.id}:monthly`,
        event.id,
        `Monthly ${subscription.plan.name} plan credit grant`,
      );
    if (
      !subscription.currentPeriodEnd ||
      periodEnd > subscription.currentPeriodEnd
    )
      await tx.billingSubscription.update({
        where: { id: subscription.id },
        data: { currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
      });
    return finish(tx, record.id, subscription.organizationId, true);
  }
  const reason =
    event.type === "credits.refunded"
      ? "Signed billing refund reverses unused credits"
      : "Signed billing expiry removes unused credits";
  await applyBillingCredits(
    tx,
    event.data.organizationId,
    -event.data.credits,
    `test:${event.id}:${event.type}`,
    event.data.reference,
    reason,
  );
  return finish(tx, record.id, event.data.organizationId, true);
}
