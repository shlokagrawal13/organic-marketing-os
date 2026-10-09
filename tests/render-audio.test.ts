import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sceneSchema } from "../packages/core/ai";
import {
  renderOptions,
  runProcess,
  sha256,
  probeMedia,
  validateRenderedProbe,
} from "../packages/core/media";
import { renderVideo } from "../packages/core/renderer";
import type { ObjectStore } from "../packages/core/object-store";

test("render output rejects malformed duration, audio timing and incompatible cached audio", () => {
  const valid = {
    format: { duration: "2.0" },
    streams: [
      {
        codec_type: "video",
        codec_name: "h264",
        width: 720,
        height: 720,
        duration: "2.0",
      },
      {
        codec_type: "audio",
        codec_name: "aac",
        sample_rate: "48000",
        channels: 2,
        start_time: "0",
        duration: "2.0",
      },
    ],
  };
  validateRenderedProbe(valid, 720, 720, 2);
  for (const [target, field, value] of [
    ["format", "duration", "N/A"],
    ["format", "duration", undefined],
    ["video", "duration", 0],
    ["audio", "duration", "NaN"],
    ["audio", "duration", 1],
    ["audio", "sample_rate", "44100"],
    ["audio", "channels", 1],
    ["audio", "codec_name", "mp3"],
    ["audio", "start_time", "N/A"],
    ["audio", "start_time", "0.5"],
  ] as const) {
    const probe = structuredClone(valid);
    const record: any =
      target === "format"
        ? probe.format
        : probe.streams.find((s) => s.codec_type === target);
    record[field] = value;
    assert.throws(
      () => validateRenderedProbe(probe, 720, 720, 2),
      /audio format or duration checks/,
    );
  }
});

const assetIds: Record<string, string> = {
  short: "00000000-0000-4000-8000-000000000001",
  long: "00000000-0000-4000-8000-000000000002",
  music: "00000000-0000-4000-8000-000000000003",
  video: "00000000-0000-4000-8000-000000000004",
  hot: "00000000-0000-4000-8000-000000000005",
  hotMusic: "00000000-0000-4000-8000-000000000006",
};
function scene(id: string, audioAssetId?: string) {
  return sceneSchema.parse({
    id,
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
    audioAssetId: audioAssetId ? assetIds[audioAssetId] : undefined,
  });
}

// Measure the exported AAC after decoding, rather than trusting its metadata.
function rms(samples: Float32Array, start: number, end: number) {
  const from = Math.round(start * 48000),
    to = Math.round(end * 48000);
  let power = 0;
  for (let i = from; i < to; i++) power += samples[i] ** 2;
  return Math.sqrt(power / (to - from));
}
function tone(
  samples: Float32Array,
  start: number,
  end: number,
  frequency: number,
) {
  const from = Math.round(start * 48000),
    to = Math.round(end * 48000);
  let real = 0,
    imaginary = 0;
  for (let i = from; i < to; i++) {
    const angle = (2 * Math.PI * frequency * i) / 48000;
    real += samples[i] * Math.cos(angle);
    imaginary += samples[i] * Math.sin(angle);
  }
  return (2 * Math.hypot(real, imaginary)) / (to - from);
}

test(
  "decoded narration is padded/trimmed at scene boundaries, silent scenes stay silent and audio caches are validated",
  { timeout: 120000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "mos-audio-qa-"));
    const objects = new Map<string, Buffer>(),
      cache = new Map<string, { objectKey: string; bytes: number }>();
    const assets: {
      id: string;
      objectKey: string;
      sha256: string;
      kind: string;
      bytes: number;
    }[] = [];
    const ffmpeg = async (args: string[]) =>
      runProcess(
        process.env.FFMPEG_PATH || "ffmpeg",
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-nostdin",
          "-y",
          "-threads",
          "1",
          ...args,
        ],
        { cwd: dir, timeout: 30000 },
      );
    const store = {
      ready: async () => {},
      download: async (key: string, path: string) => {
        const bytes = objects.get(key);
        assert.ok(bytes, `missing test object ${key}`);
        await writeFile(path, bytes);
      },
      putFile: async (key: string, path: string) => {
        objects.set(key, await readFile(path));
      },
      remove: async (key: string) => {
        objects.delete(key);
      },
    } as unknown as ObjectStore;
    async function input(
      id: string,
      frequency: number,
      duration: number,
      rate: number,
      channels: number,
      gain = 1,
    ) {
      await ffmpeg([
        "-f",
        "lavfi",
        "-i",
        `sine=frequency=${frequency}:sample_rate=${rate}:duration=${duration}`,
        ...(gain === 1 ? [] : ["-af", `volume=${gain}`]),
        "-ac",
        String(channels),
        `${id}.wav`,
      ]);
      const bytes = await readFile(join(dir, `${id}.wav`));
      objects.set(id, bytes);
      assets.push({
        id: assetIds[id],
        objectKey: id,
        sha256: sha256(bytes),
        kind: "AUDIO",
        bytes: bytes.length,
      });
    }
    async function render(
      id: string,
      scenes: ReturnType<typeof scene>[],
      musicVolume?: number,
      musicId = "music",
    ) {
      const result = await renderVideo({
        organizationId: "audio-qa",
        id,
        scenes,
        assets,
        store,
        options: renderOptions.parse({
          aspect: "1:1",
          captions: false,
          ...(musicVolume === undefined
            ? {}
            : { musicAssetId: assetIds[musicId], musicVolume }),
        }),
        signal: new AbortController().signal,
        progress: async () => {},
        cacheGet: async (key) => cache.get(key) || null,
        cachePut: async (key, entry) => {
          cache.set(key, entry);
        },
      });
      const file = join(dir, `${id}.mp4`);
      await writeFile(file, objects.get(result.outputKey)!);
      validateRenderedProbe(await probeMedia(file), 720, 720, scenes.length);
      await ffmpeg([
        "-i",
        file,
        "-map",
        "0:a:0",
        "-ac",
        "1",
        "-ar",
        "48000",
        "-f",
        "f32le",
        `${id}.pcm`,
      ]);
      const bytes = await readFile(join(dir, `${id}.pcm`));
      const samples = new Float32Array(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
      );
      assert.ok(Math.abs(samples.length / 48000 - scenes.length) < 0.05);
      assert.ok(samples.every(Number.isFinite));
      return { result, samples };
    }
    async function decodedStereoPeak(id: string, sampleRate: number) {
      await ffmpeg([
        "-i",
        `${id}.mp4`,
        "-map",
        "0:a:0",
        "-ac",
        "2",
        "-ar",
        String(sampleRate),
        "-f",
        "f32le",
        `${id}-${sampleRate}.pcm`,
      ]);
      const bytes = await readFile(join(dir, `${id}-${sampleRate}.pcm`));
      const samples = new Float32Array(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
      );
      assert.ok(samples.length > sampleRate, "stereo output was decoded");
      let peak = 0;
      for (const sample of samples) {
        assert.ok(Number.isFinite(sample), "decoded sample is finite");
        peak = Math.max(peak, Math.abs(sample));
      }
      return peak;
    }
    try {
      await input("short", 440, 0.35, 44100, 1);
      await input("long", 880, 3, 48000, 2);
      await input("music", 220, 0.2, 32000, 1);
      await ffmpeg([
        "-f",
        "lavfi",
        "-i",
        "color=c=green:s=128x128:r=30:d=1",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=660:sample_rate=48000:duration=1",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "video.mp4",
      ]);
      const video = await readFile(join(dir, "video.mp4"));
      objects.set("video", video);
      assets.push({
        id: assetIds.video,
        objectKey: "video",
        sha256: sha256(video),
        kind: "VIDEO",
        bytes: video.length,
      });
      const scenes = [
        scene("short-scene", "short"),
        scene("long-scene", "long"),
        { ...scene("silent-scene"), visualAssetId: assetIds.video },
      ];
      const plain = await render("plain", scenes);
      assert.ok(
        tone(plain.samples, 0.08, 0.25, 440) > 0.04,
        "short narration starts in its scene",
      );
      assert.ok(
        rms(plain.samples, 0.5, 0.85) < 0.001,
        "short narration is padded with silence",
      );
      assert.ok(
        tone(plain.samples, 1.15, 1.8, 880) > 0.04,
        "next narration starts at the next scene",
      );
      assert.ok(
        tone(plain.samples, 1.15, 1.8, 440) < 0.001,
        "earlier narration does not leak into next scene",
      );
      assert.ok(
        rms(plain.samples, 2.15, 2.85) < 0.001,
        "long narration is trimmed and embedded video audio stays muted",
      );
      const reused = await render("reused", scenes);
      assert.equal(reused.result.reusedScenes, 3);
      // A same-key MP4 with mono/44.1 kHz AAC must be rebuilt, not reused.
      const first = [...cache.values()][0];
      await writeFile(join(dir, "cached.mp4"), objects.get(first.objectKey)!);
      await ffmpeg([
        "-i",
        "cached.mp4",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-ac",
        "1",
        "-ar",
        "44100",
        "bad-cache.mp4",
      ]);
      const invalid = await readFile(join(dir, "bad-cache.mp4"));
      objects.set(first.objectKey, invalid);
      first.bytes = invalid.length;
      const rebuilt = await render("rebuilt", scenes);
      assert.equal(
        rebuilt.result.reusedScenes,
        2,
        "incompatible audio cache is rebuilt",
      );
      assert.ok(tone(rebuilt.samples, 0.08, 0.25, 440) > 0.04);
      const muted = await render("muted", scenes, 0);
      assert.equal(
        muted.result.reusedScenes,
        3,
        "music-only edits preserve scene caches",
      );
      assert.ok(
        rms(muted.samples, 2.15, 2.85) < 0.001,
        "zero music volume stays silent",
      );
      const mixed = await render("mixed", scenes, 0.25);
      assert.equal(mixed.result.reusedScenes, 3);
      for (const [start, end] of [
        [0.5, 0.8],
        [2.15, 2.45],
        [2.55, 2.85],
      ])
        assert.ok(
          tone(mixed.samples, start, end, 220) > 0.015,
          "short music loops across padded and silent scenes",
        );
      assert.ok(
        rms(mixed.samples, 2.15, 2.85) < 0.035,
        "selected music gain is bounded",
      );
      assert.ok(
        tone(mixed.samples, 1.15, 1.8, 880) > 0.04,
        "mix retains narration",
      );
      // Stress the supported maximum music gain with loud narration and music.
      // Check the exported AAC after 4x stereo resampling, not the limiter graph.
      await input("hot", 440, 1, 48000, 2, 8);
      await input("hotMusic", 660, 0.3, 48000, 2, 8);
      const hotPlain = await render("hot-plain", [scene("hot-scene", "hot")]);
      assert.ok(rms(hotPlain.samples, 0.2, 0.8) > 0.1);
      const plainPeak = await decodedStereoPeak("hot-plain", 48000);
      const plain4xPeak = await decodedStereoPeak("hot-plain", 192000);
      assert.ok(plainPeak < 1, `48 kHz narration peak ${plainPeak} clips`);
      assert.ok(
        plain4xPeak < 1,
        `4x resampled narration peak ${plain4xPeak} clips`,
      );
      const hot = await render(
        "hot-mix",
        [scene("hot-scene", "hot")],
        0.5,
        "hotMusic",
      );
      assert.ok(rms(hot.samples, 0.2, 0.8) > 0.1, "limited mix stays audible");
      const mixPeak = await decodedStereoPeak("hot-mix", 48000);
      const mix4xPeak = await decodedStereoPeak("hot-mix", 192000);
      let monoPeak = 0;
      for (const sample of hot.samples)
        monoPeak = Math.max(monoPeak, Math.abs(sample));
      assert.ok(mixPeak < 1, `48 kHz loud mix peak ${mixPeak} clips`);
      assert.ok(mix4xPeak < 1, `4x resampled loud mix peak ${mix4xPeak} clips`);
      assert.ok(monoPeak < 1, `48 kHz mono mix peak ${monoPeak} clips`);
      console.log(
        `48 kHz/4x stereo peaks: narration=${plainPeak}/${plain4xPeak}, music mix=${mixPeak}/${mix4xPeak}; mono mix=${monoPeak}`,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
);
