import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { sceneSchema } from "../packages/core/ai";
import { dimensions, renderOptions, runProcess } from "../packages/core/media";
import { DEFAULT_RENDER_FONT_PATH } from "../packages/core/render-font";
import { renderVideo } from "../packages/core/renderer";
import type { ObjectStore } from "../packages/core/object-store";

// A reproducible handoff for manual phone/app review. No simulated app chrome
// is treated as platform evidence; the manifest starts with all devices pending.
const root = resolve(process.env.MOS_DEVICE_REVIEW_DIR || ".local/device-review");
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const visualAssetId = "00000000-0000-4000-8000-000000000001";
const sha256 = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");

async function main() {
  await mkdir(root, { recursive: true });
  const background = join(root, "high-detail-test-pattern.png");
  const providedImage = process.env.MOS_DEVICE_REVIEW_IMAGE;
  await runProcess(ffmpeg, providedImage
    ? ["-v", "error", "-y", "-i", resolve(providedImage), "-frames:v", "1",
        "-vf", "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280", background]
    : ["-v", "error", "-y", "-f", "lavfi", "-i",
        "testsrc2=size=720x1280:rate=1", "-frames:v", "1", background]);
  const backgroundBytes = await readFile(background);
  const devanagari = process.env.TEST_DEVANAGARI_FONT_PATH ||
    "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf";
  await readFile(devanagari); // A partial English-only pack is not accepted.
  process.env.RENDER_FONT_FALLBACK_PATHS = devanagari;
  process.env.RENDER_DEVANAGARI_ENABLED = "true";
  process.env.RENDER_FONT_PATH = DEFAULT_RENDER_FONT_PATH;
  const cases = [
    { id: "short-english", title: "Clear video title", caption: "Read every caption" },
    { id: "long-english", title: "Plan your next campaign with clear goals", caption: "Keep the key message easy to read on small screens" },
    { id: "mixed-hindi", title: "Video 2026: किरण क्षत्रिय शिक्षा", caption: "Start now! हिंदी में नई शुरुआत" },
  ];
  const scenes = cases.map(({ id, title, caption }) =>
    sceneSchema.parse({
      id, purpose: "", duration: 1, voiceover: "", visual: "",
      visualAssetId, visualFit: "cover",
      onScreenText: title, caption: "",
      captionCues: [{ start: 0.25, end: 0.85, text: caption }],
      transition: "Cut", music: "", sfx: "", cta: "",
    }),
  );
  const exports: Record<string, unknown>[] = [];
  for (const [label, placement] of [
    ["standard", undefined],
    ["extra-margins", "inset-v1"],
    ["device-safe", "device-safe-v1"],
  ] as const) {
    const options = renderOptions.parse({
      aspect: "9:16", resolution: "720", background: "#000000",
      textPlacement: placement,
    });
    const [width, height] = dimensions(options);
    const file = `${label}-portrait-720.mp4`;
    const video = join(root, file);
    await renderVideo({
      organizationId: "device-review-fixture", id: label,
      scenes, options,
      assets: [{
        id: visualAssetId, objectKey: "fixture/test-pattern.png",
        sha256: sha256(backgroundBytes), kind: "IMAGE", bytes: backgroundBytes.length,
      }],
      store: {
        ready: async () => {},
        download: async (_key: string, path: string) => writeFile(path, backgroundBytes),
        putFile: async (key: string, path: string) => {
          if (key.endsWith("/video.mp4")) await writeFile(video, await readFile(path));
        },
        remove: async () => {},
      } as unknown as ObjectStore,
      signal: new AbortController().signal,
      progress: async () => {}, cacheGet: async () => null, cachePut: async () => {},
    });
    const bytes = await readFile(video);
    assert.ok(bytes.length > 0, `${file} must exist`);
    const frames: Record<string, unknown>[] = [];
    for (const [index, fixture] of cases.entries()) {
      const time = index + 0.5;
      const frame = `${label}-${fixture.id}-320.png`;
      const path = join(root, frame);
      await runProcess(ffmpeg, [
        "-v", "error", "-y", "-ss", String(time), "-i", video,
        "-frames:v", "1", "-vf", "scale=320:-1:flags=lanczos", path,
      ]);
      const frameBytes = await readFile(path);
      assert.ok(frameBytes.length > 0, `${frame} must exist`);
      frames.push({ case: fixture.id, title: fixture.title, caption: fixture.caption,
        timeSeconds: time, file: frame, sha256: sha256(frameBytes) });
    }
    exports.push({ placement: label, textPlacement: placement || null,
      aspect: "9:16", width, height, durationSeconds: cases.length,
      file, bytes: bytes.length, sha256: sha256(bytes), frames });
  }
  const manifest = {
    schemaVersion: 1, source: "scripts/prepare-device-review.ts",
    scope: "Real product exports; actual phone and platform UI review is pending.",
    background: { origin: providedImage ? "provided local image" : "synthetic test pattern",
      file: "high-detail-test-pattern.png", sha256: sha256(backgroundBytes) },
    devanagariIncluded: true,
    fontSha256: sha256(await readFile(DEFAULT_RENDER_FONT_PATH)),
    devanagariFontSha256: sha256(await readFile(devanagari)),
    exports,
    acceptance: { phonePlayback: "pending", platformDraftPreview: "pending", humanReadability: "pending" },
  };
  await writeFile(join(root, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Device review pack: ${exports.length} exports, ${cases.length * exports.length} frames; actual device/app acceptance pending. ${root}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
