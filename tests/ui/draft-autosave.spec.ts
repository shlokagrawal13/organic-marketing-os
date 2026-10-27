import { test, expect, Page } from "@playwright/test";
import { db, actor, draft } from "../support/http";
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
  status: "DRAFT" | "APPROVED" = "DRAFT",
  role: "OWNER" | "CLIENT" = "OWNER",
) {
  test.setTimeout(90000);
  await resetFixtureRateBudget();
  const org = await db.organization.create({
    data: { name: "Autosave browser fixture" },
  });
  orgs.push(org.id);
  const user = await actor(org.id, role);
  users.push(user.id);
  const content = await db.contentItem.create({
    data: { ...draft, organizationId: org.id, createdBy: user.id, status },
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
  const open = async () => {
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Content library", exact: true })
      .click();
    const current = await db.contentItem.findUniqueOrThrow({
      where: { id: content.id },
    });
    await page
      .getByRole("button", { name: `Open ${current.title}`, exact: true })
      .click();
    await expect(page.getByLabel("Content title", { exact: true })).toHaveValue(
      current.title,
    );
  };
  await open();
  const read = () =>
    db.contentItem.findUniqueOrThrow({ where: { id: content.id } });
  return { org, user, content, read, open };
}

test("saved draft and scene changes debounce into one revision and survive reload without publication", async ({
  page,
}) => {
  const w = await setup(page);
  const mutations: string[] = [];
  page.on("request", (r) => {
    if (["POST", "PUT", "DELETE"].includes(r.method())) mutations.push(r.url());
  });
  await page
    .getByLabel("Content title", { exact: true })
    .fill("Autosaved storyboard");
  await page.getByRole("combobox", { name: /^Format/ }).selectOption("Video");
  await page.getByRole("button", { name: "Add scene", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Voiceover", exact: true })
    .fill("A saved scene narration");
  await expect(page.getByLabel("Draft save status")).toContainText(
    "All changes saved.",
  );
  const row = await w.read();
  expect(row.revision).toBe(2);
  expect((row.scenes as any[])[0].voiceover).toBe("A saved scene narration");
  expect(mutations).toEqual([
    expect.stringContaining(`/content/${w.content.id}`),
  ]);
  await page.reload();
  await w.open();
  await expect(page.getByLabel("Content title", { exact: true })).toHaveValue(
    "Autosaved storyboard",
  );
  await expect(
    page.getByRole("textbox", { name: "Voiceover", exact: true }),
  ).toHaveValue("A saved scene narration");
  expect((await w.read()).status).toBe("DRAFT");
  await page.screenshot({
    path: "test-results/draft-autosave-desktop.png",
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
    path: "test-results/draft-autosave-mobile.png",
    fullPage: true,
  });
});

test("typing during a delayed real save is retained and serialized against the acknowledged revision", async ({
  page,
}) => {
  const w = await setup(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const revisions: number[] = [];
  await page.route(`**/content/${w.content.id}`, async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    revisions.push(route.request().postDataJSON().revision);
    const response = await route.fetch();
    if (revisions.length === 1) await held;
    await route.fulfill({ response });
  });
  await page
    .getByLabel("Content title", { exact: true })
    .fill("First saved typing");
  await expect.poll(async () => (await w.read()).revision).toBe(2);
  await expect(page.getByLabel("Draft save status")).toContainText(
    "Saving draft",
  );
  await page
    .getByLabel("Content title", { exact: true })
    .fill("Newer typing while saving");
  await expect(
    page.getByRole("button", { name: "Saving…", exact: true }),
  ).toBeDisabled();
  release();
  await expect(page.getByLabel("Content title", { exact: true })).toHaveValue(
    "Newer typing while saving",
  );
  await expect
    .poll(async () => (await w.read()).title)
    .toBe("Newer typing while saving");
  await expect(page.getByLabel("Draft save status")).toContainText(
    "All changes saved.",
  );
  expect(revisions).toEqual([1, 2]);
  expect((await w.read()).revision).toBe(3);
});

test("conflict pauses all retries keeps export and only discards local edits after confirmed reload", async ({
  page,
}) => {
  const w = await setup(page);
  await db.contentItem.update({
    where: { id: w.content.id },
    data: { title: "Another editor saved this", revision: { increment: 1 } },
  });
  let writes = 0;
  page.on("request", (r) => {
    if (r.method() === "PUT") writes++;
  });
  await page
    .getByLabel("Content title", { exact: true })
    .fill("Keep my conflicting local draft");
  await expect(
    page.getByLabel("Draft save status").getByRole("alert"),
  ).toContainText("newer revision");
  await expect(
    page.getByRole("button", { name: "Save draft", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("textbox", { name: "Content / script", exact: true })
    .fill("Further local notes after conflict");
  await page.waitForTimeout(2300);
  expect(writes).toBe(1);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const exported = await download;
  expect(exported.suggestedFilename()).toBe("content-draft.json");
  const chunks: Buffer[] = [];
  for await (const chunk of (await exported.createReadStream())!)
    chunks.push(Buffer.from(chunk));
  const snapshot = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  expect(snapshot.title).toBe("Keep my conflicting local draft");
  expect(snapshot.body).toBe("Further local notes after conflict");
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("button", { name: "Reload latest saved revision" })
    .click();
  await expect(page.getByLabel("Content title", { exact: true })).toHaveValue(
    "Keep my conflicting local draft",
  );
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Reload latest saved revision" })
    .click();
  await expect(page.getByLabel("Content title", { exact: true })).toHaveValue(
    "Another editor saved this",
  );
  await page
    .getByLabel("Content title", { exact: true })
    .fill("Resolved next edit");
  await expect
    .poll(async () => (await w.read()).title)
    .toBe("Resolved next edit");
  expect((await w.read()).revision).toBe(3);
});

test("failed autosave has no retry loop and explicit retry saves retained edits", async ({
  page,
}) => {
  const w = await setup(page);
  let writes = 0;
  await page.route(`**/content/${w.content.id}`, async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    writes++;
    if (writes === 1) return route.abort("failed");
    return route.continue();
  });
  await page
    .getByLabel("Content title", { exact: true })
    .fill("Retained after network error");
  await expect(
    page.getByLabel("Draft save status").getByRole("alert"),
  ).toContainText("local edits are kept");
  await page
    .getByRole("textbox", { name: "Content / script", exact: true })
    .fill("Additional retained copy");
  await page.waitForTimeout(2300);
  expect(writes).toBe(1);
  expect((await w.read()).revision).toBe(1);
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByLabel("Draft save status")).toContainText(
    "All changes saved.",
  );
  expect((await w.read()).title).toBe("Retained after network error");
  expect(writes).toBe(2);
});

test("reviewed content requires explicit save and navigation cancels pending draft autosave", async ({
  page,
}) => {
  const w = await setup(page, "APPROVED");
  await page
    .getByLabel("Content title", { exact: true })
    .fill("Explicit approval-invalidating edit");
  await expect(page.getByLabel("Draft save status")).toContainText(
    "Autosave is off outside Draft",
  );
  await page.waitForTimeout(2300);
  expect((await w.read()).status).toBe("APPROVED");
  expect((await w.read()).revision).toBe(1);
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect.poll(async () => (await w.read()).status).toBe("DRAFT");
  await page
    .getByLabel("Content title", { exact: true })
    .fill("Discard this pending edit");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Back to content", exact: true })
    .click();
  await page.waitForTimeout(2300);
  expect((await w.read()).title).toBe("Explicit approval-invalidating edit");
  await page.getByRole("button", { name: "New draft", exact: true }).click();
  await page
    .getByLabel("Content title", { exact: true })
    .fill("New draft waits for explicit save");
  await page.waitForTimeout(2300);
  expect(
    await db.contentItem.count({ where: { organizationId: w.org.id } }),
  ).toBe(1);
  await expect(page.getByLabel("Draft save status")).toContainText(
    "Save this new draft once",
  );
});

test("read-only members have no automatic write path", async ({ page }) => {
  const w = await setup(page, "DRAFT", "CLIENT");
  await expect(
    page.getByLabel("Content title", { exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Save draft", exact: true }),
  ).toBeDisabled();
  await page.waitForTimeout(2300);
  expect((await w.read()).revision).toBe(1);
});

test("a committed write with a lost response is never replayed automatically or overwritten by explicit retry", async ({
  page,
}) => {
  const w = await setup(page);
  let writes = 0;
  await page.route(`**/content/${w.content.id}`, async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    writes++;
    if (writes === 1) {
      await route.fetch();
      return route.abort("failed");
    }
    return route.continue();
  });
  await page
    .getByLabel("Content title", { exact: true })
    .fill("Committed before response loss");
  await expect(
    page.getByLabel("Draft save status").getByRole("alert"),
  ).toContainText("local edits are kept");
  expect((await w.read()).revision).toBe(2);
  await page
    .getByLabel("Content title", { exact: true })
    .fill("Keep newer local changes");
  await page.waitForTimeout(2300);
  expect(writes).toBe(1);
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByLabel("Draft save status").getByRole("alert"),
  ).toContainText("newer revision");
  expect((await w.read()).title).toBe("Committed before response loss");
  expect((await w.read()).revision).toBe(2);
});

test("a delayed save acknowledgement cannot reopen a discarded editor or schedule another write", async ({
  page,
}) => {
  const w = await setup(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let writes = 0;
  await page.route(`**/content/${w.content.id}`, async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    writes++;
    const response = await route.fetch();
    await held;
    await route.fulfill({ response });
  });
  await page
    .getByLabel("Content title", { exact: true })
    .fill("Acknowledgement comes later");
  await expect.poll(async () => (await w.read()).revision).toBe(2);
  await page
    .getByLabel("Content title", { exact: true })
    .fill("Discard unsent later edits");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Back to content", exact: true })
    .click();
  release();
  await expect(
    page.getByRole("heading", { name: "Content library", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(2300);
  await expect(page.getByLabel("Content title", { exact: true })).toHaveCount(
    0,
  );
  expect((await w.read()).title).toBe("Acknowledgement comes later");
  expect(writes).toBe(1);
});

test("an unconfirmed new-draft creation keeps local edits and blocks duplicate creation", async ({
  page,
}) => {
  const w = await setup(page);
  await page
    .getByRole("button", { name: "Back to content", exact: true })
    .click();
  await page.getByRole("button", { name: "New draft", exact: true }).click();
  let creates = 0;
  await page.route(`**/workspaces/${w.org.id}/content`, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    creates++;
    await route.fetch();
    return route.abort("failed");
  });
  await page
    .getByLabel("Content title", { exact: true })
    .fill("Created but acknowledgement lost");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByLabel("Draft save status").getByRole("alert"),
  ).toContainText("save could not be confirmed");
  await expect(
    page.getByRole("button", { name: "Save draft", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Content title", { exact: true })).toHaveValue(
    "Created but acknowledgement lost",
  );
  await page.waitForTimeout(2300);
  expect(creates).toBe(1);
  expect(
    await db.contentItem.count({ where: { organizationId: w.org.id } }),
  ).toBe(2);
});
