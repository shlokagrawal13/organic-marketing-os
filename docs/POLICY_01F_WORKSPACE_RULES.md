# POLICY-01F — workspace YouTube policy API

This increment adds tenant-scoped management for the bounded YouTube/Video
rules from POLICY-01E. It supports MASTER_SPEC sections 33 and 40; broader
semantic quality, other platforms/formats and full product acceptance remain open.

## API and authorization

`GET /api/workspaces/:organizationId/youtube-policy` returns the current revision,
rules, effective policy version, update time, deployment rules and `needsReview`.
Only current OWNER/ADMIN members may read or update this management endpoint.
Other approvers continue to see applicable rules through the upload preview.
Cross-tenant requests return 404; disallowed roles return 403.

`PUT` at the same path accepts exactly:

```json
{
  "expectedRevision": 0,
  "rules": {
    "revision": "workspace-youtube-1",
    "platform": "YouTube",
    "format": "Video",
    "titleMaxCharacters": 80,
    "descriptionMaxUtf8Bytes": 4000,
    "allowedPrivacyStatuses": ["private"],
    "requireSyntheticMediaDeclaration": false
  }
}
```

The example is valid only when it does not loosen the deployment policy. Workspace
limits cannot exceed deployment limits; visibility must be a nonempty subset;
a deployment requirement for affirmative synthetic-media declaration cannot be
disabled. Users must make accurate declarations. Platform/format, nonempty
metadata, angle-bracket restrictions and human acknowledgments remain required.

Revision 0 means no workspace override. Every successful PUT increments the
persisted revision, including updates returning to prior values. There is no
delete/reset-to-revision-0 endpoint. Stale writes return 409. Validation occurs
before the short database transaction; organization and current membership rows
are locked, authorization is rechecked, and policy plus sanitized audit receipt
are committed together. No external requests occur under these locks.

The additive `WorkspaceYoutubePolicy` table uses its organization foreign key as
the primary key and cascades on organization deletion. Existing reviews and
earlier migrations are unchanged. Workspace exports include the policy record;
the populated archive-restore verifier also checks its rules, revision and editor.
These exports are not native database/media backups.

## Review and dispatch behavior

An absent workspace policy retains the deployment policy identity, preserving
eligible POLICY-01E reviews. Once configured, effective identity binds the
deployment version, organization ID, monotonically increasing database revision
and normalized rules fingerprint. Changing back to old values cannot reactivate
an old review. Saved upload metadata fingerprints include this effective version.

The tenant-gated preview returns `workspacePolicyRevision`. Review save accepts
that revision (omitted means 0 for unconfigured legacy clients) and compares it
under the organization lock. A policy update between preview and save returns
409. The existing browser sends this revision and reads the effective rules.
Saved reviews remain immutable: prepare and review again after a policy change.

Current policy identity is rechecked at manual guidance, schedule preview/create,
due-worker claim, attempt reservation and the durable SUBMITTING transaction.
Changed policies stop fresh attempts before provider traffic; due schedules move
to NEEDS_REVIEW with POLICY_REVIEW_CHANGED. Existing tenant/channel/content/render,
claim-evidence, expiry, duplicate, uncertain-outcome and role checks remain in place.
The successful attempt records its exact effective policy version and reviewed
metadata. Updates cannot retract a request already handed off at SUBMITTING;
uncertain uploads must never be automatically retried.

Deployment rule changes still require rebuilding/restarting every API/worker and
a current deployment maintenance receipt. Workspace PUT needs no restart and does
not replace that receipt. If tighter deployment rules make a stored workspace
policy invalid, publishing fails closed. Management GET retains the stored revision
and rules with `needsReview: true`, allowing an authorized owner/admin to repair it.

## Verification and remaining work

Current-source execution is recorded in
`docs/qa/policy01f-workspace-rules-evidence.json`; prior POLICY-01E unit/native
evidence is historical. Fixture provider traffic is counted separately from real
Google acceptance. Dedicated native PostgreSQL/Redis fixtures are separate from
the ordinary development database and have no user data or shared volumes.

The policy-management form is the next bounded UI increment; this release exposes
the API and integrates its revision/rules into the existing upload-review browser
flow. Multi-platform policies, comprehensive content restrictions, semantic QA,
live providers, full Compose/MinIO, native cross-store recovery and master
acceptance remain open. See the category-by-category POLICY-01E audit as well.
