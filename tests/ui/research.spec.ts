import { test, expect, Page } from "@playwright/test";
import { resetFixtureRateBudget } from "../support/fixture-rate-budget";
import { actor, db } from "../support/http";
import { competitorInsight, searchInsight, audienceInsight, communityInsight, seasonalInsight } from "../support/research-insight";

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
  await resetFixtureRateBudget();
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

async function fillInsightObservation(page: Page, panel: ReturnType<Page["getByRole"]>, kind: "COMPETITOR" | "SEARCH" | "AUDIENCE" | "COMMUNITY" | "SEASONAL") {
  await page.getByRole("button", { name: "Add research", exact: true }).click();
  await panel.getByLabel("Research title").fill(`Synthetic ${kind.toLowerCase()} analysis`);
  await panel.getByLabel("Research category").selectOption(kind);
  await panel.getByLabel("Observation summary").fill(evidence().summary);
  await panel.getByLabel("Source URL").fill(evidence().sourceUrl);
  await panel.getByLabel("Source label").fill(evidence().sourceLabel);
  const observed = await page.evaluate(() => {
    const d = new Date(Date.now() - 60000); d.setSeconds(0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  await panel.getByLabel("Observed at (your local time)").fill(observed);
}

test("audience insight keeps missing lists explicit and freezes reviewed scope in generated strategy history", async ({ page }) => {
  const { org, user, path, open, panel } = await setup(page);
  await db.brandBrain.create({ data: { organizationId: org.id, profile: { name: "Synthetic brand", audience: "Synthetic beginners" }, creativeDna: {} } });
  await open();await fillInsightObservation(page, panel, "AUDIENCE");
  await panel.getByRole("checkbox", { name: "Add structured audience insight" }).check();
  const insight = { ...audienceInsight(), interests: [], questions: [], painPoints: [] };
  for (const [name, value] of [["Audience segment", insight.segment], ["Observed audience need", insight.observedNeed], ["Proposed response / content test", insight.proposedResponse]])
    await panel.getByLabel(name, { exact: true }).fill(value);
  await panel.getByRole("checkbox", { name: sourceAck }).check();
  await expect(panel.getByRole("button", { name: "Save research", exact: true })).toBeDisabled();
  await panel.getByLabel("Assumptions and limits", { exact: true }).fill(insight.assumptions);
  await expect(panel.getByRole("checkbox", { name: sourceAck })).not.toBeChecked();
  await panel.getByLabel("Observed interests", { exact: true }).fill(Array(6).fill("Synthetic interest").join("\n"));
  await panel.getByRole("checkbox", { name: sourceAck }).check();
  await expect(panel.getByRole("button", { name: "Save research", exact: true })).toBeDisabled();
  await panel.getByLabel("Observed interests", { exact: true }).fill("");
  await panel.getByRole("checkbox", { name: sourceAck }).check();
  await panel.getByRole("button", { name: "Save research", exact: true }).click();
  const view = panel.getByRole("region", { name: "Structured research insight" });
  await expect(view.getByRole("heading", { name: "Audience insight", exact: true })).toBeVisible();
  await expect(view.getByText("Not recorded", { exact: true })).toHaveCount(3);
  const record = (await user.call(path)).body.items[0];expect(record.insight).toEqual(insight);
  await panel.getByLabel("Review note", { exact: true }).fill("Reviewed synthetic audience source, scope and missing lists.");
  await panel.getByRole("checkbox", { name: reviewAck }).check();await panel.getByRole("button", { name: "Accept evidence", exact: true }).click();
  await expect(panel.getByText("Evidence accepted and current", { exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0,0));await page.screenshot({ path: "test-results/audience-insight-desktop.png", fullPage: true, animations: "disabled" });
  await page.getByRole("navigation").getByRole("button", { name: "Create with AI", exact: true }).click();
  await page.getByLabel("Generation type").selectOption("strategy");await page.getByLabel("What would you like to create?").fill("Synthetic scoped audience strategy");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  const context = page.getByRole("region", { name: "Strategy research context", exact: true });
  await expect(context.getByRole("button", { name: "View research sources" })).toBeEnabled({ timeout: 30000 });
  await context.getByRole("button", { name: "View research sources" }).click();
  await expect(context.getByText("Not recorded", { exact: true })).toHaveCount(3);await expect(context).toContainText(insight.assumptions);
  const edit = await user.call(`${path}/${record.id}`, "PUT", { ...evidence(record.title), insight: { ...insight, observedNeed: "Later synthetic need" }, expectedRevision: 2 });
  expect(edit.status).toBe(200);expect(edit.body.reviewStatus).toBe("UNREVIEWED");
  await context.getByRole("button", { name: "View research sources" }).click();
  await expect(context).toContainText(insight.observedNeed);await expect(context).not.toContainText("Later synthetic need");
  await page.evaluate(() => window.scrollTo(0,0));await page.screenshot({ path: "test-results/audience-insight-frozen-history.png", fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.locator(".sidebar").evaluate(el => el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await context.getByRole("region", { name: "Structured research insight" }).locator("p").first().evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: "test-results/audience-insight-history-mobile.png", fullPage: true, animations: "disabled" });
});

test("community insight saves a declared signal with assumptions, invalidates review on edit and remains readable on mobile", async ({ page }) => {
  const { user, path, open, panel } = await setup(page);await open();await fillInsightObservation(page, panel, "COMMUNITY");
  await panel.getByRole("checkbox", { name: "Add structured community insight" }).check();const insight = communityInsight();
  await panel.getByLabel("Community signal", { exact: true }).selectOption(insight.signal);
  for (const [name, value] of [["Community context", insight.channelContext], ["Observed topic", insight.topic], ["Observed interaction theme", insight.observation],
    ["Proposed response / content test", insight.proposedResponse], ["Assumptions and limits", insight.assumptions]])
    await panel.getByLabel(name, { exact: true }).fill(value);
  await expect(panel.getByText(/Omit personal identifiers and private message text/)).toBeVisible();
  await panel.getByRole("checkbox", { name: sourceAck }).check();await panel.getByRole("button", { name: "Save research", exact: true }).click();
  const view=panel.getByRole("region", { name: "Structured research insight" });await expect(view.getByRole("heading", { name: "Community insight", exact: true })).toBeVisible();
  const record = (await user.call(path)).body.items[0];expect(record.insight).toEqual(insight);
  await panel.getByLabel("Review note", { exact: true }).fill("Reviewed synthetic de-identified source, signal and assumptions.");
  await panel.getByRole("checkbox", { name: reviewAck }).check();await panel.getByRole("button", { name: "Accept evidence", exact: true }).click();
  await expect(panel.getByText("Evidence accepted and current", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reload research", exact: true }).click();await expect(view).toContainText(insight.assumptions);
  await page.getByRole("button", { name: "Switch to dark mode" }).click();await page.evaluate(() => window.scrollTo(0,0));
  await page.screenshot({ path: "test-results/community-insight-dark.png", fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Switch to light mode" }).click();await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.locator(".sidebar").evaluate(el => el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/community-insight-mobile.png", fullPage: true, animations: "disabled" });
  await panel.getByRole("button", { name: "Edit research", exact: true }).click();
  await panel.getByLabel("Community signal", { exact: true }).selectOption("REQUEST");
  await panel.getByRole("checkbox", { name: sourceAck }).check();await panel.getByRole("button", { name: "Save research", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Research saved at revision 3");
  const edited=(await user.call(`${path}/${record.id}`)).body;expect(edited.insight.signal).toBe("REQUEST");expect(edited.reviewStatus).toBe("UNREVIEWED");expect(edited.reviewedAt).toBeNull();
});

test("competitor interpretation is reviewed, sent to strategy and retained in source history after later edits", async ({ page }) => {
  const { org, user, path, open, panel } = await setup(page);
  await db.brandBrain.create({ data: { organizationId: org.id, profile: { name: "Synthetic brand", audience: "Synthetic audience" }, creativeDna: {} } });
  await open(); await fillInsightObservation(page, panel, "COMPETITOR");
  await panel.getByRole("checkbox", { name: "Add structured competitor insight" }).check();
  const insight = competitorInsight();
  for (const [label, value] of [["Competitor / subject", insight.subject], ["Observed content theme", insight.contentTheme],
    ["Observed format", insight.format], ["Observed positioning", insight.positioning], ["Proposed opportunity", insight.opportunity],
    ["How we will differentiate", insight.differentiation], ["Assumptions and limits", insight.assumptions]])
    await panel.getByLabel(label, { exact: true }).fill(value);
  await panel.getByRole("checkbox", { name: sourceAck }).check();
  await panel.getByRole("button", { name: "Save research", exact: true }).click();
  await expect(panel.getByRole("region", { name: "Structured research insight" })).toContainText(insight.differentiation);
  const record = (await user.call(path)).body.items[0]; expect(record.insight).toEqual(insight);
  await panel.getByLabel("Review note", { exact: true }).fill("Reviewed synthetic competitor source, interpretation and assumptions.");
  await panel.getByRole("checkbox", { name: reviewAck }).check();
  await panel.getByRole("button", { name: "Accept evidence", exact: true }).click();
  await expect(panel.getByText("Evidence accepted and current", { exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/competitor-insight-desktop.png", fullPage: true, animations: "disabled" });
  await page.getByRole("navigation").getByRole("button", { name: "Create with AI", exact: true }).click();
  await page.getByLabel("Generation type").selectOption("strategy");
  await page.getByLabel("What would you like to create?").fill("Synthetic strategy with reviewed competitor interpretation");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  const context = page.getByRole("region", { name: "Strategy research context", exact: true });
  await expect(context.getByRole("button", { name: "View research sources" })).toBeEnabled({ timeout: 30000 });
  await context.getByRole("button", { name: "View research sources" }).click();
  await expect(context.getByRole("region", { name: "Structured research insight" })).toContainText(insight.assumptions);
  const changed = await user.call(`${path}/${record.id}`, "PUT", { ...evidence(record.title), category: "COMPETITOR",
    insight: { ...insight, differentiation: "New original synthetic direction" }, expectedRevision: 2 });
  expect(changed.status).toBe(200); expect(changed.body.reviewStatus).toBe("UNREVIEWED");
  await context.getByRole("button", { name: "View research sources" }).click();
  await expect(context).toContainText(insight.differentiation);
  await expect(context).not.toContainText("New original synthetic direction");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/competitor-insight-frozen-history.png", fullPage: true, animations: "disabled" });
});

test("search insight form validates assumptions and list bounds, clears category changes and persists responsive views", async ({ page }) => {
  const { user, path, open, panel } = await setup(page);
  await open(); await fillInsightObservation(page, panel, "SEARCH");
  await panel.getByRole("checkbox", { name: "Add structured search insight" }).check();
  await panel.getByLabel("Search query / topic", { exact: true }).fill("Unsaved query cleared by category change");
  await panel.getByLabel("Research category").selectOption("COMPETITOR");
  await expect(panel.getByRole("checkbox", { name: "Add structured competitor insight" })).not.toBeChecked();
  await panel.getByLabel("Research category").selectOption("SEARCH");
  await panel.getByRole("checkbox", { name: "Add structured search insight" }).check();
  await expect(panel.getByLabel("Search query / topic", { exact: true })).toHaveValue("");
  const insight = searchInsight();
  await panel.getByLabel("Search query / topic", { exact: true }).fill(insight.query);
  await panel.getByLabel("Proposed search intent", { exact: true }).selectOption(insight.intent);
  await panel.getByLabel("Candidate keywords").fill(insight.keywords.join("\n"));
  await panel.getByLabel("Candidate questions").fill(insight.questions.join("\n"));
  await panel.getByLabel("Proposed answer angle", { exact: true }).fill(insight.answerAngle);
  await panel.getByRole("checkbox", { name: sourceAck }).check();
  await expect(panel.getByRole("button", { name: "Save research", exact: true })).toBeDisabled();
  await panel.getByLabel("Assumptions and limits", { exact: true }).fill(insight.assumptions);
  await expect(panel.getByRole("checkbox", { name: sourceAck })).not.toBeChecked();
  await panel.getByLabel("Candidate keywords").fill(Array(9).fill("synthetic").join("\n"));
  await panel.getByRole("checkbox", { name: sourceAck }).check();
  await expect(panel.getByRole("button", { name: "Save research", exact: true })).toBeDisabled();
  await panel.getByLabel("Candidate keywords").fill(insight.keywords.join("\n"));
  await panel.getByRole("checkbox", { name: sourceAck }).check();
  await panel.getByRole("button", { name: "Save research", exact: true }).click();
  const view = panel.getByRole("region", { name: "Structured research insight" });
  await expect(view.getByRole("heading", { name: "Search insight" })).toBeVisible();
  expect((await user.call(path)).body.items[0].insight).toEqual(insight);
  await page.getByRole("button", { name: "Reload research", exact: true }).click();
  await expect(view).toContainText(insight.questions[0]);
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/search-insight-dark.png", fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.locator(".sidebar").evaluate(el => el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/search-insight-mobile.png", fullPage: true, animations: "disabled" });
});

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
  // datetime-local normalizes :00 seconds away; use its canonical minute form.
  // Always exercise that boundary, in the browser's timezone, instead of depending on the wall-clock second.
  const observed = await page.evaluate(() => {
    const date = new Date(Date.now() - 60000);date.setSeconds(0, 0);
    return { local: new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16), utc: date.toISOString() };
  });
  await panel.getByLabel("Observed at (your local time)").fill(observed.local);
  await expect(panel.getByLabel("Observed at (your local time)")).toHaveValue(observed.local);
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
  expect(saved.observedAt).toBe(observed.utc);
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

test("a generated strategy exposes the reviewed source context actually sent to its provider", async ({ page }) => {
  const { org, user, path, open } = await setup(page);
  await db.brandBrain.create({ data: { organizationId: org.id, profile: { name: "Synthetic research brand", audience: "Synthetic audience" }, creativeDna: {} } });
  const created = (await user.call(path, "POST", evidence("Source for synthetic strategy"))).body;
  expect((await user.call(path + `/${created.id}/review`, "POST", { expectedRevision: 1, decision: "ACCEPTED", note: "Reviewed synthetic source.", sourcesReviewed: true })).status).toBe(201);
  await open();
  await page.getByRole("navigation").getByRole("button", { name: "Create with AI", exact: true }).click();
  await page.getByLabel("Generation type").selectOption("strategy");
  await page.getByLabel("Research categories", { exact: true }).selectOption(["AUDIENCE"]);
  await page.getByLabel("Research market", { exact: true }).fill(" India ");
  await page.getByLabel("Research language", { exact: true }).fill("English");
  const prompt = "Create a synthetic strategy using the supplied research evidence.";
  await page.getByLabel("What would you like to create?").fill(prompt);
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Test-only strategy", exact: true })).toBeVisible({ timeout: 30000 });
  const context = page.getByRole("region", { name: "Strategy research context" });
  await context.getByRole("button", { name: "View research sources" }).click();
  await expect(context.getByRole("heading", { name: "1 reviewed source selected" })).toBeVisible();
  await expect(context.getByRole("region", { name: "Research coverage", exact: true })).toContainText("1 matching record examined · 1 eligible · 1 captured");
  await expect(context.getByRole("region", { name: "Research coverage", exact: true })).toContainText("AUDIENCE: 1 usable source");
  await expect(context.getByText("Source for synthetic strategy", { exact: true })).toBeVisible();
  await expect(context.getByRole("link", { name: "Synthetic source publication" })).toHaveAttribute("href", evidence().sourceUrl);
  const jobs = (await user.call(`/workspaces/${org.id}/ai/jobs`)).body;
  const job = jobs.find((item: any) => item.input.prompt === prompt);
  const trace = (await user.call(`/workspaces/${org.id}/ai/jobs/${job.id}/trace`)).body;
  expect(trace.frozenContext.brand.research.evidence[0].id).toBe(created.id);
  expect(trace.frozenContext.brand.research.evidence[0].revision).toBe(2);
  expect(trace.frozenContext.brand.research.selection).toEqual({ categories: ["AUDIENCE"], market: "india", language: "english" });
  await expect(context.getByLabel("Captured research selection")).toContainText("Categories: AUDIENCE · Market: india · Language: english");
  await page.getByLabel("Research market", { exact: true }).fill("US");
  await expect(context.getByLabel("Captured research selection")).toContainText("Market: india");
  const recommendations = page.getByRole("region", { name: "Recommendation source review" });
  await expect(recommendations.getByText("Source excerpt matched — review its relevance", { exact: true })).toBeVisible();
  await expect(recommendations.getByText(evidence().summary, { exact: true })).toBeVisible();
  await expect(recommendations.getByRole("link", { name: "Synthetic source publication" })).toHaveAttribute("href", evidence().sourceUrl);
  await expect(page.getByRole("button", { name: "Use idea", exact: true })).toBeDisabled();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/strategy-research-desktop.png", fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.screenshot({ path: "test-results/strategy-research-dark.png", fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.locator(".sidebar").evaluate((el) => el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/strategy-research-mobile.png", fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Approve agent result", exact: true }).click();
  await expect(page.getByRole("button", { name: "Use idea", exact: true })).toBeEnabled();
});

test("unsupported strategy references block approval and copying while reviewer can reject", async ({ page }) => {
  const { org, path, open } = await setup(page);
  await db.brandBrain.create({ data: { organizationId: org.id, profile: { name: "Synthetic brand", audience: "Test audience" }, creativeDna: {} } });
  await open();await page.getByRole("navigation").getByRole("button", { name: "Create with AI", exact: true }).click();
  await page.getByLabel("Generation type").selectOption("strategy");
  await page.getByLabel("What would you like to create?").fill("REF_UNKNOWN: synthetic unsupported strategy reference");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  const review = page.getByRole("region", { name: "Recommendation source review" });
  await expect(review.getByRole("alert")).toHaveText("Source reference checks blocked approval. Generate a corrected strategy.", { timeout: 30000 });
  await expect(review.getByText("Source was not in the captured research context", { exact: true })).toBeVisible();
  await expect(review.getByRole("link")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Approve agent result", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Use idea", exact: true })).toBeDisabled();
  await page.screenshot({ path: "test-results/strategy-references-blocked.png", fullPage: true, animations: "disabled" });
  page.once("dialog", dialog => dialog.accept("Synthetic reference needs correction"));
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Agent result rejected.");
  await expect(page.getByRole("button", { name: "Approve agent result", exact: true })).toHaveCount(0);
});

test("strategy without research labels its recommendation as an assumption and missing data", async ({ page }) => {
  const { org, user, path, open } = await setup(page);
  const mismatched = (await user.call(path, "POST", evidence("Different language source"))).body;
  expect((await user.call(path + `/${mismatched.id}/review`, "POST", { expectedRevision: 1, decision: "ACCEPTED", sourcesReviewed: true, note: "Reviewed synthetic English source." })).status).toBe(201);
  await db.brandBrain.create({ data: { organizationId: org.id, profile: { name: "Synthetic brand", audience: "Test audience" }, creativeDna: {} } });
  await open();await page.getByRole("navigation").getByRole("button", { name: "Create with AI", exact: true }).click();
  await page.getByLabel("Generation type").selectOption("strategy");
  await page.getByLabel("Research language", { exact: true }).fill("Hindi");
  await page.getByLabel("What would you like to create?").fill("Synthetic strategy with no supplied research observations");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  const review = page.getByRole("region", { name: "Recommendation source review" });
  await expect(review.getByText("Assumption — evidence gap or proposed test", { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(review.getByText(/No usable research supplied/)).toBeVisible();
  await expect(review.getByRole("link")).toHaveCount(0);
  const context = page.getByRole("region", { name: "Strategy research context" });
  await context.getByRole("button", { name: "View research sources" }).click();
  await expect(context.getByRole("heading", { name: "No usable research evidence" })).toBeVisible();
  await expect(context.getByLabel("Captured research selection")).toContainText("Language: hindi");
  await expect(context.getByRole("region", { name: "Research coverage", exact: true })).toContainText("0 matching records examined · 0 eligible · 0 captured");
  await expect(context.getByRole("region", { name: "Research coverage", exact: true })).toContainText("AUDIENCE: 0 usable sources at generation check — evidence gap; label assumptions");
  await page.getByRole("button", { name: "Clear research filters", exact: true }).click();
  await expect(page.getByLabel("Research language", { exact: true })).toHaveValue("");
  await expect(context.getByLabel("Captured research selection")).toContainText("Language: hindi");
  await page.screenshot({ path: "test-results/strategy-references-assumption.png", fullPage: true, animations: "disabled" });
});


test("a bounded unreviewed window explains missing evidence without exposing omitted record details", async ({ page }) => {
  const { org, user, open } = await setup(page);
  await db.brandBrain.create({ data: { organizationId: org.id, profile: { name: "Synthetic coverage brand", audience: "Synthetic audience" }, creativeDna: {} } });
  await db.researchRecord.createMany({ data: Array.from({ length: 101 }, (_, i) => ({ ...evidence(`Private pending observation ${i}`),
    organizationId: org.id, createdBy: user.id, observedAt: new Date() })) });
  await open();await page.getByRole("navigation").getByRole("button", { name: "Create with AI", exact: true }).click();
  await page.getByLabel("Generation type").selectOption("strategy");
  await page.getByLabel("Research categories", { exact: true }).selectOption(["AUDIENCE", "SEARCH"]);
  await page.getByLabel("What would you like to create?").fill("Synthetic bounded research coverage explanation");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  const context = page.getByRole("region", { name: "Strategy research context", exact: true });
  await expect(context.getByRole("button", { name: "View research sources" })).toBeEnabled({ timeout: 30000 });
  await context.getByRole("button", { name: "View research sources" }).click();
  const coverage = context.getByRole("region", { name: "Research coverage", exact: true });
  await expect(coverage).toContainText("100 matching records examined · 0 eligible · 0 captured");
  await expect(coverage).toContainText("More matching records existed beyond the latest 100");
  await expect(coverage).toContainText("100 not accepted");
  await expect(coverage).toContainText("SEARCH: 0 usable sources at generation check — evidence gap; label assumptions");
  await expect(context.getByText(/Private pending observation/)).toHaveCount(0);
  await expect(context.getByRole("link")).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/research-coverage-window.png", fullPage: true, animations: "disabled" });
});


test("seasonal insight keeps unknown timing explicit, validates declared dates and freezes calendar context in strategy history", async ({ page }) => {
  const { org, user, path, open, panel } = await setup(page);
  await db.brandBrain.create({ data: { organizationId: org.id, profile: { name: "Synthetic calendar brand", audience: "Synthetic audience" }, creativeDna: {} } });
  await open();await fillInsightObservation(page, panel, "SEASONAL");
  await panel.getByRole("checkbox", { name: "Add structured seasonal insight" }).check();const insight = seasonalInsight();
  await expect(panel.getByLabel("Declared start date", { exact: true })).toBeDisabled();
  for (const [name, value] of [["Event / occasion", insight.eventName], ["Cultural / market context", insight.culturalContext], ["Business relevance", insight.businessRelevance],
    ["Proposed calendar opportunity", insight.proposedOpportunity], ["Assumptions and limits", insight.assumptions]]) await panel.getByLabel(name, { exact: true }).fill(value);
  await panel.getByLabel("Date certainty", { exact: true }).selectOption("DECLARED");
  await panel.getByLabel("Declared start date", { exact: true }).fill("2099-01-02");await panel.getByLabel("Declared end date", { exact: true }).fill("2099-01-01");
  await panel.getByRole("checkbox", { name: sourceAck }).check();await expect(panel.getByRole("button", { name: "Save research", exact: true })).toBeDisabled();
  await panel.getByLabel("Declared end date", { exact: true }).fill("2099-01-03");await panel.getByLabel("Event time zone (IANA; blank if unknown)", { exact: true }).fill("Invalid/Zone");
  await panel.getByRole("checkbox", { name: sourceAck }).check();await expect(panel.getByRole("button", { name: "Save research", exact: true })).toBeDisabled();
  await panel.getByLabel("Event time zone (IANA; blank if unknown)", { exact: true }).fill("");await panel.getByLabel("Date certainty", { exact: true }).selectOption("UNKNOWN");
  await expect(panel.getByLabel("Declared start date", { exact: true })).toHaveValue("");await expect(panel.getByRole("checkbox", { name: sourceAck })).not.toBeChecked();
  await panel.getByRole("checkbox", { name: sourceAck }).check();await panel.getByRole("button", { name: "Save research", exact: true }).click();
  const view=panel.getByRole("region", { name: "Structured research insight" });await expect(view.getByRole("heading", { name: "Seasonal insight", exact: true })).toBeVisible();
  await expect(view.getByText("Unknown", { exact: true })).toHaveCount(3);
  const record=(await user.call(path)).body.items[0];expect(record.insight).toEqual(insight);
  await panel.getByLabel("Review note", { exact: true }).fill("Reviewed synthetic calendar source; timing still unknown.");
  await panel.getByRole("checkbox", { name: reviewAck }).check();await panel.getByRole("button", { name: "Accept evidence", exact: true }).click();
  await expect(panel.getByText("Evidence accepted and current", { exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0,0));await page.screenshot({ path: "test-results/seasonal-insight-desktop.png", fullPage: true, animations: "disabled" });
  await page.getByRole("navigation").getByRole("button", { name: "Create with AI", exact: true }).click();
  await page.getByLabel("Generation type").selectOption("strategy");await page.getByLabel("What would you like to create?").fill("Synthetic calendar strategy with unknown event timing");
  await page.getByRole("button", { name: "Generate", exact: true }).click();const context=page.getByRole("region", { name: "Strategy research context", exact: true });
  await expect(context.getByRole("button", { name: "View research sources" })).toBeEnabled({ timeout: 30000 });await context.getByRole("button", { name: "View research sources" }).click();
  await expect(context).toContainText(insight.assumptions);await expect(context.getByText("Unknown", { exact: true })).toHaveCount(3);
  expect((await user.call(`${path}/${record.id}`, "PUT", { ...evidence(record.title), category: "SEASONAL", expectedRevision: 2,
    insight: { ...insight, eventName: "Later synthetic occasion", dateStatus: "DECLARED", startDate: "2099-01-01", endDate: "2099-01-02", timeZone: "Asia/Kolkata" } })).status).toBe(200);
  await context.getByRole("button", { name: "View research sources" }).click();await expect(context).toContainText(insight.eventName);await expect(context).not.toContainText("Later synthetic occasion");
  await page.setViewportSize({ width: 390, height: 844 });await expect.poll(() => page.locator(".sidebar").evaluate(el => el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/seasonal-insight-history-mobile.png", fullPage: true, animations: "disabled" });
});

test("an ended declared seasonal window stays unavailable for acceptance in dark and mobile research views", async ({ page }) => {
  const { user, path, open, panel } = await setup(page);
  const insight={ ...seasonalInsight(), dateStatus: "DECLARED", startDate: "2000-01-01", endDate: "2000-01-02", timeZone: "Asia/Kolkata" };
  expect((await user.call(path, "POST", { ...evidence("Synthetic ended event"), category: "SEASONAL", insight })).status).toBe(201);
  await open();await page.getByRole("button", { name: /Synthetic ended event/ }).click();
  await expect(panel).toContainText("The declared event window has ended in its named time zone");
  await panel.getByLabel("Review note", { exact: true }).fill("Synthetic source checked; event has ended.");await panel.getByRole("checkbox", { name: reviewAck }).check();
  await expect(panel.getByRole("button", { name: "Accept evidence", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Switch to dark mode" }).click();await page.evaluate(() => window.scrollTo(0,0));
  await page.screenshot({ path: "test-results/seasonal-insight-ended-dark.png", fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });await expect.poll(() => page.locator(".sidebar").evaluate(el => el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/seasonal-insight-ended-mobile.png", fullPage: true, animations: "disabled" });
});
