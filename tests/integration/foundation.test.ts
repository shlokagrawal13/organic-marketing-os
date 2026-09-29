import "../support/isolated";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { token, digest } from "../../packages/core/security";
import { readFileSync } from "node:fs";
const db = new PrismaClient();
const users: string[] = [];
const orgs: string[] = [];
const base = process.env.TEST_API_URL || "http://127.0.0.1:4000/api";
function client() {
  let cookie = "";
  return {
    get cookie() {
      return cookie;
    },
    set cookie(c: string) {
      cookie = c;
    },
    async call(
      path: string,
      method = "GET",
      body?: unknown,
      extra: Record<string, string> = {},
    ) {
      const r = await fetch(base + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "MarketingOS",
          cookie,
          ...extra,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const set = r.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0];
      return { status: r.status, body: await r.json() };
    },
  };
}
after(async () => {
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});
test("real HTTP authentication, tenant isolation, roles, session rotation and password recovery", async () => {
  const a = client(),
    b = client();
  assert.equal((await a.call("/auth/me")).status, 401);
  const suffix = token().slice(0, 10),
    pass = "A strong test passphrase 123";
  const aEmail = `a-${suffix}@example.test`,
    bEmail = `b-${suffix}@example.test`;
  const ra = await a.call("/auth/register", "POST", {
    name: "Alpha User",
    email: aEmail,
    password: pass,
  });
  assert.equal(ra.status, 201);
  users.push(ra.body.user.id);
  assert.equal("passwordHash" in ra.body.user, false);
  const rb = await b.call("/auth/register", "POST", {
    name: "Beta User",
    email: bEmail,
    password: pass,
  });
  assert.equal(rb.status, 201);
  users.push(rb.body.user.id);
  const oa = await a.call("/organizations", "POST", {
    name: "Alpha workspace",
    timezone: "Asia/Kolkata",
  });
  assert.equal(oa.status, 201);
  orgs.push(oa.body.id);
  const ob = await b.call("/organizations", "POST", {
    name: "Beta workspace",
    timezone: "UTC",
  });
  assert.equal(ob.status, 201);
  orgs.push(ob.body.id);
  assert.equal((await a.call(`/workspaces/${ob.body.id}`)).status, 404);
  assert.equal(
    (await b.call(`/workspaces/${oa.body.id}/activity`)).status,
    404,
  );
  assert.equal(
    (
      await a.call(`/workspaces/${ob.body.id}`, "PATCH", {
        name: "Stolen",
        timezone: "UTC",
      })
    ).status,
    404,
  );
  assert.equal((await a.call("/organizations")).body.length, 1);
  await db.membership.create({
    data: {
      userId: rb.body.user.id,
      organizationId: oa.body.id,
      role: "ANALYST",
    },
  });
  assert.equal((await b.call(`/workspaces/${oa.body.id}`)).status, 200);
  assert.equal(
    (
      await b.call(`/workspaces/${oa.body.id}`, "PATCH", {
        name: "Not allowed",
        timezone: "UTC",
      })
    ).status,
    403,
  );
  assert.equal((await b.call(`/workspaces/${oa.body.id}/team`)).status, 403);
  const forbidden = await a.call("/organizations", "POST", {
    name: "Forged",
    timezone: "UTC",
    role: "OWNER",
  });
  assert.equal(forbidden.status, 400);
  assert.equal(
    (
      await a.call(
        "/organizations",
        "POST",
        { name: "Cross origin" },
        { Origin: "https://evil.example" },
      )
    ).status,
    403,
  );
  const old = a.cookie;
  assert.equal((await a.call("/auth/renew", "POST")).status, 201);
  assert.notEqual(a.cookie, old);
  const stale = client();
  stale.cookie = old;
  assert.equal((await stale.call("/auth/me")).status, 401);
  assert.equal((await a.call("/auth/logout", "POST")).status, 201);
  assert.equal((await a.call("/auth/me")).status, 401);
  assert.equal(
    (
      await a.call("/auth/login", "POST", {
        email: aEmail,
        password: "wrong password",
      })
    ).status,
    401,
  );
  assert.equal(
    (await a.call("/auth/login", "POST", { email: aEmail, password: pass }))
      .status,
    201,
  );
  assert.equal(
    (await a.call("/auth/forgot-password", "POST", { email: aEmail })).status,
    201,
  );
  const mailbox = () =>
    readFileSync(".local/mailbox.ndjson", "utf8")
      .trim()
      .split("\n")
      .map((s) => JSON.parse(s));
  const message = mailbox()
    .filter((m) => m.to.includes(aEmail))
    .at(-1)
    .body.replace(/=\r?\n/g, "")
    .replace(/=3D/g, "=");
  const raw = message.match(/reset=([a-f0-9]{64})/)?.[1];
  assert.ok(raw, "Reset email must contain a one-time link.");
  const newer = "A different long passphrase 456";
  assert.equal(
    (
      await a.call("/auth/reset-password", "POST", {
        token: raw,
        password: newer,
      })
    ).status,
    201,
  );
  assert.equal((await a.call("/auth/me")).status, 401);
  assert.equal(
    (
      await a.call("/auth/reset-password", "POST", {
        token: raw,
        password: newer,
      })
    ).status,
    400,
  );
  assert.equal(
    (await a.call("/auth/login", "POST", { email: aEmail, password: newer }))
      .status,
    201,
  );
  assert.equal(
    (await a.call("/auth/login", "POST", { email: aEmail, password: pass }))
      .status,
    401,
  );
  assert.equal(
    (await a.call("/auth/request-verification", "POST")).status,
    201,
  );
  const verifyMail = mailbox()
    .filter((m) => m.to.includes(aEmail))
    .at(-1)
    .body.replace(/=\r?\n/g, "")
    .replace(/=3D/g, "=");
  const verifyToken = verifyMail.match(/verify=([a-f0-9]{64})/)?.[1];
  assert.ok(verifyToken);
  assert.equal(
    (await a.call("/auth/verify-email", "POST", { token: verifyToken })).status,
    201,
  );
  assert.ok((await a.call("/auth/me")).body.user.verifiedAt);
  const stored = await db.user.findUniqueOrThrow({
    where: { id: ra.body.user.id },
  });
  assert.ok(stored.passwordHash.startsWith("scrypt:"));
  const brand = {
    profile: {
      name: "Alpha Brand",
      industry: "Software",
      products: "A useful product",
      audience: "Small businesses",
      problems: "Manual work",
      usp: "One workspace",
      goals: "Qualified leads",
    },
    creativeDna: { voice: "Clear and helpful", visualStyle: "Blue and white" },
    revision: 0,
  };
  assert.equal(
    (await a.call(`/workspaces/${oa.body.id}/brand`, "PUT", brand)).status,
    200,
  );
  assert.equal(
    (await b.call(`/workspaces/${oa.body.id}/brand`, "PUT", brand)).status,
    403,
  );
  assert.equal((await a.call(`/workspaces/${ob.body.id}/brand`)).status, 404);
  const saved = await a.call(`/workspaces/${oa.body.id}/brand`);
  assert.equal(saved.body.progress.percent, 100);
  assert.equal(saved.body.brain.revision, 1);
  assert.equal(
    (await a.call(`/workspaces/${oa.body.id}/brand`, "PUT", brand)).status,
    409,
  );
  assert.equal(
    (
      await a.call(`/workspaces/${oa.body.id}/brand`, "PUT", {
        ...brand,
        profile: { ...brand.profile, name: "Updated" },
        revision: 1,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await a.call(`/workspaces/${oa.body.id}/brand/restore/1`, "POST", {
        revision: 2,
      })
    ).status,
    201,
  );
  assert.equal(
    (await a.call(`/workspaces/${oa.body.id}/brand`)).body.brain.profile.name,
    "Alpha Brand",
  );
  assert.equal(
    (await a.call(`/workspaces/${oa.body.id}/brand/versions`)).body.length,
    3,
  );
  const campaign = await a.call(`/workspaces/${oa.body.id}/campaigns`, "POST", {
    name: "Launch",
    goal: "Audience awareness",
  });
  assert.equal(campaign.status, 201);
  const draft = {
    title: "A useful launch post",
    platform: "LinkedIn",
    format: "Text",
    hook: "A new way to plan",
    body: "Our workspace keeps your brand context in one place.",
    cta: "Tell us what you think.",
    scenes: [],
    campaignId: campaign.body.id,
    plannedAt: null,
  };
  const c = await a.call(`/workspaces/${oa.body.id}/content`, "POST", draft);
  assert.equal(c.status, 201);
  const contentId = c.body.id;
  assert.equal(
    (await b.call(`/workspaces/${oa.body.id}/content`, "POST", draft)).status,
    403,
  );
  assert.equal(
    (await a.call(`/workspaces/${ob.body.id}/content/${contentId}`)).status,
    404,
  );
  assert.equal(
    (await a.call(`/workspaces/${oa.body.id}/content?q=launch`)).body.total,
    1,
  );
  assert.equal(
    (
      await a.call(
        `/workspaces/${oa.body.id}/content/${contentId}/approve`,
        "POST",
        { revision: 1, factsAndRightsReviewed: true },
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await a.call(
        `/workspaces/${oa.body.id}/content/${contentId}/review`,
        "POST",
        { revision: 1 },
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await a.call(
        `/workspaces/${oa.body.id}/content/${contentId}/approve`,
        "POST",
        { revision: 1, factsAndRightsReviewed: false },
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await a.call(
        `/workspaces/${oa.body.id}/content/${contentId}/approve`,
        "POST",
        { revision: 1, factsAndRightsReviewed: true },
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await a.call(`/workspaces/${oa.body.id}/content/${contentId}`, "PUT", {
        ...draft,
        body: "Updated copy",
        revision: 1,
      })
    ).status,
    200,
  );
  const edited = await a.call(`/workspaces/${oa.body.id}/content/${contentId}`);
  assert.equal(edited.body.item.status, "DRAFT");
  assert.equal(edited.body.item.approvedBy, null);
  assert.equal(
    (
      await a.call(`/workspaces/${oa.body.id}/content/${contentId}`, "PUT", {
        ...draft,
        revision: 1,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await b.call(
        `/workspaces/${oa.body.id}/content/${contentId}/comments`,
        "POST",
        { text: "Please clarify the CTA." },
      )
    ).status,
    201,
  );
  const key = crypto.randomUUID();
  const j = await a.call(`/workspaces/${oa.body.id}/ai/jobs`, "POST", {
    requestKey: key,
    task: "content",
    prompt: "Create a useful launch post for this test brand.",
  });
  assert.equal(j.status, 201);
  const j2 = await a.call(`/workspaces/${oa.body.id}/ai/jobs`, "POST", {
    requestKey: key,
    task: "content",
    prompt: "Create a useful launch post for this test brand.",
  });
  assert.equal(j.body.id, j2.body.id);
  let job: any;
  for (let i = 0; i < 50; i++) {
    job = (await a.call(`/workspaces/${oa.body.id}/ai/jobs`)).body.find(
      (v: any) => v.id === j.body.id,
    );
    if (job.status === "SUCCEEDED" || job.status === "FAILED") break;
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.equal(job.status, "SUCCEEDED", job.error);
  assert.equal(job.output.title, "Test-only generated draft");
  assert.equal(job.agentRun.state, "AWAITING_REVIEW");
  assert.ok(job.agentRun._count.steps >= 10);
  const trace = await a.call(
    `/workspaces/${oa.body.id}/ai/jobs/${j.body.id}/trace`,
  );
  assert.equal(trace.status, 200);
  assert.ok(
    trace.body.steps.some((step: any) => step.role === "compliance-safety"),
  );
  assert.equal(
    (
      await a.call(
        `/workspaces/${oa.body.id}/ai/jobs/${j.body.id}/review`,
        "POST",
        { decision: "approve", note: "Fixture facts and rights reviewed." },
      )
    ).status,
    201,
  );
  const usage = (await a.call(`/workspaces/${oa.body.id}/ai/status`)).body
    .usage;
  assert.ok(usage.some((u: any) => u.success && u.fallback));
  // Other tenants may already have put the failing primary into cooldown.
  // Only actual calls belong in usage history; skipped calls must not be billed.
  assert.ok(usage.every((u: any) => u.fallback || !u.success));
  const sessions = await db.session.findMany({
    where: { userId: ra.body.user.id },
  });
  assert.ok(sessions.every((s) => !a.cookie.includes(s.tokenHash)));
});
