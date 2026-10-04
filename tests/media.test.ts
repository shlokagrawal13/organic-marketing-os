import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sniffMedia,
  renderOptions,
  dimensions,
  captionSrt,
  sceneTimeline,
  validateRenderScenes,
} from "../packages/core/media";
import { sceneSchema } from "../packages/core/ai";
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
