# Video pipeline — 0.2.0

Uploaded images, H.264 clips and recorded audio now produce a real MP4. This is an FFmpeg renderer; AI visual/voice generation is not implemented.

## Flow and files

Save a video draft with stable scene IDs and optional tenant-owned visual/narration asset IDs. Queue `/renders` with its current revision, a UUID request key and rendering options. The API locks/checks the revision, validates inputs and persists an immutable snapshot plus asset references. A separate BullMQ render worker claims the database job, downloads private inputs, verifies their hashes, renders scenes, joins them, mixes optional music and probes the final result. It stores a private MP4, JPEG thumbnail and SRT. The browser polls progress and streams authenticated output.

Implementation: `apps/api/src/renders.ts`, `apps/api/src/render-worker.ts`, `packages/core/renderer.ts`, `packages/core/media.ts`; schema models Asset, RenderJob, RenderInput and RenderSegment. The queue is `marketing-render`; one concurrent job runs per worker process.

## Controls and behavior

- Portrait 9:16, landscape 16:9 and square 1:1; 720 or 1080 short-side resolution. H.264 video/AAC audio at 30 fps.
- One to twelve scenes, at most 180 seconds total; output at most 100 MiB. Cut or a short fade through black is supported. This is not an overlapping crossfade editor.
- Images/clips fit with letterboxing; clips loop if shorter than the scene. Missing visuals use a colour/text card.
- Scene narration uses an uploaded audio asset, trimmed/padded to the scene. Uploaded video sound is muted. Voiceover/music/SFX descriptions remain script notes; only attached files produce audio. No automatic TTS or licensed music catalog.
- Optional background audio loops across the video with a user-selected volume. Audio is limited to reduce clipping; subjective mix quality still needs review.
- On-screen text and optional burned captions wrap into bounded areas. Captions and SRT span each complete scene; they are not word-aligned or speech-recognized. Other writing systems and complex font shaping need their own QA.
- SHA-256 scene caching includes tenant, dimensions/settings, rendering text/duration, input hashes and font hash. Unchanged scenes can be reused after an edit; changed scenes render again. Original assets and completed renders are immutable.

## State and approval

QUEUED → RUNNING → SUCCEEDED / FAILED / CANCELED. Cancellation aborts processing; a canceled job cannot commit success. A retry makes a new immutable job from the old snapshot. Request keys prevent normal duplicate submissions and reject conflicting payloads. Limits: three active jobs and sixty jobs per rolling 24 hours per workspace.

Progress is stage-based, not a completion-time prediction. A worker heartbeat and database reconciliation recover undispatched queued records; stale claimed runs fail explicitly. Individual tool calls and whole jobs have timeouts. This recovery logic exists, but native concurrency, load and process-kill disaster exercises remain unverified.

Rendering a draft is allowed. Final approval requires an authorized approver, explicit confirmation that the video/rights were reviewed, a successful render, and APPROVED content at the same revision. Edits or moving content away from APPROVED clear render approval. Older MP4s remain downloadable with a stale warning; they cannot approve the new revision.

## Verification and remaining scope

Real FFmpeg, private upload/download, byte ranges, non-silent decoded audio, all three aspect ratios, SRT timing, thumbnails, unchanged-scene reuse, cancel/retry and approval invalidation are exercised. Playwright uploads, plays, downloads and approves an actual video. Storage is S3rver in local tests, not verified cloud S3/MinIO. See `TEST_STRATEGY.md`.

Missing: generated media/voice adapters, ASR/word timing, camera motion, arbitrary transitions/effects/SFX tracks, scene timeline editing, platform variants, visual/semantic quality models, credits and financial reservations, CDN/signed sharing, cache/output retention and full operational recovery. Rendering limits are resource guards, not a billing system.
