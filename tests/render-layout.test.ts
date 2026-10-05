import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sceneSchema } from "../packages/core/ai";
import { dimensions, renderOptions, runProcess } from "../packages/core/media";
import {
  createRenderFontPlan,
  readRenderFont,
  DEFAULT_RENDER_FONT_PATH,
} from "../packages/core/render-font";
import { layoutRenderText } from "../packages/core/render-text-layout";
import { renderVideo } from "../packages/core/renderer";
import type { ObjectStore } from "../packages/core/object-store";

const fixture = sceneSchema.parse({
  id: "layout-qa",
  purpose: "",
  duration: 1,
  voiceover: "",
  visual: "",
  onScreenText: "",
  caption: "",
  transition: "Cut",
  music: "",
  sfx: "",
  cta: "",
});
const primaryPath = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf";

test("font-aware wrapping bounds wide text and preserves combining graphemes across output geometries", async () => {
  const fonts = [
    await readRenderFont(primaryPath),
    await readRenderFont(DEFAULT_RENDER_FONT_PATH),
  ];
  for (const text of [
    "W".repeat(90),
    "W\u0301".repeat(90),
    "Caf\u00e9 Ελληνικά Кириллица ".repeat(6),
    "مرحبا بالعالم שלום עולם ".repeat(6),
  ]) {
    const plan = createRenderFontPlan(
      fonts,
      [{ ...fixture, onScreenText: text }],
      { captions: true },
    );
    for (const aspect of ["9:16", "16:9", "1:1"] as const) {
      const [width, height] = dimensions(renderOptions.parse({ aspect }));
      const layout = layoutRenderText(
        text,
        "Scene layout-qa on-screen text",
        plan,
        width,
        height,
        Math.round(Math.min(width, height) / 18),
      );
      assert.equal(layout.text.replace(/\s/g, ""), text.replace(/\s/g, ""));
      for (const line of layout.text.split("\n")) {
        assert.ok(
          plan.measureText(line, layout.fontIndex).width * layout.fontSize <=
            width * 0.84,
        );
        assert.doesNotMatch(
          line,
          /^\p{Mark}/u,
          "never detach a combining mark from its base",
        );
      }
      assert.ok(layout.fontSize >= 16);
      if (text.startsWith("مرحبا")) assert.equal(layout.fontIndex, 1);
    }
  }
});

test("overfull captions fail before storage/cache/media work but unburned SRT and cue overrides stay usable", async () => {
  const original = process.env.RENDER_FONT_PATH;
  const originalFallback = process.env.RENDER_FONT_FALLBACK_PATHS;
  process.env.RENDER_FONT_PATH = DEFAULT_RENDER_FONT_PATH;
  delete process.env.RENDER_FONT_FALLBACK_PATHS;
  const scene = { ...fixture, caption: "W".repeat(300) };
  const unexpected = () => {
    throw new Error("Unexpected storage or cache work");
  };
  try {
    const plan = createRenderFontPlan(
      await readRenderFont(DEFAULT_RENDER_FONT_PATH),
      [scene],
      { captions: true },
    );
    assert.throws(
      () =>
        layoutRenderText(
          scene.caption,
          "Scene layout-qa caption cue 1",
          plan,
          720,
          720,
          29,
        ),
      /caption cue 1.*minimum readable font size/,
    );
    await assert.rejects(
      renderVideo({
        organizationId: "layout-test",
        id: "too-long",
        scenes: [scene],
        options: renderOptions.parse({ aspect: "1:1" }),
        assets: [],
        signal: new AbortController().signal,
        store: new Proxy({} as ObjectStore, { get: unexpected }),
        progress: async () => unexpected(),
        cacheGet: async () => unexpected(),
        cachePut: async () => unexpected(),
      }),
      /caption cue 1.*minimum readable font size/,
    );
    for (const [scenes, captions] of [
      [[scene], false],
      [
        [{ ...scene, captionCues: [{ start: 0, end: 1, text: "Short cue" }] }],
        true,
      ],
    ] as const) {
      let srt = "";
      await renderVideo({
        organizationId: "layout-test",
        id: `skip-${captions}`,
        scenes: [...scenes],
        options: renderOptions.parse({ aspect: "1:1", captions }),
        assets: [],
        signal: new AbortController().signal,
        store: {
          ready: async () => {},
          putFile: async (key: string, path: string) => {
            if (key.endsWith(".srt")) srt = await readFile(path, "utf8");
          },
          remove: async () => {},
        } as unknown as ObjectStore,
        progress: async () => {},
        cacheGet: async () => null,
        cachePut: async () => {},
      });
      assert.ok(srt.includes(captions ? "Short cue" : scene.caption));
    }
  } finally {
    if (original === undefined) delete process.env.RENDER_FONT_PATH;
    else process.env.RENDER_FONT_PATH = original;
    if (originalFallback === undefined)
      delete process.env.RENDER_FONT_FALLBACK_PATHS;
    else process.env.RENDER_FONT_FALLBACK_PATHS = originalFallback;
  }
});

test(
  "decoded titles and captions stay in separate bounded bands at 720/1080 in all three aspects",
  { timeout: 180000 },
  async () => {
    const original = process.env.RENDER_FONT_PATH;
    const originalFallback = process.env.RENDER_FONT_FALLBACK_PATHS;
    process.env.RENDER_FONT_PATH = primaryPath;
    process.env.RENDER_FONT_FALLBACK_PATHS = DEFAULT_RENDER_FONT_PATH;
    const dir = await mkdtemp(join(tmpdir(), "mos-layout-"));
    try {
      for (const aspect of ["9:16", "16:9", "1:1"] as const) {
        for (const resolution of ["720", "1080"] as const) {
          const options = renderOptions.parse({
            aspect,
            resolution,
            background: "#000000",
          });
          const [width, height] = dimensions(options);
          const scenes = [
            {
              ...fixture,
              id: "wide",
              onScreenText: "W".repeat(60),
              caption: "W".repeat(80),
            },
            {
              ...fixture,
              id: "mixed",
              onScreenText: "Caf\u00e9 Ελληνικά Кириллица ".repeat(5),
              caption: "W\u0301".repeat(65),
            },
            {
              ...fixture,
              id: "rtl",
              onScreenText: "مرحبا بالعالم ".repeat(8),
              caption: "שלום עולם ".repeat(10),
            },
          ];
          const video = join(dir, "video.mp4");
          await renderVideo({
            organizationId: "layout-test",
            id: "matrix",
            scenes,
            options,
            assets: [],
            signal: new AbortController().signal,
            store: {
              ready: async () => {},
              putFile: async (key: string, path: string) => {
                if (key.endsWith("/video.mp4"))
                  await writeFile(video, await readFile(path));
              },
              remove: async () => {},
            } as unknown as ObjectStore,
            progress: async () => {},
            cacheGet: async () => null,
            cachePut: async () => {},
          });
          for (let index = 0; index < scenes.length; index++) {
            const frame = join(dir, "frame.raw");
            await runProcess(
              process.env.FFMPEG_PATH || "ffmpeg",
              [
                "-v",
                "error",
                "-y",
                "-ss",
                String(index + 0.5),
                "-i",
                video,
                "-frames:v",
                "1",
                "-pix_fmt",
                "gray",
                "-f",
                "rawvideo",
                frame,
              ],
              { timeout: 15000 },
            );
            const pixels = await readFile(frame);
            assert.equal(pixels.length, width * height);
            let title = 0,
              caption = 0,
              outside = 0;
            for (let y = 0; y < height; y++)
              for (let x = 0; x < width; x++) {
                if (pixels[y * width + x] <= 210) continue;
                if (x < width * 0.06 || x >= width * 0.94) outside++;
                if (y >= height * 0.09 && y < height * 0.4) title++;
                else if (y >= height * 0.6 && y < height * 0.93) caption++;
                else outside++;
              }
            const label = `${aspect} ${resolution} ${scenes[index].id}`;
            assert.ok(title > 150, `${label}: title missing`);
            assert.ok(caption > 150, `${label}: caption missing`);
            assert.equal(
              outside,
              0,
              `${label}: text escaped bounded overlay bands`,
            );
            if (process.env.MOS_RENDER_QA_DIR) {
              await mkdir(process.env.MOS_RENDER_QA_DIR, { recursive: true });
              await runProcess(
                process.env.FFMPEG_PATH || "ffmpeg",
                [
                  "-v",
                  "error",
                  "-y",
                  "-ss",
                  String(index + 0.5),
                  "-i",
                  video,
                  "-frames:v",
                  "1",
                  "-threads",
                  "1",
                  join(
                    process.env.MOS_RENDER_QA_DIR,
                    `${aspect.replace(":", "x")}-${resolution}-${scenes[index].id}.png`,
                  ),
                ],
                { timeout: 15000 },
              );
            }
          }
        }
      }
    } finally {
      if (original === undefined) delete process.env.RENDER_FONT_PATH;
      else process.env.RENDER_FONT_PATH = original;
      if (originalFallback === undefined)
        delete process.env.RENDER_FONT_FALLBACK_PATHS;
      else process.env.RENDER_FONT_FALLBACK_PATHS = originalFallback;
      await rm(dir, { recursive: true, force: true });
    }
  },
);
