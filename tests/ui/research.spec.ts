import { test, expect, Page } from "@playwright/test";
import Redis from "ioredis";
import { actor, db } from "../support/http";

const orgs: string[] = [], users: string[] = [];
const headers = { "X-Requested-With": "MarketingOS" };
const sourceAck = "I am authorized to record this information and source.";
const reviewAck = "I reviewed the source, observation time and summary for this record.";
const evidence = (title = "Synthetic audience questions") => ({
  title, category: "AUDIENCE", temporalScope: "CURRENT",
  summary: "Synthetic verification evidence, not actual audience research.",
  sourceUrl: "https://public.org/research", sourceLabel: "Synthetic source publication",
  observedAt: new Date(Date.now() - 60000).toISOString(),
  market: "India", language: "English", authorizedSource: true,
});
test.afterAll(async () => {
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});
async function setup(page: Page, role: Parameters<typeof actor>[1] = "OWNER") {
  test.setTimeout(90000);
  // The isolated harness guard is imported by support/http. Reset only the
  // disposable loopback API budget between independent browser fixtures.
  const redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: 1 });
  try {
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", "rate:api:*", "COUNT", 100);
      cursor = next;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== "0");
  } finally { redis.disconnect(); }
  const org = await db.organization.create({ data: { name: `Research browser ${role}` } });
  orgs.push(org.id);
  const user = await actor(org.id, role); users.push(user.id);
  await page.context().addCookies([{ name: "mos_session", value: user.headers.cookie.split("=")[1],
    domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
  const path = `/workspaces/${org.id}/research`;
  async function open() {
    await page.goto("/");
    await page.getByRole("navigation").getByRole("button", { name: "Research", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Research", exact: true })).toBeVisible();
    await expect(page.locator(".research-workspace")).toHaveAttribute("aria-busy", "false");
  }
  return { org, user, path, open, panel: page.getByRole("region", { name: "Research detail" }) };
}

test("manual research intake, acceptance and edit invalidation persist with responsive evidence views", async ({ page }) => {
  const { user, path, open, panel } = await setup(page);
  await open();
  await expect(page.getByRole("heading", { name: "No research yet" })).toBeVisible();
  await page.getByRole("button", { name: "Add research", exact: true }).click();
  await panel.getByLabel("Research title").fill("Synthetic audience questions");
  await panel.getByLabel("Research category").selectOption("AUDIENCE");
  await panel.getByLabel("Observation summary").fill(evidence().summary);
  await panel.getByLabel("Source URL").fill(evidence().sourceUrl);
  await panel.getByLabel("Source label").fill(evidence().sourceLabel);
  await panel.getByLabel("Observed at (your local time)").fill(new Date(Date.now() - 60000).toISOString().slice(0, 19));
  await panel.getByLabel("Market", { exact: true }).fill("India");
  await panel.getByLabel("Language", { exact: true }).fill("English");
  const save = panel.getByRole("button", { name: "Save research", exact: true });
  await expect(save).toBeDisabled();
  await panel.getByRole("checkbox", { name: sourceAck }).check();
  await save.click();
  await expect(page.getByRole("status")).toContainText("Research saved at revision 1");
  const list = await user.call(path);
  const saved = list.body.items[0];
  expect(saved.provenance).toBe("MANUAL"); expect(saved.reviewStatus).toBe("UNREVIEWED");
  await panel.getByLabel("Review note", { exact: true }).fill("Reviewed synthetic source and observation date.");
  await panel.getByRole("checkbox", { name: reviewAck }).check();
  await panel.getByRole("button", { name: "Accept evidence", exact: true }).click();
  await expect(panel.getByText("Evidence accepted and current", { exact: true })).toBeVisible();
  expect((await user.call(path + "/" + saved.id)).body.revision).toBe(2);
  await page.reload();
  await page.getByRole("navigation").getByRole("button", { name: "Research", exact: true }).click();
  await expect(panel.getByText("Evidence accepted and current", { exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/research-desktop.png", fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.screenshot({ path: "test-results/research-dark.png", fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.locator(".sidebar").evaluate((el) => el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/research-mobile.png", fullPage: true, animations: "disabled" });
  await panel.getByRole("button", { name: "Edit research", exact: true }).click();
  await panel.getByLabel("Research title").fill("Edited synthetic questions");
  await panel.getByRole("checkbox", { name: sourceAck }).check();
  await panel.getByRole("button", { name: "Save research", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Research saved at revision 3");
  const edited = (await user.call(path + "/" + saved.id)).body;
  expect(edited.reviewStatus).toBe("UNREVIEWED"); expect(edited.reviewedAt).toBeNull();
  expect(edited.eligibleForStrategy).toBe(false);
});

test("conflicting research edits survive until reload and workspace navigation protects unsaved input", async ({ page }) => {
  const { org, user, path, open, panel } = await setup(page);
  const record = (await user.call(path, "POST", evidence())).body;
  const other = await db.organization.create({ data: { name: "Other research browser workspace" } });
  orgs.push(other.id);
  await db.membership.create({ data: { organizationId: other.id, userId: user.id, role: "OWNER" } });
  await open();
  await panel.getByRole("button", { name: "Edit research", exact: true }).click();
  await panel.getByLabel("Research title").fill("My unsaved synthetic edit");
  expect((await user.call(path + "/" + record.id, "PUT", { ...evidence("Concurrent synthetic edit"), expectedRevision: 1 })).status).toBe(200);
  await panel.getByRole("checkbox", { name: sourceAck }).check();
  await panel.getByRole("button", { name: "Save research", exact: true }).click();
  await expect(page.locator(".research-workspace").getByRole("alert")).toContainText("Your edits are still shown");
  await expect(panel.getByLabel("Research title")).toHaveValue("My unsaved synthetic edit");
  await expect(panel.getByRole("button", { name: "Save research", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Discard edits and reload", exact: true }).click();
  await expect(panel.getByRole("heading", { name: "Concurrent synthetic edit", exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Edit research", exact: true }).click();
  await panel.getByLabel("Research title").fill("Retained after temporary failure");
  const route = `**/api${path}/${record.id}`;
  await page.route(route, (request) => request.request().method() === "PUT"
    ? request.fulfill({ status: 503, json: { error: { message: "Synthetic temporary outage" } } }) : request.continue());
  await panel.getByRole("checkbox", { name: sourceAck }).check();
  await panel.getByRole("button", { name: "Save research", exact: true }).click();
  await expect(page.locator(".research-workspace").getByRole("alert")).toHaveText("Synthetic temporary outage");
  await expect(panel.getByLabel("Research title")).toHaveValue("Retained after temporary failure");
  await page.unroute(route);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByLabel("Active workspace").selectOption(other.id);
  await expect(page.getByLabel("Active workspace")).toHaveValue(org.id);
  await expect(panel.getByLabel("Research title")).toHaveValue("Retained after temporary failure");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Active workspace").selectOption(other.id);
  await page.getByRole("navigation").getByRole("button", { name: "Research", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No research yet" })).toBeVisible();
  await expect(panel.getByText("Concurrent synthetic edit", { exact: true })).toHaveCount(0);
});

test("missing and stale evidence cannot be accepted and restricted roles cannot mutate", async ({ page }) => {
  const { org, user, path, open, panel } = await setup(page);
  const missing = (await user.call(path, "POST", { ...evidence("Missing source fixture"), sourceUrl: null, sourceLabel: null, observedAt: null })).body;
  await open();
  await expect(panel.getByText("Evidence: Missing", { exact: true })).toBeVisible();
  await panel.getByLabel("Review note", { exact: true }).fill("Missing source cannot be accepted.");
  await panel.getByRole("checkbox", { name: reviewAck }).check();
  await expect(panel.getByRole("button", { name: "Accept evidence", exact: true })).toBeDisabled();
  await panel.getByRole("button", { name: "Reject evidence", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Review saved: rejected");
  const stale = (await user.call(path, "POST", { ...evidence("Stale source fixture"), observedAt: new Date(Date.now() - 31 * 86400000).toISOString() })).body;
  await page.getByRole("button", { name: "Reload research", exact: true }).click();
  await page.getByRole("region", { name: "Research records" }).getByRole("button", { name: /Stale source fixture/ }).click();
  await expect(panel.getByText("Evidence: Stale", { exact: true })).toBeVisible();
  await panel.getByLabel("Review note", { exact: true }).fill("Stale observation needs refresh.");
  await panel.getByRole("checkbox", { name: reviewAck }).check();
  await expect(panel.getByRole("button", { name: "Accept evidence", exact: true })).toBeDisabled();
  // Live role removal must close stale owner controls before session reload.
  await db.membership.update({ where: { userId_organizationId: { userId: user.id, organizationId: org.id } }, data: { role: "ANALYST" } });
  await panel.getByRole("button", { name: "Reject evidence", exact: true }).click();
  await expect(page.locator(".research-workspace").getByRole("alert")).toContainText("Your role does not allow this action");
  await expect(panel.getByRole("button", { name: "Reject evidence", exact: true })).toHaveCount(0);
  for (const role of ["CREATOR", "ANALYST", "CLIENT"] as const) {
    await db.membership.update({ where: { userId_organizationId: { userId: user.id, organizationId: org.id } }, data: { role } });
    await open();
    await expect(panel.getByRole("button", { name: "Accept evidence", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add research", exact: true })).toHaveCount(role === "CREATOR" ? 1 : 0);
    await expect(panel.getByRole("button", { name: "Edit research", exact: true })).toHaveCount(role === "CREATOR" ? 1 : 0);
  }
  expect((await user.call(path + "/" + missing.id)).body.reviewStatus).toBe("REJECTED");
  expect((await user.call(path + "/" + stale.id)).body.reviewStatus).toBe("UNREVIEWED");
});
