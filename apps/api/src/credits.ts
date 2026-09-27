import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Query,
  Headers,
  Req,
  UseGuards,
  Module,
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import {
  Db,
  TenantGuard,
  AuthedRequest,
  Roles,
  Public,
  parse,
  idSchema,
  origin,
} from "./common";
import {
  creditPolicy,
  grantCredits,
  settleCredits,
  CreditError,
} from "../../../packages/core/credits";
import {
  billingEventSchema,
  processBillingEvent,
  requireStripeBilling,
  stripeBillingConfiguration,
  verifyBillingSignature,
  verifyAndMapStripeBillingEvent,
} from "../../../packages/core/billing";

function stripeHostedUrl(value: string | null, hostname: string) {
  if (!value) throw new CreditError(502, "Stripe did not return a hosted URL.");
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new CreditError(502, "Stripe returned an invalid hosted URL.");
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== hostname)
    throw new CreditError(502, "Stripe returned an unexpected hosted URL.");
  return parsed.toString();
}

export function configuredPlatformAdmin(userId: string) {
  return (process.env.PLATFORM_ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
}
@Injectable()
class PlatformGuard implements CanActivate {
  constructor(private db: Db) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (
      !configuredPlatformAdmin(req.userId) ||
      !(
        await this.db.user.findUnique({
          where: { id: req.userId },
          select: { verifiedAt: true },
        })
      )?.verifiedAt
    )
      throw new ForbiddenException(
        "Verified platform administrator access is required.",
      );
    return true;
  }
}
@Controller("platform/access")
class PlatformAccessController {
  constructor(private db: Db) {}
  @Get() async access(@Req() req: AuthedRequest) {
    return {
      allowed:
        configuredPlatformAdmin(req.userId) &&
        Boolean(
          (
            await this.db.user.findUnique({
              where: { id: req.userId },
              select: { verifiedAt: true },
            })
          )?.verifiedAt,
        ),
    };
  }
}
@Controller("workspaces/:organizationId/credits")
@UseGuards(TenantGuard)
@Roles("OWNER", "ADMIN", "ANALYST")
class CreditController {
  constructor(private db: Db) {}
  @Get() async summary(@Req() req: AuthedRequest) {
    const stripe = stripeBillingConfiguration();
    const [account, reservations] = await Promise.all([
      this.db.creditAccount.findUnique({
        where: { organizationId: req.organizationId },
      }),
      this.db.creditReservation.findMany({
        where: {
          organizationId: req.organizationId,
          state: { in: ["RESERVED", "REVIEW"] },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
    return {
      ...creditPolicy(),
      available: account?.available || 0,
      reserved: account?.reserved || 0,
      reservations,
      paymentsConfigured: stripe.configured,
      purchasedCreditsSupported: stripe.configured,
    };
  }
  @Get("entries") async entries(
    @Req() req: AuthedRequest,
    @Query("before") before?: string,
  ) {
    const cursor =
      before === undefined
        ? undefined
        : z.coerce.number().int().min(1).parse(before);
    const rows = await this.db.creditEntry.findMany({
      where: {
        organizationId: req.organizationId,
        ...(cursor ? { sequence: { lt: cursor } } : {}),
      },
      orderBy: { sequence: "desc" },
      take: 51,
    });
    return {
      items: rows
        .slice(0, 50)
        .map(({ requestHash, operationKey, ...row }) => row),
      nextBefore: rows.length > 50 ? rows[49].sequence : null,
    };
  }
}
@Controller("workspaces/:organizationId/billing")
@UseGuards(TenantGuard)
@Roles("OWNER", "ADMIN", "ANALYST")
class BillingController {
  constructor(private db: Db) {}
  @Get() async summary(@Req() req: AuthedRequest) {
    const subscription = await this.db.billingSubscription.findUnique({
      where: { organizationId: req.organizationId },
      include: { plan: true },
    });
    const stripe = stripeBillingConfiguration();
    return {
      mode: creditPolicy().mode,
      subscription: subscription
        ? {
            id: subscription.id,
            provider: subscription.provider,
            status: subscription.status,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            plan: {
              id: subscription.plan.id,
              name: subscription.plan.name,
              monthlyCredits: subscription.plan.monthlyCredits,
              entitlements: subscription.plan.entitlements,
            },
          }
        : null,
      checkoutConfigured: stripe.configured,
      checkoutAvailable:
        stripe.configured &&
        !(
          subscription?.provider === "stripe" &&
          ["ACTIVE", "TRIALING"].includes(subscription.status)
        ),
      portalConfigured: Boolean(
        stripe.configured &&
        subscription?.provider === "stripe" &&
        subscription.externalCustomerId,
      ),
    };
  }
  @Post("checkout")
  @Roles("OWNER", "ADMIN")
  async checkout(@Req() req: AuthedRequest, @Body() body: unknown) {
    const data = parse(
      z
        .object({
          planId: z.enum(["starter", "growth"]),
          requestKey: z.string().uuid(),
        })
        .strict(),
      body,
    );
    const configuration = requireStripeBilling();
    const [plan, subscription, user] = await Promise.all([
      this.db.billingPlan.findUnique({ where: { id: data.planId } }),
      this.db.billingSubscription.findUnique({
        where: { organizationId: req.organizationId },
      }),
      this.db.user.findUniqueOrThrow({
        where: { id: req.userId },
        select: { email: true },
      }),
    ]);
    if (!plan?.active)
      throw new CreditError(409, "The selected billing plan is unavailable.");
    if (
      subscription?.provider === "stripe" &&
      ["ACTIVE", "TRIALING"].includes(subscription.status)
    )
      throw new CreditError(
        409,
        "Use the billing portal to change an active Stripe subscription.",
      );
    const metadata = {
      marketingOsOrganizationId: req.organizationId,
      marketingOsPlanId: data.planId,
    };
    try {
      const session = await configuration.client.checkout.sessions.create(
        {
          mode: "subscription",
          client_reference_id: req.organizationId,
          line_items: [
            { price: configuration.prices[data.planId], quantity: 1 },
          ],
          success_url: `${origin()}/?workspace=${req.organizationId}&billing=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin()}/?workspace=${req.organizationId}&billing=canceled`,
          metadata,
          subscription_data: { metadata },
          ...(subscription?.provider === "stripe" &&
          subscription.externalCustomerId
            ? { customer: subscription.externalCustomerId }
            : { customer_email: user.email }),
        },
        { idempotencyKey: `checkout:${req.organizationId}:${data.requestKey}` },
      );
      return {
        id: session.id,
        url: stripeHostedUrl(session.url, "checkout.stripe.com"),
        expiresAt: new Date(session.expires_at * 1000),
      };
    } catch (error) {
      if (error instanceof CreditError) throw error;
      throw new CreditError(502, "Stripe Checkout is temporarily unavailable.");
    }
  }
  @Post("portal")
  @Roles("OWNER", "ADMIN")
  async portal(@Req() req: AuthedRequest, @Body() body: unknown) {
    const data = parse(
      z.object({ requestKey: z.string().uuid() }).strict(),
      body,
    );
    const configuration = requireStripeBilling();
    const subscription = await this.db.billingSubscription.findUnique({
      where: { organizationId: req.organizationId },
    });
    if (subscription?.provider !== "stripe" || !subscription.externalCustomerId)
      throw new CreditError(409, "A Stripe customer is required.");
    try {
      const session = await configuration.client.billingPortal.sessions.create(
        {
          customer: subscription.externalCustomerId,
          return_url: `${origin()}/?workspace=${req.organizationId}&billing=portal-return`,
        },
        { idempotencyKey: `portal:${req.organizationId}:${data.requestKey}` },
      );
      return {
        id: session.id,
        url: stripeHostedUrl(session.url, "billing.stripe.com"),
      };
    } catch {
      throw new CreditError(
        502,
        "Stripe billing portal is temporarily unavailable.",
      );
    }
  }
}
@Controller("billing/webhooks")
class BillingWebhookController {
  constructor(private db: Db) {}
  private async ingest(
    provider: "test" | "stripe",
    input: z.infer<typeof billingEventSchema>,
    payloadHash: string,
  ) {
    let event = await this.db.billingEvent.findUnique({
      where: {
        provider_externalId: { provider, externalId: input.id },
      },
    });
    if (event && event.payloadHash !== payloadHash)
      throw new CreditError(
        409,
        "Billing event ID was already used for a different payload.",
      );
    if (!event) {
      try {
        event = await this.db.billingEvent.create({
          data: {
            provider,
            externalId: input.id,
            type: input.type,
            providerCreatedAt: new Date(input.created * 1000),
            payload: input,
            payloadHash,
          },
        });
      } catch (error) {
        if ((error as any)?.code !== "P2002") throw error;
        event = await this.db.billingEvent.findUniqueOrThrow({
          where: {
            provider_externalId: { provider, externalId: input.id },
          },
        });
        if (event.payloadHash !== payloadHash)
          throw new CreditError(
            409,
            "Billing event ID was already used for a different payload.",
          );
      }
    }
    try {
      const result = await this.db.$transaction((tx) =>
        processBillingEvent(tx, event!.id),
      );
      return {
        received: true,
        id: result.externalId,
        status: result.status,
        applied: result.applied,
      };
    } catch (error) {
      const message =
        error instanceof CreditError
          ? error.message.slice(0, 500)
          : "Billing event processing failed.";
      await this.db.billingEvent.updateMany({
        where: { id: event.id, status: { not: "PROCESSED" } },
        data: { status: "FAILED", error: message },
      });
      throw error;
    }
  }
  @Public()
  @Post("test")
  async receive(
    @Req() req: AuthedRequest & { rawBody?: Buffer },
    @Headers("x-mos-billing-timestamp") timestamp?: string,
    @Headers("x-mos-billing-signature") signature?: string,
    @Body() body?: unknown,
  ) {
    if (!req.rawBody)
      throw new CreditError(400, "Billing webhook body is unavailable.");
    const payloadHash = verifyBillingSignature(
      req.rawBody,
      timestamp,
      signature,
    );
    const input = billingEventSchema.parse(body);
    return this.ingest("test", input, payloadHash);
  }
  @Public()
  @Post("stripe")
  async receiveStripe(
    @Req() req: AuthedRequest & { rawBody?: Buffer },
    @Headers("stripe-signature") signature?: string,
  ) {
    if (!req.rawBody)
      throw new CreditError(400, "Billing webhook body is unavailable.");
    const verified = verifyAndMapStripeBillingEvent(req.rawBody, signature);
    if (!verified.input)
      return {
        received: true,
        id: verified.event.id,
        status: "IGNORED",
        applied: false,
      };
    return this.ingest("stripe", verified.input, verified.payloadHash);
  }
}
@Controller("platform/credits")
@UseGuards(PlatformGuard)
class PlatformCreditController {
  constructor(private db: Db) {}
  @Post(":organizationId/adjust") async adjust(
    @Req() req: AuthedRequest,
    @Param("organizationId") organizationId: string,
    @Body() body: unknown,
  ) {
    idSchema.parse(organizationId);
    const data = parse(
      z
        .object({
          requestKey: z.string().uuid(),
          amount: z
            .number()
            .int()
            .min(-1_000_000)
            .max(1_000_000)
            .refine((n) => n !== 0),
          reason: z.string().trim().min(10).max(1000),
        })
        .strict(),
      body,
    );
    return this.db.$transaction(async (tx) => {
      const entry = await grantCredits(
        tx,
        organizationId,
        data.amount,
        data.requestKey,
        data.reason,
        req.userId,
      );
      // An idempotent replay does not duplicate the financial entry or its audit.
      const audited = await tx.auditLog.findFirst({
        where: {
          organizationId,
          action: "credits.adjusted",
          entityId: entry.id,
        },
        select: { id: true },
      });
      if (!audited)
        await tx.auditLog.create({
          data: {
            organizationId,
            actorId: req.userId,
            action: "credits.adjusted",
            entityId: entry.id,
            detail: { amount: data.amount, reason: data.reason },
          },
        });
      return {
        id: entry.id,
        available: entry.availableAfter,
        reserved: entry.reservedAfter,
      };
    });
  }
  @Post("reservations/:id/resolve") async resolve(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    idSchema.parse(id);
    const data = parse(
      z
        .object({
          consumed: z.number().int().min(0).max(10000),
          reason: z.string().trim().min(10).max(1000),
        })
        .strict(),
      body,
    );
    const reservation = await this.db.creditReservation.findUnique({
      where: { id },
    });
    if (!reservation) throw new NotFoundException("Reservation not found.");
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${reservation.organizationId} FOR UPDATE`;
      const current = await tx.creditReservation.findUniqueOrThrow({
        where: { id },
        include: { job: { select: { status: true } } },
      });
      if (
        current.state === "RESERVED" ||
        current.job?.status === "QUEUED" ||
        current.job?.status === "RUNNING"
      )
        throw new ConflictException(
          "Wait for the job to finish before resolving its credits.",
        );
      const result = await settleCredits(
        tx,
        reservation.organizationId,
        id,
        data.consumed,
        data.reason,
        req.userId,
      );
      if (current.state === "REVIEW")
        await tx.auditLog.create({
          data: {
            organizationId: reservation.organizationId,
            actorId: req.userId,
            action: "credits.review_resolved",
            entityId: id,
            detail: { consumed: data.consumed, reason: data.reason },
          },
        });
      return result;
    });
  }
}
@Module({
  controllers: [
    CreditController,
    BillingController,
    BillingWebhookController,
    PlatformAccessController,
    PlatformCreditController,
  ],
  providers: [TenantGuard, PlatformGuard],
})
export class CreditsModule {}
