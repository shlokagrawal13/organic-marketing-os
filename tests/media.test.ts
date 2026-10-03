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
