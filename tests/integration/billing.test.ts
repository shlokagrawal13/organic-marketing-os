import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, ChildProcess } from "node:child_process";
import { createHmac } from "node:crypto";
import { createWriteStream } from "node:fs";
import { createServer, Server } from "node:http";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { db, actor, until } from "../support/http";

let server: ChildProcess | undefined;
let stripeServer: Server | undefined;
after(async () => {
  if (server) {
    const done = new Promise((resolve) => server!.once("close", resolve));
    server.kill("SIGTERM");
    const force = setTimeout(() => server!.kill("SIGKILL"), 3000);
    await done;
    clearTimeout(force);
  }
  if (stripeServer)
    await new Promise<void>((resolve, reject) =>
      stripeServer!.close((error) => (error ? reject(error) : resolve())),
    );
  await db.$disconnect();
});

test(
  "signed billing inbox is idempotent, orders subscription events and grants/reverses plan credits",
  { timeout: 30000 },
  async () => {
    const secret = "billing-test-secret-with-at-least-32-characters";
    const stripeWebhookSecret = "whsec_stripe_fixture_secret_123456";
    const stripeCalls: Array<{
      url: string;
      body: URLSearchParams;
      idempotencyKey: string | undefined;
    }> = [];
    stripeServer = createServer(async (req, res) => {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      stripeCalls.push({
        url: req.url || "",
        body: new URLSearchParams(raw),
        idempotencyKey: req.headers["idempotency-key"] as string | undefined,
      });
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/v1/checkout/sessions")
        res.end(
          JSON.stringify({
            id: "cs_test_fixture",
            object: "checkout.session",
            expires_at: Math.floor(Date.now() / 1000) + 1800,
            url: "https://checkout.stripe.com/c/pay/cs_test_fixture",
          }),
        );
      else if (req.url === "/v1/billing_portal/sessions")
        res.end(
          JSON.stringify({
            id: "bps_test_fixture",
            object: "billing_portal.session",
            url: "https://billing.stripe.com/p/session/test_fixture",
          }),
        );
      else {
        res.statusCode = 404;
        res.end(
          JSON.stringify({ error: { message: "Fixture route missing" } }),
        );
      }
    });
    await new Promise<void>((resolve) =>
      stripeServer!.listen(4555, "127.0.0.1", resolve),
    );
    const url = "http://127.0.0.1:4003/api";
    server = spawn(process.execPath, ["dist/apps/api/src/main.js"], {
      env: {
        ...process.env,
        API_PORT: "4003",
        BILLING_MODE: "credits",
        BILLING_WEBHOOK_SECRET: secret,
        STRIPE_MODE: "test",
        STRIPE_SECRET_KEY: "sk_test_fixture",
        STRIPE_WEBHOOK_SECRET: stripeWebhookSecret,
        STRIPE_PRICE_STARTER: "price_starterfixture",
        STRIPE_PRICE_GROWTH: "price_growthfixture",
        STRIPE_API_BASE_URL: "http://127.0.0.1:4555/",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const log = createWriteStream(".local/billing-api.log");
    server.stdout!.pipe(log);
    server.stderr!.pipe(log);
    await until(async () => {
      try {
        return (await fetch(url + "/health")).ok;
      } catch {
        return false;
      }
    }, Boolean);

    const org = await db.organization.create({
      data: { name: "Signed billing QA" },
    });
    const owner = await actor(org.id),
      analyst = await actor(org.id, "ANALYST"),
      outsider = await actor(null);
    const stripeApiCall = async (
      acting: Awaited<ReturnType<typeof actor>>,
      path: string,
      method = "GET",
      body?: unknown,
    ) => {
      const response = await fetch(url + path, {
        method,
        headers: {
          ...acting.headers,
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    };
    const webhook = async (
      event: unknown,
      options: { timestamp?: number; signature?: string } = {},
    ) => {
      const raw = JSON.stringify(event);
      const timestamp = String(
        options.timestamp ?? Math.floor(Date.now() / 1000),
      );
      const signature =
        options.signature ??
        createHmac("sha256", secret)
          .update(`${timestamp}.${raw}`)
          .digest("hex");
      const response = await fetch(url + "/billing/webhooks/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-MOS-Billing-Timestamp": timestamp,
          "X-MOS-Billing-Signature": signature,
        },
        body: raw,
      });
      return { status: response.status, body: await response.json() };
    };
    const baseCreated = Math.floor(Date.now() / 1000) - 60;
    const subscription = {
      id: "evt_subscription_active",
      type: "subscription.upserted",
      created: baseCreated,
      data: {
        organizationId: org.id,
        externalCustomerId: "cus_test_1",
        externalSubscriptionId: "sub_test_1",
        planId: "starter",
        status: "ACTIVE",
        currentPeriodStart: new Date(Date.now() - 1000).toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
        cancelAtPeriodEnd: false,
      },
    };
    assert.equal(
      (await webhook(subscription, { signature: "0".repeat(64) })).status,
      401,
    );
    assert.equal(
      (
        await webhook(subscription, {
          timestamp: Math.floor(Date.now() / 1000) - 301,
        })
      ).status,
      401,
    );
    const accepted = await webhook(subscription);
    assert.equal(accepted.status, 201, JSON.stringify(accepted.body));
    assert.equal(accepted.body.applied, true);
    assert.deepEqual(await webhook(subscription), accepted);
    assert.equal(
      (
        await webhook({
          ...subscription,
          data: { ...subscription.data, planId: "growth" },
        })
      ).status,
      409,
    );
    assert.equal(
      await db.billingEvent.count({
        where: { provider: "test", externalId: subscription.id },
      }),
      1,
    );

    const canceled = await webhook({
      id: "evt_subscription_canceled",
      type: "subscription.canceled",
      created: baseCreated + 20,
      data: { externalSubscriptionId: "sub_test_1" },
    });
    assert.equal(canceled.status, 201, JSON.stringify(canceled.body));
    const oldUpdate = await webhook({
      ...subscription,
      id: "evt_subscription_old_update",
      created: baseCreated + 10,
      data: { ...subscription.data, status: "ACTIVE" },
    });
    assert.equal(oldUpdate.body.applied, false);
    assert.equal(
      (
        await db.billingSubscription.findUniqueOrThrow({
          where: { organizationId: org.id },
        })
      ).status,
      "CANCELED",
    );
    const reactivated = await webhook({
      ...subscription,
      id: "evt_subscription_reactivated",
      created: baseCreated + 30,
    });
    assert.equal(reactivated.body.applied, true);

    const invoice = {
      id: "evt_invoice_paid_1",
      type: "invoice.paid",
      created: baseCreated + 40,
      data: {
        externalInvoiceId: "inv_test_1",
        externalSubscriptionId: "sub_test_1",
        periodStart: new Date().toISOString(),
        periodEnd: new Date(Date.now() + 31 * 86400000).toISOString(),
        status: "paid",
        currency: "usd",
        amountDue: 1900,
        amountPaid: 1900,
      },
    };
    assert.equal((await webhook(invoice)).status, 201);
    assert.equal((await webhook(invoice)).status, 201);
    assert.equal(
      await db.creditEntry.count({
        where: { organizationId: org.id, kind: "GRANT" },
      }),
      1,
    );
    assert.equal(
      (
        await db.creditAccount.findUniqueOrThrow({
          where: { organizationId: org.id },
        })
      ).available,
      100,
    );
    const invoiceList = await owner.call(`/workspaces/${org.id}/billing/invoices`);
    assert.equal(invoiceList.status, 200);
    assert.equal(invoiceList.body.items.length, 1);
    assert.equal(invoiceList.body.items[0].externalInvoiceId, "inv_test_1");
    assert.equal(invoiceList.body.items[0].creditsGranted, 100);
    assert.equal(invoiceList.body.items[0].amountPaid, 1900);
    const invoiceDetail = await owner.call(
      `/workspaces/${org.id}/billing/invoices/${invoiceList.body.items[0].id}`,
    );
    assert.equal(invoiceDetail.status, 200);
    assert.equal(invoiceDetail.body.billingEvent.externalId, "evt_invoice_paid_1");
    assert.equal(
      (await outsider.call(`/workspaces/${org.id}/billing/invoices`)).status,
      404,
    );

    for (const event of [
      {
        id: "evt_refund_1",
        type: "credits.refunded",
        created: baseCreated + 50,
        data: {
          organizationId: org.id,
          credits: 10,
          reference: "refund_test_1",
        },
      },
      {
        id: "evt_expiry_1",
        type: "credits.expired",
        created: baseCreated + 60,
        data: {
          organizationId: org.id,
          credits: 5,
          reference: "expiry_test_1",
        },
      },
    ]) {
      const result = await webhook(event);
      assert.equal(result.status, 201, JSON.stringify(result.body));
      assert.equal((await webhook(event)).status, 201);
    }
    assert.equal(
      (
        await db.creditAccount.findUniqueOrThrow({
          where: { organizationId: org.id },
        })
      ).available,
      85,
    );
    assert.equal(
      await db.creditEntry.count({ where: { organizationId: org.id } }),
      3,
    );
    const billing = await owner.call(`/workspaces/${org.id}/billing`);
    assert.equal(billing.status, 200);
    assert.equal(billing.body.subscription.plan.id, "starter");
    assert.equal(billing.body.subscription.plan.monthlyCredits, 100);
    assert.equal(billing.body.subscription.plan.entitlements.publishing, true);
    assert.equal(
      (await outsider.call(`/workspaces/${org.id}/billing`)).status,
      404,
    );

    const beforeStripe = await stripeApiCall(
      owner,
      `/workspaces/${org.id}/billing`,
    );
    assert.equal(beforeStripe.body.checkoutConfigured, true);
    assert.equal(beforeStripe.body.checkoutAvailable, true);
    assert.equal(beforeStripe.body.portalConfigured, false);
    assert.match(beforeStripe.body.policy.refunds, /unused product credits/);
    assert.match(beforeStripe.body.policy.proration, /billing portal/);
    assert.equal(
      (
        await stripeApiCall(
          analyst,
          `/workspaces/${org.id}/billing/checkout`,
          "POST",
          {
            planId: "starter",
            requestKey: randomUUID(),
          },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await stripeApiCall(
          owner,
          `/workspaces/${org.id}/billing/portal`,
          "POST",
          { requestKey: randomUUID() },
        )
      ).status,
      409,
    );
    const checkoutKey = randomUUID();
    const checkout = await stripeApiCall(
      owner,
      `/workspaces/${org.id}/billing/checkout`,
      "POST",
      { planId: "starter", requestKey: checkoutKey },
    );
    assert.equal(checkout.status, 201, JSON.stringify(checkout.body));
    assert.equal(checkout.body.id, "cs_test_fixture");
    assert.equal(stripeCalls[0].url, "/v1/checkout/sessions");
    assert.equal(
      stripeCalls[0].idempotencyKey,
      `checkout:${org.id}:${checkoutKey}`,
    );
    assert.equal(
      stripeCalls[0].body.get("line_items[0][price]"),
      "price_starterfixture",
    );
    assert.equal(
      stripeCalls[0].body.get(
        "subscription_data[metadata][marketingOsOrganizationId]",
      ),
      org.id,
    );
    assert.equal(
      stripeCalls[0].body.get("customer_email")?.endsWith(".test"),
      true,
    );

    const stripeWebhook = async (
      event: Record<string, unknown>,
      signature?: string,
    ) => {
      const raw = JSON.stringify(event);
      const header =
        signature ||
        Stripe.webhooks.generateTestHeaderString({
          payload: raw,
          secret: stripeWebhookSecret,
          timestamp: event.created as number,
        });
      const response = await fetch(url + "/billing/webhooks/stripe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Stripe-Signature": header,
        },
        body: raw,
      });
      return { status: response.status, body: await response.json() };
    };
    const stripeCreated = Math.floor(Date.now() / 1000);
    const stripeSubscription = {
      id: "evt_stripe_subscription_updated",
      object: "event",
      api_version: "2026-09-30.clover",
      created: stripeCreated,
      data: {
        object: {
          id: "sub_stripe_fixture",
          object: "subscription",
          cancel_at_period_end: false,
          customer: "cus_stripe_fixture",
          items: {
            data: [
              {
                id: "si_stripe_fixture",
                current_period_start: stripeCreated,
                current_period_end: stripeCreated + 30 * 86400,
                price: { id: "price_starterfixture", object: "price" },
              },
            ],
          },
          livemode: false,
          metadata: { marketingOsOrganizationId: org.id },
          status: "active",
        },
      },
      livemode: false,
      pending_webhooks: 1,
      request: null,
      type: "customer.subscription.updated",
    };
    assert.equal(
      (await stripeWebhook(stripeSubscription, "bad-signature")).status,
      401,
    );
    assert.equal(
      (
        await stripeWebhook({
          ...stripeSubscription,
          id: "evt_stripe_wrong_mode",
          livemode: true,
          data: {
            object: { ...stripeSubscription.data.object, livemode: true },
          },
        })
      ).status,
      400,
    );
    const stripeAccepted = await stripeWebhook(stripeSubscription);
    assert.equal(
      stripeAccepted.status,
      201,
      JSON.stringify(stripeAccepted.body),
    );
    assert.equal((await stripeWebhook(stripeSubscription)).status, 201);
    const afterStripe = await stripeApiCall(
      owner,
      `/workspaces/${org.id}/billing`,
    );
    assert.equal(afterStripe.body.subscription.provider, "stripe");
    assert.equal(afterStripe.body.checkoutAvailable, false);
    assert.equal(afterStripe.body.portalConfigured, true);

    const portalKey = randomUUID();
    const portal = await stripeApiCall(
      owner,
      `/workspaces/${org.id}/billing/portal`,
      "POST",
      { requestKey: portalKey },
    );
    assert.equal(portal.status, 201, JSON.stringify(portal.body));
    assert.equal(portal.body.id, "bps_test_fixture");
    assert.equal(stripeCalls[1].body.get("customer"), "cus_stripe_fixture");
    assert.equal(
      stripeCalls[1].idempotencyKey,
      `portal:${org.id}:${portalKey}`,
    );

    const stripeInvoice = {
      id: "evt_stripe_invoice_paid",
      object: "event",
      api_version: "2026-09-30.clover",
      created: stripeCreated + 1,
      data: {
        object: {
          id: "in_stripe_fixture",
          object: "invoice",
          livemode: false,
          parent: {
            type: "subscription_details",
            subscription_details: {
              metadata: { marketingOsOrganizationId: org.id },
              subscription: "sub_stripe_fixture",
            },
          },
          period_start: stripeCreated,
          period_end: stripeCreated + 30 * 86400,
          status: "paid",
          currency: "usd",
          amount_due: 4900,
          amount_paid: 4900,
          hosted_invoice_url: "https://pay.stripe.com/invoice/test_fixture",
          invoice_pdf: "https://pay.stripe.com/invoice/test_fixture/pdf",
        },
      },
      livemode: false,
      pending_webhooks: 1,
      request: null,
      type: "invoice.paid",
    };
    assert.equal((await stripeWebhook(stripeInvoice)).status, 201);
    assert.equal((await stripeWebhook(stripeInvoice)).status, 201);
    assert.equal(
      (
        await db.creditAccount.findUniqueOrThrow({
          where: { organizationId: org.id },
        })
      ).available,
      185,
    );
    assert.equal(
      await db.billingEvent.count({
        where: { organizationId: org.id, provider: "stripe" },
      }),
      2,
    );
    const stripeInvoices = await stripeApiCall(
      owner,
      `/workspaces/${org.id}/billing/invoices`,
    );
    assert.equal(stripeInvoices.status, 200);
    assert.equal(stripeInvoices.body.items.length, 2);
    const storedStripeInvoice = stripeInvoices.body.items.find(
      (item: any) => item.externalInvoiceId === "in_stripe_fixture",
    );
    assert.ok(storedStripeInvoice);
    assert.equal(storedStripeInvoice.hostedInvoiceUrl.includes("stripe"), true);
    assert.equal(storedStripeInvoice.amountPaid, 4900);
  },
);
