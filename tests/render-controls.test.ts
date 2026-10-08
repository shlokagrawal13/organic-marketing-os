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
} from "../packages/core/media";
import {
  createRenderFontPlan,
  readRenderFont,
  DEFAULT_RENDER_FONT_PATH,
} from "../packages/core/render-font";
import { OUTLINE_SCRIPTS } from "../packages/core/render-scripts";
import {
  layoutRenderText,
  renderLineBreakUnits,
} from "../packages/core/render-text-layout";
import { renderFontUnits } from "../packages/core/render-controls";
import { renderTextAreas } from "../packages/core/render-text-placement";
import { renderVideo } from "../packages/core/renderer";
import type { ObjectStore } from "../packages/core/object-store";
import { CONTROL_FIXTURES } from "./fixtures/render-controls";

const scripts = OUTLINE_SCRIPTS.filter(
  (s) => !["hani", "kana", "hang"].includes(s.tag),
);
const fontPathFor = (s: (typeof scripts)[number]) =>
  process.env[s.testFontEnvironment] ||
  `/usr/share/fonts/truetype/noto/${s.fontFile}`;
const fixture = sceneSchema.parse({
  id: "control-qa",
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
function environment(t: TestContext, name?: string) {
  const values = {
    ...Object.fromEntries(
      OUTLINE_SCRIPTS.map((s) => [
        s.environment,
        scripts.includes(s as any) ? "true" : "false",
      ]),
    ),
    RENDER_FONT_PATH: name
      ? fontPathFor(scripts.find((s) => s.name === name)!)
      : DEFAULT_RENDER_FONT_PATH,
    RENDER_FONT_FALLBACK_PATHS: [
      DEFAULT_RENDER_FONT_PATH,
      ...scripts.map(fontPathFor),
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
for (const sample of CONTROL_FIXTURES) {
  test(`${sample.name}: controls match independent HarfBuzz in CJS/ESM and runtime outlines without cmap/cache poisoning`, async (t) => {
    environment(t, sample.name);
    const script = scripts.find((s) => s.name === sample.name)!;
    const fontPath = fontPathFor(script),
      bytes = await readRenderFont(fontPath);
    const reference = JSON.parse(
      await runProcess("python3", [
        "tests/fixtures/shaping-reference.py",
        fontPath,
        ...sample.texts,
      ]),
    );
    assert.equal(reference.version, "8.3.0");
    const { create } = await import("fontkit");
    for (const face of [
      create(bytes),
      createRequire(import.meta.url)("fontkit").create(bytes),
    ] as any[]) {
      face.glyphForCodePoint(0x10ffff);
      const plan = createRenderFontPlan(
        bytes,
        [{ ...fixture, onScreenText: sample.title }],
        { captions: false },
      );
      for (const expected of [
        ...reference.runs,
        ...reference.runs.slice().reverse(),
      ]) {
        assert.equal(
          renderTextSupportIssue(expected.text),
          null,
          expected.text,
        );
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
        assert.equal(outlined.paths.length, expected.glyphs.length);
        let advance = 0;
        for (const [i, g] of expected.glyphs.entries()) {
          assert.equal(
            outlined.paths[i].path,
            face.getGlyph(g.id).path.toSVG(),
          );
          assert.ok(
            Math.abs(
              outlined.paths[i].x - (advance + g.xOffset) / face.unitsPerEm,
            ) < 1e-8,
          );
          assert.ok(
            Math.abs(outlined.paths[i].y - g.yOffset / face.unitsPerEm) < 1e-8,
          );
          advance += g.advance;
        }
        assert.ok(
          Math.abs(outlined.advanceWidth - advance / face.unitsPerEm) < 1e-8,
        );
        assert.ok(
          plan.measureText(expected.text, -1).width + 1e-8 >=
            outlined.advanceWidth,
        );
      }
      assert.equal(
        face.layout(String.fromCodePoint(0x10ffff)).glyphs[0].id,
        0,
        "visible missing glyph stays missing after WJ",
      );
      const measuredPlan = createRenderFontPlan(
        bytes,
        [{ ...fixture, onScreenText: sample.a + "\u2060" + sample.a }],
        { captions: false },
      );
      assert.equal(
        measuredPlan.measureText(sample.a + "\u2060" + sample.a, -1).width,
        measuredPlan.measureText(sample.a + sample.a, -1).width,
      );
    }
    const scene = {
      ...fixture,
      captionCues: [{ start: 0.3, end: 0.8, text: sample.caption }],
    };
    assert.ok(captionSrt([scene]).includes(sample.caption));
    process.env[script.environment] = "false";
    assert.match(renderTextSupportIssue(sample.title)!, /not enabled/);
    t.diagnostic(
      `${reference.runs.length} strings: HarfBuzz ${reference.version}, CJS/ESM, forward/reverse reuse and runtime paths matched.`,
    );
  });
}
test("bounded control rejection happens before storage/cache while original unburned SRT is preserved", async (t) => {
  environment(t);
  const rejected = [
    "\u200dक",
    "क\u200d\u200dष",
    "क\u200dA",
    "A\u200dक",
    "क\u200d中",
    "中\u200dक",
    "क\u200c्ष",
    "ក\u200d្រ",
    "က\u200c္က",
    "क\u200bि",
    "क\u2060ि",
    "क\u200b",
    "A\u2060A",
    "ཀ\u200bྲ",
    "क\u200eष",
    "क\u202eष",
  ];
  const unexpected = () => {
    throw new Error("Unexpected storage/cache work");
  };
  for (const text of rejected) {
    assert.match(
      renderTextSupportIssue(text, "Rendered text", "ja")!,
      /control characters/,
    );
    const scene = { ...fixture, onScreenText: text };
    await assert.rejects(
      renderVideo({
        organizationId: "control-reject",
        id: "reject",
        scenes: [scene],
        options: renderOptions.parse({ cjkLanguage: "ja" }),
        assets: [],
        signal: new AbortController().signal,
        store: new Proxy({} as ObjectStore, { get: unexpected }),
        progress: async () => unexpected(),
        cacheGet: async () => unexpected(),
        cachePut: async () => unexpected(),
      }),
      /control characters/,
    );
    const cue = { ...fixture, caption: text };
    assert.doesNotThrow(() => validateRenderScenes([cue], { captions: false }));
    assert.ok(captionSrt([cue]).includes(text));
  }
});
test("wrapping preserves joiner font units, explicit ZWSP breaks and WJ words across mixed scripts", async (t) => {
  environment(t);
  const fonts = await Promise.all(
    [DEFAULT_RENDER_FONT_PATH, ...scripts.map(fontPathFor)].map((p) =>
      readRenderFont(p),
    ),
  );
  for (const sample of CONTROL_FIXTURES) {
    assert.deepEqual(renderLineBreakUnits(sample.a + "\u200b" + sample.a), [
      sample.a + "\u200b",
      sample.a,
    ]);
    assert.deepEqual(renderLineBreakUnits(sample.a + "\u2060" + sample.a), [
      sample.a + "\u2060" + sample.a,
    ]);
    const joined = sample.a + sample.h + "\u200d" + sample.b;
    assert.deepEqual(renderFontUnits("A" + joined), ["A", joined]);
    const mixed = "中" + joined + "中" + joined;
    const fontEnds = new Set<number>();
    let at = 0;
    for (const unit of renderFontUnits(mixed)) {
      at += unit.length;
      fontEnds.add(at);
    }
    at = 0;
    for (const unit of renderLineBreakUnits(mixed)!) {
      at += unit.length;
      assert.ok(
        fontEnds.has(at),
        sample.name + ": CJK wrapping preserves joined font unit",
      );
    }

    const text = (joined + " ").repeat(12).trim();
    const plan = createRenderFontPlan(
      fonts,
      [{ ...fixture, onScreenText: text }],
      { captions: false },
    );
    for (const aspect of ["9:16", "16:9", "1:1"] as const) {
      const [width, height] = dimensions(renderOptions.parse({ aspect }));
      const out = layoutRenderText(
        text,
        "joined title",
        plan,
        width,
        height,
        40,
      );
      assert.equal(out.text.replace(/\n/gu, " "), text);
      assert.ok(
        out.text
          .split("\n")
          .every((line) => line.split(" ").every((word) => word === joined)),
      );
    }
    const long = (sample.a + "\u2060").repeat(200) + sample.a;
    const longPlan = createRenderFontPlan(
      fonts,
      [{ ...fixture, onScreenText: long }],
      { captions: false },
    );
    assert.throws(
      () => layoutRenderText(long, "long WJ word", longPlan, 720, 1280, 40),
      /minimum readable/,
    );
  }
});

test(
  "controls: 90 timed video exports across fifteen scripts, three aspects and two resolutions",
  { timeout: 360000 },
  async (t) => {
    environment(t);
    for (const sample of CONTROL_FIXTURES) {
      const dir = await mkdtemp(
        join(tmpdir(), `mos-${sample.name.toLowerCase()}-`),
      );
      t.after(() => rm(dir, { recursive: true, force: true }));
      const qaDir = process.env.MOS_CONTROL_QA_DIR
        ? join(process.env.MOS_CONTROL_QA_DIR, sample.name.toLowerCase())
        : undefined;
      if (qaDir) await mkdir(qaDir, { recursive: true });
      const titleFor = () => "Café Ελλάδα Привет " + sample.title;
      const captionFor = () => sample.caption;
      const textPlacement = "inset-v1" as const,
        mode = "controls";
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
            onScreenText: titleFor(),
            captionCues: [{ start: 0.3, end: 0.8, text: captionFor() }],
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
            if (
              qaDir &&
              time === 0.5 &&
              aspect === "9:16" &&
              resolution === "720"
            )
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
    }
    t.diagnostic(
      "90 exports; 270 decoded timed frames; source SRT, title/cue presence, timing and bounds checked.",
    );
  },
);
