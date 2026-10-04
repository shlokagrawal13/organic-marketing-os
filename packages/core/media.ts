import { z } from "zod";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { sceneSchema } from "./ai";
import { sceneTimeline, sceneCaptionCues } from "./captions";
import { RENDER_PRESET_IDS, renderPreset } from "./render-presets";
export { renderDimensions as dimensions } from "./render-presets";
export { sceneTimeline } from "./captions";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_RENDER_BYTES = 100 * 1024 * 1024;
const normalizedRenderOptions = z
  .object({
    aspect: z.enum(["9:16", "16:9", "1:1"]).default("9:16"),
    resolution: z.enum(["720", "1080"]).default("720"),
    captions: z.boolean().default(true),
    musicAssetId: z.string().uuid().nullable().default(null),
    musicVolume: z.number().min(0).max(0.5).default(0.12),
    background: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default("#183c2b"),
    preset: z.enum(RENDER_PRESET_IDS).optional(),
  })
  .strict()
  .superRefine((options, ctx) => {
    const preset = renderPreset(options.preset);
    if (
      preset &&
      (options.aspect !== preset.aspect ||
        options.resolution !== preset.resolution)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["preset"],
        message:
          "Preset dimensions do not match. Use custom settings or the preset's aspect and resolution.",
      });
    }
  });
export const renderOptions = z.preprocess((input) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const preset = renderPreset((input as Record<string, unknown>).preset);
  // Expand preset-only requests, but keep explicit fields so contradictions
  // are rejected. Legacy options retain their exact serialized hash shape.
  return preset
    ? { aspect: preset.aspect, resolution: preset.resolution, ...input }
    : input;
}, normalizedRenderOptions);
export type RenderOptions = z.infer<typeof renderOptions>;
export type Scene = z.infer<typeof sceneSchema>;
export const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
export function sniffMedia(b: Buffer) {
  if (b.length < 12) throw new Error("The file is empty or not supported.");
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return { kind: "IMAGE" as const, mimeType: "image/png", extension: "png" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return { kind: "IMAGE" as const, mimeType: "image/jpeg", extension: "jpg" };
  if (
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WEBP"
  )
    return {
      kind: "IMAGE" as const,
      mimeType: "image/webp",
      extension: "webp",
    };
  if (
    b.toString("ascii", 4, 8) === "ftyp" &&
    /^(isom|iso2|mp4[12]|avc1|M4V )$/.test(b.toString("ascii", 8, 12))
  )
    return { kind: "VIDEO" as const, mimeType: "video/mp4", extension: "mp4" };
  if (
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WAVE"
  )
    return { kind: "AUDIO" as const, mimeType: "audio/wav", extension: "wav" };
  if (
    b.toString("ascii", 0, 3) === "ID3" ||
    (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)
  )
    return { kind: "AUDIO" as const, mimeType: "audio/mpeg", extension: "mp3" };
  throw new Error(
    "Upload a JPEG, PNG, WebP, MP4, MP3 or WAV file. The actual file format is checked.",
  );
}
export function runProcess(
  binary: string,
  args: string[],
  options: { cwd?: string; signal?: AbortSignal; timeout?: number } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) return reject(new Error("Render canceled."));
    const child = spawn(binary, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    let stdout = "",
      stderr = "",
      timedOut = false;
    const kill = () => child.kill("SIGKILL");
    const timer = setTimeout(() => {
      timedOut = true;
      kill();
    }, options.timeout ?? 90000);
    options.signal?.addEventListener("abort", kill, { once: true });
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > 500000) kill();
    });
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-8000);
    });
    const cleanup = () => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", kill);
    };
    child.on("error", (error) => {
      cleanup();
      reject(new Error(`Media tool could not start: ${error.message}`));
    });
    child.on("close", (code) => {
      cleanup();
      if (options.signal?.aborted) reject(new Error("Render canceled."));
      else if (timedOut)
        reject(new Error("Media processing exceeded its time limit."));
      else if (code !== 0)
        reject(new Error(`Media processing failed: ${stderr.slice(-1200)}`));
      else resolve(stdout);
    });
  });
}
export async function probeMedia(path: string, signal?: AbortSignal) {
  return JSON.parse(
    await runProcess(
      process.env.FFPROBE_PATH || "ffprobe",
      [
        "-v",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        path,
      ],
      { signal, timeout: 15000 },
    ),
  );
}
export function validateProbe(probe: any, kind: "IMAGE" | "VIDEO" | "AUDIO") {
  const video = probe.streams?.find((s: any) => s.codec_type === "video"),
    audio = probe.streams?.find((s: any) => s.codec_type === "audio");
  if (
    kind !== "AUDIO" &&
    (!video ||
      video.width < 1 ||
      video.height < 1 ||
      video.width * video.height > 24_000_000 ||
      video.width > 8192 ||
      video.height > 8192)
  )
    throw new Error(
      "Use an image/video with valid dimensions and at most 24 megapixels.",
    );
  const duration = Number(probe.format?.duration);
  if (
    kind !== "IMAGE" &&
    (!Number.isFinite(duration) || duration <= 0 || duration > 180)
  )
    throw new Error("Audio and video must be between 0 and 180 seconds long.");
  if (kind === "AUDIO" && !audio)
    throw new Error("This file has no playable audio stream.");
  if (kind === "VIDEO" && video.codec_name !== "h264")
    throw new Error("Use an MP4 with H.264 video for browser compatibility.");
  return {
    width: kind !== "AUDIO" ? Number(video.width) : null,
    height: kind !== "AUDIO" ? Number(video.height) : null,
    duration: kind !== "IMAGE" ? duration : null,
  };
}
export function validateRenderScenes(scenes: Scene[]) {
  if (!scenes.length || scenes.length > 12)
    throw new Error("Use between 1 and 12 scenes for a render.");
  if (new Set(scenes.map((s) => s.id)).size !== scenes.length)
    throw new Error("Scene identifiers must be unique.");
  if (scenes.reduce((n, s) => n + s.duration, 0) > 180)
    throw new Error("A render can be at most 180 seconds long.");
  for (const s of scenes) {
    sceneSchema.parse(s);
    if (s.onScreenText.length > 180 || s.caption.length > 300)
      throw new Error(
        "Keep each scene's on-screen text under 180 characters and its caption under 300 characters.",
      );
    if (!["", "cut", "fade"].includes(s.transition.toLowerCase().trim()))
      throw new Error(
        "Choose Cut or Fade for each scene transition before rendering.",
      );
  }
}
export function captionSrt(scenes: Scene[]) {
  const time = (sec: number) => {
    const ms = Math.round(sec * 1000);
    return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
  };
  let index = 0;
  const lines: string[] = [];
  for (const { scene, start } of sceneTimeline(scenes)) {
    for (const cue of sceneCaptionCues(scene))
      lines.push(
        `${++index}\n${time(start + cue.start)} --> ${time(start + cue.end)}\n${cue.text.replace(/\r/g, "").replace(/\n\s*\n/g, "\n")}\n`,
      );
  }
  return lines.join("\n");
}
