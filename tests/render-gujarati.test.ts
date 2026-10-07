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
import { layoutRenderText } from "../packages/core/render-text-layout";
import { renderTextAreas } from "../packages/core/render-text-placement";
import { checkRenderShaping } from "../packages/core/render-shaping";
import { renderVideo } from "../packages/core/renderer";
import type { ObjectStore } from "../packages/core/object-store";

const fontPath =
  process.env.TEST_GUJARATI_FONT_PATH ||
  "/usr/share/fonts/truetype/noto/NotoSansGujarati-Regular.ttf";
const devaPath =
  process.env.TEST_DEVANAGARI_FONT_PATH ||
  "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf";
const bengaliPath =
  process.env.TEST_BENGALI_FONT_PATH ||
  "/usr/share/fonts/truetype/noto/NotoSansBengali-Regular.ttf";
const fixture = sceneSchema.parse({
  id: "gujarati",
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
  const values = {
    RENDER_DEVANAGARI_ENABLED: "true",
    RENDER_GUJARATI_ENABLED: "true",
    RENDER_BENGALI_ENABLED: "true",
    RENDER_FONT_PATH: DEFAULT_RENDER_FONT_PATH,
    RENDER_FONT_FALLBACK_PATHS: [devaPath, bengaliPath, fontPath].join(
      delimiter,
    ),
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

test("Gujarati has a separate opt-in, shared mixed-script boundaries and unchanged unburned Unicode cues", (t) => {
  environment(t);
  delete process.env.RENDER_GUJARATI_ENABLED;
  assert.match(
    renderTextSupportIssue("ગુજરાતી શિક્ષણ")!,
    /Gujarati.*not enabled/,
  );
  assert.equal(renderTextSupportIssue("हिंदी"), null);
  assert.equal(renderTextSupportIssue("বাংলা"), null);
  process.env.RENDER_GUJARATI_ENABLED = "true";
  process.env.RENDER_DEVANAGARI_ENABLED = "false";
  assert.equal(renderTextSupportIssue("ગુજરાતી શિક્ષણ ૨૦૨૬।"), null);
  assert.match(
    renderTextSupportIssue("ગુજરાતી हिंदी")!,
    /Devanagari.*not enabled/,
  );
  process.env.RENDER_DEVANAGARI_ENABLED = "true";
  process.env.RENDER_BENGALI_ENABLED = "false";
  assert.equal(renderTextSupportIssue("ગુજરાતી"), null);
  assert.match(
    renderTextSupportIssue("ગુજરાતી বাংলা")!,
    /Bengali.*not enabled/,
  );
  process.env.RENDER_BENGALI_ENABLED = "true";
  assert.equal(
    renderTextSupportIssue("Café Ελλάδα Привет हिंदी বাংলা ગુજરાતી શિક્ષણ"),
    null,
  );
  for (const text of ["ગુજરાતી שלום", "ગુજરાતી مرحبا"])
    assert.match(renderTextSupportIssue(text)!, /Separate Arabic, Hebrew/);
  assert.match(renderTextSupportIssue("ગુજરાતી 新品")!, /CJK/);
  assert.match(renderTextSupportIssue("ગુજરાતી ไทย")!, /Thai/);
  assert.match(renderTextSupportIssue("ક્\u200dષ")!, /control characters/);
  assert.match(renderTextSupportIssue("ગુજરાતી 😀")!, /emoji/);
  const scene = { ...fixture, caption: "ગુજરાતી שלום" };
  assert.throws(
    () => validateRenderScenes([scene], { captions: true }),
    /caption cue 1.*Separate Arabic, Hebrew/,
  );
  assert.doesNotThrow(() => validateRenderScenes([scene], { captions: false }));
  assert.ok(captionSrt([scene]).includes(scene.caption));
  assert.doesNotThrow(() =>
    validateRenderScenes(
      [{ ...scene, captionCues: [{ start: 0.2, end: 0.8, text: "શિક્ષણ" }] }],
      { captions: true },
    ),
  );
  assert.doesNotThrow(() =>
    validateRenderScenes(
      [{ ...fixture, onScreenText: "مرحبا", caption: "ગુજરાતી" }],
      { captions: true },
    ),
  );
});

test("Gujarati conjunct/matra/reph glyph order and offsets match independent HarfBuzz in both Node exports", async (t) => {
  environment(t);
  const texts = [
    "શિક્ષણ",
    "ક્ષિ",
    "કર્મ",
    "ર્ક",
    "ર્ગ",
    "શર્મા",
    "પ્રશિક્ષણ",
    "ગુજરાતી",
    "શ્રદ્ધા",
    "ક્ત",
    "કો",
    "કૈ",
    "જ્ઞ",
    "સ્ત્ર",
    "દ્વિ",
    "ટ્યુશન",
    "એજ્યુકેશન",
    "રુ",
    "રૂ",
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
  // Native dynamic import selects the ESM export even when tsx loads this test
  // through CJS. A static TS import can otherwise exercise CJS twice.
  const { create } = await import("fontkit");
  const faces = [
    create(bytes),
    createRequire(import.meta.url)("fontkit").create(bytes),
  ];
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
      const plan = createRenderFontPlan(
        bytes,
        [{ ...fixture, onScreenText: expected.text }],
        { captions: false },
      );
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
  // Independent references for every run verify six-script ordering and each
  // font's units/offsets in the combined overlay, rather than only visibility.
  const segments = [
    [DEFAULT_RENDER_FONT_PATH, "Café "],
    [DEFAULT_RENDER_FONT_PATH, "Ελλάδα "],
    [DEFAULT_RENDER_FONT_PATH, "Привет "],
    [devaPath, "हिंदी "],
    [bengaliPath, "বাংলা "],
    [fontPath, "ગુજરાતી શિક્ષણ"],
  ];
  const fonts = await Promise.all(
    [DEFAULT_RENDER_FONT_PATH, devaPath, bengaliPath, fontPath].map(
      readRenderFont,
    ),
  );
  const mixed = segments.map(([, text]) => text).join("");
  const plan = createRenderFontPlan(
    fonts,
    [{ ...fixture, onScreenText: mixed }],
    { captions: false },
  );
  assert.equal(plan.selectFontIndex(mixed), -1);
  const outlined = plan.shapeText(mixed, -1);
  let advance = 0,
    index = 0;
  for (const [path, text] of segments) {
    const face = create(await readRenderFont(path));
    const ref = JSON.parse(
      await runProcess(
        "python3",
        ["tests/fixtures/shaping-reference.py", path, text],
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

test("Gujarati mixed-font wrapping preserves conjunct graphemes and missing coverage fails before storage", async (t) => {
  environment(t);
  const fonts = await Promise.all(
    [DEFAULT_RENDER_FONT_PATH, devaPath, bengaliPath, fontPath].map((p) =>
      readRenderFont(p),
    ),
  );
  // શ્રદ્ધા contains two graphemes (શ્ર + દ્ધા), each independently wrappable.
  const clusters = ["A\u0301", "ક્ષિ", "क्षि", "ক্ষি", "શ્ર", "દ્ધા"];
  const text = clusters.join("").repeat(18);
  const plan = createRenderFontPlan(
    fonts,
    [{ ...fixture, onScreenText: text }],
    { captions: false },
  );
  for (const aspect of ["9:16", "16:9", "1:1"] as const) {
    const [width, height] = dimensions(renderOptions.parse({ aspect }));
    const layout = layoutRenderText(
      text,
      "Gujarati title",
      plan,
      width,
      height,
      40,
    );
    assert.equal(layout.text.replace(/\n/g, ""), text);
    for (const line of layout.text.split("\n")) {
      assert.match(line, /^(?:A\u0301|ક્ષિ|क्षि|ক্ষি|શ્ર|દ્ધા)+$/u);
      assert.ok(
        plan.measureText(line, -1).width * layout.fontSize <= width * 0.84,
      );
    }
  }
  assert.throws(
    () =>
      createRenderFontPlan(
        fonts.slice(0, 3),
        [{ ...fixture, onScreenText: "ગુજરાતી શિક્ષણ" }],
        { captions: false },
      ),
    /grapheme.*glyphs missing/,
  );
  assert.throws(
    () =>
      createRenderFontPlan(
        fonts,
        [{ ...fixture, onScreenText: "ગુજરાતી שלום" }],
        { captions: false },
      ),
    /Separate Arabic, Hebrew/,
  );
  process.env.RENDER_FONT_FALLBACK_PATHS = "";
  let storageTouched = false;
  await assert.rejects(
    renderVideo({
      organizationId: "gujarati-missing",
      id: "missing",
      scenes: [{ ...fixture, onScreenText: "ગુજરાતી" }],
      options: renderOptions.parse({}),
      assets: [],
      signal: new AbortController().signal,
      store: {
        ready: async () => {
          storageTouched = true;
        },
      } as unknown as ObjectStore,
      progress: async () => {},
      cacheGet: async () => null,
      cachePut: async () => {},
    }),
    /grapheme.*glyphs missing/,
  );
  assert.equal(storageTouched, false);
});

test("Gujarati outline runtime has a distinct fingerprint and invalidates prior Indic shaping while unburned captions need no runtime", async (t) => {
  environment(t);
  const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
  const runtime = await runProcess(ffmpeg, ["-version"], { timeout: 15000 });
  const decoders = await runProcess(ffmpeg, ["-decoders"], { timeout: 15000 });
  const check = (text: string) =>
    checkRenderShaping(
      [{ ...fixture, onScreenText: text }],
      { captions: false },
      ffmpeg,
      new AbortController().signal,
    );
  assert.equal(
    await check("શિક્ષણ"),
    sha256(
      "fontkit-outlines-v2-shared-context-southeast-tibetan\n" +
        runtime +
        decoders,
    ),
  );
  assert.equal(await check("ગુજરાતી বাংলা हिंदी"), await check("શિક્ષણ"));
  assert.equal(
    await check("বাংলা"),
    sha256(
      "fontkit-outlines-v2-shared-context-southeast-tibetan\n" +
        runtime +
        decoders,
    ),
  );
  assert.equal(
    await check("हिंदी"),
    sha256(
      "fontkit-outlines-v2-shared-context-southeast-tibetan\n" +
        runtime +
        decoders,
    ),
  );
  assert.equal(
    await checkRenderShaping(
      [{ ...fixture, caption: "ગુજરાતી" }],
      { captions: false },
      "/missing/ffmpeg",
      new AbortController().signal,
    ),
    undefined,
  );
});

test(
  "decoded pure/mixed Gujarati titles/cues remain bounded and timed across 18 exports and 54 frames",
  { timeout: 180000 },
  async (t) => {
    environment(t);
    const dir = await mkdtemp(join(tmpdir(), "mos-gujarati-"));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const qaDir = process.env.MOS_GUJARATI_QA_DIR;
    if (qaDir) await mkdir(qaDir, { recursive: true });
    const titleFor = (mode: string) =>
      mode === "pure"
        ? "ગુજરાતી શિક્ષણ કર્મ શ્રદ્ધા ૨૦૨૬"
        : "Café Ελλάδα Привет हिंदी বাংলা ગુજરાતી શિક્ષણ";
    const captionFor = (mode: string) =>
      mode === "pure"
        ? "પ્રશિક્ષણ ક્ષિ કૈ નવી શરૂઆત"
        : "Ελλάδα Привет प्रशिक्षण বাংলা પ્રશિક્ષણ કર્મ ક્ષિ";
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
              organizationId: "gujarati-qa",
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
