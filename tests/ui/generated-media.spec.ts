import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import "../support/isolated";

test("generate private image and voice, attach one scene, render output and review responsive media history", async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const headers = { "X-Requested-With": "MarketingOS" };
  const signup = await page.request.post("/api/auth/register", {
    headers,
    data: {
      name: "Generation QA",
      email: `generated-ui-${randomUUID()}@example.test`,
      password: "Isolated browser password 123",
    },
  });
  expect(signup.status()).toBe(201);
  const created = await page.request.post("/api/organizations", {
    headers,
    data: { name: "Generated Media QA", timezone: "Asia/Kolkata" },
  });
  const org = await created.json();
  const root = `/api/workspaces/${org.id}`;
  const draft = await page.request.post(`${root}/content`, {
    headers,
    data: {
      title: "Generated brand story",
      platform: "Instagram",
      format: "Video",
      hook: "Build one useful idea",
      body: "A synthetic browser verification story",
      cta: "Learn more",
      scenes: [
        {
          id: "opening",
          purpose: "Introduce the idea",
          duration: 2,
          voiceover: "A test-only spoken line",
          visual: "Generated visual",
          onScreenText: "Synthetic QA story",
          caption: "",
          transition: "Cut",
          music: "",
          sfx: "",
          cta: "",
          visualAssetId: null,
          audioAssetId: null,
        },
      ],
    },
  });
  expect(draft.status()).toBe(201);
  const content = await draft.json();
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Asset library", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Generate with AI", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Generate media", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Describe your media")
    .fill("Browser synthetic product image");
  await page.getByLabel("Target content (optional)").selectOption(content.id);
  await page
    .getByRole("combobox", { name: "Target scene", exact: true })
    .selectOption("opening");
  await page
    .getByLabel("Generation rights note")
    .fill("Synthetic fixture created only for automated testing");
  await page
    .getByLabel("I have the rights and consent needed for this generation.")
    .check();
  await expect(
    page.getByRole("button", { name: "Start generation", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("I accept this estimate and the credit charge shown above.")
    .check();
  await page
    .getByRole("button", { name: "Start generation", exact: true })
    .click();
  const imageJob = page.getByRole("article", {
    name: "Generation: Browser synthetic product image",
    exact: true,
  });
  await expect(imageJob.getByRole("status")).toHaveText("Ready", {
    timeout: 25000,
  });
  await expect
    .poll(() =>
      imageJob
        .getByRole("img")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBe(640);
  await imageJob.getByRole("button", { name: "Attach to saved scene" }).click();
  await expect(imageJob.getByText("Attached at revision 2")).toBeVisible();
  await page.getByLabel("Media to generate").selectOption("voice");
  await page.getByLabel("Narration text").fill("Browser synthetic narration");
  await page
    .getByLabel("I accept this estimate and the credit charge shown above.")
    .check();
  await page
    .getByRole("button", { name: "Start generation", exact: true })
    .click();
  const voiceJob = page.getByRole("article", {
    name: "Generation: Browser synthetic narration",
    exact: true,
  });
  await expect(voiceJob.getByRole("status")).toHaveText("Ready", {
    timeout: 25000,
  });
  await expect(
    voiceJob.getByText("AI-generated voice", { exact: true }),
  ).toBeVisible();
  await voiceJob.getByRole("button", { name: "Attach to saved scene" }).click();
  await expect(voiceJob.getByText("Attached at revision 3")).toBeVisible();
  const current = await (
    await page.request.get(`${root}/content/${content.id}`)
  ).json();
  expect(current.item.scenes[0].visualAssetId).toBeTruthy();
  expect(current.item.scenes[0].audioAssetId).toBeTruthy();
  const render = await page.request.post(`${root}/renders`, {
    headers,
    data: { contentId: content.id, revision: 3, requestKey: randomUUID() },
  });
  expect(render.status()).toBe(201);
  const renderJob = await render.json();
  await expect
    .poll(
      async () =>
        (
          await (
            await page.request.get(`${root}/renders/${renderJob.id}`)
          ).json()
        ).status,
      { timeout: 30000 },
    )
    .toBe("SUCCEEDED");
  const video = await page.request.get(
    `${root}/renders/${renderJob.id}/file/video`,
  );
  expect(video.status()).toBe(200);
  expect((await video.body()).byteLength).toBeGreaterThan(1000);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: "test-results/generated-media-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.screenshot({
    path: "test-results/generated-media-dark.png",
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
    path: "test-results/generated-media-mobile.png",
    fullPage: true,
  });
  // Reload proves history/attachments live on the server, independent of component state.
  await page.reload();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Asset library", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Generate with AI", exact: true })
    .click();
  await expect(page.getByText("Attached at revision 3")).toBeVisible();
  await expect(page.locator(".generated-panel .alert.error")).toHaveCount(0);
});
