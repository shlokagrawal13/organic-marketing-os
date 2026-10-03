# Video pipeline — 0.9.2

Uploaded or privately ingested generated images, H.264 clips and audio produce a real MP4 through FFmpeg. Generated-media presets require explicit configuration and consent; see GENERATED_MEDIA.md. Live provider acceptance remains open.

## Flow and files

Save a video draft with stable scene IDs and optional tenant-owned visual/narration asset IDs. Queue `/renders` with its current revision, a UUID request key and rendering options. The API locks/checks the revision, validates inputs and persists an immutable snapshot plus asset references. A separate BullMQ render worker claims the database job, downloads private inputs, verifies their hashes, renders scenes, joins them, mixes optional music and probes the final result. It stores a private MP4, JPEG thumbnail and SRT. The browser polls progress and streams authenticated output.

Implementation: `apps/api/src/renders.ts`, `apps/api/src/render-worker.ts`, `packages/core/renderer.ts`, `packages/core/media.ts`; schema models Asset, RenderJob, RenderInput and RenderSegment. The queue is `marketing-render`; one concurrent job runs per worker process.

## Controls and behavior

- Portrait 9:16, landscape 16:9 and square 1:1; 720 or 1080 short-side resolution. H.264 video/AAC audio at 30 fps.
- One to twelve scenes, at most 180 seconds total; output at most 100 MiB. Cut or a short fade through black is supported. This is not an overlapping crossfade editor.
- The storyboard shows deterministic cumulative start/end times. Scenes can be moved earlier/later, duplicated with a new stable ID or removed before saving; attached assets and production fields move with the scene.
- Images/clips fit with letterboxing; clips loop if shorter than the scene. Missing visuals use a colour/text card.
- Scene narration uses an uploaded audio asset, trimmed/padded to the scene. Uploaded video sound is muted. Voiceover/music/SFX descriptions remain script notes; only attached files produce audio. No automatic TTS or licensed music catalog.
- Optional background audio loops across the video with a user-selected volume. Audio is limited to reduce clipping; subjective mix quality still needs review.
- On-screen text and optional burned captions wrap into bounded areas. Manual scene-relative caption cues control video visibility and SRT timing; absent/empty cues preserve full-scene captions. Other writing systems and complex font shaping need their own QA.
- SHA-256 scene caching includes tenant, dimensions/settings, effective caption text/timing, rendering text/duration, input hashes and font hash. With burned captions enabled, changing a cue invalidates that scene only. Captions-off scenes ignore cue changes in their video cache key; SRT is still regenerated. Original assets and completed renders are immutable.

## Manual timed captions (EDITOR-01B)

Each scene optionally stores `captionCues: [{ start: 0.25, end: 1.75, text: "A useful idea" }]` in its existing JSON. Times are seconds relative to the scene, with at most three decimal places. There are at most 60 cues per scene, each with 1–300 trimmed characters. Cues must be ordered, non-overlapping and within the scene; the end must exceed the start. Unknown fields, non-finite/negative times, excess precision and unsafe control characters are rejected. No database migration is required.

The storyboard can add, edit and remove cues and shows local validation errors. Explicit cues replace the scene-wide `caption`, including blank gaps. Removing every cue restores the fallback caption. Saving uses the existing role/revision checks and invalidates content/render approval. Reordering and duplicating scenes preserve relative cues; applying an AI scene rewrite explicitly clears manual cues.

FFmpeg uses half-open intervals `[start, end)`; output is sampled at 30 fps, so millisecond inputs do not imply millisecond frame precision and a very short cue may have no visible frame. SRT offsets each cue by cumulative scene start. Turning off burned captions affects the MP4 only, not the downloadable SRT. This is manual timing, not ASR, automatic speech alignment or karaoke highlighting.

## State and approval

QUEUED → RUNNING → SUCCEEDED / FAILED / CANCELED. Cancellation aborts processing; a canceled job cannot commit success. A retry makes a new immutable job from the old snapshot. Request keys prevent normal duplicate submissions and reject conflicting payloads. Limits: three active jobs and sixty jobs per rolling 24 hours per workspace.

Progress is stage-based, not a completion-time prediction. A worker heartbeat and database reconciliation recover undispatched queued records; stale claimed runs fail explicitly. Individual tool calls and whole jobs have timeouts. This recovery logic exists, but native concurrency, load and process-kill disaster exercises remain unverified.

Rendering a draft is allowed. Final approval requires an authorized approver, explicit confirmation that the video/rights were reviewed, a successful render, and APPROVED content at the same revision. Edits or moving content away from APPROVED clear render approval. Older MP4s remain downloadable with a stale warning; they cannot approve the new revision.

## Verification and remaining scope

Real FFmpeg, private upload/download, byte ranges, non-silent decoded audio, all three aspect ratios, SRT timing, thumbnails, unchanged-scene reuse, cancel/retry and approval invalidation are exercised. Timed-caption tests compare decoded frames inside/outside the cue and at its end, with captions both enabled and disabled. Playwright saves/reopens cues, uploads, plays, downloads and approves an actual video. Storage is S3Proxy 4.1.1 in local tests, not verified cloud S3/MinIO. See `TEST_STRATEGY.md` and the dated `VERIFICATION_REPORT.md`.

Generated image/video/voice presets, private ingestion and explicit targeted attachment are implemented in 0.9; see GENERATED_MEDIA.md. Voiceover text never starts speech automatically.

Missing: live generated-media acceptance, remaining provider-specific reference modes, ASR/word timing, camera motion, arbitrary transitions/effects/SFX tracks, drag/drop timeline editing, platform variants, visual/semantic quality models, render-specific financial pricing, CDN/signed sharing, cache/output retention and full operational recovery. Rendering limits are resource guards, not a billing system.
