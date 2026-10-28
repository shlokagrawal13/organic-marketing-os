import { test, expect, Page } from "@playwright/test";
import { db, actor } from "../support/http";
import { brandInput } from "../../packages/core/brand";
import { resetFixtureRateBudget } from "../support/fixture-rate-budget";
const orgs: string[] = [],
  users: string[] = [];
test.afterAll(async () => {
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});
const seed = (name = "Synthetic knowledge") =>
  brandInput.parse({
    profile: { name },
    creativeDna: { voice: "Original voice" },
    revision: 0,
  });
async function setup(
  page: Page,
  {
    empty = false,
    role = "OWNER",
    history = false,
  }: { empty?: boolean; role?: "OWNER" | "CREATOR"; history?: boolean } = {},
) {
  test.setTimeout(90000);
  await resetFixtureRateBudget();
  const org = await db.organization.create({
    data: { name: "Knowledge browser fixture" },
  });
  orgs.push(org.id);
  const owner = await actor(org.id);
  users.push(owner.id);
  if (!empty) {
    expect(
      (await owner.call(`/workspaces/${org.id}/brand`, "PUT", seed())).status,
    ).toBe(200);
    if (history)
      expect(
        (
          await owner.call(`/workspaces/${org.id}/brand`, "PUT", {
            ...seed(),
            revision: 1,
          })
        ).status,
      ).toBe(200);
  }
  const user = role === "OWNER" ? owner : await actor(org.id, role);
  if (user !== owner) users.push(user.id);
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
  const open = async (name = "Brand Brain") => {
    await page
      .getByRole("navigation")
      .getByRole("button", { name, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Brand save status" }),
    ).toBeVisible();
  };
  await open();
  const read = () =>
    db.brandBrain.findUniqueOrThrow({ where: { organizationId: org.id } });
  await expect(
    page.getByRole("textbox", { name: "Brand name", exact: true }),
  ).toHaveValue(empty ? org.name : "Synthetic knowledge");
  return { org, owner, user, open, read };
}
const panel = (page: Page) =>
  page.getByRole("region", { name: "Brand save status", exact: true });
test("Brand Brain and Creative DNA debounce together into one version and survive reload on desktop and mobile", async ({
  page,
}) => {
  const w = await setup(page);
  const writes: string[] = [];
  page.on("request", (r) => {
    if (["PUT", "POST", "DELETE"].includes(r.method())) writes.push(r.url());
  });
  await page
    .getByRole("textbox", { name: "Brand name", exact: true })
    .fill("Shared saved identity");
  await w.open("Creative DNA");
  await page
    .getByRole("textbox", { name: "Brand voice and tone", exact: true })
    .fill("Warm direct identity");
  await expect(panel(page)).toContainText("All brand changes saved.");
  const row = await w.read();
  expect(row.revision).toBe(2);
  expect((row.profile as any).name).toBe("Shared saved identity");
  expect((row.creativeDna as any).voice).toBe("Warm direct identity");
  expect(writes).toEqual([
    expect.stringContaining(`/workspaces/${w.org.id}/brand`),
  ]);
  await page.reload();
  await w.open();
  await expect(
    page.getByRole("textbox", { name: "Brand name", exact: true }),
  ).toHaveValue("Shared saved identity");
  await w.open("Creative DNA");
  await expect(
    page.getByRole("textbox", { name: "Brand voice and tone", exact: true }),
  ).toHaveValue("Warm direct identity");
  await page.screenshot({
    path: "test-results/knowledge-autosave-desktop.png",
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
    path: "test-results/knowledge-autosave-mobile.png",
    fullPage: true,
  });
});
test("knowledge typing during an acknowledged but delayed write is serialized without discarding either editor", async ({
  page,
}) => {
  const w = await setup(page);
  let release!: () => void;
  const held = new Promise<void>((r) => {
    release = r;
  });
  const revisions: number[] = [];
  await page.route(`**/workspaces/${w.org.id}/brand`, async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    revisions.push(route.request().postDataJSON().revision);
    const response = await route.fetch();
    if (revisions.length === 1) await held;
    await route.fulfill({ response });
  });
  await page
    .getByRole("textbox", { name: "Brand name", exact: true })
    .fill("First acknowledged identity");
  await expect.poll(async () => (await w.read()).revision).toBe(2);
  await w.open("Creative DNA");
  await page
    .getByRole("textbox", { name: "Brand voice and tone", exact: true })
    .fill("New voice during write");
  release();
  await expect(panel(page)).toContainText("All brand changes saved.");
  expect(revisions).toEqual([1, 2]);
  const row = await w.read();
  expect(row.revision).toBe(3);
  expect((row.profile as any).name).toBe("First acknowledged identity");
  expect((row.creativeDna as any).voice).toBe("New voice during write");
});
test("knowledge conflict preserves exact exported edits and blocks restore until confirmed reload", async ({
  page,
}) => {
  const w = await setup(page, { history: true });
  await db.brandBrain.update({
    where: { organizationId: w.org.id },
    data: {
      revision: { increment: 1 },
      profile: { ...seed().profile, name: "Other editor identity" },
    },
  });
  await page
    .getByRole("textbox", { name: "Brand name", exact: true })
    .fill("Keep conflicting identity");
  await expect(panel(page).getByRole("alert")).toContainText("newer revision");
  await expect(
    page.getByRole("button", { name: "Save brand", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Restore revision 1", exact: true }),
  ).toBeDisabled();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export local brand edits" }).click();
  const download = await pending;
  const chunks: Buffer[] = [];
  for await (const chunk of (await download.createReadStream())!)
    chunks.push(Buffer.from(chunk));
  const local = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  expect(local.profile.name).toBe("Keep conflicting identity");
  expect(local.creativeDna.voice).toBe("Original voice");
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("button", { name: "Reload latest brand knowledge" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Brand name", exact: true }),
  ).toHaveValue("Keep conflicting identity");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Reload latest brand knowledge" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Brand name", exact: true }),
  ).toHaveValue("Other editor identity");
  await page
    .getByRole("textbox", { name: "Brand name", exact: true })
    .fill("Resolved identity");
  await expect(panel(page)).toContainText("All brand changes saved.");
  expect((await w.read()).revision).toBe(4);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    `**/workspaces/${w.org.id}/brand/restore/1`,
    async (route) => {
      const response = await route.fetch();
      await held;
      await route.fulfill({ response });
    },
  );
  await page
    .getByRole("button", { name: "Restore revision 1", exact: true })
    .click();
  await expect.poll(async () => (await w.read()).revision).toBe(5);
  await expect(
    page.getByRole("textbox", { name: "Brand name", exact: true }),
  ).toBeDisabled();
  await expect(
    page
      .getByRole("navigation")
      .getByRole("button", { name: "Content library", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("combobox", { name: /Active workspace/ }),
  ).toBeDisabled();
  release();
  await expect(
    page.getByText("Brand version restored.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Brand name", exact: true }),
  ).toHaveValue("Synthetic knowledge");
});
test("failed knowledge writes pause without replay and committed response loss cannot overwrite a newer revision", async ({
  page,
}) => {
  const w = await setup(page);
  let writes = 0;
  await page.route(`**/workspaces/${w.org.id}/brand`, async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    writes++;
    if (writes === 1) return route.abort("failed");
    if (writes === 3) {
      await route.fetch();
      return route.abort("failed");
    }
    return route.continue();
  });
  await page
    .getByRole("textbox", { name: "Brand name", exact: true })
    .fill("Retained failed identity");
  await expect(panel(page).getByRole("alert")).toContainText(
    "local edits are kept",
  );
  await page.waitForTimeout(2300);
  expect(writes).toBe(1);
  expect((await w.read()).revision).toBe(1);
  await page.getByRole("button", { name: "Save brand", exact: true }).click();
  await expect(panel(page)).toContainText("All brand changes saved.");
  await page
    .getByRole("textbox", { name: "Brand name", exact: true })
    .fill("Committed identity with lost receipt");
  await expect(panel(page).getByRole("alert")).toContainText(
    "local edits are kept",
  );
  expect((await w.read()).revision).toBe(3);
  await page.waitForTimeout(2300);
  expect(writes).toBe(3);
  await page.getByRole("button", { name: "Save brand", exact: true }).click();
  await expect(panel(page).getByRole("alert")).toContainText("newer revision");
  expect((await w.read()).revision).toBe(3);
});
test("knowledge navigation confirms discard cancels pending saves and ignores late write acknowledgements", async ({
  page,
}) => {
  const w = await setup(page);
  await page
    .getByRole("textbox", { name: "Brand name", exact: true })
    .fill("Discard pending identity");
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Content library", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Brand Brain", exact: true }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Content library", exact: true })
    .click();
  await page.waitForTimeout(2300);
  expect((await w.read()).revision).toBe(1);
  await w.open();
  let release!: () => void;
  const held = new Promise<void>((r) => {
    release = r;
  });
  await page.route(`**/workspaces/${w.org.id}/brand`, async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    const response = await route.fetch();
    await held;
    await route.fulfill({ response });
  });
  await page
    .getByRole("textbox", { name: "Brand name", exact: true })
    .fill("Write acknowledged after leaving");
  await expect.poll(async () => (await w.read()).revision).toBe(2);
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Content library", exact: true })
    .click();
  release();
  await expect(
    page.getByRole("heading", { name: "Content library", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Brand name", exact: true }),
  ).toHaveCount(0);
  await w.open();
  await expect(
    page.getByRole("textbox", { name: "Brand name", exact: true }),
  ).toHaveValue("Write acknowledged after leaving");
});
test("brand initial creation requires explicit save and uncertain creation cannot be duplicated", async ({
  page,
}) => {
  const w = await setup(page, { empty: true });
  let writes = 0;
  await page.route(`**/workspaces/${w.org.id}/brand`, async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    writes++;
    await route.fetch();
    await route.abort("failed");
  });
  await page
    .getByRole("textbox", { name: "Brand name", exact: true })
    .fill("Explicit first identity");
  await page.waitForTimeout(2300);
  expect(writes).toBe(0);
  await page.getByRole("button", { name: "Save brand", exact: true }).click();
  await expect(panel(page).getByRole("alert")).toContainText(
    "save could not be confirmed",
  );
  await expect(
    page.getByRole("button", { name: "Save brand", exact: true }),
  ).toBeDisabled();
  await page.waitForTimeout(2300);
  expect(writes).toBe(1);
  expect((await w.read()).revision).toBe(1);
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Reload latest brand knowledge" })
    .click();
  await expect(panel(page)).toContainText("Autosave is on");
});
test("content creators retain read-only brand knowledge access without automatic writes", async ({
  page,
}) => {
  const w = await setup(page, { role: "CREATOR" });
  await expect(
    page.getByRole("textbox", { name: "Brand name", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Save brand", exact: true }),
  ).toBeDisabled();
  await w.open("Creative DNA");
  await expect(
    page.getByRole("textbox", { name: "Brand voice and tone", exact: true }),
  ).toBeDisabled();
  await page.waitForTimeout(2300);
  expect((await w.read()).revision).toBe(1);
});
test("late knowledge reads cannot overwrite the currently selected workspace", async ({
  page,
}) => {
  const w = await setup(page);
  const other = await db.organization.create({
    data: { name: "Other knowledge workspace" },
  });
  orgs.push(other.id);
  await db.membership.create({
    data: { organizationId: other.id, userId: w.owner.id, role: "OWNER" },
  });
  expect(
    (
      await w.owner.call(
        `/workspaces/${other.id}/brand`,
        "PUT",
        seed("Other workspace identity"),
      )
    ).status,
  ).toBe(200);
  await page.reload();
  await w.open();
  let release!: () => void;
  const held = new Promise<void>((r) => {
    release = r;
  });
  let intercepted = false;
  await page.route(`**/workspaces/${w.org.id}/brand`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    intercepted = true;
    await held;
    await route.fulfill({ response });
  });
  await page
    .getByRole("button", { name: "Reload latest brand knowledge" })
    .click();
  await expect.poll(() => intercepted).toBe(true);
  await page
    .getByRole("combobox", { name: /Active workspace/ })
    .selectOption(other.id);
  release();
  await w.open();
  await expect(
    page.getByRole("textbox", { name: "Brand name", exact: true }),
  ).toHaveValue("Other workspace identity");
  await expect(
    page.getByText("Synthetic knowledge", { exact: true }),
  ).toHaveCount(0);
});

test("delayed older history cannot replace the history from a newer acknowledged knowledge save", async ({
  page,
}) => {
  const w = await setup(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let historyHeld = false,
    reads = 0;
  await page.route(
    `**/workspaces/${w.org.id}/brand/versions`,
    async (route) => {
      reads++;
      const response = await route.fetch();
      if (reads === 1) {
        expect((await response.json())[0].revision).toBe(2);
        historyHeld = true;
        await held;
      }
      await route.fulfill({ response });
    },
  );
  await page
    .getByRole("textbox", { name: "Brand name", exact: true })
    .fill("First saved history");
  await expect.poll(() => historyHeld).toBe(true);
  await page
    .getByRole("textbox", { name: "Brand name", exact: true })
    .fill("Newer saved history");
  await expect(
    page.locator(".version-row").getByText("Revision 3", { exact: true }),
  ).toBeVisible();
  const late = page.waitForResponse((response) =>
    response.url().endsWith("/brand/versions"),
  );
  release();
  await (await late).finished();
  await page.waitForTimeout(300);
  await expect(
    page.locator(".version-row").getByText("Revision 3", { exact: true }),
  ).toBeVisible();
  expect((await w.read()).revision).toBe(3);
});
