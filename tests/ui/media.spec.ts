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
  await expect(
    scene.getByRole("combobox", { name: "Camera motion", exact: true }),
  ).toBeDisabled();
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
  await expect(
    scene.getByRole("combobox", { name: "Visual framing", exact: true }),
  ).toHaveValue("contain");
  await scene
    .getByRole("combobox", { name: "Visual framing", exact: true })
    .selectOption("cover");
  await expect(
    scene.getByRole("combobox", { name: "Camera motion", exact: true }),
  ).toHaveValue("static");
  await scene
    .getByRole("combobox", { name: "Camera motion", exact: true })
    .selectOption("slow-zoom");
  await scene
    .getByRole("combobox", { name: "Narration audio", exact: true })
    .selectOption({ label: "tone.wav" });
  await scene
    .getByLabel("On-screen text", { exact: true })
    .fill("Your next idea starts here");
  await scene
    .getByLabel("Caption", { exact: true })
    .fill("Bring your own brand to the story.");
  await scene.getByText("Timed captions (0)", { exact: true }).click();
  await scene
    .getByRole("button", { name: "Add caption cue", exact: true })
    .click();
  const cue = scene.getByRole("group", { name: "Caption cue 1", exact: true });
  await cue.getByLabel("Start (seconds)", { exact: true }).fill("0.25");
  await cue.getByLabel("End (seconds)", { exact: true }).fill("1.75");
  await cue
    .getByLabel("Caption text", { exact: true })
    .fill("Manually timed brand story");
  await expect(scene.getByLabel("Caption", { exact: true })).toBeDisabled();
  await expect(scene.locator(".caption-editor [role=alert]")).toHaveCount(0);
  await scene.getByLabel("Duration (seconds)").fill("1");
  await expect(scene.locator(".caption-editor [role=alert]")).toHaveText(
    "Caption cues must stay within the scene duration.",
  );
  await scene.getByLabel("Duration (seconds)").fill("3");
  await scene
    .getByRole("button", { name: "Add caption cue", exact: true })
    .click();
  await expect(scene.locator(".caption-editor [role=alert]")).toBeVisible();
  await scene
    .getByRole("button", { name: "Remove caption cue 2", exact: true })
    .click();
  await expect(scene.locator(".caption-editor [role=alert]")).toHaveCount(0);
  await page.getByRole("button", { name: "Add scene", exact: true }).click();
  const secondScene = page.locator(".scene-card").nth(1);
  await secondScene
    .getByLabel("Scene purpose", { exact: true })
    .fill("Close with one clear action");
  await secondScene.getByLabel("Duration (seconds)").fill("1");
  await secondScene
    .getByLabel("On-screen text", { exact: true })
    .fill("Start one useful story");
  await page
    .getByRole("button", { name: "Move scene 2 earlier", exact: true })
    .click();
  await expect(
    page.locator(".scene-card").first().getByLabel("Scene purpose"),
  ).toHaveValue("Close with one clear action");
  await page
    .getByRole("button", { name: "Duplicate scene 1", exact: true })
    .click();
  await expect(page.locator(".scene-card")).toHaveCount(3);
  await expect(
    page.locator(".scene-card").nth(1).getByLabel("Scene purpose"),
  ).toHaveValue("Close with one clear action copy");
  await page
    .getByRole("button", { name: "Remove scene 2", exact: true })
    .click();
  await expect(page.locator(".scene-card")).toHaveCount(2);
  await expect(page.locator(".scene-timeline a").first()).toContainText(
    "0:00–0:01",
  );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
  // Reopen the saved record to prove server persistence after reordering.
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Video studio", exact: true })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Content library", exact: true })
    .click();
  await page
    .getByText("A brand story, ready to share", { exact: true })
    .click();
  const savedScene = page.locator(".scene-card").nth(1);
  await expect(
    savedScene.getByRole("combobox", { name: "Camera motion", exact: true }),
  ).toHaveValue("slow-zoom");
  await expect(
    savedScene.getByRole("combobox", { name: "Visual framing", exact: true }),
  ).toHaveValue("cover");
  await savedScene.getByText("Timed captions (1)", { exact: true }).click();
  await expect(
    savedScene.getByLabel("Start (seconds)", { exact: true }),
  ).toHaveValue("0.25");
  await expect(
    savedScene.getByRole("textbox", { name: "Caption text", exact: true }),
  ).toHaveValue("Manually timed brand story");
  await savedScene.locator(".caption-editor").screenshot({
    path: "test-results/timed-caption-editor-desktop.png",
    animations: "disabled",
  });
  const desktopViewport = page.viewportSize()!;
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    savedScene.getByRole("textbox", { name: "Caption text", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await savedScene.locator(".caption-editor").screenshot({
    path: "test-results/timed-caption-editor-mobile.png",
    animations: "disabled",
  });
  await page.setViewportSize(desktopViewport);
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
  const preset = page.getByRole("combobox", {
    name: "Export preset",
    exact: true,
  });
  await expect(preset).toHaveValue("");
  const guides = page.getByRole("figure", {
    name: "Selected export composition",
    exact: true,
  });
  await expect(guides).toContainText("Standard placement");
  await expect(guides.locator("svg")).toHaveAttribute(
    "viewBox",
    "0 0 720 1280",
  );
  await preset.selectOption("vertical-social-v1");
  await expect(guides.locator("svg")).toHaveAttribute(
    "viewBox",
    "0 0 1080 1920",
  );
  const placement = page.getByRole("combobox", {
    name: "Text placement",
    exact: true,
  });
  await expect(placement).toHaveValue("device-safe-v1");
  await expect(guides).toContainText("Device safe");
  await expect(
    page.getByText(/Standard portrait text can be covered/),
  ).toHaveCount(0);
  await expect(page.getByText(/Export size: 1080 × 1920 px/)).toBeVisible();
  await page
    .getByRole("combobox", { name: "Resolution", exact: true })
    .selectOption("720");
  await expect(preset).toHaveValue("");
  await preset.selectOption("landscape-video-v1");
  await expect(guides.locator("svg")).toHaveAttribute(
    "viewBox",
    "0 0 1920 1080",
  );
  await expect(
    page.getByRole("combobox", { name: "Aspect ratio", exact: true }),
  ).toHaveValue("16:9");
  await page
    .getByRole("combobox", { name: "Aspect ratio", exact: true })
    .selectOption("9:16");
  await expect(preset).toHaveValue("");
  await placement.selectOption("");
  await expect(placement).toHaveValue("");
  await expect(
    page.getByText(/Standard portrait text can be covered/),
  ).toBeVisible();
  await preset.selectOption("vertical-social-v1");
  await expect(placement).toHaveValue("device-safe-v1");
  await placement.selectOption("");
  await expect(
    page.getByText(/Standard portrait text can be covered/),
  ).toBeVisible();
  await placement.selectOption("inset-v1");
  await preset.selectOption("vertical-social-v1");
  await expect(placement).toHaveValue("inset-v1");
  await expect(
    page.getByText(/Standard portrait text can be covered/),
  ).toHaveCount(0);
  await expect(guides).toContainText("Extra margins");
  await expect(
    guides.locator('[data-guide-kind="title"] > rect'),
  ).toHaveAttribute("x", "129.6");
  await expect(
    guides.locator('[data-guide-kind="title"] > rect'),
  ).toHaveAttribute("width", "734.4");
  await placement.selectOption("device-safe-v1");
  await expect(
    page.getByText(/Standard portrait text can be covered/),
  ).toHaveCount(0);
  await expect(guides).toContainText("Device safe");
  await expect(
    guides.locator('[data-guide-kind="title"] > rect'),
  ).toHaveAttribute("x", "172.8");
  await expect(
    guides.locator('[data-guide-kind="title"] > rect'),
  ).toHaveAttribute("width", "604.8");
  await placement.selectOption("inset-v1");
  const burnedCaptions = page.getByLabel("Burn scene captions into video");
  await burnedCaptions.uncheck();
  await expect(guides.locator('[data-guide-kind="caption"]')).toHaveCount(0);
  await expect(guides).toContainText("SRT remains available");
  await burnedCaptions.check();
  await expect(guides.locator('[data-guide-kind="caption"]')).toHaveCount(1);
  await preset.selectOption("square-feed-v1");
  await expect(guides.locator("svg")).toHaveAttribute(
    "viewBox",
    "0 0 1080 1080",
  );
  await expect(placement).toHaveValue("inset-v1");
  await expect(
    page.getByRole("combobox", { name: "Resolution", exact: true }),
  ).toHaveValue("1080");
  await expect(page.getByText(/Export size: 1080 × 1080 px/)).toBeVisible();
  const cjkLanguage = page.getByRole("combobox", {
    name: "Chinese, Japanese or Korean language",
    exact: true,
  });
  await expect(cjkLanguage).toHaveValue("");
  await cjkLanguage.selectOption("ja");
  await page.getByRole("button", { name: "Render video", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Download MP4", exact: true }),
  ).toBeVisible({ timeout: 45000 });
  await expect(page.getByText(/Extra margins.*scenes reused/)).toBeVisible();
  await expect(page.getByText(/Japanese.*scenes reused/)).toBeVisible();
  const video = page.getByLabel("Rendered video preview", { exact: true });
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), {
      timeout: 15000,
    })
    .toBeGreaterThanOrEqual(1);
  expect(
    await video.evaluate((v: HTMLVideoElement) => [
      v.videoWidth,
      v.videoHeight,
    ]),
  ).toEqual([1080, 1080]);
  // Composer changes must not relabel or modify the saved render.
  await preset.selectOption("landscape-video-v1");
  await placement.selectOption("");
  await page.getByLabel("Background colour", { exact: true }).fill("#ffffff");
  await burnedCaptions.uncheck();
  await expect(guides.locator("svg > rect")).toHaveAttribute("fill", "#ffffff");
  await expect(guides.locator('[data-guide-kind="caption"]')).toHaveCount(0);
  await expect(guides).toContainText("Standard placement");
  await expect(guides.locator("svg")).toHaveAttribute(
    "viewBox",
    "0 0 1920 1080",
  );
  await page
    .getByText("Saved render composition guides", { exact: true })
    .click();
  const savedGuides = page.getByRole("figure", {
    name: "Saved render composition",
    exact: true,
  });
  await expect(savedGuides).toContainText("Extra margins");
  await expect(savedGuides.locator("svg > rect")).toHaveAttribute(
    "fill",
    "#183c2b",
  );
  await expect(savedGuides.locator('[data-guide-kind="caption"]')).toHaveCount(
    1,
  );
  await expect(savedGuides.locator("svg")).toHaveAttribute(
    "viewBox",
    "0 0 1080 1080",
  );
  await expect(page.locator(".render-history-item").first()).toContainText(
    "Square feed · 1080 × 1080 px",
  );
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
  await expect(page.getByText(/Extra margins.*scenes reused/)).toBeVisible();
  await page
    .getByText("Saved render composition guides", { exact: true })
    .click();
  await expect(savedGuides).toContainText(
    "1:1 · 1080 × 1080 px · Extra margins",
  );
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
  await expect(savedGuides).toBeVisible();
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
