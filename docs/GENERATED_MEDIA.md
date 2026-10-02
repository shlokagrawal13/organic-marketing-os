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

Use a provider model compatible with these fixed presets:

| Kind | Contract | Preset |
| --- | --- | --- |
| Image | POST `/v1/images/generations` | GPT Image-compatible; one 1024×1024 medium-quality PNG; base64 response |
| Voice | POST `/v1/audio/speech` | Up to 4,000 characters, built-in Alloy voice, WAV; disclose AI-generated voice |
| Video | POST `/v1/videos`, GET saved ID, GET saved ID/content | One four-second 720×1280 portrait clip; MP4 |

Provider request formats were checked against the official [image reference](https://developers.openai.com/api/reference/resources/images/methods/generate),
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
ID, or resume OUTPUT_READY using saved private bytes. Redis queue entries are
repaired from database records. Poll errors retry reads, not generation. Polling
or ingestion beyond 24 hours requires manual reconciliation. Workers use a
60-second stale lease and a three-minute per-attempt deadline.

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
Reference asset IDs are now tenant-checked before queueing: IDs must be unique,
active image assets in the same workspace. The current OpenAI preset still rejects
source assets before provider submission, so this is a source/reference contract
gate rather than live editing support.

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
reference-image/editing adapters that actually send source bytes to a provider;
additional voices/options/providers; native PostgreSQL/Compose concurrency and
cross-store restore; automatic orphan/staging cleanup; provider billing
reconciliation and output reconciliation after UNKNOWN. An ambiguous object write
may leave a private orphan retained for investigation. No automatic paid retry or
deletion tries to conceal that uncertainty. See MEDIA-01D and DATA-01.
