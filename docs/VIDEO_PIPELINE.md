# Video pipeline — 0.9.2

Uploaded or privately ingested generated images, H.264 clips and audio produce a real MP4 through FFmpeg. Generated-media presets require explicit configuration and consent; see GENERATED_MEDIA.md. Live provider acceptance remains open.

## Flow and files

Save a video draft with stable scene IDs and optional tenant-owned visual/narration asset IDs. Queue `/renders` with its current revision, a UUID request key and rendering options. The API locks/checks the revision, validates inputs and persists an immutable snapshot plus asset references. A separate BullMQ render worker claims the database job, downloads private inputs, verifies their hashes, renders scenes, joins them, mixes optional music and probes the final result. It stores a private MP4, JPEG thumbnail and SRT. The browser polls progress and streams authenticated output.

Implementation: `apps/api/src/renders.ts`, `apps/api/src/render-worker.ts`, `packages/core/renderer.ts`, `packages/core/media.ts`; schema models Asset, RenderJob, RenderInput and RenderSegment. The queue is `marketing-render`; one concurrent job runs per worker process.

## Controls and behavior

- Portrait 9:16, landscape 16:9 and square 1:1; 720 or 1080 short-side resolution. H.264 video/AAC audio at 30 fps.
- One to twelve scenes, at most 180 seconds total; output at most 100 MiB. Cut or a short fade through black is supported. This is not an overlapping crossfade editor.
- The storyboard shows deterministic cumulative start/end times. Scenes can be moved earlier/later, duplicated with a new stable ID or removed before saving; attached assets and production fields move with the scene.
- Images/clips use per-scene Fit (whole visual with background borders) or Fill (center crop without stretching). Fit remains the default. Clips loop if shorter than the scene; missing visuals use a colour/text card.
- Scene narration uses an uploaded audio asset, trimmed/padded to the scene. Uploaded video sound is muted. Voiceover/music/SFX descriptions remain script notes; only attached files produce audio. No automatic TTS or licensed music catalog.
- Optional background audio loops across the video with a user-selected volume. Audio is limited to reduce clipping; subjective mix quality still needs review.
- On-screen text and optional burned captions wrap into bounded areas. Manual scene-relative caption cues control video visibility and SRT timing; absent/empty cues preserve full-scene captions. Other writing systems and complex font shaping need their own QA.
- SHA-256 scene caching includes tenant, dimensions/settings, effective caption text/timing, rendering text/duration, visual framing, input hashes and font hash. With burned captions enabled, changing a cue invalidates that scene only. Captions-off scenes ignore cue changes in their video cache key; SRT is still regenerated. Changing visual framing rerenders that scene only. Original assets and completed renders are immutable.

## Optional extra text margins (EDITOR-01N)

Render options accept optional `textPlacement: "inset-v1"`. The Video studio
labels this **Extra margins**; omitting the field retains **Standard placement**
and the previous serialized options, text positions and scene cache identity.
The placement is saved in the immutable render options and displayed with the
preview and history; changing the export-size preset retains the selection.

The versioned composition areas below are fractions of the output frame. Both
title and caption boxes share the listed horizontal limits. Layout reserves a
12-pixel background-box border on every edge, uses the configured font metrics
and grapheme wrapping, and rejects text that cannot fit at the 16-pixel minimum.
Titles align to the top of their box; captions align to its bottom. Portrait
composition leaves additional space on the right and below the captions.

| Aspect | Left–right | Title top–bottom | Caption top–bottom |
| --- | --- | --- | --- |
| 9:16 | 12%–80% | 18%–38% | 52%–72% |
| 16:9 | 10%–90% | 14%–36% | 60%–82% |
| 1:1 | 12%–88% | 16%–38% | 58%–80% |

These are product composition margins, not official platform UI guarantees.
Review the exported video on the intended platform. Per-platform interface,
device, policy and publishing acceptance remains open.

Placement affects both FFmpeg drawtext and opt-in Devanagari glyph-outline
rendering. Changing placement rebuilds scenes with rendered text; empty scenes
retain their cache key. Captions-off scenes still ignore unburned captions, and
cue timing and scene-offset SRT content remain unchanged.

## Audio output QA (EDITOR-01K)

Every newly rendered segment, cached segment and final MP4 must have H.264 video
at the requested dimensions and stereo 48 kHz AAC. Container, video and audio
stream durations must be finite, positive and within 0.2 seconds of the requested
length. Audio start time must be finite and within 0.05 seconds of zero. An
incompatible cached segment is rebuilt; a failed new/final output is not published.
The encoding settings and scene cache key stay the same because this increment
strengthens validation rather than changing the mix.

Real exported AAC is decoded to PCM in isolated tests. Different tone frequencies
identify short narration padded with silence, long narration trimmed at the scene
boundary, the next scene's narration, muted embedded video sound, silent scenes,
short music looping across the full timeline and zero/selected music volume.
Input fixtures exercise mono/stereo at 32, 44.1 and 48 kHz. A deliberately mono
44.1 kHz cache entry is rebuilt; music-only changes retain valid scene caches.

These tests do not certify subjective speech intelligibility, loudness targets,
true-peak clipping, arbitrary channel layouts/codecs, ASR alignment or playback
on physical devices. Those acceptance items remain open.

## Font-aware bounded text layout (EDITOR-01J)

Titles and burned caption cues now wrap using metrics from their selected primary
or fallback font instead of an average character-width estimate. Word boundaries
are preferred; overlong words split only at Unicode grapheme boundaries so a base
letter and its combining accents stay together. Whitespace remains collapsed.

Layout conservatively accounts for shaped and unpositioned glyph bounds and pixel
rounding. Text is limited to 84% of frame width and 28% of frame height per overlay,
with separate title/caption areas and the existing background box. Font size can
shrink to 16 pixels; text that still cannot fit fails with a bounded scene/cue
message before temporary output, storage access or cache work. Shorten that text
or split it into scenes/cues. Draft text and downloadable SRT are not truncated or
rewrapped. Captions-off and explicit-cue overrides retain their existing behavior.

Scene cache version 6 prevents reuse of segments made with the earlier layout.
The font/script policy is unchanged. QA exercises 720 and 1080 short-side output
in all three aspect ratios, including wide Latin, combining marks, Greek/Cyrillic
and Arabic/Hebrew fallback text. Pixel bounds do not certify OCR-level meaning,
every custom font, actual mobile-device legibility or Indic/CJK shaping.

## RTL text shaping (EDITOR-01H)

Arabic and Hebrew rendered titles and burned captions are accepted when the
configured font contains the needed glyphs. FFmpeg `drawtext` is invoked with
`text_shaping=1` so the worker does not depend on the build default. The same
API and worker validation remains in force before queueing or rendering.

This is a bounded RTL slice, not universal multilingual support. Devanagari,
other Indic scripts, CJK, emoji and unsupported symbols still fail with named
policy errors unless a future increment adds appropriate fonts, fallback and
readability QA. Captions-off Unicode SRT behavior remains unchanged.

## Fallback font/readability QA (EDITOR-01I)

The render worker can load trusted fallback fonts from `RENDER_FONT_FALLBACK_PATHS`
using the platform path delimiter. `RENDER_FONT_PATH` remains the primary font.
Every configured file must still be a single TTF/OTF up to 16 MiB. Browser font
uploads, remote font URLs and user-selected font families are not added.

For each rendered title or burned caption cue, the worker chooses the first
configured font that fully covers that overlay's glyphs. If no single configured
font covers the whole overlay, the job fails with the existing bounded missing-
glyph message. FFmpeg receives the selected controlled `fontfile` for that
overlay, and the scene cache key includes the hashes of the full configured font
set so changing fallback configuration cannot reuse stale segments.

Local QA verifies an Arabic/Hebrew render where the primary font lacks those
glyphs and the fallback supplies them, then decodes a real frame and checks that
visible text pixels exist. This is a readability smoke test, not OCR, typography
review, font licensing review or universal complex-script support. Devanagari,
other Indic scripts and CJK remain blocked by the render policy until a dedicated
language/font/shaping increment supports them.

## Configured-font coverage (EDITOR-01G)

The worker checks glyph mappings in the exact font bytes it will copy for FFmpeg,
before creating temporary output, contacting storage, downloading media or using
scene caches. It uses pinned Fontkit 2.0.4, not a hand-written font parser. The
font bytes also remain part of the existing scene cache hash. Each job reloads
the configured file, so font replacement cannot retain stale coverage results.

`RENDER_FONT_PATH` is an optional trusted worker-side file path; blank uses
`/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`. Use a single TTF/OTF file up to
16 MiB. Collections, WOFF/WOFF2, oversized/unreadable files and inspection errors
fail explicitly. When containerized, mount the file and set its in-container path
on the render worker. Browser font uploads or font-family fallback are not added.

Glyph inspection follows the same effective titles and burned cues as script
validation; ignored fallback captions and captions-off Unicode SRT are preserved.
Whitespace is collapsed for coverage checks, matching rendering layout. Missing
characters produce bounded scene/cue and Unicode-codepoint messages in render
history. Controlled font errors are exposed; codec errors and filesystem paths
remain private. The API still applies script policy before queueing; actual font
coverage is worker-side, so it needs no API-side font installation. A missing
glyph fails the queued job before expensive media work; it is not an API 400.

This checks glyph mappings, not visual readability, ligatures, complex shaping,
font licensing or comprehensive font-file sanitization. Font configuration is
trusted administration input. Existing Latin/Greek/Cyrillic script restrictions
remain even if a custom font contains other scripts. Multilingual shaping and
decoded-text readability QA remain separate work. Unit fixtures require system
DejaVu Sans, which the Docker image and CI media setup already install.

Parser reference: https://github.com/foliojs/fontkit (buffer creation and
`hasGlyphForCodePoint` API).

## Rendered-text preflight (EDITOR-01F)

The API rejects unsupported on-screen text before creating a render job, with
the scene ID and caption cue number in the error. The worker uses the same
validation, including for older saved snapshots. Draft storage and voiceover
notes are unchanged; this check neither translates text nor starts speech.

The conservative policy allows Latin, Greek, Cyrillic, Arabic and Hebrew scripts,
basic combining accents and an explicit set of common punctuation/whitespace. It rejects other
scripts, emoji/symbols outside the policy, unsafe controls and invisible format
characters. Common unsupported scripts receive a named explanation. Use an image
asset containing the text where needed. This is script/character preflight, not
inspection of the configured font's glyph table or proof of shaping/readability.
Custom fonts do not expand the policy automatically. EDITOR-01G adds the separate
worker glyph-mapping check above; multilingual shaping remains unverified.

Only effective burned caption cues are checked. Explicit cues replace an unused
fallback caption; with burned captions off, Unicode SRT text remains exportable.
On-screen titles are always checked. Accepted text, rendering and cache keys are
otherwise unchanged; there is no migration or new dependency.

## Named export presets (EDITOR-01E)

The render composer offers three versioned geometry presets plus Custom:

| Preset | Saved ID | Aspect | Output pixels |
| --- | --- | --- | --- |
| Reels / Shorts | `vertical-social-v1` | 9:16 | 1080 × 1920 |
| Landscape video | `landscape-video-v1` | 16:9 | 1920 × 1080 |
| Square feed | `square-feed-v1` | 1:1 | 1080 × 1080 |

Selecting a preset sets aspect and resolution while retaining captions, music,
volume and background. Manually changing aspect or resolution selects Custom.
The composer shows exact output dimensions; preview/history show the settings
saved with that job, independently of the current composer selection.

`POST /renders` accepts `options: { preset: "square-feed-v1" }` and expands the
geometry before hashing and saving immutable job options. Explicit contradictory
dimensions and unknown preset IDs are rejected. Legacy requests retain their
defaults and serialized hash shape. Saved jobs and retries retain the preset ID
and resolved geometry; preset IDs must never be remapped. No migration is needed.
Scene caching continues to use dimensions and effective rendering settings, so
Custom and named renders with identical settings reuse the same scenes.

Create each variant as a separate render from the saved content revision. This
does not rewrite the source draft, platform field, captions, framing or motion,
or transfer approval between renders. Existing tenant, role, revision, quota,
cancel/retry and approval gates apply. Presets describe export geometry only:
they do not validate a platform's upload policies or safe areas, publish content,
or automatically rewrite text and scene composition for different platforms.

## Image camera motion (EDITOR-01D)

Scenes store `cameraMotion: "static" | "slow-zoom"`, defaulting to `static`
for legacy drafts and render snapshots. The editor enables this control only
for attached images. A saved motion preference is preserved when replacing an
asset, but video clips and color/text cards ignore it, including in their cache
keys. Reordering, duplication, generated-media attachment and AI scene rewrites
preserve the preference. Existing revision, tenant and approval gates apply.

Slow zoom starts at 1× and reaches at most 1.08× over the scene's 30 fps frames.
Fit/Fill normalizes the image first, so intermediate frames remain bounded even
for extreme aspect ratios. The centered zoom includes Fit's background borders;
Fill continues to cover the frame. Titles and timed captions are drawn afterward
and remain stationary. Source previews show the original; render to review motion.
Cache version 4 includes the effective image motion. Changing motion invalidates
only affected image scenes. There are no arbitrary filter expressions, speed
controls, panning or migration in this increment.

## Visual framing (EDITOR-01C)

Scenes store `visualFit: "contain" | "cover"` in their existing JSON. Missing values default to `contain`, including old render snapshots. No database migration or arbitrary filter expression is introduced. The editor calls these options Fit and Fill and disables the control when no visual is attached. This applies to uploaded and generated images/video; originals are never modified.

Fit keeps the existing aspect-preserving scale and centered padding using the selected render background. Fill first crops centrally near the target aspect ratio, scales to cover the output, then removes any source-pixel rounding at the edges. Cropping before upscaling prevents extreme aspect ratios from allocating enormous intermediate frames. There is no stretch or user-selected focal point. The source preview remains the original asset, so the UI asks the user to render to inspect final framing. No-asset color/text scenes ignore the framing value.

Mode changes use existing content revision and approval rules. Reorder/duplicate, generated-media attachment and applying an AI scene rewrite preserve the selected mode. Cache version 3 separates the new framing contract from older cached segments; subsequent mode-only edits reuse unchanged scenes. Pixel tests use wide still/video and tall still fixtures with colored edge markers to distinguish borders from center cropping.

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

Missing: live generated-media acceptance, remaining provider-specific reference modes, ASR/word timing, camera panning/custom motion, arbitrary transitions/effects/SFX tracks, drag/drop timeline editing, automatic platform-specific composition/text variants and policy validation, visual/semantic quality models, render-specific financial pricing, CDN/signed sharing, cache/output retention and full operational recovery. Rendering limits are resource guards, not a billing system.


## Optional Devanagari overlays

Set `RENDER_DEVANAGARI_ENABLED=true` on API and render worker only after configuring a trusted covering TTF/OTF through `RENDER_FONT_PATH` / `RENDER_FONT_FALLBACK_PATHS` and FFmpeg with the `librsvg` decoder. It defaults to false. Fontkit applies OpenType substitutions/positions in the selected exact font bytes, emits glyph paths into controlled transparent SVG, then FFmpeg rasterizes and composites PNG overlays. User text never enters SVG markup or font/URL references. Cue timing and fades apply to the composite; Unicode SRT stays unchanged. Ordinary non-Devanagari scenes keep their existing drawtext path/cache identity. Devanagari scenes include runtime/pipeline fingerprints.

Do not infer Hindi shaping from the presence of FFmpeg drawtext/HarfBuzz build flags: the tested FFmpeg 6.1.1 direct path failed visual conjunct/matra QA. Six output geometries and 18 decoded timed frames pass the outline route. Local test font is an unbundled official NotoSansDevanagari-Regular.ttf (SHA-256 `385e78e6359a9d88a0f243d53b1209d7548361ba2194e2b9ec779bcaa7e8949d`); CI installs fonts-noto-core. EDITOR-01M permits mixed Latin/Devanagari overlays across configured fonts, with one covering font per complete grapheme. Full native/container/device and other Indic/CJK acceptance remain open.


## Mixed Latin/Devanagari text (EDITOR-01M)

With Devanagari enabled, a title such as `Video 2026: नई शुरुआत` can use DejaVu Sans for Latin and a configured Noto Sans Devanagari fallback for Hindi. Runs change only between complete grapheme clusters and at script/font boundaries. Fontkit shapes each run independently; units-per-em normalization aligns differently sized font coordinate systems on one baseline. Wrapped lines share the maximum ascent/descent, preserving room when one line is English-only. Measurements include every selected run; a missing complete cluster fails before storage/cache/download work. Spaces must also have a glyph in the selected run's font.

This bounded path accepts Latin/Devanagari plus common/inherited characters already allowed by the script policy. It rejects Devanagari combined with RTL or other scripts; it is not a general bidirectional layout engine. The Devanagari outline fingerprint is `fontkit-outlines-v2-script-font-runs`; configured font byte hashes remain in scene keys. Non-Devanagari caches retain their existing identity. Caption timing, source Unicode SRT and safe outline-only SVG remain in effect.

Verification covers pure Hindi and mixed text across six geometries each (36 decoded frames), portrait/landscape visual review, complete conjunct/Latin-combining wrapping, rejected split-font clusters, same-font cache reuse and changed-font rebuilding. HTTP renders/downloads an actual mixed-script export. Font binaries and generated QA frames remain outside the source checkpoint.
