import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { actor, db } from "../support/http";
import { resetFixtureRateBudget } from "../support/fixture-rate-budget";

const organizations: string[] = [];
const users: string[] = [];

test.afterAll(async () => {
  await db.organization.deleteMany({ where: { id: { in: organizations } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});

test("notification center loads tenant updates and toggles unread state", async ({
  page,
}) => {
  test.setTimeout(90000);
  await resetFixtureRateBudget();
  const org = await db.organization.create({
    data: { name: "Notifications browser workspace" },
  });
  organizations.push(org.id);
  const user = await actor(org.id, "OWNER");
  users.push(user.id);
  await db.notification.create({
    data: {
      organizationId: org.id,
      type: "RENDER_SUCCEEDED",
      category: "RENDER",
      title: "Render complete",
      body: "The campaign video is ready for review.",
      eventKey: `render:${randomUUID()}:SUCCEEDED`,
    },
  });
  await page.context().addCookies([
    {
      name: "mos_session",
      value: user.headers.cookie.split("=")[1],
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await page.goto("/");
  const trigger = page.getByRole("button", { name: /Notifications/ });
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute(
    "aria-label",
    "Notifications (1 unread)",
  );
  await trigger.click();
  await expect(
    page.getByRole("heading", { name: "Notifications", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".notification-stream-status")).toHaveText(
    "Live updates",
  );
  await expect(
    page.getByText("The campaign video is ready for review."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Mark notification as read" }).click();
  await expect(trigger).toHaveAttribute("aria-label", "Notifications");
  await page
    .getByRole("button", { name: "Mark notification as unread" })
    .click();
  await expect(trigger).toHaveAttribute(
    "aria-label",
    "Notifications (1 unread)",
  );

  await page.getByRole("button", { name: "Notification preferences" }).click();
  await expect(
    page.getByRole("heading", { name: "Notification preferences" }),
  ).toBeVisible();
  const renderUpdates = page.getByRole("checkbox", {
    name: "Render updates",
  });
  await expect(renderUpdates).not.toBeChecked();
  await renderUpdates.check();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.locator(".notification-success")).toHaveText(
    "Notification preferences saved.",
  );
  await page.getByRole("button", { name: "Back to notifications" }).click();
  await expect(
    page.getByText("The campaign video is ready for review."),
  ).not.toBeVisible();
  await expect(trigger).toHaveAttribute("aria-label", "Notifications");

  await page.getByRole("button", { name: "Notification preferences" }).click();
  await expect(
    page.getByRole("checkbox", { name: "Render updates" }),
  ).toBeChecked();
  await page.getByRole("checkbox", { name: "Render updates" }).uncheck();
  await page.getByRole("button", { name: "Close notifications" }).click();
  await trigger.click();
  await page.getByRole("button", { name: "Notification preferences" }).click();
  await expect(
    page.getByRole("checkbox", { name: "Render updates" }),
  ).toBeChecked();
});

test("notification center reconnects the optional live stream after a transient failure", async ({
  page,
}) => {
  test.setTimeout(90000);
  await resetFixtureRateBudget();
  const org = await db.organization.create({
    data: { name: "Notification stream reconnect workspace" },
  });
  organizations.push(org.id);
  const user = await actor(org.id, "OWNER");
  users.push(user.id);
  let attempts = 0;
  await page.route(
    /\/api\/workspaces\/[^/]+\/notifications\/stream/,
    async (route) => {
      attempts += 1;
      if (attempts === 1) {
        await route.abort("failed");
        return;
      }
      await route.continue();
    },
  );
  await page.context().addCookies([
    {
      name: "mos_session",
      value: user.headers.cookie.split("=")[1],
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await page.goto("/");
  await page.getByRole("button", { name: /Notifications/ }).click();
  await expect.poll(() => attempts, { timeout: 15000 }).toBeGreaterThan(1);
  await expect(page.locator(".notification-stream-status")).toHaveText(
    "Live updates",
    { timeout: 15000 },
  );
});

test("notification deep links open the current workspace view", async ({
  page,
}) => {
  test.setTimeout(90000);
  await resetFixtureRateBudget();
  const org = await db.organization.create({
    data: { name: "Notification deep link workspace" },
  });
  organizations.push(org.id);
  const user = await actor(org.id, "OWNER");
  users.push(user.id);
  await db.notification.create({
    data: {
      organizationId: org.id,
      type: "CONTENT_READY",
      category: "CONTENT",
      title: "Open the media library",
      body: "This notification should navigate inside the active workspace.",
      link: `/workspaces/${org.id}/media`,
      eventKey: `content:${randomUUID()}:READY`,
    },
  });
  await page.context().addCookies([
    {
      name: "mos_session",
      value: user.headers.cookie.split("=")[1],
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await page.goto("/");
  await page.getByRole("button", { name: /Notifications/ }).click();
  await page.getByRole("button", { name: /Open the media library/ }).click();
  await expect(
    page.getByRole("heading", { name: "Asset library" }),
  ).toBeVisible();
});
