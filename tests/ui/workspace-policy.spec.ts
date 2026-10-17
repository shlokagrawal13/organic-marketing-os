import { test, expect, Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { db } from "../support/http";
import rules from "../../packages/core/youtube-rules.json";
import Redis from "ioredis";

test.afterAll(async () => { await db.$disconnect(); });

const headers = { "X-Requested-With": "MarketingOS" };
const acknowledgment = "I reviewed these rules and understand existing upload reviews and scheduled posts may need review again.";
async function setup(page: Page, role: "OWNER" | "ADMIN" = "OWNER") {
  test.setTimeout(90000);
  // Independent browser accounts share one fixture loopback IP. Clear only
  // their inherited auth/API counters, keeping the runtime limiter enabled.
  // ../support/http imports the isolated-harness guard before this can run.
  const redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: 1 });
  try {
    for (const pattern of ["rate:auth:*", "rate:api:*"]) {
      let cursor = "0";
      do {
        const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = next;
        if (keys.length) await redis.del(...keys);
      } while (cursor !== "0");
    }
  } finally { redis.disconnect(); }
  expect((await page.request.post("/api/auth/register", { headers, data: {
    name: "Policy manager QA", email: `policy-manager-${randomUUID()}@example.test`,
    password: "Isolated browser password 123",
  } })).status()).toBe(201);
  const me = await (await page.request.get("/api/auth/me")).json();
  const org = await (await page.request.post("/api/organizations", { headers,
    data: { name: `Policy workspace ${role}`, timezone: "Asia/Kolkata" } })).json();
  if (role === "ADMIN") await db.membership.update({ where: { userId_organizationId: {
    userId: me.user.id, organizationId: org.id,
  } }, data: { role } });
  await page.goto("/");
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  const panel = page.getByRole("region", { name: "Workspace YouTube policy" });
  await expect(panel.getByText("Using deployment defaults · revision 0")).toBeVisible();
  return { org, me, panel, url: `/api/workspaces/${org.id}/youtube-policy` };
}

test("owner explicitly reviews and persists bounded workspace upload rules on desktop and mobile", async ({ page }) => {
  const { org, panel, url } = await setup(page);
  const title = panel.getByRole("spinbutton", { name: /Title length limit/ });
  const description = panel.getByRole("spinbutton", { name: /Description size limit/ });
  const save = panel.getByRole("button", { name: "Save upload rules" });
  const ack = panel.getByRole("checkbox", { name: acknowledgment });
  await expect(save).toBeDisabled();
  await expect(title).toHaveAttribute("max", "100");
  await title.fill("101");
  await expect(panel.getByRole("alert")).toContainText("whole number from 1 to 100");
  await expect(ack).toBeDisabled();
  await title.fill("80"); await ack.check();
  await title.fill("70"); await expect(ack).not.toBeChecked();
  for (const name of ["Private", "Unlisted", "Public"]) await panel.getByRole("checkbox", { name, exact: true }).uncheck();
  await expect(panel.getByRole("alert")).toHaveText("Allow at least one visibility option.");
  await panel.getByRole("checkbox", { name: "Private", exact: true }).check();
  await description.fill("4000");
  await panel.getByRole("checkbox", { name: "Only allow uploads declared as realistic synthetic or altered media" }).check();
  await expect(save).toBeDisabled();
  await ack.focus(); await page.keyboard.press("Space");
  await expect(save).toBeEnabled(); await save.click();
  await expect(panel.getByRole("status")).toContainText("Policy saved at revision 1");
  await expect(save).toBeDisabled();
  const persisted = await (await page.request.get(url)).json();
  expect(persisted.revision).toBe(1);
  expect(persisted.rules.titleMaxCharacters).toBe(70);
  expect(persisted.rules.allowedPrivacyStatuses).toEqual(["private"]);
  expect(persisted.rules.requireSyntheticMediaDeclaration).toBe(true);
  expect(await db.auditLog.count({ where: { organizationId: org.id, action: "policy.youtube_updated" } })).toBe(1);
  await page.reload();
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  await expect(title).toHaveValue("70");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/workspace-policy-desktop.png", fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.screenshot({ path: "test-results/workspace-policy-dark.png", fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await panel.scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator(".sidebar").evaluate((element) => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(title).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/workspace-policy-mobile.png", fullPage: true, animations: "disabled" });
});

test("admin preserves conflicting edits, recovers transient errors and repairs invalid stored rules", async ({ page }) => {
  const { org, panel, url } = await setup(page, "ADMIN");
  const title = panel.getByRole("spinbutton", { name: /Title length limit/ });
  const save = panel.getByRole("button", { name: "Save upload rules" });
  const ack = panel.getByRole("checkbox", { name: acknowledgment });
  await title.fill("80"); await ack.check();
  expect((await page.request.put(url, { headers, data: { expectedRevision: 0,
    rules: { ...rules, titleMaxCharacters: 90, descriptionMaxUtf8Bytes: 4500 } } })).status()).toBe(200);
  await save.click();
  await expect(panel.getByRole("alert")).toContainText("Your edits are still shown");
  await expect(title).toHaveValue("80"); await expect(save).toBeDisabled();
  await expect(ack).not.toBeChecked();
  await panel.getByRole("button", { name: "Discard edits and reload" }).click();
  await expect(title).toHaveValue("90");
  await title.fill("75"); await ack.check(); await save.click();
  await expect(panel.getByRole("status")).toContainText("Policy saved at revision 2");
  const routeUrl = `**/workspaces/${org.id}/youtube-policy`;
  await page.route(routeUrl, (route) => route.request().method() === "PUT"
    ? route.fulfill({ status: 503, json: { error: { message: "Temporary test outage" } } })
    : route.continue());
  await title.fill("70"); await ack.check(); await save.click();
  await expect(panel.getByRole("alert")).toHaveText("Temporary test outage");
  await expect(title).toHaveValue("70"); await expect(ack).not.toBeChecked();
  await page.unroute(routeUrl);
  await ack.check(); await save.click();
  await expect(panel.getByRole("status")).toContainText("Policy saved at revision 3");
  await db.workspaceYoutubePolicy.update({ where: { organizationId: org.id }, data: { rules: {} } });
  await panel.getByRole("button", { name: "Reload rules" }).click();
  await expect(panel.getByRole("status")).toContainText("Saved rules need review");
  await expect(title).toHaveValue("100");
  await expect(save).toBeDisabled(); await ack.check(); await save.click();
  await expect(panel.getByRole("status")).toContainText("Policy saved at revision 4");
  expect((await (await page.request.get(url)).json()).needsReview).toBe(false);
});

test("workspace changes discard drafts only after confirmation and restricted roles never load the editor", async ({ page }) => {
  const { org, me, panel } = await setup(page);
  const other = await (await page.request.post("/api/organizations", { headers,
    data: { name: "Other isolated policy workspace", timezone: "Asia/Kolkata" } })).json();
  const stranger = await db.organization.create({ data: { name: "Unrelated private workspace" } });
  // Refresh session membership list before exercising the workspace picker.
  await page.reload();
  await page.getByLabel("Active workspace").selectOption(org.id);
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  await panel.getByRole("spinbutton", { name: /Title length limit/ }).fill("55");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByLabel("Active workspace").selectOption(other.id);
  await expect(page.getByLabel("Active workspace")).toHaveValue(org.id);
  await expect(panel.getByRole("spinbutton", { name: /Title length limit/ })).toHaveValue("55");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Active workspace").selectOption(other.id);
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  await expect(panel.getByRole("spinbutton", { name: /Title length limit/ })).toHaveValue("100");
  await expect(panel.getByRole("checkbox", { name: acknowledgment })).not.toBeChecked();
  // Server role changed while an old owner view remains open: save must fail
  // closed and remove editable controls before the session is refreshed.
  await db.membership.update({ where: { userId_organizationId: { userId: me.user.id, organizationId: other.id } }, data: { role: "EDITOR" } });
  await panel.getByRole("spinbutton", { name: /Title length limit/ }).fill("60");
  await panel.getByRole("checkbox", { name: acknowledgment }).check();
  await panel.getByRole("button", { name: "Save upload rules" }).click();
  await expect(panel.getByRole("alert")).toContainText("Your role does not allow this action");
  await expect(panel.getByRole("button", { name: "Save upload rules" })).toHaveCount(0);
  for (const role of ["EDITOR", "CREATOR", "ANALYST", "CLIENT"] as const) {
    await db.membership.update({ where: { userId_organizationId: { userId: me.user.id, organizationId: other.id } }, data: { role } });
    const requests: string[] = [];
    const watch = (request: { url(): string }) => { if (request.url().includes(`/workspaces/${other.id}/youtube-policy`)) requests.push(request.url()); };
    page.on("request", watch);
    await page.reload();
    await page.getByLabel("Active workspace").selectOption(other.id);
    await page.getByRole("button", { name: "Connections", exact: true }).click();
    await expect(panel).toHaveCount(0);
    expect(requests).toHaveLength(0);
    page.off("request", watch);
    expect((await page.request.get(`/api/workspaces/${other.id}/youtube-policy`)).status()).toBe(403);
  }
  expect((await page.request.get(`/api/workspaces/${stranger.id}/youtube-policy`)).status()).toBe(404);
  expect(await db.workspaceYoutubePolicy.count({ where: { organizationId: { in: [org.id, other.id] } } })).toBe(0);
  await db.organization.delete({ where: { id: stranger.id } });
});
