import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sniffMedia,
  renderOptions,
  dimensions,
  captionSrt,
  sceneTimeline,
  validateRenderScenes,
  renderTextSupportIssue,
} from "../packages/core/media";
import { sceneSchema } from "../packages/core/ai";
import { RENDER_PRESETS } from "../packages/core/render-presets";
import {
  MAX_CAPTION_CUES,
  sceneCaptionCues,
  timelineTime,
} from "../packages/core/captions";
const fixtureScene = {
  id: "timed",
  purpose: "",
  duration: 2,
  voiceover: "",
  visual: "",
  onScreenText: "",
  caption: "Legacy fallback",
  transition: "Cut",
  music: "",
  sfx: "",
  cta: "",
};

test("named render presets normalize geometry, reject conflicts and preserve legacy hashes", () => {
  assert.equal(
    JSON.stringify(renderOptions.parse({})),
    '{"aspect":"9:16","resolution":"720","captions":true,"musicAssetId":null,"musicVolume":0.12,"background":"#183c2b"}',
  );
  const expected = [
    [1080, 1920],
    [1920, 1080],
    [1080, 1080],
  ];
  for (const [i, preset] of RENDER_PRESETS.entries()) {
    const options = renderOptions.parse({
      preset: preset.id,
      captions: false,
      background: "#123456",
      musicVolume: 0.25,
    });
    assert.deepEqual(dimensions(options), expected[i]);
    assert.equal(options.preset, preset.id);
    assert.equal(options.captions, false);
    assert.equal(options.background, "#123456");
    assert.equal(options.musicVolume, 0.25);
    assert.deepEqual(
      renderOptions.parse(options),
      options,
      "saved snapshots parse identically",
    );
    assert.throws(() =>
      renderOptions.parse({ preset: preset.id, resolution: "720" }),
    );
    assert.throws(() =>
      renderOptions.parse({
        preset: preset.id,
        aspect: preset.aspect === "1:1" ? "9:16" : "1:1",
      }),
    );
  }
  for (const preset of [
    "unknown",
    "__proto__",
    null,
    {},
    "vertical-social-v2",
  ]) {
    assert.throws(() => renderOptions.parse({ preset }));
  }
  assert.throws(() =>
    renderOptions.parse({ preset: RENDER_PRESETS[0].id, filter: "crop=1:1" }),
  );
  assert.equal(
    renderOptions.parse({ textPlacement: "device-safe-v1" }).textPlacement,
    "device-safe-v1",
  );
  assert.throws(() => renderOptions.parse({ textPlacement: "device-safe-v2" }));
});

test("scene motion defaults to static and accepts only bounded presets", () => {
  assert.equal(sceneSchema.parse(fixtureScene).cameraMotion, "static");
  assert.equal(
    sceneSchema.parse({ ...fixtureScene, cameraMotion: "slow-zoom" })
      .cameraMotion,
    "slow-zoom",
  );
  for (const cameraMotion of [null, "", "pan", "zoompan=z=100", 8, {}])
    assert.equal(
      sceneSchema.safeParse({ ...fixtureScene, cameraMotion }).success,
      false,
    );
});

test("scene framing defaults legacy inputs to fit and accepts only bounded modes", () => {
  assert.equal(sceneSchema.parse(fixtureScene).visualFit, "contain");
  assert.equal(
    sceneSchema.parse({ ...fixtureScene, visualFit: "cover" }).visualFit,
    "cover",
  );
  for (const visualFit of [
    null,
    "",
    "stretch",
    "cover,crop=1:1",
    { mode: "cover" },
  ])
    assert.equal(
      sceneSchema.safeParse({ ...fixtureScene, visualFit }).success,
      false,
    );
});

test("caption cues preserve legacy scenes and export exact ordered scene-relative timing", () => {
  const legacy = sceneSchema.parse({ ...fixtureScene, duration: 1.25 });
  assert.deepEqual(legacy.captionCues, []);
  assert.deepEqual(sceneCaptionCues(legacy), [
    { start: 0, end: 1.25, text: "Legacy fallback" },
  ]);
  const timed = sceneSchema.parse({
    ...fixtureScene,
    captionCues: [
      { start: 0.125, end: 0.5, text: "First" },
      { start: 0.5, end: 1, text: "Adjacent" },
      { start: 1.5, end: 2, text: "After a gap" },
    ],
  });
  assert.equal(
    captionSrt([legacy, timed]),
    "1\n00:00:00,000 --> 00:00:01,250\nLegacy fallback\n\n" +
      "2\n00:00:01,375 --> 00:00:01,750\nFirst\n\n" +
      "3\n00:00:01,750 --> 00:00:02,250\nAdjacent\n\n" +
      "4\n00:00:02,750 --> 00:00:03,250\nAfter a gap\n",
  );
  assert.equal(timelineTime(1.125), "0:01.125");
  assert.equal(timelineTime(61), "1:01");
});

test("caption validation rejects invalid, overlapping, unordered and excessive cues", () => {
  const cue = { start: 0.25, end: 1, text: "Valid" };
  for (const captionCues of [
    [{ ...cue, start: -1 }],
    [{ ...cue, end: 3 }],
    [{ ...cue, end: 0.25 }],
    [{ ...cue, end: 0.1 }],
    [{ ...cue, start: NaN }],
    [{ ...cue, end: Infinity }],
    [{ ...cue, start: 0.0001 }],
    [{ ...cue, text: " " }],
    [{ ...cue, text: "x".repeat(301) }],
    [{ ...cue, text: "hidden\x00text" }],
    [{ ...cue, filter: "movie=http://internal" }],
    [cue, { ...cue, start: 0.9, end: 1.2 }],
    [cue, { ...cue, start: 0, end: 0.1 }],
    Array.from({ length: MAX_CAPTION_CUES + 1 }, () => cue),
  ])
    assert.equal(
      sceneSchema.safeParse({ ...fixtureScene, captionCues }).success,
      false,
    );
  assert.throws(() =>
    validateRenderScenes([
      { ...sceneSchema.parse(fixtureScene), captionCues: [{ ...cue, end: 3 }] },
    ]),
  );
  const maximum = Array.from({ length: MAX_CAPTION_CUES }, (_, i) => ({
    start: i,
    end: i + 1,
    text: "word",
  }));
  assert.equal(
    sceneSchema.safeParse({
      ...fixtureScene,
      duration: 60,
      captionCues: maximum,
    }).success,
    true,
  );
});
test("uploads reject executable/text formats and rendering options reject filter injection", () => {
  assert.throws(() =>
    sniffMedia(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')),
  );
  assert.throws(() =>
    renderOptions.parse({ background: "red;movie=http://internal" }),
  );
  assert.deepEqual(
    dimensions(renderOptions.parse({ aspect: "16:9", resolution: "1080" })),
    [1920, 1080],
  );
});
test("render bounds and scene captions have deterministic, accurate timing", () => {
  const s = sceneSchema.parse({
    id: "a",
    purpose: "",
    duration: 1.25,
    voiceover: "",
    visual: "",
    onScreenText: "",
    caption: "First caption",
    transition: "Cut",
    music: "",
    sfx: "",
    cta: "",
  });
  assert.match(
    captionSrt([s, { ...s, id: "b", duration: 2, caption: "Second caption" }]),
    /00:00:01,250 --> 00:00:03,250/,
  );
  assert.deepEqual(
    sceneTimeline([s, { ...s, id: "b", duration: 2 }]).map(
      ({ index, scene, start, end }) => ({ index, id: scene.id, start, end }),
    ),
    [
      { index: 0, id: "a", start: 0, end: 1.25 },
      { index: 1, id: "b", start: 1.25, end: 3.25 },
    ],
  );
  assert.throws(() => validateRenderScenes([s, { ...s }]));
  assert.throws(() =>
    validateRenderScenes([{ ...s, transition: "arbitrary filter" }]),
  );
  assert.throws(() =>
    validateRenderScenes(
      Array.from({ length: 4 }, (_, i) => ({
        ...s,
        id: String(i),
        duration: 60,
      })),
    ),
  );
});

test("render text preflight accepts configured RTL scripts and reports unsupported shaping cases", (t) => {
  const enabled = process.env.RENDER_DEVANAGARI_ENABLED;
  process.env.RENDER_DEVANAGARI_ENABLED = "false";
  t.after(() => {
    if (enabled === undefined) delete process.env.RENDER_DEVANAGARI_ENABLED;
    else process.env.RENDER_DEVANAGARI_ENABLED = enabled;
  });
  const latin = sceneSchema.parse({
    ...fixtureScene,
    id: "latin",
    onScreenText:
      "Caf\u00e9 launch: cre\u0300me bru\u0302le\u0301e, 50% off\r\nToday",
    caption: "Greek α and Cyrillic Ж remain in the supported QA set.",
  });
  assert.equal(renderTextSupportIssue(latin.onScreenText), null);
  assert.equal(
    renderTextSupportIssue(
      "Plan smarter \u00b7 100% your brand \u00a9 \u00a3 \u20ac \u20b9",
    ),
    null,
  );
  assert.doesNotThrow(() => validateRenderScenes([latin]));
  assert.doesNotThrow(() =>
    validateRenderScenes([
      sceneSchema.parse({
        ...fixtureScene,
        id: "rtl",
        onScreenText: "مرحبا بالعالم",
        caption: "שלום עולם",
      }),
    ]),
  );
  for (const [field, text, pattern] of [
    ["onScreenText", "Launch 🚀", /emoji/i],
    ["caption", "नमस्ते", /Devanagari/],
    ["caption", "新品上市", /CJK/],
    ["caption", "bad\x00text", /control characters/],
    ["caption", "hidden\u202etext", /control characters/],
    ["caption", "\u0531", /outside the current render policy/],
    ["caption", "\u{10400}", /outside the current render policy/],
  ] as const) {
    assert.throws(
      () =>
        validateRenderScenes([
          sceneSchema.parse({
            ...fixtureScene,
            id: field,
            [field]: text,
          }),
        ]),
      pattern,
    );
  }
  const srtOnly = sceneSchema.parse({ ...fixtureScene, caption: "नमस्ते" });
  assert.doesNotThrow(() =>
    validateRenderScenes([srtOnly], { captions: false }),
  );
  assert.match(captionSrt([srtOnly]), /नमस्ते/);
  assert.throws(() => validateRenderScenes([srtOnly]), /Devanagari/);
  assert.throws(
    () =>
      validateRenderScenes(
        [sceneSchema.parse({ ...fixtureScene, onScreenText: "नमस्ते" })],
        { captions: false },
      ),
    /Devanagari/,
  );
  assert.throws(
    () =>
      validateRenderScenes([
        sceneSchema.parse({
          ...fixtureScene,
          captionCues: [{ start: 0, end: 1, text: "नमस्ते" }],
        }),
      ]),
    /caption cue 1.*Devanagari/,
  );
  assert.doesNotThrow(() =>
    validateRenderScenes([
      sceneSchema.parse({
        ...fixtureScene,
        caption: "नमस्ते fallback not rendered",
        captionCues: [{ start: 0, end: 1, text: "Rendered Latin cue" }],
      }),
    ]),
  );
});

test("media subprocess cancellation closes a running child promptly", async () => {
  const { runProcess } = await import("../packages/core/media");
  const abort = new AbortController();
  const running = runProcess(
    process.execPath,
    ["-e", "setInterval(() => {}, 1000)"],
    { signal: abort.signal, timeout: 5000 },
  );
  setTimeout(() => abort.abort(), 100);
  await assert.rejects(running, /canceled/i);
});

test("media process output preserves Unicode split across UTF-8 pipe chunks", async () => {
  const { runProcess } = await import("../packages/core/media");
  const text = "ภาษาไทย ພາສາລາວ ភាសាខ្មែរ မြန်မာ བོད་ཡིག་";
  const program = `const b=Buffer.from(${JSON.stringify(text)});let i=0;function write(){if(i===b.length)return;process.stdout.write(b.subarray(i,i+1));i++;setTimeout(write,1);}write();`;
  assert.equal(
    await runProcess(process.execPath, ["-e", program], { timeout: 5000 }),
    text,
  );
});
