import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sceneSchema } from "../packages/core/ai";
import { renderOptions, dimensions, runProcess } from "../packages/core/media";
import { renderVideo } from "../packages/core/renderer";
import {
  DEFAULT_RENDER_FONT_PATH,
  createRenderFontPlan,
  readRenderFont,
} from "../packages/core/render-font";
import {
  DEVICE_SAFE_TEXT_PLACEMENT,
  renderTextAreas,
} from "../packages/core/render-text-placement";
import { layoutRenderText } from "../packages/core/render-text-layout";
import type { ObjectStore } from "../packages/core/object-store";
const fixture = sceneSchema.parse({
  id: "placement",
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
const fontPath =
  process.env.TEST_DEVANAGARI_FONT_PATH ||
  "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf";
function environment(t: TestContext) {
  const keys = [
    "RENDER_FONT_PATH",
    "RENDER_FONT_FALLBACK_PATHS",
    "RENDER_DEVANAGARI_ENABLED",
  ];
  const old = keys.map((key) => process.env[key]);
  t.after(() =>
    keys.forEach((key, i) => {
      if (old[i] === undefined) delete process.env[key];
      else process.env[key] = old[i];
    }),
  );
  process.env.RENDER_FONT_PATH = DEFAULT_RENDER_FONT_PATH;
  process.env.RENDER_FONT_FALLBACK_PATHS = fontPath;
  process.env.RENDER_DEVANAGARI_ENABLED = "true";
}
test("placement is strict/optional, legacy serialization stays stable and inset overflow fails before media work", async (t) => {
  environment(t);
  assert.equal(
    JSON.stringify(renderOptions.parse({})),
    '{"aspect":"9:16","resolution":"720","captions":true,"musicAssetId":null,"musicVolume":0.12,"background":"#183c2b"}',
  );
  for (const textPlacement of [
    "standard",
    "inset-v2",
    "device-safe-v2",
    "x=0",
    null,
    {},
    42,
  ])
    assert.throws(() => renderOptions.parse({ textPlacement }));
  const options = renderOptions.parse({
    preset: "vertical-social-v1",
    textPlacement: "inset-v1",
  });
  assert.equal(options.textPlacement, "inset-v1");
  assert.equal(options.aspect, "9:16");
  assert.equal(renderTextAreas(renderOptions.parse({}), 720, 1280), undefined);
  const area = renderTextAreas(options, 1080, 1920)!;
  assert.equal(area.title.right, 864);
  assert.ok(Math.abs(area.caption.bottom - 1382.4) < 0.001);
  const safe = renderTextAreas(
    { aspect: "9:16", textPlacement: DEVICE_SAFE_TEXT_PLACEMENT },
    1080,
    1920,
  )!;
  assert.equal(safe.title.left, 172.8);
  assert.equal(safe.title.right, 777.6);
  assert.ok(Math.abs(safe.caption.top - 921.6) < 0.001);
  assert.ok(Math.abs(safe.caption.bottom - 1267.2) < 0.001);
  const text = "W".repeat(300);
  const plan = createRenderFontPlan(
    await readRenderFont(DEFAULT_RENDER_FONT_PATH),
    [{ ...fixture, caption: text }],
    { captions: true },
  );
  assert.throws(
    () =>
      layoutRenderText(
        text,
        "Caption",
        plan,
        720,
        720,
        40,
        renderTextAreas({ aspect: "1:1", textPlacement: "inset-v1" }, 720, 720)!
          .caption,
      ),
    /cannot fit/,
  );
  let work = 0;
  await assert.rejects(
    renderVideo({
      organizationId: "inset-test",
      id: "overflow",
      scenes: [sceneSchema.parse({ ...fixture, caption: text })],
      options: renderOptions.parse({
        aspect: "1:1",
        textPlacement: "inset-v1",
      }),
      assets: [],
      store: new Proxy(
        {},
        {
          get: () => () => {
            work++;
          },
        },
      ) as ObjectStore,
      signal: new AbortController().signal,
      progress: async () => {
        work++;
      },
      cacheGet: async () => {
        work++;
        return null;
      },
      cachePut: async () => {
        work++;
      },
    }),
    /cannot fit/,
  );
  assert.equal(
    work,
    0,
    "valid draft overflow fails before storage/cache/media work",
  );
});
test(
  "decoded inset Latin and mixed Hindi overlays stay inside aspect-specific title/caption boxes",
  { timeout: 120000 },
  async (t) => {
    environment(t);
    const dir = await mkdtemp(join(tmpdir(), "mos-inset-"));
    t.after(() => rm(dir, { recursive: true, force: true }));
    await mkdir(".local/editor01n-frames", { recursive: true });
    const scenes = [
      {
        ...fixture,
        id: "latin",
        onScreenText: "Readable video title with extra margins",
        captionCues: [
          {
            start: 0.3,
            end: 0.8,
            text: "Caption placement with extra margins",
          },
        ],
      },
      {
        ...fixture,
        id: "mixed",
        onScreenText: "Video 2026: किरण क्षत्रिय शिक्षा",
        captionCues: [
          { start: 0.3, end: 0.8, text: "Start now! हिंदी में नई शुरुआत" },
        ],
      },
    ];
    for (const aspect of ["9:16", "16:9", "1:1"] as const)
      for (const resolution of ["720", "1080"] as const) {
        const options = renderOptions.parse({
          aspect,
          resolution,
          textPlacement: "inset-v1",
          background: "#000000",
        });
        const [width, height] = dimensions(options);
        const file = join(dir, "video.mp4");
        await renderVideo({
          organizationId: "inset-test",
          id: "matrix",
          scenes,
          options,
          assets: [],
          store: {
            ready: async () => {},
            putFile: async (key: string, path: string) => {
              if (key.endsWith("/video.mp4"))
                await writeFile(file, await readFile(path));
              if (key.endsWith(".srt"))
                assert.match(
                  await readFile(path, "utf8"),
                  /00:00:01,300 --> 00:00:01,800\nStart now!/,
                );
            },
            remove: async () => {},
          } as unknown as ObjectStore,
          signal: new AbortController().signal,
          progress: async () => {},
          cacheGet: async () => null,
          cachePut: async () => {},
        });
        const [left, right, titleTop, titleBottom, captionTop, captionBottom] =
          aspect === "9:16"
            ? [0.12, 0.8, 0.18, 0.38, 0.52, 0.72]
            : aspect === "16:9"
              ? [0.1, 0.9, 0.14, 0.36, 0.6, 0.82]
              : [0.12, 0.88, 0.16, 0.38, 0.58, 0.8];
        for (const index of [0, 1])
          for (const time of [0.1, 0.5, 0.9]) {
            const raw = join(dir, "frame.gray");
            await runProcess(
              process.env.FFMPEG_PATH || "ffmpeg",
              [
                "-v",
                "error",
                "-y",
                "-ss",
                String(index + time),
                "-i",
                file,
                "-frames:v",
                "1",
                "-pix_fmt",
                "gray",
                "-f",
                "rawvideo",
                raw,
              ],
              { timeout: 15000 },
            );
            const pixels = await readFile(raw);
            assert.equal(pixels.length, width * height);
            let title = 0,
              caption = 0,
              outside = 0;
            for (let y = 0; y < height; y++)
              for (let x = 0; x < width; x++) {
                if (pixels[y * width + x] <= 210) continue;
                if (x < width * left || x > width * right) outside++;
                else if (y >= height * titleTop && y <= height * titleBottom)
                  title++;
                else if (
                  y >= height * captionTop &&
                  y <= height * captionBottom
                )
                  caption++;
                else outside++;
              }
            assert.ok(
              title > 150,
              `${aspect}/${resolution}/${index}: title visible`,
            );
            assert.equal(
              outside,
              0,
              "all bright text inside designated inset boxes",
            );
            if (time === 0.5) assert.ok(caption > 150);
            else assert.equal(caption, 0, "cue hidden outside interval");
          }
        await runProcess(
          process.env.FFMPEG_PATH || "ffmpeg",
          [
            "-v",
            "error",
            "-y",
            "-ss",
            "1.5",
            "-i",
            file,
            "-frames:v",
            "1",
            `.local/editor01n-frames/${aspect.replace(":", "-")}-${resolution}.png`,
          ],
          { timeout: 15000 },
        );
      }
  },
);
test("placement changes rebuild text scenes while empty scenes and unchanged placement reuse cache", async (t) => {
  environment(t);
  const entries = new Map<string, { objectKey: string; bytes: number }>(),
    objects = new Map<string, Buffer>();
  const context = {
    organizationId: "inset-test",
    id: "cache",
    scenes: [
      { ...fixture, id: "text", onScreenText: "Title", caption: "Caption" },
      { ...fixture, id: "empty" },
    ],
    options: renderOptions.parse({ aspect: "1:1" }),
    assets: [],
    store: {
      ready: async () => {},
      putFile: async (key: string, path: string) => {
        objects.set(key, await readFile(path));
      },
      download: async (key: string, path: string) => {
        await writeFile(path, objects.get(key)!);
      },
      remove: async () => {},
    } as unknown as ObjectStore,
    signal: new AbortController().signal,
    progress: async () => {},
    cacheGet: async (key: string) => entries.get(key) || null,
    cachePut: async (
      key: string,
      value: { objectKey: string; bytes: number },
    ) => {
      entries.set(key, value);
    },
  };
  assert.equal((await renderVideo(context)).reusedScenes, 0);
  context.options = renderOptions.parse({
    aspect: "1:1",
    textPlacement: "inset-v1",
  });
  assert.equal((await renderVideo(context)).reusedScenes, 1);
  assert.equal((await renderVideo(context)).reusedScenes, 2);
  context.options = renderOptions.parse({
    aspect: "1:1",
    textPlacement: DEVICE_SAFE_TEXT_PLACEMENT,
  });
  assert.equal((await renderVideo(context)).reusedScenes, 1);
  assert.equal((await renderVideo(context)).reusedScenes, 2);
  context.options = renderOptions.parse({ aspect: "1:1" });
  assert.equal((await renderVideo(context)).reusedScenes, 2);
});
