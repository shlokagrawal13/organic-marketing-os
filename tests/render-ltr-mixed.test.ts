import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  process.env.TEST_DEVANAGARI_FONT_PATH ||
  "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf";
const fixture = sceneSchema.parse({
  id: "ltr-mixed",
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
    RENDER_BENGALI_ENABLED: "false",
    RENDER_FONT_PATH: DEFAULT_RENDER_FONT_PATH,
    RENDER_FONT_FALLBACK_PATHS: fontPath,
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

test("mixed LTR preflight permits configured Hindi/Greek/Cyrillic but rejects mixed RTL in effective titles and cues", (t) => {
  environment(t);
  for (const text of [
    "Café Ελληνικά Кириллица शिक्षा क्षि",
    "Ελλάδα Привет हिंदी 2026।",
  ])
    assert.equal(renderTextSupportIssue(text), null);
  for (const text of ["हिंदी שלום", "हिंदी مرحبا"])
    assert.match(renderTextSupportIssue(text)!, /Separate Arabic, Hebrew/);
  assert.match(renderTextSupportIssue("हिंदी নমস্কার")!, /Bengali/);
  assert.match(renderTextSupportIssue("हिंदी 新品")!, /CJK/);
  assert.match(
    renderTextSupportIssue("हिंदी\u200f Привет")!,
    /control characters/,
  );
  const scene = { ...fixture, caption: "हिंदी שלום" };
  assert.throws(
    () => validateRenderScenes([scene], { captions: true }),
    /caption cue 1.*Separate Arabic, Hebrew/,
  );
  assert.doesNotThrow(() => validateRenderScenes([scene], { captions: false }));
  assert.ok(captionSrt([scene]).includes(scene.caption));
  assert.doesNotThrow(() =>
    validateRenderScenes(
      [
        {
          ...scene,
          captionCues: [{ start: 0.2, end: 0.8, text: "Ελλάδα हिंदी" }],
        },
      ],
      { captions: true },
    ),
  );
  assert.doesNotThrow(
    () =>
      validateRenderScenes(
        [{ ...fixture, onScreenText: "مرحبا", caption: "हिंदी" }],
        { captions: true },
      ),
    "separate overlays keep independent direction",
  );
  process.env.RENDER_DEVANAGARI_ENABLED = "false";
  assert.match(renderTextSupportIssue("Ελλάδα हिंदी")!, /not enabled/);
});

test("mixed LTR runs preserve combining/conjunct clusters and use each script's covering font", async () => {
  const fonts = [
    await readRenderFont(DEFAULT_RENDER_FONT_PATH),
    await readRenderFont(fontPath),
  ];
  const runs = ["Ελλάδα", "Привет", "क्षि", "Café"];
  const text = runs.join("");
  const plan = createRenderFontPlan(
    fonts,
    [{ ...fixture, onScreenText: text }],
    { captions: false },
  );
  const combined = plan.shapeText(text, -1);
  const separate = runs.map((run, i) => plan.shapeText(run, i === 2 ? 1 : 0));
  assert.ok(
    Math.abs(
      combined.advanceWidth -
        separate.reduce(
          (sum, run) => sum + run.advanceWidth / run.unitsPerEm,
          0,
        ),
    ) < 1e-8,
  );
  assert.equal(
    combined.paths.length,
    separate.reduce((sum, run) => sum + run.paths.length, 0),
  );
  const clusters = ["A\u0301", "Α\u0301", "И\u0306", "क्षि"];
  const long = clusters.join("").repeat(25);
  const wrapPlan = createRenderFontPlan(
    fonts,
    [{ ...fixture, onScreenText: long }],
    { captions: false },
  );
  for (const aspect of ["9:16", "16:9", "1:1"] as const) {
    const [width, height] = dimensions(renderOptions.parse({ aspect }));
    const layout = layoutRenderText(
      long,
      "LTR title",
      wrapPlan,
      width,
      height,
      40,
    );
    assert.equal(layout.text.replace(/\n/g, ""), long);
    for (const line of layout.text.split("\n")) {
      assert.match(line, /^(?:A\u0301|Α\u0301|И\u0306|क्षि)+$/u);
      assert.ok(
        wrapPlan.measureText(line, -1).width * layout.fontSize <= width * 0.84,
      );
    }
  }
  assert.throws(
    () =>
      createRenderFontPlan(
        fonts.slice(0, 1),
        [{ ...fixture, onScreenText: text }],
        { captions: false },
      ),
    /grapheme.*glyphs missing/,
  );
  assert.throws(
    () =>
      createRenderFontPlan(
        fonts,
        [{ ...fixture, onScreenText: "हिंदी שלום" }],
        { captions: false },
      ),
    /Separate Arabic, Hebrew/,
  );
});

test("LTR outline pipeline invalidates preceding Devanagari segments without changing plain-script runtime identity", async (t) => {
  environment(t);
  const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
  const signal = new AbortController().signal;
  const runtime = await runProcess(ffmpeg, ["-version"], { timeout: 15000 });
  const decoders = await runProcess(ffmpeg, ["-decoders"], { timeout: 15000 });
  const fingerprint = await checkRenderShaping(
    [{ ...fixture, onScreenText: "Ελλάδα हिंदी" }],
    { captions: false },
    ffmpeg,
    signal,
  );
  assert.ok(fingerprint);
  assert.notEqual(
    fingerprint,
    sha256("fontkit-outlines-v2-script-font-runs\n" + runtime + decoders),
  );
  assert.equal(
    await checkRenderShaping(
      [{ ...fixture, onScreenText: "Ελλάδα Привет" }],
      { captions: false },
      "/missing/ffmpeg",
      signal,
    ),
    undefined,
  );
});

test(
  "decoded mixed LTR titles/cues remain bounded and timed at six geometries with standard and extra margins",
  { timeout: 180000 },
  async (t) => {
    environment(t);
    const dir = await mkdtemp(join(tmpdir(), "mos-ltr-mixed-"));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const qaDir = process.env.MOS_LTR_QA_DIR;
    if (qaDir) await mkdir(qaDir, { recursive: true });
    const title = "Café: Ελληνικά Кириллица नई शुरुआत शिक्षा";
    const caption = "Ελλάδα 2026 — Привет мир: प्रशिक्षण और क्षि";
    for (const textPlacement of [undefined, "inset-v1"] as const)
      for (const aspect of ["9:16", "16:9", "1:1"] as const)
        for (const resolution of ["720", "1080"] as const) {
          const options = renderOptions.parse({
            aspect,
            resolution,
            textPlacement,
            background: "#000000",
          });
          const [width, height] = dimensions(options);
          const name = `${textPlacement || "standard"}-${aspect.replace(":", "x")}-${resolution}`;
          const video = join(dir, `${name}.mp4`);
          const scene = {
            ...fixture,
            onScreenText: title,
            captionCues: [{ start: 0.3, end: 0.8, text: caption }],
          };
          await renderVideo({
            organizationId: "ltr-qa",
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
