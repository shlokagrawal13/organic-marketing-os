# Project handoff — 0.9.2 / 2026-10-02

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
allowlists, bounded image/voice options, separately quoted editing with one to
four ordered verified private image references, active credit-resolution guards
and retained UNKNOWN output reconciliation. Custom voices, another provider and
video reference modes remain; MEDIA-LIVE-01 requires authorized live
model access and spend. Advanced editing and other master modules remain pending.
Do not reset all completed work to pending because native/live gates are open.

The source is published to public `shlokagrawal13/organic-marketing-os` main.
The earlier automatic approval review rejection is a closed audit event after
the user's explicit approval for this public upload. Never touch the unrelated
`OrganicMarketing` repository.

The previous account-side Actions gate is cleared. Application commit
`12173f1e13b9f6210bd0f72ba9a17b28d3b6d9a4` contains the accumulated
retained-output, source-edit and bounded-option slices; all 26 uploaded paths
matched locally. Public run `37111278142` completed every native verification
step successfully.
No Windows deployment update or ChatGPT buffering root cause is claimed.
