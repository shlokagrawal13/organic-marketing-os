import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
test("workspace health, complete export download and responsive operations UI", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Your name").fill("Operations QA");
  await page
    .getByLabel("Email address")
    .fill(`operations-${Date.now()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("A verification password 123");
  await page.getByRole("button", { name: "Create your account" }).click();
  await page.getByLabel("Workspace name").fill("Operations workspace");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Workspace health", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Workspace health", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Video rendering worker", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ops-services .pill")).toHaveText([
    "Available",
    "Available",
    "Available",
    "Available",
    "Available",
    "Available",
  ]);
  await page.screenshot({
    path: "test-results/workspace-health-desktop.png",
    fullPage: true,
  });
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export workspace data", exact: true })
    .click();
  const download = await downloadPromise;
  await download.saveAs("test-results/workspace-data.ndjson");
  const text = await readFile("test-results/workspace-data.ndjson", "utf8"),
    lines = text.trimEnd().split("\n"),
    last = JSON.parse(lines.at(-1)!);
  expect(last.type).toBe("complete");
  expect(last.data.sha256).toBe(
    createHash("sha256")
      .update(lines.slice(0, -1).join("\n") + "\n")
      .digest("hex"),
  );
  expect(text).not.toContain("passwordHash");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.screenshot({
    path: "test-results/workspace-health-dark.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to light mode" }).click();
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
    path: "test-results/workspace-health-mobile.png",
    fullPage: true,
  });
});
