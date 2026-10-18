import { test, expect } from "@playwright/test";
import Redis from "ioredis";
import { actor, db } from "../support/http";
import { resetFixtureRateBudget } from "../support/fixture-rate-budget";

test("shared fixture budgets preserve auth/API throttling and isolate authenticated bootstrap", async ({ page }) => {
  const org = await db.organization.create({ data: { name: "Isolated auth budget reproduction" } });
  const user = await actor(org.id);
  const redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: 1 });
  try {
    await resetFixtureRateBudget();
    await page.context().addCookies([{ name: "mos_session", value: user.headers.cookie.split("=")[1], domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
    await page.goto("/");
    await expect(page.getByRole("navigation").getByRole("button", { name: "Content library" })).toBeVisible();
    const keys = await redis.keys("rate:auth:*");expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) await redis.set(key, "40", "EX", 60);
    const [blocked] = await Promise.all([page.waitForResponse(r => r.url().endsWith("/api/auth/me")), page.reload()]);
    expect(blocked.status()).toBe(429);
    await expect(page.getByText("Too many requests. Please wait a minute.", { exact: true })).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await resetFixtureRateBudget();
    const [restored] = await Promise.all([page.waitForResponse(r => r.url().endsWith("/api/auth/me")), page.reload()]);
    expect(restored.status()).toBe(200);
    await expect(page.getByRole("navigation").getByRole("button", { name: "Content library" })).toBeVisible();
    const apiKeys = await redis.keys("rate:api:*");expect(apiKeys.length).toBeGreaterThan(0);
    for (const key of apiKeys) await redis.set(key, "600", "EX", 60);
    const [apiBlocked] = await Promise.all([page.waitForResponse(r => r.url().endsWith("/api/organizations")), page.reload()]);
    expect(apiBlocked.status()).toBe(429);
    await expect(page.getByText("Too many requests. Please wait a minute.", { exact: true })).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await resetFixtureRateBudget();
    const [apiRestored] = await Promise.all([page.waitForResponse(r => r.url().endsWith("/api/organizations")), page.reload()]);
    expect(apiRestored.status()).toBe(200);
    await expect(page.getByRole("navigation").getByRole("button", { name: "Content library" })).toBeVisible();
  } finally {
    redis.disconnect();await db.organization.delete({ where: { id: org.id } });await db.user.delete({ where: { id: user.id } });await db.$disconnect();
  }
});
