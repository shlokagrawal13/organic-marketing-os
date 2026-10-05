import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, open, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sceneSchema } from "../packages/core/ai";
import { renderOptions, validateRenderScenes } from "../packages/core/media";
import {
  assertRenderFontCoverage,
  DEFAULT_RENDER_FONT_PATH,
  MAX_RENDER_FONT_BYTES,
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
