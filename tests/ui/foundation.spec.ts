import { test, expect } from "@playwright/test";
test("register, create a workspace, and sign out", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Your name").fill("QA Workspace Owner");
  await page.getByLabel("Email address").fill(`ui-${Date.now()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("A browser test password 123");
  await page.getByRole("button", { name: "Create your account" }).click();
  await expect(
    page.getByRole("heading", { name: "Give your brand a home." }),
  ).toBeVisible();
  await page.getByLabel("Workspace name").fill("Organic Studio");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Let’s make your next move, QA." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Build your Brand Brain" }).click();
  await page.getByLabel("Industry", { exact: true }).fill("Marketing software");
  await page
    .getByLabel("Products and services")
    .fill("A marketing workspace for small business owners.");
  await page
    .getByLabel("What makes you different?")
    .fill("Brand context stays with the team.");
  await page
    .getByLabel("Target audience")
    .fill("Small business owners in India.");
  await page
    .getByLabel("Customer problems")
    .fill("Content planning takes too much time.");
  await page.getByLabel("Marketing goals").fill("Build an engaged community.");
  await page.getByRole("button", { name: "Save brand", exact: true }).click();
  await expect(page.getByText("Brand knowledge saved.")).toBeVisible();
  await page.getByRole("button", { name: "Creative DNA", exact: true }).click();
  await page
    .getByLabel("Brand voice and tone")
    .fill("Helpful, direct and warm.");
  await page
    .getByLabel("Visual identity")
    .fill("Clean photography and deep green.");
  await page.getByRole("button", { name: "Save brand", exact: true }).click();
  await expect(page.getByText("Saved · revision 2")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Creative DNA", exact: true }).click();
  await expect(page.getByLabel("Brand voice and tone")).toHaveValue(
    "Helpful, direct and warm.",
  );
  await page
    .getByRole("button", { name: "Command center", exact: true })
    .click();
  await expect(page.getByText("100% complete")).toBeVisible();
  await page.screenshot({
    path: "test-results/workspace-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.waitForTimeout(150);
  await page.screenshot({
    path: "test-results/workspace-dark.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Campaigns", exact: true })
    .click();
  await page.getByRole("button", { name: "New campaign" }).click();
  await page
    .getByLabel("Campaign name", { exact: true })
    .fill("Autumn brand launch");
  await page
    .getByLabel("Goal", { exact: true })
    .fill("Help small teams build consistent marketing.");
  await page
    .getByRole("button", { name: "Create campaign", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Autumn brand launch" }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Content library", exact: true })
    .click();
  await page.getByRole("button", { name: "New draft" }).click();
  await page
    .getByLabel("Content title", { exact: true })
    .fill("A clearer way to plan your content");
  await page
    .getByLabel("Hook", { exact: true })
    .fill("Does your team start from scratch every week?");
  await page
    .getByLabel("Content / script", { exact: true })
    .fill(
      "Bring your offer, audience and creative direction into one shared workspace. Start with a clear brand profile and build your next draft from there.",
    );
  await page
    .getByLabel("Call to action", { exact: true })
    .fill("Share the biggest challenge in your content planning.");
  await page
    .getByRole("combobox", { name: "Campaign", exact: true })
    .selectOption({ label: "Autumn brand launch" });
  await page.getByLabel("Planned date and time").fill("2026-09-25T10:00");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Request review", exact: true })
    .click();
  await expect(
    page.getByText("Content sent for review.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel(
      "I reviewed the facts, usage rights, brand fit and platform requirements.",
    )
    .check();
  await page.getByRole("button", { name: "Approve this revision" }).click();
  await expect(
    page.getByText("Content approved.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/content-review-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Content library", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "approved", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Create with AI", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "What would you like to create?" })
    .fill("Create a useful LinkedIn launch post for this business.");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Test-only generated draft" }),
  ).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: "Approve agent result" }).click();
  await expect(
    page.getByText("Agent result approved.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review as a draft" }).click();
  await expect(page.getByLabel("Content title", { exact: true })).toHaveValue(
    "Test-only generated draft",
  );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Content library", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Open A clearer way to plan your content",
    }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".sidebar")
        .evaluate((el) => el.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/content-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("button", { name: "Create your account" }),
  ).toBeVisible();
});
test("mobile registration is visible without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Create your account" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/auth-mobile.png",
    fullPage: true,
  });
});
