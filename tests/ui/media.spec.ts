import { test, expect } from "@playwright/test";
test("inspect workspace pages, upload private media, render and approve a playable video", async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  await page.goto("/");
  await page.getByLabel("Your name").fill("Media QA Owner");
  await page
    .getByLabel("Email address")
    .fill(`media-ui-${Date.now()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("A browser test password 123");
  await page.getByRole("button", { name: "Create your account" }).click();
  await page.getByLabel("Workspace name").fill("Organic Media Studio");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Let’s make your next move, Media." }),
  ).toBeVisible();
  for (const tab of [
    "Brand Brain",
    "Creative DNA",
    "Create with AI",
    "Campaigns",
    "Calendar",
    "Performance",
    "Activity",
  ]) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name: tab, exact: true })
      .click();
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator(".page-loading")).toHaveCount(0);
    await expect(page.locator("main .alert.error")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Connections", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.locator("main h1")).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Asset library", exact: true })
    .click();
  await page
    .getByLabel("Choose media")
    .setInputFiles(".local/media-fixtures/product.png");
  await page.getByLabel("Tags", { exact: true }).fill("product, launch");
  await page
    .getByLabel("Source / rights note")
    .fill("Synthetic image for automated UI testing");
  await page.getByLabel("I have permission to use this media.").check();
  await expect(
    page.getByRole("button", { name: "Upload asset", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Upload asset", exact: true }).click();
  await expect(page.getByText("Asset uploaded and checked.")).toBeVisible({
    timeout: 15000,
  });
  await expect(
    page.getByRole("img", { name: "product.png", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByRole("img", { name: "product.png", exact: true })
        .evaluate((el: HTMLImageElement) => el.naturalWidth),
    )
    .toBe(640);
  await page
    .getByLabel("Choose media")
    .setInputFiles(".local/media-fixtures/tone.wav");
  await page.getByLabel("I have permission to use this media.").check();
  await page.getByRole("button", { name: "Upload asset", exact: true }).click();
  await expect(page.getByRole("heading", { name: "tone.wav" })).toBeVisible({
    timeout: 15000,
  });
  await page.screenshot({
    path: "test-results/asset-library-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Content library", exact: true })
    .click();
  await page.getByRole("button", { name: "New draft", exact: true }).click();
  await page
    .getByLabel("Content title", { exact: true })
    .fill("A brand story, ready to share");
  await page
    .getByRole("combobox", { name: "Format", exact: true })
    .selectOption("Video");
  await page
    .getByLabel("Hook", { exact: true })
    .fill("Make room for your next idea.");
  await page
    .getByLabel("Content / script", { exact: true })
    .fill("One clear message, shaped around your own brand and media.");
  await page
    .getByLabel("Call to action", { exact: true })
    .fill("Start with one useful story.");
  await page.getByRole("button", { name: "Add scene", exact: true }).click();
  const scene = page.locator(".scene-card").first();
  await scene
    .getByLabel("Scene purpose", { exact: true })
    .fill("Introduce the brand");
  await scene.getByLabel("Duration (seconds)").fill("3");
  await scene
    .getByLabel("Voiceover", { exact: true })
    .fill("Your next idea starts here.");
  await scene
    .getByRole("combobox", { name: "Visual asset", exact: true })
    .selectOption({ label: "product.png" });
  await scene
    .getByRole("combobox", { name: "Narration audio", exact: true })
    .selectOption({ label: "tone.wav" });
  await scene
    .getByLabel("On-screen text", { exact: true })
    .fill("Your next idea starts here");
  await scene
    .getByLabel("Caption", { exact: true })
    .fill("Bring your own brand to the story.");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Request review", exact: true })
    .click();
  await page
    .getByLabel(
      "I reviewed the facts, usage rights, brand fit and platform requirements.",
    )
    .check();
  await page.getByRole("button", { name: "Approve this revision" }).click();
  await expect(
    page.getByText("Content approved.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Render video", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Download MP4", exact: true }),
  ).toBeVisible({ timeout: 45000 });
  const video = page.getByLabel("Rendered video preview", { exact: true });
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), {
      timeout: 15000,
    })
    .toBeGreaterThanOrEqual(1);
  await video.evaluate(async (v: HTMLVideoElement) => {
    v.muted = true;
    await v.play();
  });
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThan(0.1);
  await video.evaluate((v: HTMLVideoElement) => v.pause());
  await page
    .getByLabel(
      "I watched this video and checked its visuals, audio, captions and usage rights.",
    )
    .check();
  await page
    .getByRole("button", { name: "Approve rendered video", exact: true })
    .click();
  await expect(
    page.getByText("This rendered video is approved.", { exact: true }),
  ).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download MP4", exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/\.mp4$/);
  await download.saveAs("test-results/browser-render.mp4");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Video studio", exact: true })
    .click();
  await expect(
    page.getByText("This rendered video is approved.", { exact: true }),
  ).toBeVisible();
  await page
    .locator("video.render-player")
    .evaluate(async (v: HTMLVideoElement) => {
      v.muted = true;
      await v.play();
      v.pause();
    });
  await page.screenshot({
    path: "test-results/video-studio-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.screenshot({
    path: "test-results/video-studio-dark.png",
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
    path: "test-results/video-studio-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Asset library", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "product.png" }),
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
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/asset-library-mobile.png",
    fullPage: true,
  });
  // Exercise the real multipart upload through Next's proxy above its 10 MiB default.
  await page
    .getByLabel("Choose media")
    .setInputFiles(".local/media-fixtures/large-audio.wav");
  await page.getByLabel("I have permission to use this media.").check();
  const uploaded = page.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().endsWith("/assets"),
  );
  await page.getByRole("button", { name: "Upload asset", exact: true }).click();
  const result = await uploaded;
  expect(result.status()).toBe(201);
  const body = await result.json();
  expect(body.asset.bytes).toBeGreaterThan(10 * 1024 * 1024);
  await expect(
    page.getByRole("heading", { name: "large-audio.wav" }),
  ).toBeVisible();
});
