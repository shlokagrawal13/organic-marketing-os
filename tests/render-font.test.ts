import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, open, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sceneSchema } from "../packages/core/ai";
import {
  renderOptions,
  runProcess,
  validateRenderScenes,
} from "../packages/core/media";
import {
  assertRenderFontCoverage,
  createRenderFontPlan,
  DEFAULT_RENDER_FONT_PATH,
  MAX_RENDER_FONT_BYTES,
  readRenderFonts,
  readRenderFont,
  RenderFontError,
} from "../packages/core/render-font";
import { renderVideo } from "../packages/core/renderer";
import type { ObjectStore } from "../packages/core/object-store";

const fixture = sceneSchema.parse({
  id: "font-qa",
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
const missingLatin = "\u{1df00}";

test("configured font maps real Latin, Greek, Cyrillic, accents and normalized whitespace", async () => {
  const bytes = await readRenderFont(DEFAULT_RENDER_FONT_PATH);
  const scene = {
    ...fixture,
    onScreenText:
      "Caf\u00e9 \u03b1 \u0416 cre\u0300me\t\n\u00b7 \u00a3 \u20ac \u20b9",
  };
  assert.doesNotThrow(() => validateRenderScenes([scene]));
  assert.doesNotThrow(() =>
    assertRenderFontCoverage(bytes, [scene], { captions: true }),
  );
});

test("font coverage rejects missing glyphs in effective titles/cues, preserving unburned SRT and fallback overrides", async () => {
  const bytes = await readRenderFont(DEFAULT_RENDER_FONT_PATH);
  const scene = { ...fixture, onScreenText: missingLatin };
  assert.doesNotThrow(
    () => validateRenderScenes([scene]),
    "script policy alone cannot guarantee font coverage",
  );
  for (const captions of [false, true]) {
    assert.throws(
      () => assertRenderFontCoverage(bytes, [scene], { captions }),
      /Scene font-qa on-screen text.*U\+1DF00/,
    );
  }
  const caption = { ...fixture, caption: missingLatin };
  assert.throws(
    () => assertRenderFontCoverage(bytes, [caption], { captions: true }),
    /caption cue 1.*U\+1DF00/,
  );
  assert.doesNotThrow(() =>
    assertRenderFontCoverage(bytes, [caption], { captions: false }),
  );
  assert.doesNotThrow(() =>
    assertRenderFontCoverage(
      bytes,
      [{ ...caption, captionCues: [{ start: 0, end: 1, text: "Visible" }] }],
      { captions: true },
    ),
  );
  assert.throws(
    () =>
      assertRenderFontCoverage(
        bytes,
        [
          {
            ...fixture,
            captionCues: [{ start: 0, end: 1, text: missingLatin }],
          },
        ],
        { captions: true },
      ),
    /caption cue 1.*U\+1DF00/,
  );
});

test("configured fallback fonts cover allowed multilingual text missing from the primary font", async () => {
  const primary = await readRenderFont(
    "/usr/share/fonts/opentype/urw-base35/NimbusRoman-Regular.otf",
  );
  const fallback = await readRenderFont(DEFAULT_RENDER_FONT_PATH);
  const scene = { ...fixture, onScreenText: "مرحبا", caption: "שלום" };
  assert.doesNotThrow(() => validateRenderScenes([scene]));
  assert.throws(
    () => assertRenderFontCoverage(primary, [scene], { captions: true }),
    /Scene font-qa on-screen text.*U\+0645/,
  );
  const plan = createRenderFontPlan([primary, fallback], [scene], {
    captions: true,
  });
  assert.equal(plan.selectFontIndex(scene.onScreenText), 1);
  assert.equal(plan.selectFontIndex(scene.caption), 1);
});

test("readRenderFonts loads unique primary and fallback font paths from configuration", async () => {
  const previousPrimary = process.env.RENDER_FONT_PATH;
  const previousFallbacks = process.env.RENDER_FONT_FALLBACK_PATHS;
  process.env.RENDER_FONT_PATH =
    "/usr/share/fonts/opentype/urw-base35/NimbusRoman-Regular.otf";
  process.env.RENDER_FONT_FALLBACK_PATHS = [
    DEFAULT_RENDER_FONT_PATH,
    DEFAULT_RENDER_FONT_PATH,
  ].join(":");
  try {
    const fonts = await readRenderFonts();
    assert.equal(fonts.length, 2);
    assert.ok(fonts[0].length > 12);
    assert.ok(fonts[1].length > 12);
  } finally {
    if (previousPrimary === undefined) delete process.env.RENDER_FONT_PATH;
    else process.env.RENDER_FONT_PATH = previousPrimary;
    if (previousFallbacks === undefined)
      delete process.env.RENDER_FONT_FALLBACK_PATHS;
    else process.env.RENDER_FONT_FALLBACK_PATHS = previousFallbacks;
  }
});

test("font inspection rejects malformed, collection, web, oversized and unreadable files without exposing paths", async () => {
  for (const bytes of [
    Buffer.alloc(0),
    Buffer.from("ttcf-not-a-single-font"),
    Buffer.from("wOFF-not-a-render-font"),
    Buffer.alloc(MAX_RENDER_FONT_BYTES + 1),
  ]) {
    assert.throws(
      () => assertRenderFontCoverage(bytes, [fixture], { captions: true }),
      RenderFontError,
    );
  }
  const broken = Buffer.alloc(12);
  broken.writeUInt32BE(0x00010000);
  broken.writeUInt16BE(1, 4);
  assert.throws(
    () =>
      assertRenderFontCoverage(broken, [{ ...fixture, onScreenText: "A" }], {
        captions: true,
      }),
    /could not be inspected/,
  );
  const dir = await mkdtemp(join(tmpdir(), "mos-font-test-"));
  try {
    await assert.rejects(
      readRenderFont(join(dir, "private-font.ttf")),
      (e: unknown) =>
        e instanceof RenderFontError &&
        !e.message.includes(dir) &&
        /could not be read/.test(e.message),
    );
    const oversized = await open(join(dir, "large.ttf"), "w");
    await oversized.truncate(MAX_RENDER_FONT_BYTES + 1);
    await oversized.close();
    await assert.rejects(
      readRenderFont(join(dir, "large.ttf")),
      /between 12 bytes and 16 MiB/,
    );
    await writeFile(join(dir, "small.ttf"), "tiny");
    await assert.rejects(
      readRenderFont(join(dir, "small.ttf")),
      /between 12 bytes and 16 MiB/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("renderer checks the configured font before storage, cache or media work", async () => {
  const previous = process.env.RENDER_FONT_PATH;
  process.env.RENDER_FONT_PATH = DEFAULT_RENDER_FONT_PATH;
  const unexpected = () => {
    throw new Error("No storage/cache/media work expected");
  };
  try {
    await assert.rejects(
      renderVideo({
        organizationId: "font-test",
        id: "font-job",
        scenes: [{ ...fixture, onScreenText: missingLatin }],
        options: renderOptions.parse({}),
        assets: [],
        signal: new AbortController().signal,
        store: new Proxy({} as ObjectStore, { get: unexpected }),
        progress: async () => unexpected(),
        cacheGet: async () => unexpected(),
        cachePut: async () => unexpected(),
      }),
      /configured render font \(U\+1DF00\)/,
    );
  } finally {
    if (previous === undefined) delete process.env.RENDER_FONT_PATH;
    else process.env.RENDER_FONT_PATH = previous;
  }
});

test("renderer uses explicit text shaping and fallback fonts for readable Arabic and Hebrew text", async () => {
  const previous = process.env.RENDER_FONT_PATH;
  const previousFallbacks = process.env.RENDER_FONT_FALLBACK_PATHS;
  process.env.RENDER_FONT_PATH =
    "/usr/share/fonts/opentype/urw-base35/NimbusRoman-Regular.otf";
  process.env.RENDER_FONT_FALLBACK_PATHS = DEFAULT_RENDER_FONT_PATH;
  const stored: string[] = [];
  let output: Buffer | null = null;
  const dir = await mkdtemp(join(tmpdir(), "mos-font-readable-"));
  try {
    const result = await renderVideo({
      organizationId: "font-test",
      id: "rtl-job",
      scenes: [
        {
          ...fixture,
          onScreenText: "مرحبا بالعالم",
          caption: "שלום עולם",
        },
      ],
      options: renderOptions.parse({ captions: true, resolution: "720" }),
      assets: [],
      signal: new AbortController().signal,
      store: {
        ready: async () => {},
        putFile: async (key: string, path: string) => {
          stored.push(key);
          if (key.endsWith("/video.mp4")) output = await readFile(path);
        },
        remove: async () => {},
      } as unknown as ObjectStore,
      progress: async () => {},
      cacheGet: async () => null,
      cachePut: async () => {},
    });
    assert.equal(result.width, 720);
    assert.equal(result.height, 1280);
    assert.ok(result.outputBytes > 0);
    assert.ok(stored.includes("font-test/renders/rtl-job/video.mp4"));
    assert.ok(stored.includes("font-test/renders/rtl-job/thumbnail.jpg"));
    assert.ok(stored.includes("font-test/renders/rtl-job/captions.srt"));
    assert.ok(stored.some((key) => key.startsWith("font-test/segments/")));
    assert.ok(output);
    const video = join(dir, "rtl.mp4");
    await writeFile(video, output);
    const framePath = join(dir, "rtl.raw");
    await runProcess(
      process.env.FFMPEG_PATH || "ffmpeg",
      [
        "-v",
        "error",
        "-ss",
        "0.5",
        "-i",
        video,
        "-frames:v",
        "1",
        "-vf",
        "crop=720:900:0:80",
        "-pix_fmt",
        "gray",
        "-f",
        "rawvideo",
        framePath,
      ],
      { timeout: 15000 },
    );
    const frame = await readFile(framePath);
    const brightPixels = frame.reduce(
      (count, pixel) => count + (pixel > 210 ? 1 : 0),
      0,
    );
    assert.ok(
      brightPixels > 150,
      `expected readable overlay pixels, got ${brightPixels}`,
    );
  } finally {
    if (previous === undefined) delete process.env.RENDER_FONT_PATH;
    else process.env.RENDER_FONT_PATH = previous;
    if (previousFallbacks === undefined)
      delete process.env.RENDER_FONT_FALLBACK_PATHS;
    else process.env.RENDER_FONT_FALLBACK_PATHS = previousFallbacks;
    await rm(dir, { recursive: true, force: true });
  }
});
