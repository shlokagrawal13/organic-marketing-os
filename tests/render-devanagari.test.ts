import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sceneSchema } from "../packages/core/ai";
import {
  renderTextSupportIssue,
  validateRenderScenes,
  runProcess,
  dimensions,
  renderOptions,
} from "../packages/core/media";
import {
  DEFAULT_RENDER_FONT_PATH,
  createRenderFontPlan,
  readRenderFont,
} from "../packages/core/render-font";
import {
  validateDevanagariRuntime,
  checkRenderShaping,
} from "../packages/core/render-shaping";
import { layoutRenderText } from "../packages/core/render-text-layout";
import { glyphOverlaySvg } from "../packages/core/render-glyph-overlay";
import { renderVideo } from "../packages/core/renderer";
import type { ObjectStore } from "../packages/core/object-store";

const fontPath =
  process.env.TEST_DEVANAGARI_FONT_PATH ||
  "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf";
const fixture = sceneSchema.parse({
  id: "hindi-qa",
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
function environment(
  t: TestContext,
  values: Record<string, string | undefined>,
) {
  const original = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );
  const apply = (env: Record<string, string | undefined>) => {
    for (const [key, value] of Object.entries(env))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  };
  apply(values);
  t.after(() => apply(original));
}
const supportedBuild =
  " V....D librsvg              Librsvg rasterizer (codec svg)\n";

test("Devanagari is opt-in, unsupported scripts/controls stay blocked and ignored captions need no shaping runtime", async (t) => {
  environment(t, { RENDER_DEVANAGARI_ENABLED: "false", RENDER_BENGALI_ENABLED: "false" });
  assert.match(
    renderTextSupportIssue("हिंदी में वीडियो")!,
    /Devanagari.*not enabled/,
  );
  process.env.RENDER_DEVANAGARI_ENABLED = "true";
  for (const text of [
    "हिंदी में वीडियो",
    "किरण क्षत्रिय शिक्षा प्रशिक्षण श्रद्धा ऋतु कार्यक्षेत्र",
    "Video 2026: हिंदी में नई शुरुआत।",
  ])
    assert.equal(renderTextSupportIssue(text), null);
  assert.match(renderTextSupportIssue("নমস্কার")!, /Bengali/);
  assert.match(renderTextSupportIssue("新品上市")!, /CJK/);
  assert.match(renderTextSupportIssue("क्\u200dष")!, /control characters/);
  const unburned = { ...fixture, caption: "हिंदी में वीडियो" };
  validateRenderScenes([unburned], { captions: false });
  assert.equal(
    await checkRenderShaping(
      [unburned],
      { captions: false },
      "/missing/ffmpeg",
      new AbortController().signal,
    ),
    undefined,
  );
  assert.equal(
    await checkRenderShaping(
      [
        {
          ...unburned,
          captionCues: [{ start: 0, end: 1, text: "Latin override" }],
        },
      ],
      { captions: true },
      "/missing/ffmpeg",
      new AbortController().signal,
    ),
    undefined,
  );
});

test("Devanagari runtime guard rejects legacy/missing shaping before fonts, storage or cache work", async (t) => {
  validateDevanagariRuntime(supportedBuild);
  for (const version of [
    "ffmpeg version 6.1.1",
    supportedBuild.replace("librsvg", "svg-other"),
    "unknown",
  ])
    assert.throws(
      () => validateDevanagariRuntime(version),
      /librsvg SVG decoder/,
    );
  const dir = await mkdtemp(join(tmpdir(), "mos-hindi-runtime-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const binary = join(dir, "legacy-ffmpeg");
  await writeFile(
    binary,
    "#!/bin/sh\nprintf 'ffmpeg version 5.1.7\\nconfiguration: --enable-libfreetype --enable-libfribidi\\n'\n",
    { mode: 0o700 },
  );
  environment(t, {
    RENDER_DEVANAGARI_ENABLED: "true",
    FFMPEG_PATH: binary,
    RENDER_FONT_PATH: "/unreadable/font.ttf",
  });
  const unexpected = () => {
    throw new Error("Unexpected storage/cache work");
  };
  await assert.rejects(
    renderVideo({
      organizationId: "hindi-test",
      id: "legacy",
      scenes: [{ ...fixture, onScreenText: "हिंदी" }],
      options: renderOptions.parse({}),
      assets: [],
      store: new Proxy({} as ObjectStore, { get: unexpected }),
      signal: new AbortController().signal,
      progress: async () => unexpected(),
      cacheGet: async () => unexpected(),
      cachePut: async () => unexpected(),
    }),
    /Devanagari or Bengali rendering requires FFmpeg with the librsvg SVG decoder/,
  );
});

test("Devanagari font fallback keeps conjunct graphemes intact and missing coverage fails safely while Latin/Devanagari font runs compose", async (t) => {
  environment(t, {
    RENDER_DEVANAGARI_ENABLED: "true",
    RENDER_FONT_PATH: DEFAULT_RENDER_FONT_PATH,
    RENDER_FONT_FALLBACK_PATHS: undefined,
  });
  const unexpected = () => {
    throw new Error("Unexpected storage/cache work");
  };
  await assert.rejects(
    renderVideo({
      organizationId: "hindi-test",
      id: "missing-font",
      scenes: [{ ...fixture, onScreenText: "हिंदी" }],
      options: renderOptions.parse({}),
      assets: [],
      store: new Proxy({} as ObjectStore, { get: unexpected }),
      signal: new AbortController().signal,
      progress: async () => unexpected(),
      cacheGet: async () => unexpected(),
      cachePut: async () => unexpected(),
    }),
    /glyphs missing from the configured render font/,
  );
  const text = "क्षि".repeat(45);
  const plan = createRenderFontPlan(
    [
      await readRenderFont(DEFAULT_RENDER_FONT_PATH),
      await readRenderFont(fontPath),
    ],
    [{ ...fixture, onScreenText: text }],
    { captions: false },
  );
  assert.equal(plan.selectFontIndex(text), -1);
  for (const aspect of ["9:16", "16:9", "1:1"] as const) {
    const [width, height] = dimensions(renderOptions.parse({ aspect }));
    const layout = layoutRenderText(
      text,
      "Hindi conjunct title",
      plan,
      width,
      height,
      40,
    );
    assert.equal(layout.text.replace(/\n/g, ""), text);
    for (const line of layout.text.split("\n")) {
      assert.match(
        line,
        /^(क्षि)+$/u,
        "wrap only between complete conjunct clusters",
      );
      assert.ok(
        plan.measureText(line, 1).width * layout.fontSize <= width * 0.84,
      );
    }
  }
  const mixed = "Video 2026: हिंदी में नई शुरुआत।";
  const mixedPlan = createRenderFontPlan(
    plan.fonts,
    [{ ...fixture, onScreenText: mixed }],
    { captions: false },
  );
  assert.equal(mixedPlan.selectFontIndex(mixed), -1);
  assert.ok(
    mixedPlan
      .shapeText(mixed, -1)
      .paths.some((glyph) => glyph.scale === 1 / 2048),
  );
  assert.ok(
    mixedPlan
      .shapeText(mixed, -1)
      .paths.some((glyph) => glyph.scale === 1 / 1000),
  );
  assert.throws(
    () =>
      createRenderFontPlan(
        plan.fonts,
        [{ ...fixture, onScreenText: "हिंदी שלום" }],
        { captions: false },
      ),
    /Devanagari or Bengali with Latin/,
  );
});

test(
  "decoded Hindi and mixed Latin title/caption frames are bounded and timed across all six output geometries",
  { timeout: 120000 },
  async (t) => {
    environment(t, {
      RENDER_DEVANAGARI_ENABLED: "true",
      RENDER_FONT_PATH: DEFAULT_RENDER_FONT_PATH,
      RENDER_FONT_FALLBACK_PATHS: fontPath,
    });
    const dir = await mkdtemp(join(tmpdir(), "mos-hindi-frame-"));
    t.after(() => rm(dir, { recursive: true, force: true }));
    await mkdir(".local/editor01m-frames", { recursive: true });
    for (const mixed of [false, true]) {
      const title =
        (mixed ? "Video 2026: " : "") +
        "किरण क्षत्रिय शिक्षा प्रशिक्षण श्रद्धा ऋतु कार्यक्षेत्र";
      const caption =
        "हिंदी में वीडियो नई शुरुआत और बेहतर योजना।" +
        (mixed ? " Start now!" : "");
      for (const aspect of ["9:16", "16:9", "1:1"] as const)
        for (const resolution of ["720", "1080"] as const) {
          const options = renderOptions.parse({
            aspect,
            resolution,
            captions: true,
            background: "#000000",
          });
          const [width, height] = dimensions(options);
          const name = `${mixed ? "mixed" : "hindi"}-${aspect.replace(":", "-")}-${resolution}`;
          const file = join(dir, `${name}.mp4`);
          const keys: string[] = [];
          await renderVideo({
            organizationId: "hindi-test",
            id: name,
            scenes: [
              {
                ...fixture,
                onScreenText: title,
                captionCues: [{ start: 0.3, end: 0.8, text: caption }],
              },
            ],
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
                    /00:00:00,300 --> 00:00:00,800\nहिंदी/,
                  );
              },
              remove: async () => {},
            } as unknown as ObjectStore,
            signal: new AbortController().signal,
            progress: async () => {},
            cacheGet: async (key) => {
              keys.push(key);
              return null;
            },
            cachePut: async () => {},
          });
          assert.equal(keys.length, 1);
          for (const time of [0.1, 0.5, 0.9]) {
            const raw = join(dir, "frame.rgb");
            await runProcess(
              process.env.FFMPEG_PATH || "ffmpeg",
              [
                "-v",
                "error",
                "-y",
                "-ss",
                String(time),
                "-i",
                file,
                "-frames:v",
                "1",
                "-pix_fmt",
                "rgb24",
                "-f",
                "rawvideo",
                raw,
              ],
              { timeout: 30000 },
            );
            const pixels = await readFile(raw);
            assert.equal(pixels.length, width * height * 3);
            const bands = [
              { count: 0, left: width, right: 0, top: height, bottom: 0 },
              { count: 0, left: width, right: 0, top: height, bottom: 0 },
            ];
            for (let y = 0; y < height; y++)
              for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 3;
                if (
                  pixels[i] > 180 &&
                  pixels[i + 1] > 180 &&
                  pixels[i + 2] > 180
                ) {
                  const b = bands[y < height / 2 ? 0 : 1];
                  b.count++;
                  b.left = Math.min(b.left, x);
                  b.right = Math.max(b.right, x);
                  b.top = Math.min(b.top, y);
                  b.bottom = Math.max(b.bottom, y);
                }
              }
            assert.ok(bands[0].count > 100, `${name}: Hindi title visible`);
            assert.ok(
              bands[0].left >= width * 0.075 && bands[0].right <= width * 0.925,
            );
            assert.ok(
              bands[0].top >= height * 0.09 && bands[0].bottom < height * 0.45,
            );
            if (time === 0.5) {
              assert.ok(
                bands[1].count > 100,
                `${name}: Hindi cue visible in interval`,
              );
              assert.ok(
                bands[1].left >= width * 0.075 &&
                  bands[1].right <= width * 0.925,
              );
              assert.ok(
                bands[1].top >= height * 0.59 &&
                  bands[1].bottom <= height * 0.94,
              );
              await runProcess(
                process.env.FFMPEG_PATH || "ffmpeg",
                [
                  "-v",
                  "error",
                  "-y",
                  "-ss",
                  "0.5",
                  "-i",
                  file,
                  "-frames:v",
                  "1",
                  `.local/editor01m-frames/${name}.png`,
                ],
                { timeout: 30000 },
              );
            } else
              assert.equal(
                bands[1].count,
                0,
                `${name}: cue hidden outside its interval`,
              );
          }
        }
    }
  },
);

test("Hindi outlines apply conjunct substitution and never embed user text as SVG markup", async () => {
  const font = await readRenderFont(fontPath);
  const text = "क्षि <>";
  const plan = createRenderFontPlan(
    font,
    [{ ...fixture, onScreenText: text }],
    { captions: false },
  );
  const run = plan.shapeText("क्षि", 0);
  assert.ok(
    run.paths.length < [..."क्षि"].length,
    "conjunct uses substituted glyphs",
  );
  const svg = glyphOverlaySvg(text, plan, 0, 40, 720, 1280, false);
  assert.match(svg, /<path d=/);
  assert.doesNotMatch(svg, /क्षि|<text|<image|href=|<>&|NaN|Infinity/);
  assert.throws(
    () => glyphOverlaySvg(text, plan, 0, 4000, 720, 1280, false),
    /does not fit/,
  );
});

test("mixed-script wrapping preserves complete Latin combining and Hindi conjunct clusters", async () => {
  const text = "A\u0301क्षि".repeat(35);
  const plan = createRenderFontPlan(
    [
      await readRenderFont(DEFAULT_RENDER_FONT_PATH),
      await readRenderFont(fontPath),
    ],
    [{ ...fixture, onScreenText: text }],
    { captions: false },
  );
  for (const aspect of ["9:16", "16:9", "1:1"] as const) {
    const [width, height] = dimensions(renderOptions.parse({ aspect }));
    const layout = layoutRenderText(
      text,
      "mixed title",
      plan,
      width,
      height,
      40,
    );
    assert.equal(layout.text.replace(/\n/g, ""), text);
    for (const line of layout.text.split("\n")) {
      assert.match(line, /^(?:A\u0301|क्षि)+$/u);
      assert.ok(
        plan.measureText(line, -1).width * layout.fontSize <= width * 0.84,
      );
    }
  }
  assert.throws(
    () =>
      createRenderFontPlan(
        plan.fonts,
        [{ ...fixture, onScreenText: "Video क\u0301" }],
        { captions: false },
      ),
    /grapheme.*glyphs missing/,
  );
});

test("mixed overlay reuses valid scene cache and changing configured fonts rebuilds it", async (t) => {
  environment(t, {
    RENDER_DEVANAGARI_ENABLED: "true",
    RENDER_FONT_PATH: DEFAULT_RENDER_FONT_PATH,
    RENDER_FONT_FALLBACK_PATHS: fontPath,
  });
  const entries = new Map<string, { objectKey: string; bytes: number }>();
  const objects = new Map<string, Buffer>();
  const context = {
    organizationId: "mixed-test",
    id: "cache",
    scenes: [{ ...fixture, onScreenText: "Video 2026: नई शुरुआत" }],
    options: renderOptions.parse({
      resolution: "720",
      aspect: "1:1",
      captions: false,
    }),
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
      entry: { objectKey: string; bytes: number },
    ) => {
      entries.set(key, entry);
    },
  };
  assert.equal((await renderVideo(context)).reusedScenes, 0);
  assert.equal((await renderVideo(context)).reusedScenes, 1);
  process.env.RENDER_FONT_PATH =
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf";
  assert.equal((await renderVideo(context)).reusedScenes, 0);
  assert.equal(entries.size, 2);
});
