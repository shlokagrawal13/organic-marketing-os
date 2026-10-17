# POLICY-01E — declarative YouTube metadata policy

## Specification coverage

Reviewed MASTER_SPEC sections 33 and 40 against the existing content, claim,
YouTube policy, posting-guidance and publication-boundary implementations.
This is a bounded increment; POLICY-01 remains partial.

| Requirement | Existing coverage and remaining work |
| --- | --- |
| Brand consistency, tone, visual identity | Brand context and explicit human approval exist; automated semantic/visual consistency remains open. |
| Factual accuracy, grammar, unsupported claims, CTA | Structural checks and bounded claim/evidence review exist; source truth, comprehensive claim detection, grammar and semantic CTA correctness remain open. |
| Copyright/IP, unauthorized material | Human rights acknowledgment and tenant-owned asset checks exist; automated rights/licensing verification remains open. |
| Audio/video quality, captions, resolution, aspect ratio | Container/render bounds and bounded readability/export evidence exist; arbitrary-content perceptual quality, speech/caption accuracy and complete device acceptance remain open. |
| Platform requirements, metadata, restrictions | YouTube upload metadata and explicit declaration review exist. This increment makes a bounded subset declarative. Other platforms, formats and comprehensive restrictions remain open. |
| Brand safety and policy risk | Human approval and bounded checks exist; comprehensive semantic moderation remains open. |
| Spam/repetition | Configurable cadence and bounded title/topic/CTA guidance exist; comprehensive semantic repetition detection remains open. |
| Configurable platform/format rules | Strict YouTube/Video deployment configuration now supports bounded metadata ceilings. A database-managed multi-platform rule engine remains open. |
| Configurable disclosures | Audience and synthetic choices remain mandatory, with all human acknowledgments. Operators may restrict the workflow to synthetic-media declarations. Conditional per-platform disclosures remain open. |
| Rate/frequency guidance | Existing environment-configured posting guidance is retained. These recommendations do not certify platform limits. |
| Update without application rewrite | Edit validated JSON, rebuild and restart API and every worker; no TypeScript edit is needed for the supported settings. Hot reload, workspace settings and rule-management UI remain open. |

## Operator contract

`packages/core/youtube-rules.json` is trusted deployment configuration, not a
tenant request body. It is loaded and validated at module startup. Unknown keys,
invalid types, empty/duplicate visibility sets, unsupported platforms/formats,
fractional limits and limits above the maintained ceilings fail closed.

Supported settings:

- `revision`: operator-maintained identifier.
- `titleMaxCharacters`: 1–100, using the existing JavaScript UTF-16 length semantics.
- `descriptionMaxUtf8Bytes`: 1–5000 after assembling the approved hook/body/CTA.
- `allowedPrivacyStatuses`: nonempty subset of private, unlisted and public.
- `requireSyntheticMediaDeclaration`: when true, only an accurate affirmative
  synthetic-media declaration is eligible; users must not mislabel content to proceed.

Required platform/format, angle-bracket restrictions, nonempty metadata, explicit
audience/disclosure choices and acknowledgments cannot be disabled by config.
The default values retain the earlier metadata/declaration behavior.

Normalized, immutable rules receive a SHA-256 fingerprint included in the effective
policy version. This version also enters the existing official-source manifest
fingerprint, saved review fingerprint, readiness evidence and dispatch checks.
Changing any meaningful setting invalidates old review/maintenance identities;
reordering the allowed visibility set does not. Old saved reviews are immutable:
create a new preparation/review after a rules change.

After a config edit, rebuild and restart **all** API/worker processes together.
The build copies the JSON into `dist`; editing the source without rebuilding does
not change a running process. Confirm the current effective policy version and
source fingerprint using the existing readiness tooling before recording a fresh
operator maintenance receipt. Never copy the earlier static POLICY-01D identity
into the new deployment. The existing default-off live/scheduled flags are retained.
Mixed versions are unsupported; stop dispatch during rollout. The module does
not fetch official pages or establish that external policy has stayed unchanged.

## Publication boundaries

The preview returns the effective rules; the browser offers only allowed visibility
choices and blocks saving an incompatible synthetic declaration. The API derives
metadata from the approved snapshot and enforces the same rules independently.

Reservation now checks the exact tenant, channel, revision, current policy,
unexpired review and metadata fingerprint before inserting an attempt. Submission,
manual guidance, scheduled eligibility and due-worker checks retain their current
version/fingerprint guards. A stale identity stops before outbound provider work.
No schema, dependency, migration or user-data change is needed.

## Verification scope

Current execution evidence is in `docs/qa/policy01e-declarative-rules-evidence.json`.
Saved POLICY-01D native CI is historical and does not verify this new source.
Live Google/AI/Stripe acceptance, native cross-store recovery, full Compose/MinIO
and master acceptance remain open. The earlier context-recovery edits are retained.
