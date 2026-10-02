import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { grantCredits, reserveCredits } from "../../packages/core/credits";
import "../support/isolated";

test("credit history shows real ledger entries and stays usable on mobile", async ({
  page,
}) => {
  const headers = { "X-Requested-With": "MarketingOS" };
  const signup = await page.request.post("/api/auth/register", {
    headers,
    data: {
      name: "Credit UI QA",
      email: `credits-${randomUUID()}@example.test`,
      password: "A test password 123456",
    },
  });
  expect(signup.status()).toBe(201);
  const user = (await signup.json()).user;
  const created = await page.request.post("/api/organizations", {
    headers,
    data: { name: "Credit UI workspace", timezone: "Asia/Kolkata" },
  });
  expect(created.status()).toBe(201);
  const org = await created.json();
  const db = new PrismaClient();
  try {
    await db.$transaction(async (tx) => {
      await grantCredits(
        tx,
        org.id,
        12,
        randomUUID(),
        "Synthetic browser verification grant",
        user.id,
      );
      await reserveCredits(tx, org.id, `ui:${randomUUID()}`, 3, user.id);
    });
  } finally {
    await db.$disconnect();
  }
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Credits & usage", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Credits & usage", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".credits-total")).toHaveText(["9", "3"]);
  await expect(
    page.getByText("Synthetic browser verification grant", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Platform credit adjustment" }),
  ).toHaveCount(0);
  await expect(page.getByText(/Self-hosted mode:/)).toBeVisible();
  await page.getByRole("button", { name: "Refresh credits" }).click();
  await expect(
    page
      .getByRole("table", { name: "Credit history", exact: true })
      .locator("tbody tr"),
  ).toHaveCount(2);
  await page.screenshot({
    path: "test-results/credits-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page
        .locator(".sidebar")
        .evaluate((el) => el.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/credits-mobile.png",
    fullPage: true,
  });
});
