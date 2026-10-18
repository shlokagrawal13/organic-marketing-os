# Research evidence foundation

RESEARCH-01A adds a workspace library for manually supplied research evidence. An operator records a summary and one source citation, identifies the observation date and context, and submits the current record for human review. This is the first bounded research increment; live ingestion and consumption by the strategy model are separate work.

## Provenance and freshness

Each record retains its workspace, author, server collection time and `MANUAL` provenance. Source URL, source label and observation time are supplied by the operator. The intake acknowledgment confirms the operator is authorized to use that source. Saving a URL does not fetch its contents or prove reachability, quality, rights or factual accuracy.

Categories cover industry, audience, competitor, search, seasonal and community evidence. Temporal scope is independently recorded as current, historical, evergreen, emerging or expired. These are operator classifications, not measured trend scores.

Freshness is recalculated at read and review time. Missing citation, label or observation time yields `MISSING`. Observations at least 30 days old and records explicitly marked expired yield `STALE`. Otherwise complete observations are `CURRENT`. The 30-day limit is an initial bounded policy, not a guarantee that every industry fact remains valid for that period. Reviewing an old record does not renew its observation date.

An accepted, current record with a non-historical/non-expired scope is eligible for future strategy selection. The current strategy and content-generation jobs do not consume this library yet. Historical records may be reviewed as historical evidence, but remain excluded from current strategy eligibility. No missing engagement, search-volume, popularity or competitor metric is invented.

## Access and revision rules

All workspace members can read the library. Owners, admins, editors and creators can create and edit records. Owners, admins and editors can accept or reject evidence. Every read and mutation is scoped to the active workspace; mutations recheck current membership inside their transaction.

Edits and reviews require the loaded revision. Each successful mutation advances it, so simultaneous edit/review attempts cannot silently overwrite each other. Editing clears the previous review. Acceptance requires complete, current evidence and an explicit source-review acknowledgment. Audit entries retain actor, record identity, revision and decision without copying the source URL or text.

## API

All routes are under `/api/workspaces/:organizationId/research`:

- `GET /`: latest 100 records, with computed freshness and eligibility.
- `POST /`: create a manually supplied record.
- `GET /:id`: fetch one record in the workspace.
- `PUT /:id`: edit using `expectedRevision`; invalidate the existing review.
- `POST /:id/review`: accept or reject using `expectedRevision`, `decision`, `note` and `sourcesReviewed`.

The library, review and provenance fields are included in workspace record export and the populated upgrade/archive-restore fixture. A workspace export is not a native database/private-media backup.

## Requirement coverage and next increment

This foundation advances master section 18 to partial coverage. Temporal classifications and freshness support section 19, and source categories prepare for sections 20–23 and 47. Categories alone do not implement competitor analysis, SEO/AEO, localization, calendar intelligence or community analysis.

The next increment should select bounded, current accepted evidence for strategy generation, freeze citations and revisions at queue time, recheck expiry when the worker executes, and pass the same evidence to both the agent trace and actual model request. Old jobs and empty libraries must retain explicit missing-evidence behavior. Live source connectors and real source-quality acceptance remain open.

Verification results for this increment are recorded in the current checkpoint and `docs/qa/research01a-evidence.json` after execution completes.
