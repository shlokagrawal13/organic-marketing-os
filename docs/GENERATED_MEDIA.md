# Generated media — 0.9.2

Image, video and voice generation now have durable database jobs, tenant APIs,
a BullMQ worker, private asset ingestion and an Asset library → Generate with AI
screen. The first adapter uses OpenAI HTTP contracts. All verification used
isolated fixtures; no live provider quality, availability or charges are certified.
The provider-neutral lifecycle contracts remain in `packages/core/generated-media.ts`.
The concrete synchronous/asynchronous adapter and durable worker are in
`openai-media.ts` and `media-generation-runtime.ts`.

## Enable explicitly

Preserve existing `.env` and add the generated-media keys from `.env.example`.
Set `MEDIA_GENERATION_ENABLED=true`, `OPENAI_MEDIA_API_KEY`, and each enabled
kind's `MEDIA_IMAGE_*`, `MEDIA_VIDEO_*` or `MEDIA_VOICE_*` model, estimate in USD
and credit price. Blank models stay unavailable. There is no implicit default
model, price, runtime fixture, fallback provider or paid API test on startup.
Do not expose the provider key to the frontend. Each media kind may also set
`MEDIA_IMAGE_PLANS`, `MEDIA_VIDEO_PLANS` or `MEDIA_VOICE_PLANS` to a comma-separated
allowlist of `free`, `starter`, `growth` and `self_hosted`; blank means the model
is available to all plans. The workspace plan is resolved before queueing and the
saved provider policy is frozen with the job.

Optional reference-image editing uses the same configured GPT Image-compatible
model and separate `MEDIA_IMAGE_EDIT_ESTIMATE_USD` and
`MEDIA_IMAGE_EDIT_CREDITS` values. Set both or neither. The edit mode accepts
one to four ordered, active tenant-owned images of at most 8 MiB each. The worker reads private bytes,
checks object-key tenant prefix, length, SHA-256 and detected MIME before the
paid submission boundary, then sends multipart bytes to `/v1/images/edits`.
Archived, missing, altered or oversized sources fail without a provider call.
The status API and asset-library UI show the separate estimate when a reference
is selected. The estimate is still not a provider-enforced cost cap.

Image and voice requests expose a bounded option catalog. The operator-configured
estimate and credit quote must conservatively cover every selectable combination;
the app does not infer provider pricing. The normalized selection is stored in
the generation request, returned as its preset and copied into queue/completion
audit evidence. Image output stays PNG so transparent backgrounds remain safe.
Voice output is limited to WAV and MP3 because both pass the private media
validation pipeline. The app supports the provider's built-in voices and speeds
from 0.25x through 4x; custom voice IDs are outside this increment.

Use a provider model compatible with these bounded presets:

| Kind | Contract | Preset |
| --- | --- | --- |
| Image | POST `/v1/images/generations` | GPT Image-compatible; one PNG; 1024×1024, 1536×1024 or 1024×1536; low/medium/high; opaque/transparent |
| Image edit | POST `/v1/images/edits` | One to four ordered owned-image references; same bounded PNG options; multipart input, base64 output |
| Voice | POST `/v1/audio/speech` | Up to 4,000 characters; built-in voice; WAV/MP3; 0.25x–4x; disclose AI-generated voice |
| Video | POST `/v1/videos`, GET saved ID, GET saved ID/content | One four-second 720×1280 portrait clip; MP4 |

Provider request formats were checked against the official [image generation reference](https://developers.openai.com/api/reference/resources/images/methods/generate),
[image edit reference](https://developers.openai.com/api/reference/resources/images/methods/edit),
[speech reference](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create),
and [video guide](https://developers.openai.com/api/docs/guides/video-generation).
Model access, output quality and actual billing still require authorized live tests.

USD figures are **operator-configured estimates**, not provider-enforced spending
limits. The accepted maximum must cover the saved estimate. Fixed presets, a
4-active/20-per-24-hours tenant quota and explicit consent bound requests; they do
not guarantee a final provider bill. OpenAI responses used here do not provide an
actual dollar cost, so it remains null. Never report a missing cost as zero.

In credits mode, reserve the accepted fixed credit price before queuing. Validated
private delivery consumes exactly that reservation. Cancel before submission or
known preflight failure releases it. Unknown submission, invalid output or a
provider-reported failure keeps credits in REVIEW for platform reconciliation.
Self-hosted mode does not reserve product credits; the configured provider account
can still be charged. In-flight cancellation is recorded as a request, without
claiming that the provider stopped or refunded it; a completed result is retained.
Credit review resolution also checks active media-generation state, so a platform
administrator cannot release or consume a media reservation while the related
job is still queued, submitting, pending or waiting for private ingestion.

## Persistence and recovery

The additive twelfth migration creates `MediaGeneration`: frozen request/preset,
tenant request-key/hash, reservation, provider receipt/request ID, output pointer,
asset link, attachment revision, lease, cancellation request and timestamps.

A database claim becomes SUBMITTING **before** the paid boundary. A submit error,
lost acceptance response or expired submit lease becomes UNKNOWN and never
resubmits automatically. A later worker can poll PENDING using its existing video
ID, or resume OUTPUT_READY using saved private bytes. If provider bytes were
written to private storage but the worker lost its database claim before ingestion,
the job is moved to UNKNOWN with the private output pointer retained for platform
review and credits remain in REVIEW. Redis queue entries are repaired from
database records. Poll errors retry reads, not generation. Polling or ingestion
beyond 24 hours requires manual reconciliation. Workers use a 60-second stale
lease and a three-minute per-attempt deadline. Redis queue jobs also have a 120-second renewable lock and 30-second stalled checks: after SIGKILL, backdating a DB claim alone does not remove an active queue lock. The recovery fault fixture now deterministically interrupts a held poll, waits for natural queue recovery within a bounded 210-second test deadline and checks one submission/same provider ID/private output. This is a test budget, not a production recovery SLA; no runtime timing/queue behavior was changed.

Output reads are bounded to 25 MiB. Arbitrary output URLs are never fetched;
provider requests stay on the official origin and redirects fail closed. Only the
isolated non-production harness can select its exact loopback fixture origin.
Magic bytes and real ffprobe validate media kind, codecs, dimensions and duration.
Ingestion enforces the existing 2 GiB workspace asset quota, tenant hash dedup and
active asset checks. Private storage retains provenance in the generation/audit
records, including rights note, model, receipt, request ID and output hash.

A request carries optional content ID, revision, scene ID and component. An explicit
Attach action changes only the chosen visual/narration slot, adds a content version
and invalidates content/render approval. A stale revision returns 409 and preserves
the generated asset for manual use. Repeating an attachment returns its receipt
without applying another content edit. All list/detail/create/cancel/attach routes
check tenant membership; writes require OWNER, ADMIN, EDITOR or CREATOR.
Reference asset IDs are tenant-checked before queueing: IDs must be unique,
active image assets in the same workspace. A separately enabled image-edit
preset supports one to four ordered references; other media kinds and a fifth
reference fail before provider submission. The worker repeats every source check
and verifies every private object before submitting a paid edit.

Workspace health includes the media worker and state counts. Private record
exports include sanitized generation history, excluding private object keys and
worker tokens. Media binaries still need a separate private-store backup.

## Tests and remaining limits

HTTP fixtures exercise image, speech, asynchronous video, interrupted transport,
poll retry, invalid bytes, rights/cost/role gates, duplicate request keys,
reservation settlement/review, queued/in-flight cancellation, tenant isolation,
private downloads, export, attachment idempotency and stale revision protection.
Fault tests actually kill workers and restart them; provider-ID/private-output
recovery does not submit again. Browser coverage creates image/voice assets,
attaches them, renders an MP4 and reloads durable history. These fixtures are
synthetic, never customer outputs.

Pending: authorized live image/video/voice acceptance and signed-redirect behavior;
custom voices/additional providers and video references; native PostgreSQL/Compose concurrency and
cross-store restore; automatic aged staging cleanup and provider billing
reconciliation after UNKNOWN. Ambiguous provider output is retained privately as
structured review evidence instead of being retried or silently deleted. See
MEDIA-01D and DATA-01.
