"use client";
import {
  captionCueSchema,
  captionTimingError,
  MAX_CAPTION_CUES,
  type CaptionCue,
} from "../../../packages/core/captions";

export function CaptionEditor({
  duration,
  cues,
  onChange,
}: {
  duration: number;
  cues: CaptionCue[];
  onChange: (cues: CaptionCue[]) => void;
}) {
  const lastEnd = cues.at(-1)?.end || 0;
  const shapeError = cues.some(
    (cue) => !captionCueSchema.safeParse(cue).success,
  );
  const error = shapeError
    ? "Each cue needs text (1–300 characters) and valid times with up to three decimal places."
    : captionTimingError({ duration, caption: "", captionCues: cues });
  const change = (
    index: number,
    key: keyof CaptionCue,
    value: string | number,
  ) =>
    onChange(
      cues.map((cue, i) => (i === index ? { ...cue, [key]: value } : cue)),
    );
  return (
    <details className="caption-editor">
      <summary>Timed captions ({cues.length})</summary>
      <p className="field-help">
        Manual timing in seconds from this scene's start. Cues replace the
        full-scene Caption; gaps stay blank. Listen and check the rendered
        video. This does not transcribe or automatically align speech. Up to{" "}
        {MAX_CAPTION_CUES} ordered, non-overlapping cues.
      </p>
      {cues.map((cue, index) => (
        <fieldset className="caption-cue" key={index}>
          <legend>Caption cue {index + 1}</legend>
          <div className="form-grid">
            <label>
              Start (seconds)
              <input
                type="number"
                min={0}
                max={duration}
                step="0.001"
                value={cue.start}
                onChange={(event) =>
                  change(index, "start", Number(event.target.value))
                }
              />
            </label>
            <label>
              End (seconds)
              <input
                type="number"
                min={0.001}
                max={duration}
                step="0.001"
                value={cue.end}
                onChange={(event) =>
                  change(index, "end", Number(event.target.value))
                }
              />
            </label>
          </div>
          <label>
            Caption text
            <textarea
              maxLength={300}
              value={cue.text}
              onChange={(event) => change(index, "text", event.target.value)}
            />
          </label>
          <button
            type="button"
            className="button"
            onClick={() => onChange(cues.filter((_, i) => i !== index))}
          >
            Remove caption cue {index + 1}
          </button>
        </fieldset>
      ))}
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="button"
        disabled={cues.length >= MAX_CAPTION_CUES || lastEnd >= duration}
        onClick={() =>
          onChange([
            ...cues,
            {
              start: lastEnd,
              end: Math.min(duration, lastEnd + 1),
              text: "",
            },
          ])
        }
      >
        Add caption cue
      </button>
      {!cues.length && (
        <p className="field-help">
          No timed cues: the full-scene Caption is used.
        </p>
      )}
    </details>
  );
}
