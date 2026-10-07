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
import { SOUTHEAST_BATCH_FIXTURES } from "./fixtures/southeast-batch";

const fontPathFor = (script: (typeof OUTLINE_SCRIPTS)[number]) =>
  process.env[script.testFontEnvironment] ||
  `/usr/share/fonts/truetype/noto/${script.fontFile}`;
const fixture = sceneSchema.parse({
  id: "southeast-batch",
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
  sample?: (typeof SOUTHEAST_BATCH_FIXTURES)[number],
) {
  const values: Record<string, string> = {
    ...Object.fromEntries(
      OUTLINE_SCRIPTS.map((script) => [script.environment, "true"]),
    ),
    RENDER_FONT_PATH: sample
      ? fontPathFor(OUTLINE_SCRIPTS.find((s) => s.name === sample.name)!)
      : DEFAULT_RENDER_FONT_PATH,
    RENDER_FONT_FALLBACK_PATHS: [
      DEFAULT_RENDER_FONT_PATH,
      ...OUTLINE_SCRIPTS.map(fontPathFor),
    ].join(delimiter),
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
    [
      ...new Set([
        process.env.RENDER_FONT_PATH || DEFAULT_RENDER_FONT_PATH,
        DEFAULT_RENDER_FONT_PATH,
        ...OUTLINE_SCRIPTS.map(fontPathFor),
      ]),
    ].map((path) => readRenderFont(path)),
  );
const generatedTexts = (name: string) => {
  const texts: string[] = [];
  if (name === "Thai" || name === "Lao") {
    const shift = name === "Thai" ? 0 : 0x80;
    // The pinned Lao test font predates these 14 modern letters. Test their
    // missing-font rejection separately rather than using .notdef as acceptance.
    const absentLao = new Set([
      3718, 3721, 3724, 3726, 3727, 3728, 3729, 3730, 3731, 3736, 3744, 3752,
      3753, 3756,
    ]);
    for (let b = 0xe01 + shift; b < 0xe2f + shift; b++) {
      if (
        !/\p{Letter}/u.test(String.fromCodePoint(b)) ||
        (shift && absentLao.has(b))
      )
        continue;
      for (const suffix of [
        [],
        [0xe33],
        [0xe48, 0xe33],
        [0xe49, 0xe33],
        [0xe34],
        [0xe38],
        [0xe34, 0xe48],
        [0xe38, 0xe49],
      ])
        texts.push(String.fromCodePoint(b, ...suffix.map((c) => c + shift)));
    }
  } else if (name === "Khmer") {
    for (let b = 0x1780; b < 0x17a3; b++)
      for (const sub of ["", "្ក", "្រ", "្យ"])
        for (const v of [
          "",
          "ា",
          "ិ",
          "ី",
          "ុ",
          "ូ",
          "េ",
          "ែ",
          "ៃ",
          "ោ",
          "ៅ",
          "ើ",
          "ៀ",
          "ឿ",
          "ំ",
        ])
          texts.push(String.fromCodePoint(b) + sub + v);
  } else if (name === "Myanmar") {
    for (let b = 0x1000; b < 0x1021; b++) {
      for (const medial of ["", "ျ", "ြ", "ွ", "ှ", "ျွ", "ြွ", "ျှ", "ြှ"])
        for (const v of ["", "ိ", "ီ", "ု", "ူ", "ေ", "ော", "ံ", "့", "ို"])
          texts.push(String.fromCodePoint(b) + medial + v);
      for (const v of ["", "ိ", "ီ", "ု", "ေ"]) {
        texts.push(
          "င်္" + String.fromCodePoint(b) + v,
          "င်္" + String.fromCodePoint(b) + "ျ" + v,
          String.fromCodePoint(b) + "္က" + v,
        );
      }
    }
  } else if (name === "Tibetan") {
    for (let b = 0xf40; b < 0xf6d; b++)
      if (/\p{Letter}/u.test(String.fromCodePoint(b)))
        for (const sub of ["", "ྲ", "ྱ"])
          for (const v of ["", "ཱ", "ི", "ུ", "ེ", "ོ", "ཱི", "ཱུ", "ིཾ"])
            texts.push(String.fromCodePoint(b) + sub + v);
  }
  return texts;
};
for (const sample of SOUTHEAST_BATCH_FIXTURES) {
  const script = OUTLINE_SCRIPTS.find((item) => item.name === sample.name)!;
  const fontPath = fontPathFor(script);
  test(`${sample.name}: separate opt-in, effective cues, unchanged SRT and shared RTL/control boundaries`, (t) => {
    environment(t, sample);
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
    for (const other of SOUTHEAST_BATCH_FIXTURES) {
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
    environment(t, sample);
    const texts = [
      ...new Set([...sample.texts, ...generatedTexts(sample.name)]),
    ];
    const bytes = await readRenderFont(fontPath);
    const reference = {
      engine: "HarfBuzz",
      version: "",
      unitsPerEm: 0,
      runs: [] as any[],
    };
    for (let start = 0; start < texts.length; start += 100) {
      const batch = JSON.parse(
        await runProcess(
          "python3",
          [
            "tests/fixtures/shaping-reference.py",
            fontPath,
            ...texts.slice(start, start + 100),
          ],
          { timeout: 30000 },
        ),
      );
      assert.equal(batch.engine, "HarfBuzz");
      if (start) {
        assert.equal(batch.version, reference.version);
        assert.equal(batch.unitsPerEm, reference.unitsPerEm);
      }
      reference.version = batch.version;
      reference.unitsPerEm = batch.unitsPerEm;
      reference.runs.push(...batch.runs);
    }
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
      [{ ...fixture, onScreenText: sample.texts[0] }],
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
      `HarfBuzz ${reference.version}: ${sample.texts.length} curated, ${texts.length} unique total reference strings, CJS/ESM/outlines matched.`,
    );
  });
  test(`${sample.name}: mixed-font wrapping keeps graphemes complete and missing/truncated fonts fail before storage`, async (t) => {
    environment(t, sample);
    const fonts = await getFonts();
    const text = ("A\u0301 " + sample.cluster + " क्षि ").repeat(6).trim();
    const compact = text.replace(/ /g, "");
    const plan = createRenderFontPlan(
      fonts,
      [{ ...fixture, onScreenText: text }],
      { captions: false },
    );
    const boundaries = new Set([
      0,
      ...Array.from(
        new Intl.Segmenter("und", { granularity: "grapheme" }).segment(compact),
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
      assert.equal(layout.text.replace(/[\n ]/g, ""), compact);
      let consumed = 0;
      for (const line of layout.text.split("\n")) {
        consumed += line.replace(/ /g, "").length;
        assert.ok(
          boundaries.has(consumed),
          "wrap at a complete grapheme boundary",
        );
        assert.ok(
          plan.measureText(line, -1).width * layout.fontSize <= width * 0.84,
        );
      }
    }
    const { create } = await import("fontkit");
    const point = sample.texts[0].codePointAt(0)!;
    const missing = fonts.filter(
      (font) => !create(font).hasGlyphForCodePoint(point),
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
    process.env.RENDER_FONT_PATH = fontPathFor(
      OUTLINE_SCRIPTS.find(
        (s) => s.name === (sample.name === "Thai" ? "Khmer" : "Thai"),
      )!,
    );
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
    environment(t, sample);
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
      sha256(
        "fontkit-outlines-v2-shared-context-southeast-tibetan\n" +
          runtime +
          decoders,
      ),
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
      environment(t, sample);
      const dir = await mkdtemp(
        join(tmpdir(), `mos-${sample.key.toLowerCase()}-`),
      );
      t.after(() => rm(dir, { recursive: true, force: true }));
      const qaDir = process.env.MOS_SOUTHEAST_BATCH_QA_DIR
        ? join(process.env.MOS_SOUTHEAST_BATCH_QA_DIR, sample.key.toLowerCase())
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
                organizationId: "southeast-batch-qa",
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

test("Southeast Asian word wrapping protects dictionary words, leading vowels and Tibetan tsheg while oversized words fail readably", async (t) => {
  environment(t);
  const { renderLineBreakUnits } =
    await import("../packages/core/render-text-layout");
  for (const text of [
    "ภาษาไทยการศึกษา",
    "ພາສາລາວສຶກສາ",
    "ភាសាខ្មែរសិក្សា",
    "မြန်မာပညာရေး",
    "བོད་ཡིག་སློབ་",
  ]) {
    const units = renderLineBreakUnits(text)!;
    assert.equal(units.join(""), text);
    assert.ok(units.length > 1);
    const plan = createRenderFontPlan(
      await getFonts(),
      [{ ...fixture, onScreenText: text }],
      { captions: false },
    );
    const width =
      Math.max(
        ...units.map(
          (unit) =>
            plan.measureText(unit, -1).width * 18 + Array.from(unit).length,
        ),
      ) /
        0.84 +
      1;
    const layout = layoutRenderText(
      text,
      "dictionary title",
      plan,
      width,
      2000,
      18,
    );
    const boundaries = new Set<number>([0]);
    let consumed = 0;
    for (const unit of units) {
      consumed += unit.length;
      boundaries.add(consumed);
    }
    consumed = 0;
    for (const line of layout.text.split("\n")) {
      consumed += line.length;
      assert.ok(boundaries.has(consumed));
      assert.ok(!/^[་]/u.test(line));
    }
    assert.equal(layout.text.replace(/\n/g, ""), text);
    const longest = units.reduce((a, b) => (a.length > b.length ? a : b));
    const shortPlan = createRenderFontPlan(
      await getFonts(),
      [{ ...fixture, onScreenText: longest }],
      { captions: false },
    );
    assert.throws(
      () =>
        layoutRenderText(longest, "dictionary title", shortPlan, 20, 2000, 18),
      /minimum readable font size/,
    );
  }
});

test("Derived Sara Am glyph coverage selects a complete fallback and rejects missing glyphs before cache/storage", async (t) => {
  environment(t);
  const script = OUTLINE_SCRIPTS.find((s) => s.name === "Thai")!;
  const original = await readRenderFont(fontPathFor(script)),
    broken = Buffer.from(original);
  const tables = broken.readUInt16BE(4);
  let cmap = 0;
  for (let i = 0; i < tables; i++)
    if (broken.toString("ascii", 12 + i * 16, 16 + i * 16) === "cmap")
      cmap = broken.readUInt32BE(20 + i * 16);
  assert.ok(cmap);
  const records = broken.readUInt16BE(cmap + 2);
  let removed = 0;
  for (let i = 0; i < records; i++) {
    const table = cmap + broken.readUInt32BE(cmap + 8 + i * 8);
    if (broken.readUInt16BE(table) !== 4) continue;
    const count = broken.readUInt16BE(table + 6) / 2;
    for (let j = 0; j < count; j++) {
      const end = broken.readUInt16BE(table + 14 + j * 2),
        start = broken.readUInt16BE(table + 16 + count * 2 + j * 2);
      if (start > 0xe4d || end < 0xe4d) continue;
      const address = table + 16 + count * 6 + j * 2,
        offset = broken.readUInt16BE(address);
      assert.ok(offset, "pinned test cmap uses a glyph array for Nikhahit");
      broken.writeUInt16BE(0, address + offset + (0xe4d - start) * 2);
      removed++;
    }
  }
  assert.ok(removed);
  const { create } = await import("fontkit");
  assert.equal(create(broken).hasGlyphForCodePoint(0xe33), true);
  assert.equal(create(broken).hasGlyphForCodePoint(0xe4d), false);
  const scene = { ...fixture, onScreenText: "น้ำ" };
  assert.throws(
    () => createRenderFontPlan(broken, [scene], { captions: false }),
    /grapheme.*glyphs missing/,
  );
  const complete = createRenderFontPlan([broken, original], [scene], {
    captions: false,
  });
  const expected = createRenderFontPlan(original, [scene], { captions: false });
  assert.deepEqual(
    complete.shapeText(scene.onScreenText, -1),
    expected.shapeText(scene.onScreenText, -1),
  );
  const dir = await mkdtemp(join(tmpdir(), "mos-derived-glyph-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, "missing-nikhahit.ttf");
  await writeFile(path, broken);
  process.env.RENDER_FONT_PATH = path;
  process.env.RENDER_FONT_FALLBACK_PATHS = "";
  const unexpected = () => {
    throw new Error("Unexpected storage/cache work");
  };
  await assert.rejects(
    renderVideo({
      organizationId: "southeast-missing",
      id: "derived",
      scenes: [scene],
      options: renderOptions.parse({ captions: false }),
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

test("All fifteen registered scripts compose independently referenced runs without changing Unicode SRT", async (t) => {
  environment(t);
  process.env.RENDER_FONT_PATH = fontPathFor(
    OUTLINE_SCRIPTS.find((s) => s.name === "Lao")!,
  );
  const { INDIC_BATCH_FIXTURES } = await import("./fixtures/indic-batch");
  const { create } = await import("fontkit");
  const segments: [string, string][] = [
    [DEFAULT_RENDER_FONT_PATH, "Café "],
    [DEFAULT_RENDER_FONT_PATH, "Ελλάδα "],
    [DEFAULT_RENDER_FONT_PATH, "Привет "],
    [fontPathFor(OUTLINE_SCRIPTS[0]), "हिंदी "],
    [fontPathFor(OUTLINE_SCRIPTS[1]), "বাংলা "],
    [fontPathFor(OUTLINE_SCRIPTS[2]), "ગુજરાતી "],
    ...[...INDIC_BATCH_FIXTURES, ...SOUTHEAST_BATCH_FIXTURES].map(
      (sample) =>
        [
          fontPathFor(OUTLINE_SCRIPTS.find((s) => s.name === sample.name)!),
          sample.texts[0] + " ",
        ] as [string, string],
    ),
  ];
  const text = segments.map(([, part]) => part).join("");
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
      assert.equal(
        actual.path,
        face.getGlyph(glyph.id).path.toSVG(),
        `${part} glyph ${index - 1} from ${path}`,
      );
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
  const scene = { ...fixture, caption: text };
  assert.ok(captionSrt([scene]).includes(text));
  t.diagnostic(
    "18 independently referenced Latin/Greek/Cyrillic and fifteen outline script runs matched.",
  );
});
