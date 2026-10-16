import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("claim evidence blocks approval until the exact revision is resolved", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const headers = { "X-Requested-With": "MarketingOS" };
  expect(
    (
      await page.request.post("/api/auth/register", {
        headers,
        data: {
          name: "Claim Policy UI QA",
          email: `claim-ui-${randomUUID()}@example.test`,
          password: "Isolated browser password 123",
        },
      })
    ).status(),
  ).toBe(201);
  const organization = await (
    await page.request.post("/api/organizations", {
      headers,
      data: { name: "Claim Policy UI QA", timezone: "Asia/Kolkata" },
    })
  ).json();
  const root = `/api/workspaces/${organization.id}`;
  const title = "Plan for 35% more qualified leads";
  const created = await (
    await page.request.post(`${root}/content`, {
      headers,
      data: {
        title,
        platform: "LinkedIn",
        format: "Text",
        hook: "Give the team a shared starting point.",
        body: "Organize ideas, drafts and feedback in one workspace.",
        cta: "Explore the workflow.",
        scenes: [],
      },
    })
  ).json();
  expect(
    (
      await page.request.post(`${root}/content/${created.id}/review`, {
        headers,
        data: { revision: 1 },
      })
    ).status(),
  ).toBe(201);

  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Content library" })
    .click();
  await page.getByRole("button", { name: `Open ${title}` }).click();
  await expect(
    page.getByRole("heading", { name: "Claim evidence" }),
  ).toBeVisible();
  const approval = page.getByRole("button", { name: "Approve this revision" });
  await page
    .getByLabel(
      "I reviewed the facts, usage rights, brand fit and platform requirements.",
    )
    .check();
  await expect(approval).toBeDisabled();
  const card = page.locator(".claim-card").first();
  await expect(
    page.getByText(/public HTTPS source checked within the last 30 days/u),
  ).toBeVisible();
  await card.getByLabel("Evidence URL").fill("https://example.com/report");
  await card.getByLabel("Evidence label").fill("Test-only source report");
  await card.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Save claim evidence" }).click();
  await expect(
    page.getByText("Claim evidence saved for this revision.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel(
      "I reviewed the facts, usage rights, brand fit and platform requirements.",
    )
    .check();
  await expect(approval).toBeEnabled();
  await approval.click();
  await expect(
    page.getByText("Content approved.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Approved for this revision.")).toBeVisible();
});
