import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, delimiter } from "node:path";
import { createRequire } from "node:module";
import { sceneSchema } from "../packages/core/ai";
import {
  dimensions,
  renderOptions,
  renderTextSupportIssue,
  validateRenderScenes,
  captionSrt,
  runProcess,
  sha256,
} from "../packages/core/media";
import {
  createRenderFontPlan,
  readRenderFont,
  DEFAULT_RENDER_FONT_PATH,
} from "../packages/core/render-font";
import {
  OUTLINE_SCRIPTS,
  outlinePipelineRevision,
} from "../packages/core/render-scripts";
import { layoutRenderText } from "../packages/core/render-text-layout";
import { renderTextAreas } from "../packages/core/render-text-placement";
import { checkRenderShaping } from "../packages/core/render-shaping";
import { glyphOverlaySvg } from "../packages/core/render-glyph-overlay";
import { renderVideo } from "../packages/core/renderer";
import type { ObjectStore } from "../packages/core/object-store";
import { INDIC_BATCH_FIXTURES } from "./fixtures/indic-batch";

const LEGACY_OUTLINE_SCRIPTS = OUTLINE_SCRIPTS.filter(
  (s) => !["hani", "kana", "hang"].includes(s.tag),
);
const fontPathFor = (script: (typeof LEGACY_OUTLINE_SCRIPTS)[number]) =>
  process.env[script.testFontEnvironment] ||
  `/usr/share/fonts/truetype/noto/${script.fontFile}`;
const fixture = sceneSchema.parse({
  id: "indic-batch",
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
function environment(t: TestContext) {
  const values: Record<string, string> = {
    RENDER_HAN_ENABLED: "false",
    RENDER_HIRAGANA_ENABLED: "false",
    RENDER_KATAKANA_ENABLED: "false",
    RENDER_HANGUL_ENABLED: "false",
    ...Object.fromEntries(
      LEGACY_OUTLINE_SCRIPTS.map((script) => [script.environment, "true"]),
    ),
    RENDER_FONT_PATH: DEFAULT_RENDER_FONT_PATH,
    RENDER_FONT_FALLBACK_PATHS:
      LEGACY_OUTLINE_SCRIPTS.map(fontPathFor).join(delimiter),
  };
  const old = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, values);
  t.after(() => {
    for (const [key, value] of Object.entries(old))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  });
}
const getFonts = () =>
  Promise.all(
    [DEFAULT_RENDER_FONT_PATH, ...LEGACY_OUTLINE_SCRIPTS.map(fontPathFor)].map(
      (path) => readRenderFont(path),
    ),
  );
const generatedSinhala = () => {
  const texts: string[] = [];
  for (let c = 0xd9a; c <= 0xdc6; c++)
    if (/\p{Letter}/u.test(String.fromCodePoint(c)))
      for (const vowel of [
        "",
        "ා",
        "ැ",
        "ෑ",
        "ි",
        "ී",
        "ු",
        "ූ",
        "ෘ",
        "ෙ",
        "ේ",
        "ෛ",
        "ො",
        "ෝ",
        "ෞ",
        "්",
      ])
        texts.push(String.fromCodePoint(c) + vowel);
  return texts;
};
for (const sample of INDIC_BATCH_FIXTURES) {
  const script = LEGACY_OUTLINE_SCRIPTS.find(
    (item) => item.name === sample.name,
  )!;
  const fontPath = fontPathFor(script);
  test(`${sample.name}: separate opt-in, effective cues, unchanged SRT and shared RTL/control boundaries`, (t) => {
    environment(t);
    delete process.env[script.environment];
    assert.match(
      renderTextSupportIssue(sample.title)!,
      new RegExp(`${sample.name}.*not enabled`),
    );
    assert.equal(renderTextSupportIssue("हिंदी বাংলা ગુજરાતી"), null);
    process.env[script.environment] = "true";
    assert.equal(
      renderTextSupportIssue(
        sample.title + " Café Ελλάδα Привет हिंदी বাংলা ગુજરાતી",
      ),
      null,
    );
    for (const other of INDIC_BATCH_FIXTURES) {
      if (other.key === sample.key) continue;
      process.env[`RENDER_${other.key}_ENABLED`] = "false";
      assert.equal(renderTextSupportIssue(sample.title), null);
      assert.match(
        renderTextSupportIssue(sample.title + " " + other.title)!,
        new RegExp(`${other.name}.*not enabled`),
      );
      process.env[`RENDER_${other.key}_ENABLED`] = "true";
    }
    for (const rtl of ["שלום", "مرحبا"])
      assert.match(
        renderTextSupportIssue(sample.title + " " + rtl)!,
        /Separate Arabic, Hebrew/,
      );
    assert.match(renderTextSupportIssue(sample.title + " 新品")!, /CJK/);
    assert.equal(renderTextSupportIssue(sample.title + " ไทย"), null);
    assert.match(
      renderTextSupportIssue(sample.title + "\u200d")!,
      /control characters|Sinhala joiner-based conjuncts/,
    );
    assert.match(renderTextSupportIssue(sample.title + " 😀")!, /emoji/);
    const scene = { ...fixture, caption: sample.title + " שלום" };
    assert.throws(
      () => validateRenderScenes([scene], { captions: true }),
      /caption cue 1.*Separate Arabic, Hebrew/,
    );
    assert.doesNotThrow(() =>
      validateRenderScenes([scene], { captions: false }),
    );
    assert.ok(captionSrt([scene]).includes(scene.caption));
    assert.doesNotThrow(() =>
      validateRenderScenes(
        [
          {
            ...scene,
            captionCues: [{ start: 0.3, end: 0.8, text: sample.caption }],
          },
        ],
        { captions: true },
      ),
    );
    assert.doesNotThrow(() =>
      validateRenderScenes(
        [{ ...scene, onScreenText: "مرحبا", caption: sample.caption }],
        { captions: true },
      ),
    );
  });
  test(`${sample.name}: independent HarfBuzz glyph/advance/offset and emitted-outline reference in CJS/ESM`, async (t) => {
    environment(t);
    const texts = [
      ...sample.texts,
      ...(sample.name === "Sinhala" ? generatedSinhala() : []),
    ];
    const bytes = await readRenderFont(fontPath);
    const reference = JSON.parse(
      await runProcess(
        "python3",
        ["tests/fixtures/shaping-reference.py", fontPath, ...texts],
        { timeout: 30000 },
      ),
    );
    assert.equal(reference.engine, "HarfBuzz");
    const { create } = await import("fontkit");
    const faces = [
      create(bytes),
      createRequire(import.meta.url)("fontkit").create(bytes),
    ];
    // Reuse one inspected runtime font across all reference cases. Re-decoding
    // hundreds of identical fonts adds allocations without adding coverage.
    const plan = createRenderFontPlan(
      bytes,
      [{ ...fixture, onScreenText: sample.title }],
      { captions: false },
    );
    for (const face of faces) {
      assert.equal(face.unitsPerEm, reference.unitsPerEm);
      for (const expected of reference.runs) {
        const actual = face.layout(expected.text);
        assert.deepEqual(
          actual.glyphs.map((g: any, i: number) => ({
            id: g.id,
            advance: actual.positions[i].xAdvance,
            xOffset: actual.positions[i].xOffset,
            yOffset: actual.positions[i].yOffset,
          })),
          expected.glyphs,
          expected.text,
        );
        assert.ok(actual.glyphs.every((g: any) => g.id > 0));
        const outlined = plan.shapeText(expected.text, -1);
        let advance = 0;
        assert.equal(outlined.paths.length, expected.glyphs.length);
        for (const [i, glyph] of expected.glyphs.entries()) {
          assert.equal(
            outlined.paths[i].path,
            face.getGlyph(glyph.id).path.toSVG(),
          );
          assert.ok(
            Math.abs(
              outlined.paths[i].x - (advance + glyph.xOffset) / face.unitsPerEm,
            ) < 1e-8,
          );
          assert.ok(
            Math.abs(outlined.paths[i].y - glyph.yOffset / face.unitsPerEm) <
              1e-8,
          );
          advance += glyph.advance;
        }
        assert.ok(
          Math.abs(outlined.advanceWidth - advance / face.unitsPerEm) < 1e-8,
        );
      }
    }
    t.diagnostic(
      `HarfBuzz ${reference.version}: ${sample.texts.length} curated${sample.name === "Sinhala" ? " + 656 generated" : ""} strings, CJS/ESM/outlines matched.`,
    );
  });
  test(`${sample.name}: mixed-font wrapping keeps graphemes complete and missing/truncated fonts fail before storage`, async (t) => {
    environment(t);
    const fonts = await getFonts();
    const text = ("A\u0301" + sample.cluster + "क्षि").repeat(18);
    const plan = createRenderFontPlan(
      fonts,
      [{ ...fixture, onScreenText: text }],
      { captions: false },
    );
    const boundaries = new Set([
      0,
      ...Array.from(
        new Intl.Segmenter("und", { granularity: "grapheme" }).segment(text),
        (item) => item.index + item.segment.length,
      ),
    ]);
    for (const aspect of ["9:16", "16:9", "1:1"] as const) {
      const [width, height] = dimensions(renderOptions.parse({ aspect }));
      const layout = layoutRenderText(
        text,
        `${sample.name} title`,
        plan,
        width,
        height,
        40,
      );
      assert.equal(layout.text.replace(/\n/g, ""), text);
      let consumed = 0;
      for (const line of layout.text.split("\n")) {
        consumed += line.length;
        assert.ok(
          boundaries.has(consumed),
          "wrap at a complete grapheme boundary",
        );
        assert.ok(
          plan.measureText(line, -1).width * layout.fontSize <= width * 0.84,
        );
      }
    }
    const missing = fonts.filter(
      (_, i) => i !== LEGACY_OUTLINE_SCRIPTS.indexOf(script) + 1,
    );
    assert.throws(
      () =>
        createRenderFontPlan(
          missing,
          [{ ...fixture, onScreenText: sample.title }],
          { captions: false },
        ),
      /grapheme.*glyphs missing/,
    );
    const bad = (await readRenderFont(fontPath)).subarray(
      0,
      Math.floor((await readRenderFont(fontPath)).length * 0.8),
    );
    assert.throws(
      () =>
        createRenderFontPlan(
          bad,
          [{ ...fixture, onScreenText: sample.title }],
          { captions: false },
        ),
      /could not be inspected/,
    );
    process.env.RENDER_FONT_FALLBACK_PATHS = "";
    const unexpected = () => {
      throw new Error("Unexpected storage/cache work");
    };
    await assert.rejects(
      renderVideo({
        organizationId: "indic-missing",
        id: sample.key,
        scenes: [{ ...fixture, onScreenText: sample.title }],
        options: renderOptions.parse({}),
        assets: [],
        signal: new AbortController().signal,
        store: new Proxy({} as ObjectStore, { get: unexpected }),
        progress: async () => unexpected(),
        cacheGet: async () => unexpected(),
        cachePut: async () => unexpected(),
      }),
      /grapheme.*glyphs missing/,
    );
  });
  test(`${sample.name}: guarded runtime fingerprint invalidates old Indic outlines and ignores unburned cues`, async (t) => {
    environment(t);
    const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
    const runtime = await runProcess(ffmpeg, ["-version"], { timeout: 15000 }),
      decoders = await runProcess(ffmpeg, ["-decoders"], { timeout: 15000 });
    const current = await checkRenderShaping(
      [{ ...fixture, onScreenText: sample.title }],
      { captions: false },
      ffmpeg,
      new AbortController().signal,
    );
    assert.equal(
      current,
      sha256("fontkit-outlines-v4-joiner-controls\n" + runtime + decoders),
    );
    for (const previous of [
      "fontkit-outlines-v1-gujarati-script-font-runs",
      "fontkit-outlines-v1-bengali-script-font-runs",
      "fontkit-outlines-v3-ltr-script-font-runs",
    ])
      assert.notEqual(current, sha256(previous + "\n" + runtime + decoders));
    assert.equal(
      await checkRenderShaping(
        [{ ...fixture, caption: sample.title }],
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
            ...fixture,
            caption: sample.title,
            captionCues: [{ start: 0, end: 1, text: "Plain override" }],
          },
        ],
        { captions: true },
        "/missing/ffmpeg",
        new AbortController().signal,
      ),
      undefined,
    );
  });
  test(
    `${sample.name}: decoded pure/mixed titles/cues stay bounded and timed across 18 exports and 54 frames`,
    { timeout: 180000 },
    async (t) => {
      environment(t);
      const dir = await mkdtemp(
        join(tmpdir(), `mos-${sample.key.toLowerCase()}-`),
      );
      t.after(() => rm(dir, { recursive: true, force: true }));
      const qaDir = process.env.MOS_INDIC_BATCH_QA_DIR
        ? join(process.env.MOS_INDIC_BATCH_QA_DIR, sample.key.toLowerCase())
        : undefined;
      if (qaDir) await mkdir(qaDir, { recursive: true });
      const titleFor = (mode: string) =>
        mode === "pure"
          ? sample.title
          : "Café Ελλάδα Привет हिंदी বাংলা ગુજરાતી " + sample.title;
      const captionFor = (mode: string) =>
        mode === "pure"
          ? sample.caption
          : "Ελλάδα Привет हिंदी " + sample.caption;
      for (const mode of ["pure", "mixed"])
        for (const textPlacement of (mode === "pure"
          ? [undefined]
          : [undefined, "inset-v1"]) as (undefined | "inset-v1")[])
          for (const aspect of ["9:16", "16:9", "1:1"] as const)
            for (const resolution of ["720", "1080"] as const) {
              const options = renderOptions.parse({
                aspect,
                resolution,
                textPlacement,
                background: "#000000",
              });
              const [width, height] = dimensions(options);
              const name = `${mode}-${textPlacement || "standard"}-${aspect.replace(":", "x")}-${resolution}`;
              const video = join(dir, `${name}.mp4`);
              const scene = {
                ...fixture,
                onScreenText: titleFor(mode),
                captionCues: [{ start: 0.3, end: 0.8, text: captionFor(mode) }],
              };
              await renderVideo({
                organizationId: "indic-batch-qa",
                id: name,
                scenes: [scene],
                options,
                assets: [],
                signal: new AbortController().signal,
                store: {
                  ready: async () => {},
                  putFile: async (key: string, path: string) => {
                    if (key.endsWith("/video.mp4"))
                      await writeFile(video, await readFile(path));
                    if (key.endsWith(".srt"))
                      assert.equal(
                        await readFile(path, "utf8"),
                        captionSrt([scene]),
                      );
                  },
                  remove: async () => {},
                } as unknown as ObjectStore,
                progress: async () => {},
                cacheGet: async () => null,
                cachePut: async () => {},
              });
              const areas = renderTextAreas(options, width, height);
              const bounds = [
                areas?.title || {
                  left: width * 0.06,
                  right: width * 0.94,
                  top: height * 0.09,
                  bottom: height * 0.45,
                },
                areas?.caption || {
                  left: width * 0.06,
                  right: width * 0.94,
                  top: height * 0.59,
                  bottom: height * 0.94,
                },
              ];
              for (const time of [0.1, 0.5, 0.9]) {
                const frame = join(dir, "frame.gray");
                await runProcess(
                  process.env.FFMPEG_PATH || "ffmpeg",
                  [
                    "-v",
                    "error",
                    "-y",
                    "-ss",
                    String(time),
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
                  { timeout: 30000 },
                );
                const pixels = await readFile(frame);
                assert.equal(pixels.length, width * height);
                const counts = [0, 0];
                let outside = 0;
                for (let y = 0; y < height; y++)
                  for (let x = 0; x < width; x++) {
                    if (pixels[y * width + x] <= 210) continue;
                    const band = y < height / 2 ? 0 : 1,
                      b = bounds[band];
                    counts[band]++;
                    if (x < b.left || x > b.right || y < b.top || y > b.bottom)
                      outside++;
                  }
                assert.ok(counts[0] > 150, `${name} ${time}: title missing`);
                if (time === 0.5)
                  assert.ok(counts[1] > 150, `${name}: cue missing`);
                else
                  assert.equal(
                    counts[1],
                    0,
                    `${name} ${time}: cue outside interval`,
                  );
                assert.equal(outside, 0, `${name} ${time}: text outside bands`);
                if (qaDir && time === 0.5)
                  await runProcess(
                    process.env.FFMPEG_PATH || "ffmpeg",
                    [
                      "-v",
                      "error",
                      "-y",
                      "-ss",
                      "0.5",
                      "-i",
                      video,
                      "-frames:v",
                      "1",
                      "-threads",
                      "1",
                      join(qaDir, `${name}.png`),
                    ],
                    { timeout: 30000 },
                  );
              }
            }
    },
  );
}

test("registry: all ten Indic scripts compose independently referenced font/script runs in one overlay", async (t) => {
  environment(t);
  const { create } = await import("fontkit");
  const segments = [
    [DEFAULT_RENDER_FONT_PATH, "Café "],
    [DEFAULT_RENDER_FONT_PATH, "Ελλάδα "],
    [DEFAULT_RENDER_FONT_PATH, "Привет "],
    [fontPathFor(LEGACY_OUTLINE_SCRIPTS[0]), "हिंदी "],
    [fontPathFor(LEGACY_OUTLINE_SCRIPTS[1]), "বাংলা "],
    [fontPathFor(LEGACY_OUTLINE_SCRIPTS[2]), "ગુજરાતી "],
    ...INDIC_BATCH_FIXTURES.map((sample) => [
      fontPathFor(LEGACY_OUTLINE_SCRIPTS.find((s) => s.name === sample.name)!),
      sample.texts[0] + " ",
    ]),
  ];
  const text = segments.map(([, text]) => text).join("");
  const plan = createRenderFontPlan(
    await getFonts(),
    [{ ...fixture, onScreenText: text }],
    { captions: false },
  );
  const outlined = plan.shapeText(text, -1);
  let advance = 0,
    index = 0;
  for (const [path, part] of segments) {
    const face = create(await readRenderFont(path));
    const ref = JSON.parse(
      await runProcess(
        "python3",
        ["tests/fixtures/shaping-reference.py", path, part],
        { timeout: 30000 },
      ),
    );
    for (const glyph of ref.runs[0].glyphs) {
      const actual = outlined.paths[index++];
      assert.equal(actual.path, face.getGlyph(glyph.id).path.toSVG());
      assert.equal(actual.scale, 1 / ref.unitsPerEm);
      assert.ok(
        Math.abs(actual.x - advance - glyph.xOffset / ref.unitsPerEm) < 1e-8,
      );
      assert.ok(Math.abs(actual.y - glyph.yOffset / ref.unitsPerEm) < 1e-8);
      advance += glyph.advance / ref.unitsPerEm;
    }
  }
  assert.equal(index, outlined.paths.length);
  assert.ok(Math.abs(outlined.advanceWidth - advance) < 1e-8);
});
test("registry: every legacy Indic cache revision changes with the shared engine patch while plain overlays keep their path", (t) => {
  environment(t);
  assert.equal(
    outlinePipelineRevision(["हिंदी"]),
    "fontkit-outlines-v4-joiner-controls",
  );
  assert.equal(
    outlinePipelineRevision(["বাংলা"]),
    "fontkit-outlines-v4-joiner-controls",
  );
  assert.equal(
    outlinePipelineRevision(["ગુજરાતી"]),
    "fontkit-outlines-v4-joiner-controls",
  );
  assert.equal(renderTextSupportIssue("Café Ελλάδα Привет مرحبا שלום"), null);
  process.env.RENDER_SINHALA_ENABLED = "true";
  assert.equal(renderTextSupportIssue("ශ්\u200dරී"), null);
  assert.match(
    renderTextSupportIssue("ශ්\u200dරී\u200e")!,
    /control characters/,
  );
});

test("fractional inset caption bounds accept Telugu/Sinhala edge rounding while rejecting real overflow", async (t) => {
  environment(t);
  const fonts = await getFonts();
  for (const [name, aspect, resolution] of [
    ["Telugu", "16:9", "720"],
    ["Sinhala", "9:16", "1080"],
  ] as const) {
    const sample = INDIC_BATCH_FIXTURES.find((s) => s.name === name)!;
    const text = "Ελλάδα Привет हिंदी " + sample.caption;
    const options = renderOptions.parse({
        aspect,
        resolution,
        textPlacement: "inset-v1",
      }),
      [width, height] = dimensions(options);
    const area = renderTextAreas(options, width, height)!.caption;
    const plan = createRenderFontPlan(
      fonts,
      [{ ...fixture, caption: text }],
      options,
    );
    const layout = layoutRenderText(
      text,
      "fractional inset caption",
      plan,
      width,
      height,
      Math.round(Math.min(width, height) / 25),
      area,
    );
    assert.doesNotThrow(() =>
      glyphOverlaySvg(
        layout.text,
        plan,
        layout.fontIndex,
        layout.fontSize,
        width,
        height,
        true,
        area,
      ),
    );
    assert.throws(
      () =>
        glyphOverlaySvg(
          layout.text,
          plan,
          layout.fontIndex,
          layout.fontSize * 20,
          width,
          height,
          true,
          area,
        ),
      /does not fit/,
    );
  }
});
