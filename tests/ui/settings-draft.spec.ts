import { test, expect, Page } from "@playwright/test";
import { db, actor } from "../support/http";
import { resetFixtureRateBudget } from "../support/fixture-rate-budget";
const orgs: string[] = [],
  users: string[] = [];
test.afterAll(async () => {
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});
async function setup(
  page: Page,
  role:
    "OWNER" | "ADMIN" | "EDITOR" | "CREATOR" | "ANALYST" | "CLIENT" = "OWNER",
  open = true,
) {
  test.setTimeout(120000);
  await resetFixtureRateBudget();
  const org = await db.organization.create({
    data: { name: "Settings fixture", timezone: "Asia/Kolkata" },
  });
  orgs.push(org.id);
  const user = await actor(org.id, role);
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
  await page.goto("/");
  const navigate = () =>
    page
      .locator(".sidebar")
      .getByRole("button", { name: "Settings", exact: true })
      .click();
  const panel = page.getByRole("region", {
    name: "Workspace details",
    exact: true,
  });
  if (open) {
    await navigate();
    await expect(panel.getByLabel("Name", { exact: true })).toHaveValue(
      org.name,
    );
  }
  return {
    org,
    user,
    panel,
    navigate,
    endpoint: `**/api/workspaces/${org.id}`,
    read: () => db.organization.findUniqueOrThrow({ where: { id: org.id } }),
  };
}
async function localExport(page: Page) {
  const event = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export local settings", exact: true })
    .click();
  const stream = await (await event).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
async function importLocal(page: Page, contents: unknown) {
  await page.getByLabel("Import local settings JSON").setInputFiles({
    name: "workspace-settings-local.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      typeof contents === "string" ? contents : JSON.stringify(contents),
    ),
  });
}

test("settings drafts protect navigation workspace reload and sign out with exact local export", async ({
  page,
}) => {
  const w = await setup(page);
  const other = await db.organization.create({
    data: { name: "Other settings workspace" },
  });
  orgs.push(other.id);
  await db.membership.create({
    data: { organizationId: other.id, userId: w.user.id, role: "OWNER" },
  });
  await page.reload();
  await w.navigate();
  const mutations: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "PATCH" || /\/auth\/logout(?:-all)?$/.test(r.url()))
      mutations.push(r.url());
  });
  await w.panel
    .getByLabel("Name", { exact: true })
    .fill("Keep these local edits");
  await w.panel.getByLabel("Timezone", { exact: true }).fill("Europe/London");
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("button", { name: "Command center", exact: true })
    .click();
  await expect(w.panel).toBeVisible();
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("combobox", { name: "Active workspace" })
    .selectOption(other.id);
  await expect(
    page.getByRole("combobox", { name: "Active workspace" }),
  ).toHaveValue(w.org.id);
  page.once("dialog", async (d) => {
    expect(d.type()).toBe("beforeunload");
    await d.dismiss();
  });
  await page.reload({ waitUntil: "commit", timeout: 5000 }).catch(() => {});
  await expect(w.panel.getByLabel("Name", { exact: true })).toHaveValue(
    "Keep these local edits",
  );
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("button", { name: "Sign out of all devices", exact: true })
    .click();
  const exported = await localExport(page);
  expect(exported.workspaceId).toBe(w.org.id);
  expect(exported.settings).toEqual({
    name: "Keep these local edits",
    timezone: "Europe/London",
  });
  expect(exported.savedSettings).toEqual({
    name: w.org.name,
    timezone: w.org.timezone,
  });
  expect(mutations).toEqual([]);
  expect((await w.read()).name).toBe(w.org.name);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect(mutations.filter((x) => x.endsWith("/auth/logout"))).toHaveLength(1);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).some((key) =>
        key.startsWith("organic-settings-draft-v1:"),
      ),
    ),
  ).toBe(false);
});

test("manual settings save serializes actual writes and locks navigation until acknowledgement", async ({
  page,
}) => {
  const w = await setup(page, "ADMIN");
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let writes = 0;
  await page.route(w.endpoint, async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    writes++;
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
  });
  try {
    await w.panel
      .getByLabel("Name", { exact: true })
      .fill("Saved settings name");
    await w.panel.getByLabel("Timezone", { exact: true }).fill("Europe/London");
    await w.panel
      .getByRole("button", { name: "Save workspace", exact: true })
      .dblclick();
    await expect
      .poll(async () => (await w.read()).name)
      .toBe("Saved settings name");
    await expect(w.panel.getByLabel("Name", { exact: true })).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Command center", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("combobox", { name: "Active workspace" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", {
        name: "Sign out of all devices",
        exact: true,
      }),
    ).toBeDisabled();
    release();
    await expect(page.getByLabel("Workspace settings status")).toHaveText(
      "Workspace settings saved.",
    );
    expect(writes).toBe(1);
    expect(
      await db.auditLog.count({
        where: { organizationId: w.org.id, action: "workspace.updated" },
      }),
    ).toBe(1);
    await expect(page.locator(".timezone")).toHaveText("Europe/London");
    await expect(
      page
        .getByRole("combobox", { name: "Active workspace" })
        .locator("option:checked"),
    ).toHaveText("Saved settings name");
    await page.screenshot({
      path: "test-results/settings-draft-desktop.png",
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
      path: "test-results/settings-draft-mobile.png",
      fullPage: true,
    });
  } finally {
    release();
  }
});

test("ambiguous committed settings save never replays and failed reload retains exact local edits", async ({
  page,
}) => {
  const w = await setup(page);
  let writes = 0;
  await page.route(w.endpoint, async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    writes++;
    await route.fetch();
    await route.abort("failed");
  });
  await w.panel
    .getByLabel("Name", { exact: true })
    .fill("Unconfirmed local name");
  await w.panel
    .getByRole("button", { name: "Save workspace", exact: true })
    .click();
  await expect(w.panel.getByRole("alert")).toContainText(
    "It may have completed",
  );
  expect((await w.read()).name).toBe("Unconfirmed local name");
  await expect(
    w.panel.getByRole("button", { name: "Save workspace", exact: true }),
  ).toBeDisabled();
  await w.panel
    .getByLabel("Name", { exact: true })
    .fill("Keep newer local typing");
  expect((await localExport(page)).saveUnconfirmed).toBe(true);
  const admin = await actor(w.org.id, "ADMIN");
  users.push(admin.id);
  const laterSave = await admin.call(`/workspaces/${w.org.id}`, "PATCH", {
    name: "Another administrator changed it",
    timezone: w.org.timezone,
    expectedRevision: 1,
  });
  expect(laterSave.status).toBe(200);
  expect(laterSave.body.settingsRevision).toBe(2);
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("button", { name: "Reload settings", exact: true })
    .click();
  await expect(w.panel.getByLabel("Name", { exact: true })).toHaveValue(
    "Keep newer local typing",
  );
  await page.unroute(w.endpoint);
  await page.route(w.endpoint, (route) => route.abort("failed"));
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Reload settings", exact: true })
    .click();
  await expect(w.panel.getByRole("alert")).toContainText(
    "Could not load the latest settings",
  );
  await expect(w.panel.getByLabel("Name", { exact: true })).toHaveValue(
    "Keep newer local typing",
  );
  await expect(
    w.panel.getByRole("button", { name: "Save workspace", exact: true }),
  ).toBeDisabled();
  await page.unroute(w.endpoint);
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Reload settings", exact: true })
    .click();
  await expect(w.panel.getByLabel("Name", { exact: true })).toHaveValue(
    "Another administrator changed it",
  );
  await page.waitForTimeout(2300);
  expect(writes).toBe(1);
  expect(
    await db.auditLog.count({
      where: { organizationId: w.org.id, action: "workspace.updated" },
    }),
  ).toBe(2);
});

test("another administrator's acknowledged save blocks stale settings edits until confirmed reload", async ({
  page,
}) => {
  const w = await setup(page);
  const admin = await actor(w.org.id, "ADMIN");
  users.push(admin.id);
  let writes = 0;
  page.on("request", (request) => {
    if (
      request.method() === "PATCH" &&
      request.url().endsWith(`/workspaces/${w.org.id}`)
    )
      writes++;
  });
  await w.panel.getByLabel("Name", { exact: true }).fill("Keep local proposal");
  const otherSave = await admin.call(`/workspaces/${w.org.id}`, "PATCH", {
    name: "Admin's newer name",
    timezone: "UTC",
    expectedRevision: 0,
  });
  expect(otherSave.status).toBe(200);
  expect(otherSave.body.settingsRevision).toBe(1);
  await w.panel
    .getByRole("button", { name: "Save workspace", exact: true })
    .click();
  await expect(w.panel.getByRole("alert")).toContainText(
    "changed in another session",
  );
  await expect(w.panel.getByLabel("Name", { exact: true })).toHaveValue(
    "Keep local proposal",
  );
  await expect(
    w.panel.getByRole("button", { name: "Save workspace", exact: true }),
  ).toBeDisabled();
  const exported = await localExport(page);
  expect(exported.settings.name).toBe("Keep local proposal");
  expect(exported.savedRevision).toBe(0);
  expect(exported.settingsConflict).toBe(true);
  expect(exported.saveUnconfirmed).toBe(false);
  expect(writes).toBe(1);
  page.once("dialog", (dialog) => dialog.dismiss());
  await w.panel
    .getByRole("button", { name: "Reload settings", exact: true })
    .click();
  await expect(w.panel.getByLabel("Name", { exact: true })).toHaveValue(
    "Keep local proposal",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await w.panel
    .getByRole("button", { name: "Reload settings", exact: true })
    .click();
  await expect(w.panel.getByLabel("Name", { exact: true })).toHaveValue(
    "Admin's newer name",
  );
  await w.panel
    .getByLabel("Name", { exact: true })
    .fill("Reviewed merged name");
  await w.panel
    .getByRole("button", { name: "Save workspace", exact: true })
    .click();
  await expect(page.getByLabel("Workspace settings status")).toHaveText(
    "Workspace settings saved.",
  );
  expect((await w.read()).settingsRevision).toBe(2);
  expect((await w.read()).name).toBe("Reviewed merged name");
  expect(writes).toBe(2);
  expect(
    await db.auditLog.count({
      where: { organizationId: w.org.id, action: "workspace.updated" },
    }),
  ).toBe(2);
});

test("conflict review keeps local edits through read failure and merges selected latest fields before manual save", async ({
  page,
}) => {
  const w = await setup(page);
  const admin = await actor(w.org.id, "ADMIN");
  users.push(admin.id);
  let writes = 0;
  page.on("request", (request) => {
    if (
      request.method() === "PATCH" &&
      request.url().endsWith(`/workspaces/${w.org.id}`)
    )
      writes++;
  });
  await w.panel.getByLabel("Name", { exact: true }).fill("My reviewed name");
  const other = await admin.call(`/workspaces/${w.org.id}`, "PATCH", {
    name: "Admin's name",
    timezone: "Europe/London",
    expectedRevision: 0,
  });
  expect(other.status).toBe(200);
  await w.panel
    .getByRole("button", { name: "Save workspace", exact: true })
    .click();
  await expect(w.panel.getByLabel("Settings conflict review")).toBeVisible();
  expect(writes).toBe(1);
  await page.route(w.endpoint, (route) => {
    if (route.request().method() === "GET") return route.abort("failed");
    return route.continue();
  });
  await w.panel.getByRole("button", { name: "Review latest settings" }).click();
  await expect(w.panel.getByRole("alert")).toContainText(
    "Could not review the latest settings",
  );
  await expect(w.panel.getByLabel("Name", { exact: true })).toHaveValue(
    "My reviewed name",
  );
  await expect(
    w.panel.getByRole("button", { name: "Save workspace", exact: true }),
  ).toBeDisabled();
  await page.unroute(w.endpoint);
  await w.panel.getByRole("button", { name: "Review latest settings" }).click();
  const review = w.panel.getByLabel("Settings conflict review");
  await expect(review).toContainText("latest “Admin's name”");
  await expect(review).toContainText("latest “Europe/London”");
  await expect(review).toContainText("your draft “My reviewed name”");
  const before = await localExport(page);
  expect(before.reviewedLatest.revision).toBe(1);
  expect(before.settings.name).toBe("My reviewed name");
  await review.getByRole("button", { name: "Use latest timezone" }).click();
  await expect(w.panel.getByLabel("Timezone", { exact: true })).toHaveValue(
    "Europe/London",
  );
  expect(writes).toBe(1);
  await review
    .getByRole("button", { name: "Accept reviewed revision" })
    .click();
  await expect(
    w.panel.getByRole("button", { name: "Save workspace", exact: true }),
  ).toBeEnabled();
  expect((await w.read()).name).toBe("Admin's name");
  expect(writes).toBe(1);
  await w.panel
    .getByRole("button", { name: "Save workspace", exact: true })
    .click();
  await expect(w.panel.getByLabel("Workspace settings status")).toHaveText(
    "Workspace settings saved.",
  );
  const saved = await w.read();
  expect(saved.name).toBe("My reviewed name");
  expect(saved.timezone).toBe("Europe/London");
  expect(saved.settingsRevision).toBe(2);
  expect(writes).toBe(2);
  expect(
    await db.auditLog.count({
      where: { organizationId: w.org.id, action: "workspace.updated" },
    }),
  ).toBe(2);
});

test("exported settings draft imports after reload without accepting another workspace or hidden fields", async ({
  page,
}) => {
  const w = await setup(page);
  let writes = 0;
  page.on("request", (request) => {
    if (
      request.method() === "PATCH" &&
      request.url().endsWith(`/workspaces/${w.org.id}`)
    )
      writes++;
  });
  await w.panel
    .getByLabel("Name", { exact: true })
    .fill("Recovered from export");
  const exported = await localExport(page);
  page.once("dialog", (dialog) => dialog.accept());
  await w.panel.getByRole("button", { name: "Reload settings" }).click();
  await expect(w.panel.getByLabel("Name", { exact: true })).toHaveValue(
    w.org.name,
  );
  await importLocal(page, { ...exported, workspaceId: "another-workspace" });
  await expect(w.panel.getByRole("alert")).toContainText("another workspace");
  await expect(w.panel.getByLabel("Name", { exact: true })).toHaveValue(
    w.org.name,
  );
  await importLocal(page, "{broken json");
  await expect(w.panel.getByRole("alert")).toContainText(
    "Invalid settings export",
  );
  await importLocal(page, {
    ...exported,
    settings: { ...exported.settings, expectedRevision: 999, id: "foreign" },
    savedSettings: { ...exported.savedSettings, id: "foreign" },
  });
  await expect(w.panel.getByLabel("Name", { exact: true })).toHaveValue(
    "Recovered from export",
  );
  await expect(w.panel.getByLabel("Workspace settings status")).toHaveText(
    "Unsaved settings changes.",
  );
  expect(writes).toBe(0);
  page.once("dialog", (dialog) => dialog.dismiss());
  await importLocal(page, {
    ...exported,
    settings: { name: "Do not replace", timezone: "UTC" },
  });
  await expect(w.panel.getByLabel("Name", { exact: true })).toHaveValue(
    "Recovered from export",
  );
  await w.panel
    .getByRole("button", { name: "Save workspace", exact: true })
    .click();
  await expect(w.panel.getByLabel("Workspace settings status")).toHaveText(
    "Workspace settings saved.",
  );
  const saved = await w.read();
  expect(saved.name).toBe("Recovered from export");
  expect(saved.settingsRevision).toBe(1);
  expect(writes).toBe(1);
  expect(
    await db.auditLog.count({
      where: { organizationId: w.org.id, action: "workspace.updated" },
    }),
  ).toBe(1);
});

test("stale or unconfirmed settings exports require explicit review and never write on import", async ({
  page,
}) => {
  const w = await setup(page);
  const admin = await actor(w.org.id, "ADMIN");
  users.push(admin.id);
  let writes = 0;
  page.on("request", (request) => {
    if (
      request.method() === "PATCH" &&
      request.url().endsWith(`/workspaces/${w.org.id}`)
    )
      writes++;
  });
  await w.panel.getByLabel("Name", { exact: true }).fill("Recovered proposal");
  const exported = await localExport(page);
  const other = await admin.call(`/workspaces/${w.org.id}`, "PATCH", {
    name: "Server newer name",
    timezone: "Europe/London",
    expectedRevision: 0,
  });
  expect(other.status).toBe(200);
  page.once("dialog", (dialog) => dialog.accept());
  await w.panel.getByRole("button", { name: "Reload settings" }).click();
  await expect(w.panel.getByLabel("Name", { exact: true })).toHaveValue(
    "Server newer name",
  );
  await importLocal(page, exported);
  await expect(w.panel.getByLabel("Name", { exact: true })).toHaveValue(
    "Recovered proposal",
  );
  await expect(
    w.panel.getByRole("button", { name: "Save workspace", exact: true }),
  ).toBeDisabled();
  const review = w.panel.getByLabel("Settings conflict review");
  await expect(review).toContainText("latest “Europe/London”");
  expect(writes).toBe(0);
  await review.getByRole("button", { name: "Use latest timezone" }).click();
  await review
    .getByRole("button", { name: "Accept reviewed revision" })
    .click();
  expect(writes).toBe(0);
  await w.panel
    .getByRole("button", { name: "Save workspace", exact: true })
    .click();
  await expect(w.panel.getByLabel("Workspace settings status")).toHaveText(
    "Workspace settings saved.",
  );
  expect((await w.read()).settingsRevision).toBe(2);
  expect((await w.read()).timezone).toBe("Europe/London");
  const uncertainExport = await localExport(page);
  uncertainExport.settings.name = "Unconfirmed exported proposal";
  uncertainExport.saveUnconfirmed = true;
  await importLocal(page, uncertainExport);
  await expect(
    w.panel.getByRole("button", { name: "Save workspace", exact: true }),
  ).toBeDisabled();
  expect(writes).toBe(1);
  await expect(w.panel.getByLabel("Settings conflict review")).toContainText(
    "revision 2",
  );
  expect(
    await db.auditLog.count({
      where: { organizationId: w.org.id, action: "workspace.updated" },
    }),
  ).toBe(2);
});

test("browser backup survives reload but requires explicit recovery and manual save", async ({
  page,
}) => {
  const w = await setup(page);
  let writes = 0;
  page.on("request", (request) => {
    if (
      request.method() === "PATCH" &&
      request.url().endsWith(`/workspaces/${w.org.id}`)
    )
      writes++;
  });
  await w.panel
    .getByLabel("Name", { exact: true })
    .fill("Crash recovered name");
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage).some((key) =>
          key.startsWith("organic-settings-draft-v1:"),
        ),
      ),
    )
    .toBe(true);
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await w.navigate();
  await expect(w.panel.getByLabel("Name", { exact: true })).toHaveValue(
    w.org.name,
  );
  await expect(
    w.panel.getByLabel("Browser settings draft backup"),
  ).toBeVisible();
  expect(writes).toBe(0);
  await w.panel.getByRole("button", { name: "Recover browser draft" }).click();
  await expect(w.panel.getByLabel("Name", { exact: true })).toHaveValue(
    "Crash recovered name",
  );
  expect(writes).toBe(0);
  await w.panel
    .getByRole("button", { name: "Save workspace", exact: true })
    .click();
  await expect(w.panel.getByLabel("Workspace settings status")).toHaveText(
    "Workspace settings saved.",
  );
  expect((await w.read()).name).toBe("Crash recovered name");
  expect(writes).toBe(1);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage).some((key) =>
          key.startsWith("organic-settings-draft-v1:"),
        ),
      ),
    )
    .toBe(false);
  await w.panel.getByLabel("Name", { exact: true }).fill("Discarded backup");
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage).some((key) =>
          key.startsWith("organic-settings-draft-v1:"),
        ),
      ),
    )
    .toBe(true);
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await w.navigate();
  await w.panel.getByRole("button", { name: "Discard browser draft" }).click();
  await page.reload();
  await w.navigate();
  await expect(w.panel.getByLabel("Browser settings draft backup")).toHaveCount(
    0,
  );
});

test("stale browser backup requires revision review and is scoped to the signed-in user", async ({
  page,
}) => {
  const w = await setup(page);
  const admin = await actor(w.org.id, "ADMIN");
  users.push(admin.id);
  await w.panel.getByLabel("Name", { exact: true }).fill("Offline proposal");
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage).some((key) =>
          key.startsWith("organic-settings-draft-v1:"),
        ),
      ),
    )
    .toBe(true);
  expect(
    (
      await admin.call(`/workspaces/${w.org.id}`, "PATCH", {
        name: "Server newer",
        expectedRevision: 0,
      })
    ).status,
  ).toBe(200);
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await w.navigate();
  await w.panel.getByRole("button", { name: "Recover browser draft" }).click();
  await expect(
    w.panel.getByRole("button", { name: "Save workspace", exact: true }),
  ).toBeDisabled();
  await expect(w.panel.getByLabel("Settings conflict review")).toContainText(
    "Server newer",
  );
  expect((await w.read()).settingsRevision).toBe(1);
  await page.context().addCookies([
    {
      name: "mos_session",
      value: admin.headers.cookie.split("=")[1],
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await w.navigate();
  await expect(w.panel.getByLabel("Browser settings draft backup")).toHaveCount(
    0,
  );
});

test("validation and revoked membership retain settings edits without automatic writes", async ({
  page,
}) => {
  const w = await setup(page);
  let writes = 0;
  page.on("request", (r) => {
    if (r.method() === "PATCH") writes++;
  });
  await w.panel.getByLabel("Timezone", { exact: true }).fill("Not/AZone");
  await w.panel
    .getByRole("button", { name: "Save workspace", exact: true })
    .click();
  await expect(w.panel.getByRole("alert")).toContainText(
    "Settings were not saved",
  );
  expect((await w.read()).timezone).toBe(w.org.timezone);
  await w.panel.getByLabel("Timezone", { exact: true }).fill("Europe/London");
  await w.panel
    .getByRole("button", { name: "Save workspace", exact: true })
    .click();
  await expect(page.getByLabel("Workspace settings status")).toHaveText(
    "Workspace settings saved.",
  );
  await db.membership.deleteMany({
    where: { organizationId: w.org.id, userId: w.user.id },
  });
  await w.panel
    .getByLabel("Name", { exact: true })
    .fill("Revoked edits retained");
  await w.panel
    .getByRole("button", { name: "Save workspace", exact: true })
    .click();
  await expect(w.panel.getByRole("alert")).toContainText(
    "Settings were not saved",
  );
  await expect(w.panel.getByLabel("Name", { exact: true })).toHaveValue(
    "Revoked edits retained",
  );
  await page.waitForTimeout(2300);
  expect(writes).toBe(3);
  expect((await w.read()).name).toBe(w.org.name);
});

test("all four non-admin roles retain read-only workspace settings and server write denial", async ({
  page,
}) => {
  for (const role of ["EDITOR", "CREATOR", "ANALYST", "CLIENT"] as const) {
    const w = await setup(page, role);
    await expect(w.panel.getByLabel("Name", { exact: true })).toBeDisabled();
    await expect(
      w.panel.getByLabel("Timezone", { exact: true }),
    ).toBeDisabled();
    await expect(
      w.panel.getByRole("button", { name: "Save workspace", exact: true }),
    ).toBeDisabled();
    expect(
      (
        await w.user.call(`/workspaces/${w.org.id}`, "PATCH", {
          name: "Forbidden change",
          timezone: "UTC",
        })
      ).status,
    ).toBe(403);
    expect((await w.read()).name).toBe(w.org.name);
  }
});

test("settings initial read failure recovers and reopening always loads current server values", async ({
  page,
}) => {
  const w = await setup(page, "OWNER", false);
  await page.route(w.endpoint, (route) => route.abort("failed"));
  await w.navigate();
  await expect(w.panel.getByRole("alert")).toContainText(
    "Could not load the latest settings",
  );
  await expect(w.panel.getByLabel("Name", { exact: true })).toBeDisabled();
  await page.unroute(w.endpoint);
  await page
    .getByRole("button", { name: "Reload settings", exact: true })
    .click();
  await expect(w.panel.getByLabel("Name", { exact: true })).toHaveValue(
    w.org.name,
  );
  await w.panel
    .getByLabel("Name", { exact: true })
    .fill("Discarded local name");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Command center", exact: true })
    .click();
  await db.organization.update({
    where: { id: w.org.id },
    data: { name: "Fresh server name" },
  });
  await w.navigate();
  await expect(w.panel.getByLabel("Name", { exact: true })).toHaveValue(
    "Fresh server name",
  );
  await expect(
    w.panel.getByLabel("Browser settings draft backup"),
  ).toBeVisible();
  await w.panel.getByRole("button", { name: "Discard browser draft" }).click();
  await w.panel.getByLabel("Name", { exact: true }).fill("Temporary edit");
  await w.panel.getByLabel("Name", { exact: true }).fill("Fresh server name");
  await expect(page.getByLabel("Workspace settings status")).toHaveText(
    "No unsaved settings changes.",
  );
  const dialogs: string[] = [];
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    void d.dismiss();
  });
  await page
    .getByRole("button", { name: "Command center", exact: true })
    .click();
  await expect(w.panel).not.toBeVisible();
  expect(dialogs).toEqual([]);
  page.removeAllListeners("dialog");
  await w.navigate();
  await w.panel
    .getByLabel("Name", { exact: true })
    .fill("Discard on all-device sign-out");
  let release!: () => void;
  const logoutGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/auth/logout-all", async (route) => {
    const response = await route.fetch();
    await logoutGate;
    await route.fulfill({ response });
  });
  try {
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", { name: "Sign out of all devices", exact: true })
      .click();
    await expect(w.panel.getByLabel("Name", { exact: true })).toBeDisabled();
    await expect(
      w.panel.getByRole("button", { name: "Save workspace", exact: true }),
    ).toBeDisabled();
  } finally {
    release();
  }
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect((await w.user.call(`/workspaces/${w.org.id}`)).status).toBe(401);
  expect((await w.read()).name).toBe("Fresh server name");
});
