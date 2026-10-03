import { z } from "zod";

export const MAX_CAPTION_CUES = 60;
const seconds = z
  .number()
  .finite()
  .min(0)
  .max(60)
  .refine(
    (value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-8,
    "Use caption times with at most three decimal places.",
  );
export const captionCueSchema = z
  .object({
    start: seconds,
    end: seconds,
    text: z
      .string()
      .trim()
      .min(1)
      .max(300)
      .refine(
        (text) => !/[\x00-\x08\x0b-\x1f\x7f]/.test(text),
        "Remove control characters from caption text.",
      ),
  })
  .strict();
export type CaptionCue = z.infer<typeof captionCueSchema>;
type CaptionScene = {
  duration: number;
  caption: string;
  captionCues?: CaptionCue[];
};

export function captionTimingError(scene: CaptionScene): string | null {
  let previousEnd = 0;
  for (const cue of scene.captionCues || []) {
    if (cue.end <= cue.start)
      return "Each caption end must be after its start.";
    if (cue.end > scene.duration)
      return "Caption cues must stay within the scene duration.";
    if (cue.start < previousEnd)
      return "Caption cues must be ordered and must not overlap.";
    previousEnd = cue.end;
  }
  return null;
}

// Empty/absent cues preserve legacy scene-wide captions. Cues replace, not layer
// over, that fallback. Cue intervals are half-open [start, end).
export function sceneCaptionCues(scene: CaptionScene): CaptionCue[] {
  if (scene.captionCues?.length) return scene.captionCues;
  return scene.caption.trim()
    ? [{ start: 0, end: scene.duration, text: scene.caption }]
    : [];
}

export function sceneTimeline<T extends { duration: number }>(scenes: T[]) {
  let elapsed = 0;
  return scenes.map((scene, index) => {
    const start = elapsed;
    elapsed += scene.duration;
    return { index, scene, start, end: elapsed };
  });
}

export function timelineTime(seconds: number) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const whole = Math.floor(ms / 1000);
  const fraction = ms % 1000;
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}${fraction ? `.${String(fraction).padStart(3, "0")}` : ""}`;
}
