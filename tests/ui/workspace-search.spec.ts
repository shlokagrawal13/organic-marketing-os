import { test, expect, Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { actor, db } from "../support/http";
import { resetFixtureRateBudget } from "../support/fixture-rate-budget";
const orgs: string[] = [],
  users: string[] = [];
test.afterAll(async () => {
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});
async function setup(page: Page) {
  test.setTimeout(90000);
  await resetFixtureRateBudget();
  const org = await db.organization.create({
    data: { name: "Search browser workspace" },
  });
  orgs.push(org.id);
  const user = await actor(org.id);
  users.push(user.id);
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
  const content = await db.contentItem.create({
    data: {
      organizationId: org.id,
      createdBy: user.id,
      title: "Synthetic launch draft",
      body: "Search browser fixture",
      platform: "LinkedIn",
      format: "Text",
    },
  });
  await db.campaign.create({
    data: {
      organizationId: org.id,
      name: "Synthetic launch campaign",
      goal: "Browser fixture",
      audience: "Test audience",
    },
  });
  await db.asset.create({
    data: {
      organizationId: org.id,
      createdBy: user.id,
      name: "Synthetic launch image.png",
      kind: "IMAGE",
      mimeType: "image/png",
      bytes: 3,
      sha256: randomUUID(),
      objectKey: `${org.id}/synthetic-metadata-only.png`,
      tags: ["launch"],
    },
  });
  const open = async () => {
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Workspace search", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Workspace search" }),
    ).toBeVisible();
  };
  const search = async () => {
    await page.getByLabel("Search this workspace").fill("launch");
    await page
      .getByRole("button", { name: "Search workspace", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "3 results shown" }),
    ).toBeVisible();
  };
  return { org, user, content, open, search };
}

async function savedPreparation(w: Awaited<ReturnType<typeof setup>>) {
  return db.publicationIntent.create({
    data: {
      organizationId: w.org.id,
      contentId: w.content.id,
      contentRevision: 1,
      platform: "YouTube",
      createdBy: w.user.id,
      requestKey: randomUUID(),
      requestHash: "synthetic-internal-hash",
      status: "INVALIDATED",
      snapshot: {
        title: "Saved aurora preparation",
        body: "Frozen browser fixture",
      },
    },
  });
}

test("publication search opens the exact frozen preparation without publishing and links to current content", async ({
  page,
}) => {
  const w = await setup(page),
    intent = await savedPreparation(w);
  await db.contentItem.update({
    where: { id: w.content.id },
    data: { title: "Current changed title", revision: 2 },
  });
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() !== "GET" &&
      request.url().includes("/publication-intents")
    )
      mutations.push(request.method());
  });
  await page.goto("/");
  await w.open();
  await page.getByLabel("Search this workspace").fill("aurora");
  await page.getByLabel("Search type").selectOption("publication");
  await page
    .getByRole("button", { name: "Search workspace", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "1 results shown" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Saved aurora preparation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Publication preparation", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Saved aurora preparation",
      exact: true,
    }),
  ).toBeVisible();
  const panel = page.getByRole("region", {
    name: "Publication preparation details",
  });
  await expect(panel).toContainText(intent.id);
  await expect(panel).toContainText("INVALIDATED");
  await expect(panel).toContainText(
    "not evidence of a successful external post",
  );
  await page.screenshot({
    path: "test-results/publication-search-detail.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".sidebar")).not.toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/publication-search-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Back to search results" }).click();
  await expect(page.getByLabel("Search this workspace")).toHaveValue("aurora");
  await expect(page.getByLabel("Search type")).toHaveValue("publication");
  await page
    .getByRole("button", { name: "Saved aurora preparation", exact: true })
    .click();
  await page.getByRole("button", { name: "Open current content" }).click();
  await expect(page.getByLabel("Content title", { exact: true })).toHaveValue(
    "Current changed title",
  );
  expect(mutations).toEqual([]);
  expect(
    await db.publicationAttempt.count({ where: { organizationId: w.org.id } }),
  ).toBe(0);
});

test("delayed publication detail cannot reappear after returning to results or switching workspace", async ({
  page,
}) => {
  const w = await setup(page),
    intent = await savedPreparation(w);
  const other = await db.organization.create({
    data: { name: "Empty publication search workspace" },
  });
  orgs.push(other.id);
  await db.membership.create({
    data: { userId: w.user.id, organizationId: other.id, role: "ANALYST" },
  });
  await page.goto("/");
  await page.getByLabel("Active workspace").selectOption(w.org.id);
  await w.open();
  await page.getByLabel("Search this workspace").fill("aurora");
  await page
    .getByRole("button", { name: "Search workspace", exact: true })
    .click();
  const pattern = `**/api/workspaces/${w.org.id}/publication-intents/${intent.id}`;
  for (const leave of ["back", "workspace"]) {
    let release!: () => void, started!: () => void, finished!: () => void;
    const held = new Promise<void>((r) => {
        release = r;
      }),
      requested = new Promise<void>((r) => {
        started = r;
      }),
      fulfilled = new Promise<void>((r) => {
        finished = r;
      });
    await page.route(pattern, async (route) => {
      const response = await route.fetch();
      started();
      await held;
      await route.fulfill({ response });
      finished();
    });
    try {
      await page
        .getByRole("button", { name: "Saved aurora preparation", exact: true })
        .click();
      await requested;
      await expect(
        page
          .getByRole("status")
          .filter({ hasText: "Loading publication preparation" }),
      ).toBeVisible();
      if (leave === "back")
        await page
          .getByRole("button", { name: "Back to search results" })
          .click();
      else {
        await page.getByLabel("Active workspace").selectOption(other.id);
        await w.open();
      }
      release();
      await fulfilled;
      await page.unroute(pattern);
      await expect(
        page.getByRole("heading", {
          name: "Publication preparation",
          exact: true,
        }),
      ).toHaveCount(0);
      if (leave === "back")
        await expect(page.getByLabel("Search this workspace")).toHaveValue(
          "aurora",
        );
      else {
        await expect(page.getByLabel("Search this workspace")).toHaveValue("");
        await expect(
          page.getByRole("button", {
            name: "Saved aurora preparation",
            exact: true,
          }),
        ).toHaveCount(0);
      }
    } finally {
      release();
    }
  }
});
test("workspace search opens saved content, campaigns and assets and preserves unsaved-change confirmation", async ({
  page,
}) => {
  const w = await setup(page);
  await page.goto("/");
  await w.open();
  await w.search();
  await page.screenshot({
    path: "test-results/workspace-search-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Synthetic launch draft", exact: true })
    .click();
  await expect(page.getByLabel("Content title", { exact: true })).toHaveValue(
    "Synthetic launch draft",
  );
  await page
    .getByLabel("Content title", { exact: true })
    .fill("Unsaved search draft");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Workspace search", exact: true })
    .click();
  await expect(page.getByLabel("Content title", { exact: true })).toHaveValue(
    "Unsaved search draft",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await w.open();
  await w.search();
  await page
    .getByRole("button", { name: "Synthetic launch campaign", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Synthetic launch campaign",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Show all campaigns" }),
  ).toBeVisible();
  await w.open();
  await w.search();
  await page
    .getByRole("button", { name: "Synthetic launch image.png", exact: true })
    .click();
  await expect(page.locator(".asset-card")).toHaveCount(1);
  await expect(page.locator(".asset-card")).toContainText(
    "Synthetic launch image.png",
  );
  await expect(
    page.getByRole("button", { name: "Show all assets" }),
  ).toBeVisible();
  await w.open();
  await page.getByLabel("Search this workspace").fill("unmatchedneedle");
  await page
    .getByRole("button", { name: "Search workspace", exact: true })
    .click();
  await expect(
    page.getByText(
      "No matching records. Try different words or include archived items.",
    ),
  ).toBeVisible();
  await w.search();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".sidebar")).not.toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/workspace-search-mobile.png",
    fullPage: true,
  });
});
test("search ignores delayed responses after workspace switch and recovers from request errors", async ({
  page,
}) => {
  const w = await setup(page);
  const other = await db.organization.create({
    data: { name: "Empty search workspace" },
  });
  orgs.push(other.id);
  await db.membership.create({
    data: { userId: w.user.id, organizationId: other.id, role: "ANALYST" },
  });
  await page.goto("/");
  await page.getByLabel("Active workspace").selectOption(w.org.id);
  await w.open();
  let release!: () => void, started!: () => void, finished!: () => void;
  const fulfilled = new Promise<void>((resolve) => {
    finished = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requested = new Promise<void>((resolve) => {
    started = resolve;
  });
  const pattern = `**/api/workspaces/${w.org.id}/search?*`;
  await page.route(pattern, async (route) => {
    const response = await route.fetch();
    started();
    await held;
    await route.fulfill({ response });
    finished();
  });
  try {
    await page.getByLabel("Search this workspace").fill("launch");
    await page
      .getByRole("button", { name: "Search workspace", exact: true })
      .click();
    await requested;
    await page.getByLabel("Active workspace").selectOption(other.id);
    await w.open();
    release();
    await fulfilled;
    await page.unroute(pattern);
    await expect(page.getByLabel("Search this workspace")).toHaveValue("");
    await expect(
      page.getByText("Synthetic launch draft", { exact: true }),
    ).toHaveCount(0);
    await page.route(`**/api/workspaces/${other.id}/search?*`, (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: { message: "Synthetic search unavailable" },
        }),
      }),
    );
    await page.getByLabel("Search this workspace").fill("launch");
    await page
      .getByRole("button", { name: "Search workspace", exact: true })
      .click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Synthetic search unavailable" }),
    ).toContainText("Synthetic search unavailable");
    await page.unroute(`**/api/workspaces/${other.id}/search?*`);
    await page
      .getByRole("button", { name: "Search workspace", exact: true })
      .click();
    await expect(
      page.getByText(
        "No matching records. Try different words or include archived items.",
      ),
    ).toBeVisible();
  } finally {
    release();
  }
});

test("delayed searched content cannot replace a newer unsaved draft", async ({
  page,
}) => {
  const w = await setup(page);
  await page.goto("/");
  await w.open();
  await w.search();
  let release!: () => void, started!: () => void, finished!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requested = new Promise<void>((resolve) => {
    started = resolve;
  });
  const fulfilled = new Promise<void>((resolve) => {
    finished = resolve;
  });
  const pattern = `**/api/workspaces/${w.org.id}/content/${w.content.id}`;
  await page.route(pattern, async (route) => {
    const response = await route.fetch();
    started();
    await held;
    await route.fulfill({ response });
    finished();
  });
  try {
    await page
      .getByRole("button", { name: "Synthetic launch draft", exact: true })
      .click();
    await requested;
    await page.getByRole("button", { name: "New draft", exact: true }).click();
    await page
      .getByLabel("Content title", { exact: true })
      .fill("Keep my new draft");
    release();
    await fulfilled;
    await page.unroute(pattern);
    await expect(page.getByLabel("Content title", { exact: true })).toHaveValue(
      "Keep my new draft",
    );
    await expect(
      page.getByText("Unsaved changes", { exact: true }),
    ).toBeVisible();
    page.once("dialog", (dialog) => dialog.dismiss());
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Workspace search", exact: true })
      .click();
    await expect(page.getByLabel("Content title", { exact: true })).toHaveValue(
      "Keep my new draft",
    );
  } finally {
    release();
  }
});
