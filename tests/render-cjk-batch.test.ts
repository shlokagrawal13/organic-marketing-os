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
  MAX_RENDER_FONT_BYTES,
} from "../packages/core/render-font";
import {
  OUTLINE_SCRIPTS,
  outlinePipelineRevision,
} from "../packages/core/render-scripts";
import {
  CJK_LANGUAGES,
  CJK_ENVIRONMENTS,
  cjkLanguageTag,
  isCjkTag,
} from "../packages/core/render-cjk";
import {
  layoutRenderText,
  renderLineBreakUnits,
} from "../packages/core/render-text-layout";
import { renderTextAreas } from "../packages/core/render-text-placement";
import { checkRenderShaping } from "../packages/core/render-shaping";
import { glyphOverlaySvg } from "../packages/core/render-glyph-overlay";
import { renderVideo } from "../packages/core/renderer";
import type { ObjectStore } from "../packages/core/object-store";
import {
  CJK_BATCH_FIXTURES,
  cjkFontPath,
  cjkTexts,
  cjkOptions,
  type CjkFixture,
} from "./fixtures/cjk-batch";

const fixture = sceneSchema.parse({
  id: "cjk-batch",
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
const legacy = OUTLINE_SCRIPTS.filter((s) => !isCjkTag(s.tag));
const legacyPath = (s: (typeof OUTLINE_SCRIPTS)[number]) =>
  process.env[s.testFontEnvironment] ||
  "/usr/share/fonts/truetype/noto/" + s.fontFile;
function environment(t: TestContext, sample: CjkFixture) {
  const values: Record<string, string> = {
    ...Object.fromEntries(OUTLINE_SCRIPTS.map((s) => [s.environment, "true"])),
    RENDER_FONT_PATH: cjkFontPath(sample.key),
    RENDER_FONT_FALLBACK_PATHS: [
      DEFAULT_RENDER_FONT_PATH,
      ...legacy.map(legacyPath),
    ].join(delimiter),
    TEST_HB_LANGUAGE: sample.language,
    TEST_HB_SCRIPT: sample.tag,
  };
  const old = Object.fromEntries(
    Object.keys(values).map((k) => [k, process.env[k]]),
  );
  Object.assign(process.env, values);
  t.after(() => {
    for (const [k, v] of Object.entries(old))
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
  });
}
const getFonts = () =>
  Promise.all(
    [
      ...new Set([
        process.env.RENDER_FONT_PATH!,
        DEFAULT_RENDER_FONT_PATH,
        ...legacy.map(legacyPath),
      ]),
    ].map((p) => readRenderFont(p)),
  );
async function references(path: string, texts: string[]) {
  const result = { engine: "", version: "", unitsPerEm: 0, runs: [] as any[] };
  for (let i = 0; i < texts.length; i += 100) {
    const r = JSON.parse(
      await runProcess(
        "python3",
        [
          "tests/fixtures/shaping-reference.py",
          path,
          ...texts.slice(i, i + 100),
        ],
        { timeout: 30000 },
      ),
    );
    assert.equal(r.engine, "HarfBuzz");
    if (i) {
      assert.equal(r.version, result.version);
      assert.equal(r.unitsPerEm, result.unitsPerEm);
    }
    Object.assign(result, {
      engine: r.engine,
      version: r.version,
      unitsPerEm: r.unitsPerEm,
    });
    result.runs.push(...r.runs);
  }
  return result;
}
for (const sample of CJK_BATCH_FIXTURES) {
  test(
    sample.name +
      ": explicit saved locale, independent CJK opt-ins, effective cues and preserved Unicode SRT",
    (t) => {
      environment(t, sample);
      assert.equal(
        renderTextSupportIssue(sample.title, "CJK title", sample.language),
        null,
      );
      assert.match(
        renderTextSupportIssue(sample.title)!,
        /Choose.*Japanese.*Korean/,
      );
      assert.throws(
        () =>
          validateRenderScenes([{ ...fixture, onScreenText: sample.title }], {
            captions: false,
          }),
        /CJK/,
      );
      assert.doesNotThrow(() =>
        validateRenderScenes(
          [{ ...fixture, onScreenText: sample.title }],
          cjkOptions(sample.language),
        ),
      );
      for (const [flag, text, language] of [
        ["RENDER_HAN_ENABLED", "新", "zh-Hans"],
        ["RENDER_HIRAGANA_ENABLED", "あ", "ja"],
        ["RENDER_KATAKANA_ENABLED", "ア", "ja"],
        ["RENDER_HANGUL_ENABLED", "한", "ko"],
      ] as const) {
        process.env[flag] = "false";
        assert.match(
          renderTextSupportIssue(text, "title", language)!,
          /not enabled/,
        );
        process.env[flag] = "true";
      }
      assert.match(
        renderTextSupportIssue("カタカナ", "title", "zh-Hans")!,
        /Choose Japanese/,
      );
      assert.match(
        renderTextSupportIssue("한국어", "title", "ja")!,
        /Choose Korean/,
      );
      for (const text of [
        sample.title + "\u200d",
        sample.title + "\ufe00",
        sample.title + "\u{e0100}",
        sample.title + " 😀",
      ]) {
        assert.ok(renderTextSupportIssue(text, "title", sample.language));
      }
      assert.match(
        renderTextSupportIssue(
          sample.title + " שלום",
          "title",
          sample.language,
        )!,
        /Separate Arabic, Hebrew/,
      );
      const scene = { ...fixture, caption: sample.title };
      assert.doesNotThrow(() =>
        validateRenderScenes([scene], { captions: false }),
      );
      assert.ok(captionSrt([scene]).includes(sample.title));
      assert.doesNotThrow(() =>
        validateRenderScenes(
          [
            {
              ...scene,
              captionCues: [{ start: 0.3, end: 0.8, text: "Plain override" }],
            },
          ],
          { captions: true },
        ),
      );
      assert.equal(
        renderOptions.parse({ cjkLanguage: sample.language }).cjkLanguage,
        sample.language,
      );
      assert.throws(() => renderOptions.parse({ cjkLanguage: "auto" }));
    },
  );
  test(
    sample.name +
      ": independent HarfBuzz glyph/advance/offset and runtime outlines",
    { timeout: 240000 },
    async (t) => {
      environment(t, sample);
      const path = cjkFontPath(sample.key),
        bytes = await readRenderFont(path);
      assert.ok(bytes.length <= MAX_RENDER_FONT_BYTES);
      const { create } = await import("fontkit"),
        faces = [
          create(bytes),
          createRequire(import.meta.url)("fontkit").create(bytes),
        ];
      const candidates = cjkTexts(sample),
        texts = candidates.filter((text) =>
          Array.from(text).every((c) =>
            faces[0].hasGlyphForCodePoint(c.codePointAt(0)!),
          ),
        );
      const missing = candidates.filter((text) => !texts.includes(text));
      for (const text of missing)
        assert.throws(
          () =>
            createRenderFontPlan(
              bytes,
              [{ ...fixture, onScreenText: text }],
              cjkOptions(sample.language),
            ),
          /glyphs missing/,
        );
      assert.ok(
        sample.texts.every((text) => texts.includes(text)),
        "every curated reference must be covered",
      );
      const reference = await references(path, texts),
        plan = createRenderFontPlan(
          bytes,
          [{ ...fixture, onScreenText: sample.texts[0] }],
          cjkOptions(sample.language),
        );
      for (const face of faces) {
        for (const expected of reference.runs) {
          const actual = face.layout(
            expected.text.normalize("NFC"),
            undefined,
            sample.tag,
            cjkLanguageTag(sample.language),
          );
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
          assert.equal(
            outlined.paths.length,
            expected.glyphs.length,
            expected.text,
          );
          for (const [i, g] of expected.glyphs.entries()) {
            assert.equal(
              outlined.paths[i].path,
              face.getGlyph(g.id).path.toSVG(),
              expected.text,
            );
            assert.ok(
              Math.abs(
                outlined.paths[i].x - (advance + g.xOffset) / face.unitsPerEm,
              ) < 1e-8,
              expected.text,
            );
            assert.ok(
              Math.abs(outlined.paths[i].y - g.yOffset / face.unitsPerEm) <
                1e-8,
              expected.text,
            );
            advance += g.advance;
          }
          assert.ok(
            Math.abs(outlined.advanceWidth - advance / face.unitsPerEm) < 1e-8,
            expected.text,
          );
        }
      }
      t.diagnostic(
        "HarfBuzz " +
          reference.version +
          ": " +
          sample.texts.length +
          " curated, " +
          texts.length +
          " covered CJK reference strings, " +
          missing.length +
          " missing-font strings rejected; CJS/ESM/outlines matched.",
      );
    },
  );
  test(
    sample.name +
      ": complete-grapheme wrapping, overfull text and missing/truncated fonts fail before storage",
    async (t) => {
      environment(t, sample);
      const text = (sample.title + " A\u0301 क्षि ").repeat(5).trim(),
        fonts = await getFonts();
      const plan = createRenderFontPlan(
        fonts,
        [{ ...fixture, onScreenText: text }],
        cjkOptions(sample.language),
      );
      for (const aspect of ["9:16", "16:9", "1:1"] as const) {
        const [w, h] = dimensions(renderOptions.parse({ aspect })),
          layout = layoutRenderText(text, "CJK title", plan, w, h, 40);
        assert.equal(layout.text.replace(/\s/g, ""), text.replace(/\s/g, ""));
        for (const line of layout.text.split("\n")) {
          assert.doesNotMatch(line, /^[\p{Mark}、。）」』】]/u);
          assert.doesNotMatch(line, /[（「『【]$/u);
          assert.ok(
            plan.measureText(line, -1).width * layout.fontSize <= w * 0.84,
          );
        }
      }
      const bytes = await readRenderFont(cjkFontPath(sample.key));
      assert.throws(
        () =>
          createRenderFontPlan(
            bytes.subarray(0, bytes.length - 100),
            [{ ...fixture, onScreenText: sample.title }],
            cjkOptions(sample.language),
          ),
        /inspected/,
      );
      const unexpected = () => {
        throw Error("Unexpected storage/cache/media work");
      };
      const overfull = sample.title + " " + "W".repeat(120);
      const overflowOptions = renderOptions.parse({
        aspect: "9:16",
        resolution: "720",
        captions: false,
        cjkLanguage: sample.language,
      });
      const overflowPlan = createRenderFontPlan(
        fonts,
        [{ ...fixture, onScreenText: overfull }],
        overflowOptions,
      );
      assert.throws(
        () =>
          layoutRenderText(overfull, "CJK title", overflowPlan, 720, 1280, 40),
        /readable/,
      );
      await assert.rejects(
        renderVideo({
          organizationId: "cjk-qa",
          id: "overfull",
          scenes: [{ ...fixture, onScreenText: overfull }],
          options: overflowOptions,
          assets: [],
          signal: new AbortController().signal,
          store: new Proxy({} as ObjectStore, { get: unexpected }),
          progress: async () => unexpected(),
          cacheGet: async () => unexpected(),
          cachePut: async () => unexpected(),
        }),
        /readable/,
      );
      assert.ok(
        captionSrt([{ ...fixture, caption: "か\u3099 한" }]).includes(
          "か\u3099 한",
        ),
      );
      process.env.RENDER_FONT_PATH = DEFAULT_RENDER_FONT_PATH;
      process.env.RENDER_FONT_FALLBACK_PATHS = "";
      await assert.rejects(
        renderVideo({
          organizationId: "cjk-qa",
          id: "missing",
          scenes: [{ ...fixture, onScreenText: sample.title }],
          options: renderOptions.parse({ cjkLanguage: sample.language }),
          assets: [],
          signal: new AbortController().signal,
          store: new Proxy({} as ObjectStore, { get: unexpected }),
          progress: async () => unexpected(),
          cacheGet: async () => unexpected(),
          cachePut: async () => unexpected(),
        }),
        /grapheme.*glyphs missing/,
      );
    },
  );
  test(
    sample.name +
      ": runtime fingerprint records locale and ignores unburned or overridden cues",
    async (t) => {
      environment(t, sample);
      const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg",
        runtime = await runProcess(ffmpeg, ["-version"]),
        decoders = await runProcess(ffmpeg, ["-decoders"]);
      const current = await checkRenderShaping(
        [{ ...fixture, onScreenText: sample.title }],
        cjkOptions(sample.language),
        ffmpeg,
        new AbortController().signal,
      );
      assert.equal(
        current,
        sha256(
          outlinePipelineRevision([sample.title], sample.language) +
            "\n" +
            runtime +
            decoders,
        ),
      );
      assert.notEqual(
        outlinePipelineRevision(["骨"], "ja"),
        outlinePipelineRevision(["骨"], "zh-Hans"),
      );
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
    },
  );
  test(
    `${sample.name}: decoded pure/mixed titles/cues stay bounded and timed across 18 exports and 54 frames`,
    { timeout: 180000 },
    async (t) => {
      environment(t, sample);
      const dir = await mkdtemp(
        join(tmpdir(), `mos-${sample.key.toLowerCase()}-`),
      );
      t.after(() => rm(dir, { recursive: true, force: true }));
      const qaDir = process.env.MOS_CJK_BATCH_QA_DIR
        ? join(process.env.MOS_CJK_BATCH_QA_DIR, sample.key.toLowerCase())
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
                cjkLanguage: sample.language,
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
                organizationId: "cjk-batch-qa",
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

test("CJK wrapping yields only independent ICU strict boundaries and preserves all complete graphemes", async (t) => {
  environment(t, CJK_BATCH_FIXTURES[2]);
  const texts: string[] = [
    "新商品「こんにちは」。",
    "价格（１２３．４５）元。",
    "骨直令羽，品質生活。",
    "한국어 즐거운 생활",
    "한글 즐거운 생활",
    "か\u3099、き\u3099。",
    "ｶﾞｯｺｳ「ﾊﾟﾋﾟﾌﾟﾍﾟﾎﾟ」",
    "商品 Café A\u0301 2026",
    "「ภาษาไทยการศึกษา」新商品",
    "新商品ភាសាខ្មែរសិក្សា",
  ];
  for (const punct of "、。，．？！：；・ー々〻ゝゞヽヾぁぃぅぇぉっゃゅょァィゥェォッャュョ）］｝」』】")
    for (const prefix of ["新商品", "カタカナ", "あいうえお", "価格１２３"])
      texts.push(prefix + punct + "世界");
  for (const open of "（［｛「『【") texts.push("新商品" + open + "世界。");
  const reference = JSON.parse(
    await runProcess(
      "python3",
      ["tests/fixtures/linebreak-reference.py", "ja", ...texts],
      { timeout: 30000 },
    ),
  );
  assert.equal(reference.engine, "ICU");
  for (const r of reference.runs) {
    const units = renderLineBreakUnits(r.text)!;
    assert.equal(units.join(""), r.text);
    const ends = new Set(
      Array.from(
        new Intl.Segmenter("und", { granularity: "grapheme" }).segment(r.text),
        (g) => g.index + g.segment.length,
      ),
    );
    let at = 0;
    for (const unit of units) {
      at += unit.length;
      assert.ok(ends.has(at), r.text);
      assert.ok(r.breaks.includes(at), r.text + " at " + at);
    }
  }
  for (const text of ["新商品「こんにちは」。", "價格１２３．４５元。"])
    assert.ok(renderLineBreakUnits(text)!.length > 2);
  assert.ok(
    renderLineBreakUnits("한국어 즐거운 생활")!.every(
      (unit) => !["한", "국", "어"].includes(unit),
    ),
  );
  t.diagnostic(
    "ICU " +
      reference.version +
      ": " +
      texts.length +
      " CJK line-break cases, all emitted boundaries independently accepted; stricter non-starters/Korean words protected.",
  );
});

test("CJK localized Han glyphs independently match across all four configured font variants", async (t) => {
  environment(t, CJK_BATCH_FIXTURES[0]);
  const texts = [
    "骨",
    "直",
    "令",
    "羽",
    "门",
    "門",
    "新",
    "国",
    "國",
    "「骨直令羽」",
  ];
  const ids = new Map<string, number[]>();
  for (const language of CJK_LANGUAGES) {
    process.env.TEST_HB_LANGUAGE = language;
    process.env.TEST_HB_SCRIPT = "hani";
    for (const sample of CJK_BATCH_FIXTURES) {
      const path = cjkFontPath(sample.key),
        bytes = await readRenderFont(path),
        r = await references(path, texts);
      const { create } = await import("fontkit");
      const face = create(bytes),
        common = createRequire(import.meta.url)("fontkit").create(bytes);
      const plan = createRenderFontPlan(
        bytes,
        [{ ...fixture, onScreenText: texts[0] }],
        cjkOptions(language),
      );
      for (const expected of r.runs) {
        for (const f of [face, common]) {
          const run = f.layout(
            expected.text,
            undefined,
            "hani",
            cjkLanguageTag(language),
          );
          assert.deepEqual(
            run.glyphs.map((g: any, i: number) => ({
              id: g.id,
              advance: run.positions[i].xAdvance,
              xOffset: run.positions[i].xOffset,
              yOffset: run.positions[i].yOffset,
            })),
            expected.glyphs,
          );
        }
        const shaped = plan.shapeText(expected.text, -1);
        assert.deepEqual(
          shaped.paths.map((g) => g.path),
          expected.glyphs.map((g: any) => face.getGlyph(g.id).path.toSVG()),
        );
        let advance = 0;
        for (const [i, g] of expected.glyphs.entries()) {
          assert.ok(
            Math.abs(
              shaped.paths[i].x - (advance + g.xOffset) / face.unitsPerEm,
            ) < 1e-8,
          );
          assert.ok(
            Math.abs(shaped.paths[i].y - g.yOffset / face.unitsPerEm) < 1e-8,
          );
          advance += g.advance;
        }
        assert.ok(
          Math.abs(shaped.advanceWidth - advance / face.unitsPerEm) < 1e-8,
        );
      }
      if (sample.key === "sc")
        ids.set(
          language,
          r.runs.flatMap((r) => r.glyphs.map((g: any) => g.id)),
        );
    }
  }
  assert.notDeepEqual(
    ids.get("ja"),
    ids.get("zh-Hans"),
    "explicit locale selects different regional Han forms",
  );
  t.diagnostic(
    "HarfBuzz localized Han: 4 fonts x 4 locales x 10 cases matched in CJS/ESM/runtime outlines.",
  );
});

test("CJK saved locale and trusted font bytes separate scene caches while unchanged renders reuse them", async (t) => {
  environment(t, CJK_BATCH_FIXTURES[0]);
  const entries = new Map<string, { objectKey: string; bytes: number }>(),
    objects = new Map<string, Buffer>();
  const context = {
    organizationId: "cjk-cache-test",
    id: "cache",
    scenes: [{ ...fixture, onScreenText: "骨直令羽" }],
    options: renderOptions.parse({
      aspect: "1:1",
      resolution: "720",
      captions: false,
      cjkLanguage: "zh-Hans",
    }),
    assets: [],
    signal: new AbortController().signal,
    progress: async () => {},
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
  context.options.cjkLanguage = "ja";
  assert.equal((await renderVideo(context)).reusedScenes, 0);
  assert.equal((await renderVideo(context)).reusedScenes, 1);
  process.env.RENDER_FONT_PATH = cjkFontPath("jp");
  assert.equal((await renderVideo(context)).reusedScenes, 0);
  assert.equal(entries.size, 3);
});

test("CJK mixed Latin Greek Cyrillic and three Indic font runs match independent HarfBuzz placement", async (t) => {
  environment(t, CJK_BATCH_FIXTURES[0]);
  const { create } = await import("fontkit");
  for (const sample of CJK_BATCH_FIXTURES) {
    process.env.RENDER_FONT_PATH = cjkFontPath(sample.key);
    const primary = await readRenderFont(cjkFontPath(sample.key)),
      latin = await readRenderFont(DEFAULT_RENDER_FONT_PATH),
      fontBytes = [
        latin,
        primary,
        ...(await Promise.all(
          legacy.map((s) => readRenderFont(legacyPath(s))),
        )),
      ];
    const parts = [
      {
        text: "Café ",
        tag: "latn",
        bytes: latin,
        path: DEFAULT_RENDER_FONT_PATH,
      },
      {
        text: "Ελλάδα ",
        tag: "grek",
        bytes: latin,
        path: DEFAULT_RENDER_FONT_PATH,
      },
      {
        text: "Привет ",
        tag: "cyrl",
        bytes: latin,
        path: DEFAULT_RENDER_FONT_PATH,
      },
      ...[
        ["हिंदी ", "deva"],
        ["বাংলা ", "beng"],
        ["ગુજરાતી ", "gujr"],
      ].map(([text, tag]) => {
        const script = legacy.find((s) => s.tag === tag)!;
        return {
          text,
          tag,
          path: legacyPath(script),
          bytes: fontBytes[2 + legacy.indexOf(script)],
        };
      }),
      {
        text: "骨直令羽",
        tag: "hani",
        bytes: primary,
        path: cjkFontPath(sample.key),
      },
    ];
    const text = parts.map((p) => p.text).join("");
    const plan = createRenderFontPlan(
      fontBytes,
      [{ ...fixture, onScreenText: text }],
      cjkOptions(sample.language),
    );
    const actual = plan.shapeText(text, -1);
    let advance = 0,
      index = 0;
    for (const part of parts) {
      process.env.TEST_HB_SCRIPT = part.tag;
      if (isCjkTag(part.tag)) process.env.TEST_HB_LANGUAGE = sample.language;
      else delete process.env.TEST_HB_LANGUAGE;
      const ref = await references(part.path, [part.text]);
      const face = create(part.bytes);
      let local = 0;
      for (const g of ref.runs[0].glyphs) {
        const outline = actual.paths[index++];
        assert.equal(
          outline.path,
          face.getGlyph(g.id).path.toSVG(),
          sample.name + part.text,
        );
        assert.ok(
          Math.abs(
            outline.x - (advance + (local + g.xOffset) / face.unitsPerEm),
          ) < 1e-8,
          sample.name + part.text,
        );
        assert.ok(Math.abs(outline.y - g.yOffset / face.unitsPerEm) < 1e-8);
        local += g.advance;
      }
      advance += local / face.unitsPerEm;
    }
    assert.equal(index, actual.paths.length);
    assert.ok(Math.abs(advance - actual.advanceWidth) < 1e-8);
  }
  t.diagnostic(
    "HarfBuzz mixed CJK: four saved locales x seven known font/script runs matched emitted paths, advances and offsets.",
  );
});
