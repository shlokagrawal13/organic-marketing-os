import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import "../support/isolated";

test("review real saved scene/caption timings, stale revisions, player readiness and render switching", async ({
  page,
}) => {
  test.setTimeout(120000);
  const headers = { "X-Requested-With": "MarketingOS" };
  expect(
    (
      await page.request.post("/api/auth/register", {
        headers,
        data: {
          name: "Review QA",
          email: `review-${randomUUID()}@example.test`,
          password: "Isolated browser password 123",
        },
      })
    ).status(),
  ).toBe(201);
  const org = await (
    await page.request.post("/api/organizations", {
      headers,
      data: { name: "Render Review QA", timezone: "Asia/Kolkata" },
    })
  ).json();
  const root = `/api/workspaces/${org.id}`;
  const scene = (id: string, duration: number) => ({
    id,
    duration,
    purpose: `Saved ${id}`,
    voiceover: "",
    visual: "",
    onScreenText: "",
    caption: "",
    transition: "Cut",
    music: "",
    sfx: "",
    cta: "",
    visualAssetId: null,
    audioAssetId: null,
  });
  const data = {
    title: "Saved review timing",
    platform: "Instagram",
    format: "Video",
    hook: "Review",
    body: "Test-only scene plan",
    cta: "",
    scenes: [
      { ...scene("opening", 2), caption: "Scene-wide fallback" },
      {
        ...scene("closing", 3),
        caption: "Unused fallback",
        captionCues: [{ start: 0.5, end: 1.5, text: "Timed closing caption" }],
      },
      scene("silent", 1),
    ],
  };
  const create = await page.request.post(`${root}/content`, { headers, data });
  expect(create.status()).toBe(201);
  const content = await create.json();
  async function render(captions: boolean) {
    const response = await page.request.post(`${root}/renders`, {
      headers,
      data: {
        contentId: content.id,
        revision: 1,
        requestKey: randomUUID(),
        options: { captions },
      },
    });
    expect(response.status()).toBe(201);
    const job = await response.json();
    await expect
      .poll(
        async () =>
          (await (await page.request.get(`${root}/renders/${job.id}`)).json())
            .status,
        { timeout: 45000 },
      )
      .toBe("SUCCEEDED");
    return job;
  }
  const burned = await render(true);
  const srtOnly = await render(false);
  // The source changes duration/order after both exports. Review keeps their snapshot.
  expect(
    (
      await page.request.put(`${root}/content/${content.id}`, {
        headers,
        data: {
          ...data,
          revision: 1,
          scenes: [
            { ...scene("closing", 8), purpose: "Changed draft scene" },
            scene("opening", 1),
          ],
        },
      })
    ).status(),
  ).toBe(200);
  let releaseMetadata!: () => void;
  const metadataGate = new Promise<void>((resolve) => {
    releaseMetadata = resolve;
  });
  await page.route(`**/renders/${srtOnly.id}/file/video`, async (route) => {
    await metadataGate;
    await route.continue();
  });
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Video studio", exact: true })
    .click();
  const review = page.getByRole("region", { name: "Saved render navigation" });
  const first = review.getByRole("button", {
    name: "Jump to scene 1",
    exact: true,
  });
  const second = review.getByRole("button", {
    name: "Jump to scene 2",
    exact: true,
  });
  const timed = review.getByRole("button", {
    name: "Jump to scene 2 caption 1",
    exact: true,
  });
  const video = page.getByLabel("Rendered video preview", { exact: true });
  await expect(first).toBeDisabled();
  await expect(review.getByRole("status")).toHaveText("Loading video timings…");
  releaseMetadata();
  await expect(first).toBeEnabled();
  await page.unroute(`**/renders/${srtOnly.id}/file/video`);
  await expect(
    page.getByText("Content changed after this render.", { exact: false }),
  ).toBeVisible();
  await expect(first).toContainText("Saved opening");
  await expect(second).toContainText("0:02–0:05");
  await expect(timed).toContainText("0:02.500–0:03.500");
  await expect(review).toContainText("Captions are in the SRT only");
  await expect(review).not.toContainText("Unused fallback");
  await expect(review).not.toContainText("Changed draft scene");
  await expect(
    review.getByRole("button", {
      name: "Jump to scene 3 caption 1",
      exact: true,
    }),
  ).toHaveCount(0);
  async function position(expected: number) {
    await expect
      .poll(() =>
        video.evaluate(
          (v: HTMLVideoElement, target: number) =>
            Math.abs(v.currentTime - target),
          expected,
        ),
      )
      .toBeLessThan(0.04);
  }
  await second.click();
  await position(2);
  expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  await expect(second).toHaveAttribute("aria-current", "true");
  await expect(timed).not.toHaveAttribute("aria-current", "true");
  // Keyboard activation seeks the cue, then native seeking respects its half-open end.
  await timed.focus();
  await page.keyboard.press("Enter");
  await position(2.5);
  await expect(timed).toHaveAttribute("aria-current", "true");
  await video.evaluate((v: HTMLVideoElement) => {
    v.currentTime = 3.5;
  });
  await expect(timed).not.toHaveAttribute("aria-current", "true");
  await review
    .getByRole("button", { name: "Jump to scene 1 caption 1", exact: true })
    .click();
  await position(0);
  await video.evaluate(async (v: HTMLVideoElement) => {
    v.muted = true;
    await v.play();
  });
  await second.click();
  expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(false);
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThan(2.1);
  await video.evaluate((v: HTMLVideoElement) => {
    v.pause();
    v.currentTime = v.duration;
  });
  await expect(review.locator('[aria-current="true"]')).toHaveCount(0);
  await page.locator(".render-history-item").nth(1).click();
  await expect(video).toHaveAttribute(
    "src",
    `${root}/renders/${burned.id}/file/video`,
  );
  await expect(first).toBeEnabled();
  await position(0);
  await expect(review).not.toContainText("Captions are in the SRT only");
  await timed.click();
  await position(2.5);
  await review.screenshot({ path: "test-results/render-review-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await second.click();
  await position(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await review.screenshot({ path: "test-results/render-review-mobile.png" });
  // Failed media loading must leave all navigation disabled.
  await page.route(`**/renders/${srtOnly.id}/file/video`, (route) =>
    route.abort(),
  );
  await page.locator(".render-history-item").first().click();
  await expect(review.getByRole("alert")).toContainText("Video could not load");
  await expect(first).toBeDisabled();
  await expect(timed).toBeDisabled();
});
