import { test, expect } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import { db, scene } from "../support/http";
import { encryptSocialToken } from "../../packages/core/social-tokens";

test("an owner reviews one approved YouTube render without scheduling or posting", async ({ page }) => {
  test.setTimeout(60000);
  const headers = { "X-Requested-With": "MarketingOS" };
  expect((await page.request.post("/api/auth/register", { headers, data: {
    name: "Policy UI QA", email: `policy-ui-${randomUUID()}@example.test`, password: "Isolated browser password 123",
  } })).status()).toBe(201);
  const me = await (await page.request.get("/api/auth/me")).json();
  const org = await (await page.request.post("/api/organizations", { headers, data: {
    name: "Policy Review UI QA", timezone: "Asia/Kolkata",
  } })).json();
  const root = `/api/workspaces/${org.id}`;
  const title = "Review this YouTube upload";
  const created = await page.request.post(`${root}/content`, { headers, data: {
    title, platform: "YouTube", format: "Video", hook: "A useful introduction",
    body: "Factual video description for the test-only review.", cta: "Learn more", scenes: [scene],
  } });
  expect(created.status()).toBe(201);
  const content = await created.json();
  expect((await page.request.post(`${root}/content/${content.id}/review`, { headers, data: { revision: 1 } })).status()).toBe(201);
  expect((await page.request.post(`${root}/content/${content.id}/approve`, { headers, data: { revision: 1, factsAndRightsReviewed: true } })).status()).toBe(201);
  const render = await db.renderJob.create({ data: {
    organizationId: org.id, contentId: content.id, contentRevision: 1,
    actorId: me.user.id, requestKey: randomUUID(), requestHash: "test-only-policy-ui",
    snapshot: { title, platform: "YouTube", format: "Video", hook: "A useful introduction", body: "Factual video description for the test-only review.", cta: "Learn more", scenes: [scene] },
    options: {}, totalScenes: 1, status: "SUCCEEDED", outputKey: `${org.id}/test-only/no-media`,
    approvedAt: new Date(), approvedBy: me.user.id,
  } });
  const identity = { organizationId: org.id, provider: "YOUTUBE" as const, externalAccountId: "test-only-channel" };
  const connection = await db.socialConnection.create({ data: {
    ...identity, accountLabel: "Test-only channel", scopes: ["https://www.googleapis.com/auth/youtube.upload"],
    accessTokenCiphertext: encryptSocialToken("fixture-access", identity, randomBytes(32).toString("base64")),
    tokenExpiresAt: new Date(Date.now() + 3600000),
  } });

  await page.goto("/?youtube=connected");
  await expect(page.getByRole("heading", { name: "Connections" })).toBeVisible();
  await expect(page.getByText("Test-only channel")).toBeVisible();
  await expect(page).toHaveURL("/");
  await page.getByRole("navigation").getByRole("button", { name: "Content library" }).click();
  await page.getByRole("button", { name: `Open ${title}`, exact: true }).click();
  const panel = page.getByRole("region", { name: "YouTube publication review" });
  await expect(panel.getByText("YouTube upload review")).toBeVisible();
  await expect(panel.getByRole("combobox", { name: /Approved render/ })).toHaveValue(render.id);
  await panel.getByRole("button", { name: "Create new upload preparation" }).click();
  await expect(panel.getByRole("textbox", { name: "Title", exact: true })).toHaveValue(title);
  await expect(panel.getByText("Nothing was posted.", { exact: false })).toBeVisible();
  const save = panel.getByRole("button", { name: "Save policy review" });
  await expect(save).toBeDisabled();
  await panel.getByRole("combobox", { name: "Channel" }).selectOption(connection.id);
  await panel.getByRole("combobox", { name: "Visibility" }).selectOption("unlisted");
  await panel.getByRole("combobox", { name: "Is this video made for kids?" }).selectOption("no");
  await panel.getByRole("combobox", { name: "Does it contain realistic synthetic or altered media?" }).selectOption("yes");
  await panel.getByRole("checkbox", { name: "I checked the exact title and description above." }).check();
  await panel.getByRole("checkbox", { name: "I checked the child-audience declaration." }).check();
  await panel.getByRole("checkbox", { name: "I checked the realistic synthetic-media declaration." }).check();
  await panel.getByRole("checkbox", { name: "I checked usage rights and current YouTube rules for this video." }).check();
  await expect(save).toBeEnabled();
  await save.click();
  await expect(panel.getByText("Review saved", { exact: true })).toBeVisible();
  await expect(panel.getByText(/Live YouTube posting is not available/)).toBeVisible();
  await expect(panel.getByRole("button", { name: "Publish reviewed video to YouTube" })).toHaveCount(0);
  const reviews = await db.publicationPolicyReview.findMany({ where: { organizationId: org.id } });
  expect(reviews).toHaveLength(1);
  expect((reviews[0].metadata as any).status).toEqual({ privacyStatus: "unlisted", selfDeclaredMadeForKids: false, containsSyntheticMedia: true });
  expect(await db.publicationAttempt.count({ where: { organizationId: org.id } })).toBe(0);
  // Browser-only readiness fixture exercises the notice without enabling the
  // isolated API's live dispatch flag or sending a provider request.
  const attemptUrl = `**/publication-intents/${reviews[0].intentId}/youtube-attempt`;
  await page.route(attemptUrl, (route) => route.fulfill({ status: 200,
    contentType: "application/json", body: JSON.stringify({ attempt: null,
      canPublish: true, canReconcile: false }) }));
  await panel.getByRole("button", { name: /Open .*revision 1/ }).first().click();
  await expect(panel.getByRole("button", { name: "Publish reviewed video to YouTube" })).toBeVisible();
  await expect(panel.getByText(/By clicking 'upload,' you certify/)).toBeVisible();
  await expect(panel.locator(".youtube-terms-desktop")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel.locator(".youtube-terms-mobile")).toBeVisible();
  await expect(panel.locator(".youtube-terms-desktop")).toBeHidden();
  await page.unroute(attemptUrl);
  await page.setViewportSize({ width: 1280, height: 800 });
  await panel.getByRole("button", { name: /Open .*revision 1/ }).first().click();
  await expect(panel.getByRole("button", { name: "Publish reviewed video to YouTube" })).toHaveCount(0);
  await page.screenshot({ path: "test-results/social-policy-review.png", fullPage: true });
  await page.reload();
  await page.getByRole("navigation").getByRole("button", { name: "Content library" }).click();
  await page.getByRole("button", { name: `Open ${title}`, exact: true }).click();
  const reopened = page.getByRole("region", { name: "YouTube publication review" });
  await reopened.getByRole("button", { name: /Open .*·/ }).click();
  await expect(reopened.getByText("Review saved", { exact: true })).toBeVisible();
  await expect(reopened.getByText(/Live YouTube posting is not available/)).toBeVisible();
  expect(await db.publicationAttempt.count({ where: { organizationId: org.id } })).toBe(0);
  const prepared = await db.publicationIntent.findFirstOrThrow({ where: { organizationId: org.id } });
  await db.publicationAttempt.create({ data: {
    organizationId: org.id, intentId: prepared.id, connectionId: connection.id,
    contentId: content.id, contentRevision: 1, requestKey: randomUUID(),
    requestHash: "test-only-historical-attempt", status: "UNKNOWN",
    outcomeCode: "UPLOAD_OUTCOME_UNCERTAIN", startedAt: new Date(),
  } });
  await db.publicationIntent.update({ where: { id: prepared.id },
    data: { status: "INVALIDATED", invalidatedAt: new Date() } });
  await page.reload();
  await page.getByRole("navigation").getByRole("button", { name: "Content library" }).click();
  await page.getByRole("button", { name: `Open ${title}`, exact: true }).click();
  const historical = page.getByRole("region", { name: "YouTube publication review" });
  await historical.getByRole("button", { name: /revision 1 · INVALIDATED/ }).click();
  await expect(historical.getByText("Status: UNKNOWN")).toBeVisible();
  await expect(historical.getByText(/may already exist/)).toBeVisible();
  await expect(historical.getByRole("button", { name: "Publish reviewed video to YouTube" })).toHaveCount(0);
  await db.$disconnect();
});
