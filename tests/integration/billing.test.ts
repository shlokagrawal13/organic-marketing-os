import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, ChildProcess } from "node:child_process";
import { createHmac } from "node:crypto";
import { createWriteStream } from "node:fs";
import { db, actor, until } from "../support/http";

let server: ChildProcess | undefined;
after(async () => {
  if (server) {
    const done = new Promise((resolve) => server!.once("close", resolve));
    server.kill("SIGTERM");
    const force = setTimeout(() => server!.kill("SIGKILL"), 3000);
    await done;
    clearTimeout(force);
  }
  await db.$disconnect();
});

test(
  "signed billing inbox is idempotent, orders subscription events and grants/reverses plan credits",
  { timeout: 30000 },
  async () => {
    const secret = "billing-test-secret-with-at-least-32-characters";
    const url = "http://127.0.0.1:4003/api";
    server = spawn(process.execPath, ["dist/apps/api/src/main.js"], {
      env: {
        ...process.env,
        API_PORT: "4003",
        BILLING_MODE: "credits",
        BILLING_WEBHOOK_SECRET: secret,
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
      outsider = await actor(null);
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
        externalSubscriptionId: "sub_test_1",
        periodStart: new Date().toISOString(),
        periodEnd: new Date(Date.now() + 31 * 86400000).toISOString(),
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
  },
);
