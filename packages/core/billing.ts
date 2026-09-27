import { Prisma } from "@prisma/client";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import Stripe from "stripe";
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

type StripeBillingConfiguration =
  | { mode: "disabled"; configured: false }
  | {
      mode: "test" | "live";
      configured: true;
      client: Stripe;
      webhookSecret: string;
      prices: Record<"starter" | "growth", string>;
      plansByPrice: Map<string, "starter" | "growth">;
    };

export function stripeBillingConfiguration(): StripeBillingConfiguration {
  const mode = process.env.STRIPE_MODE || "disabled";
  if (mode === "disabled") return { mode, configured: false };
  if (mode !== "test" && mode !== "live")
    throw new Error("STRIPE_MODE must be disabled, test or live.");
  const secretKey = process.env.STRIPE_SECRET_KEY || "";
  if (!secretKey.startsWith(mode === "test" ? "sk_test_" : "sk_live_"))
    throw new Error(`STRIPE_SECRET_KEY must be a ${mode}-mode secret key.`);
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
  if (!/^whsec_[A-Za-z0-9_]{12,}$/.test(webhookSecret))
    throw new Error("STRIPE_WEBHOOK_SECRET is invalid.");
  const prices = {
    starter: process.env.STRIPE_PRICE_STARTER || "",
    growth: process.env.STRIPE_PRICE_GROWTH || "",
  };
  if (!Object.values(prices).every((id) => /^price_[A-Za-z0-9]+$/.test(id)))
    throw new Error("Stripe Starter and Growth price IDs are required.");
  if (prices.starter === prices.growth)
    throw new Error("Stripe plan price IDs must be different.");
  const options: Stripe.StripeConfig = {
    maxNetworkRetries: 2,
    timeout: 10_000,
    telemetry: false,
  };
  const baseUrl = process.env.STRIPE_API_BASE_URL;
  if (baseUrl) {
    if (process.env.NODE_ENV === "production")
      throw new Error(
        "STRIPE_API_BASE_URL cannot be overridden in production.",
      );
    const parsed = new URL(baseUrl);
    if (
      !["127.0.0.1", "localhost", "::1"].includes(parsed.hostname) ||
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.pathname !== "/"
    )
      throw new Error("STRIPE_API_BASE_URL must be a loopback origin.");
    options.host = parsed.hostname;
    options.port = Number(
      parsed.port || (parsed.protocol === "https:" ? 443 : 80),
    );
    options.protocol = parsed.protocol === "https:" ? "https" : "http";
  }
  return {
    mode,
    configured: true,
    client: new Stripe(secretKey, options),
    webhookSecret,
    prices,
    plansByPrice: new Map([
      [prices.starter, "starter"],
      [prices.growth, "growth"],
    ]),
  };
}

export function requireStripeBilling() {
  const configuration = stripeBillingConfiguration();
  if (!configuration.configured)
    throw new CreditError(503, "Stripe billing is not configured.");
  return configuration;
}

function stripeId(value: string | { id: string } | null) {
  return typeof value === "string" ? value : value?.id || null;
}

function stripeSubscriptionStatus(status: Stripe.Subscription.Status) {
  const mapped = {
    active: "ACTIVE",
    canceled: "CANCELED",
    incomplete: "PAST_DUE",
    incomplete_expired: "CANCELED",
    past_due: "PAST_DUE",
    paused: "PAUSED",
    trialing: "TRIALING",
    unpaid: "UNPAID",
  } as const;
  return mapped[status as keyof typeof mapped];
}

function organizationMetadata(metadata: Stripe.Metadata | null | undefined) {
  const value = metadata?.marketingOsOrganizationId;
  if (!value) return null;
  const parsed = z.string().uuid().safeParse(value);
  if (!parsed.success)
    throw new CreditError(400, "Stripe organization metadata is invalid.");
  return parsed.data;
}

export function mapStripeBillingEvent(
  event: Stripe.Event,
  configuration = requireStripeBilling(),
): BillingEventInput | null {
  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const organizationId = organizationMetadata(subscription.metadata);
    if (!organizationId) return null;
    if (event.type === "customer.subscription.deleted")
      return {
        id: event.id,
        type: "subscription.canceled",
        created: event.created,
        data: { externalSubscriptionId: subscription.id },
      };
    const matching = subscription.items.data.filter((item) =>
      configuration.plansByPrice.has(item.price.id),
    );
    if (subscription.items.data.length !== 1 || matching.length !== 1)
      throw new CreditError(
        409,
        "Stripe subscription must contain exactly one configured plan price.",
      );
    const item = matching[0];
    const planId = configuration.plansByPrice.get(item.price.id)!;
    const status = stripeSubscriptionStatus(subscription.status);
    if (!status)
      throw new CreditError(409, "Stripe subscription status is unsupported.");
    const customer = stripeId(subscription.customer);
    if (!customer)
      throw new CreditError(400, "Stripe subscription customer is missing.");
    return {
      id: event.id,
      type: "subscription.upserted",
      created: event.created,
      data: {
        organizationId,
        externalCustomerId: customer,
        externalSubscriptionId: subscription.id,
        planId,
        status,
        currentPeriodStart: new Date(
          item.current_period_start * 1000,
        ).toISOString(),
        currentPeriodEnd: new Date(
          item.current_period_end * 1000,
        ).toISOString(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    };
  }
  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const detail = invoice.parent?.subscription_details;
    const organizationId = organizationMetadata(detail?.metadata);
    if (!organizationId) return null;
    const subscriptionId = stripeId(detail?.subscription || null);
    if (!subscriptionId)
      throw new CreditError(400, "Stripe invoice subscription is missing.");
    return {
      id: event.id,
      type: "invoice.paid",
      created: event.created,
      data: {
        externalSubscriptionId: subscriptionId,
        periodStart: new Date(invoice.period_start * 1000).toISOString(),
        periodEnd: new Date(invoice.period_end * 1000).toISOString(),
      },
    };
  }
  return null;
}

export function verifyAndMapStripeBillingEvent(
  rawBody: Buffer,
  signatureHeader: string | undefined,
) {
  const configuration = requireStripeBilling();
  if (!signatureHeader)
    throw new CreditError(401, "Stripe signature is missing.");
  let event: Stripe.Event;
  try {
    event = configuration.client.webhooks.constructEvent(
      rawBody,
      signatureHeader,
      configuration.webhookSecret,
      300,
    );
  } catch {
    throw new CreditError(401, "Invalid Stripe signature.");
  }
  if (event.livemode !== (configuration.mode === "live"))
    throw new CreditError(
      400,
      "Stripe event mode does not match configuration.",
    );
  return {
    event,
    input: mapStripeBillingEvent(event, configuration),
    payloadHash: createHash("sha256").update(rawBody).digest("hex"),
  };
}

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
      provider: record.provider,
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
        `${record.provider}:${event.id}:monthly`,
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
    `${record.provider}:${event.id}:${event.type}`,
    event.data.reference,
    reason,
  );
  return finish(tx, record.id, event.data.organizationId, true);
}
