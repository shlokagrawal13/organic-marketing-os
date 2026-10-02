# Project handoff — 0.9.1 / 2026-10-02

The user asked to continue the stopped Organic Marketing OS build without losing
prior work. The exact private remote base was restored, v0.8.1 was verified and
committed locally, and work progressed into durable generated media and its UI.

## Preserve

- Architecture and full master spec; twelve additive migrations, all previous SQL
  retained. User credentials, runtime database and media were not accessed.
- Existing accounts/brand/content/review/campaigns/media/rendering, credits/billing,
  model-routing and agent-graph functionality.
- No invented marketing metrics. Synthetic provider outputs exist only in tests.
- No automatic paid retry after UNKNOWN or an interrupted submit boundary.
- Separate local fixture, native infrastructure, live-provider and full-product
  acceptance claims. Exact results live in VERIFICATION_REPORT.md and qa JSON.

## Version 0.9 changes

MediaGeneration persistence and OpenAI image/voice/video adapters now run through
scoped APIs, fixed credit reservations, BullMQ dispatch and private ingestion.
A saved provider ID permits video polling after restart; saved private bytes permit
ingestion recovery. Submission ambiguity keeps credits for review. Byte/magic/
ffprobe checks, quota and tenant dedup run before asset completion. Scene attachment
is explicit and revision checked, preserves other scenes and resets approval.

The Asset library generation panel includes configuration availability, preset,
rights note, estimate acceptance, durable history, private previews/downloads and
attachment actions. Media worker health and sanitized generation exports are wired
in. See GENERATED_MEDIA.md for exact presets, money semantics and remaining limits.

## Continue

Read the checkpoint and task board. MEDIA-01D now has plan-specific model
allowlists and tenant-owned source-reference gates. It still retains provider
source-byte editing, option expansion and output reconciliation; MEDIA-LIVE-01
requires authorized live model access and spend. Advanced editing and other master modules remain pending.
Do not reset all completed work to pending because native/live gates are open.

The source is published to private `shlokagrawal13/organic-marketing-os` main.
0.9.1 source commit `0b9dce36c95027723ea0529e734316b2af039131` points to tree
`c1918f5b14059606dc39b239d5f7ffc7b854b061`, and recursive verification matched
182/182 remote blob paths, modes and SHAs to the local checkpoint with zero
mismatches. The earlier automatic approval review rejection is a closed
audit event after the user's explicit approval for this private upload. Never
touch the unrelated `OrganicMarketing` repository.

The latest observed Actions run `37005496060` remains `startup_failure` with zero
jobs; earlier authenticated evidence named billing, but that UI was not rechecked.
No CI pass, Windows deployment update or ChatGPT buffering root cause is claimed.
