import { z } from "zod";
import {
  OUTLINE_SCRIPTS,
  OUTLINE_UNICODE_CLASS,
  outlineScript,
} from "./render-scripts";
import {
  CJK_LANGUAGES,
  CJK_CHARACTERS,
  cjkTextIssue,
  type CjkLanguage,
} from "./render-cjk";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { sceneSchema } from "./ai";
import { sceneTimeline, sceneCaptionCues } from "./captions";
import { INSET_TEXT_PLACEMENT } from "./render-text-placement";
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
    textPlacement: z.literal(INSET_TEXT_PLACEMENT).optional(),
    cjkLanguage: z.enum(CJK_LANGUAGES).optional(),
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
const emojiOrSymbol = /[\u{1f000}-\u{1faff}\u{2600}-\u{27bf}\ufe0f]/u;
// Script preflight, not a font cmap guarantee. Keep common punctuation explicit.
const supportedRenderCharacters = new RegExp(
  String.raw`^[\t\r\n\x20-\x7e\u00a0-\u00ff\u0300-\u036f\u0590-\u05ff\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\u0900-\u097f\u2000-\u200a\u2010-\u2027\u202f\u2030-\u205e\u20ac\u20b9\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Hebrew}${OUTLINE_UNICODE_CLASS}\u3000-\u303f\u3099-\u309c\u30a0\u30fb\u30fc\uff01-\uff60\uff9e\uff9f]*$`,
  "u",
);
const unsupportedIndicMix = new RegExp(
  String.raw`[^\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Common}\p{Script=Inherited}${OUTLINE_UNICODE_CLASS}]`,
  "u",
);
export const hasDevanagariText = (text: string) =>
  /[\u0900-\u097f\p{Script=Devanagari}]/u.test(text);
export const hasBengaliText = (text: string) =>
  /\p{Script=Bengali}/u.test(text);
export const hasGujaratiText = (text: string) =>
  /\p{Script=Gujarati}/u.test(text);
export const hasIndicOutlineText = (text: string) =>
  Boolean(outlineScript(text)) || CJK_CHARACTERS.test(text);
export function indicMixSupportIssue(text: string, label = "Rendered text") {
  if (hasIndicOutlineText(text) && unsupportedIndicMix.test(text))
    return `${label} can combine enabled outline scripts with Latin, Greek or Cyrillic text, numbers and punctuation only. Separate Arabic, Hebrew and other scripts into another overlay.`;
  return null;
}
export function renderTextSupportIssue(
  text: string,
  label = "Rendered text",
  cjkLanguage?: CjkLanguage,
) {
  const cjkIssue = cjkTextIssue(text, label, cjkLanguage);
  if (cjkIssue) return cjkIssue;
  if (/\p{Script=Sinhala}/u.test(text) && /[\u200c\u200d]/u.test(text))
    return `${label} contains Sinhala joiner-based conjuncts outside the current shaping acceptance. Preserve the joiners and attach this text as an image until that coverage is verified.`;
  if (
    /[\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}\p{Script=Tibetan}]/u.test(
      text,
    ) &&
    /\p{Cf}/u.test(text)
  )
    return `${label} contains shaping or word-break control characters outside current acceptance. Preserve legitimate joiners and word-break controls and attach this text as an image until that coverage is verified.`;
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\p{Cf}]/u.test(text))
    return `${label} contains control characters. Remove them before rendering.`;
  if (emojiOrSymbol.test(text))
    return `${label} contains emoji or symbol glyphs that the current video font cannot guarantee. Remove them or attach that text as an image.`;
  // Script-property matching keeps common danda independent of Hindi opt-in.
  for (const script of OUTLINE_SCRIPTS)
    if (script.pattern.test(text) && process.env[script.environment] !== "true")
      return `${label} contains ${script.name} text but ${script.name} rendering is not enabled. Ask an administrator to configure a covering font and a supported shaping runtime before enabling it, or attach this text as an image.`;
  if (!supportedRenderCharacters.test(text))
    return `${label} contains characters outside the current render policy. Use Latin, Greek, Cyrillic, Arabic or Hebrew text with common punctuation, or attach the text as an image.`;
  return indicMixSupportIssue(text, label);
}
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
    // Preserve UTF-8 characters split across pipe chunks without raising the output cap.
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
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
export function validateRenderedProbe(
  probe: any,
  width: number,
  height: number,
  expectedDuration: number,
) {
  const video = probe.streams?.find((s: any) => s.codec_type === "video"),
    audio = probe.streams?.find((s: any) => s.codec_type === "audio");
  const matchesDuration = (value: unknown) => {
    const duration = Number(value);
    return (
      Number.isFinite(duration) &&
      duration > 0 &&
      Math.abs(duration - expectedDuration) <= 0.2
    );
  };
  const audioStart = Number(audio?.start_time);
  if (
    video?.codec_name !== "h264" ||
    video.width !== width ||
    video.height !== height ||
    audio?.codec_name !== "aac" ||
    Number(audio.sample_rate) !== 48000 ||
    audio.channels !== 2 ||
    !Number.isFinite(audioStart) ||
    Math.abs(audioStart) > 0.05 ||
    !matchesDuration(probe.format?.duration) ||
    !matchesDuration(video.duration) ||
    !matchesDuration(audio.duration)
  )
    throw new Error(
      "The rendered media did not pass codec, dimension, audio format or duration checks.",
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
export function renderedSceneText(
  scene: Scene,
  options: Pick<RenderOptions, "captions" | "cjkLanguage">,
) {
  return [
    { text: scene.onScreenText, label: `Scene ${scene.id} on-screen text` },
    ...(options.captions ? sceneCaptionCues(scene) : []).map((cue, index) => ({
      text: cue.text,
      label: `Scene ${scene.id} caption cue ${index + 1}`,
    })),
  ];
}

export function validateRenderScenes(
  scenes: Scene[],
  options: Pick<RenderOptions, "captions" | "cjkLanguage"> = { captions: true },
) {
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
    for (const { text, label } of renderedSceneText(s, options)) {
      const issue = renderTextSupportIssue(text, label, options.cjkLanguage);
      if (issue) throw new Error(issue);
    }
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
