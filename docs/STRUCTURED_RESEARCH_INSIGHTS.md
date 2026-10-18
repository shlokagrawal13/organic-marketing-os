# Structured research insights

RESEARCH-01F adds optional, manually entered competitor/search analysis to a cited research observation. RESEARCH-01G extends it with audience/community interpretations; see `docs/AUDIENCE_COMMUNITY_INSIGHTS.md` for their bounds, missing-list behavior and three-agent context. These cover bounded parts of master sections 18, 20, 21 and 47. RESEARCH-01 remains Partial. The application does not retrieve these sources or measure demand, engagement, rankings or competitor performance.

| Requirement | Implemented slice | Remaining acceptance |
| --- | --- | --- |
| 18 — structured knowledge feeding strategy | A source record can carry one category-matched insight; reviewed sources freeze the insight in the actual provider context and research trace | Structured audience/community and other research domains; factual/relevance evaluation |
| 20 — opportunities and differentiation | Competitor subject, observed theme/format/positioning, proposed opportunity, differentiation and explicit assumptions | Authorized collection; posting-pattern/engagement analysis; semantic no-copy, relevance and quality evaluation |
| 21 — SEO/AEO and answer-oriented content | Proposed search query, intent, candidate keywords/questions, answer angle and explicit assumptions | Authorized measured demand; generated title/description/FAQ/structured-content workflows and search/answer-quality acceptance |

## Intake and review

The existing record remains the source of provenance, URL, source label, observed/collected times, market/language and review. An optional `insight` is COMPETITOR, SEARCH, AUDIENCE or COMMUNITY and must match the record category. INDUSTRY and SEASONAL cannot carry it. Unknown fields and unsupported measurements are rejected. Existing API clients may omit it; omission or explicit null saves no structured insight. Updates remain whole-record replacements, so clients preserving an insight must send it with their edit.

Competitor fields are subject (160 characters), contentTheme (300), format (120), positioning (500), opportunity (500), differentiation (500) and assumptions (500). Search fields are query (200), intent (INFORMATIONAL/COMMERCIAL/NAVIGATIONAL/TRANSACTIONAL), 1–8 keywords (80 each), 1–5 questions (200 each), answerAngle (500) and assumptions (500). All fields are required when enabled. Trimmed serialized analysis must also fit within 6,000 UTF-8 bytes. The browser shows the limits and treats candidate lists as one item per line. Category changes clear the optional draft analysis.

Every edit, including an insight-only edit or removal, increments the source revision and clears acceptance. Current tenant membership, writer/reviewer roles, optimistic revisions, workspace/record lock ordering and observation expiry remain enforced. Acceptance rejects malformed stored insights; source lists mark them unusable. Manual review records a human decision; it does not prove truth, rights or semantic quality.

## Strategy, history and interpretation

Eligible evidence carries the full structured insight, without truncation, in its fingerprint and frozen snapshot. It shares the existing latest-100 matching window, 10-source cap and total 24,000-byte UTF-8 snapshot bound. A whole source can be omitted for capacity; coverage records that omission. No omitted or foreign-source analysis enters the context. Source revision, acceptance, fingerprint and expiry are rechecked before generation/provider fallback. Later edits cannot replace old analysis inside queued or completed jobs.

The provider policy distinguishes an analyst interpretation from the source summary. It requires retained assumptions, differentiation without copying and proposed search hypotheses without invented demand/rankings/traffic. Recommendation reference checks still quote only the captured summary, never insight text. These are structural and identity checks; semantic interpretation, truth and no-copy quality are not automatically established.

The research detail and saved strategy source viewer display the structured fields and assumptions. Old observations/jobs explicitly show that no structured insight was recorded. A nullable additive JSONB migration leaves predecessor records null and preserves existing fields. Absent/null insights are omitted from snapshot evidence, preserving old source fingerprints. Tenant record export and populated archive restore retain source insights, queued snapshots and frozen run context. This archive exercise does not certify native PostgreSQL/private-media cross-store restore.

## Verification

Tests cover strict category/type/field/list/UTF-8 bounds, legacy fingerprint compatibility, tampering and drift, total snapshot capacity, tenant isolation, insight-only acceptance invalidation, provider/trace equality, replay/history/export, summary-only quotation, actual browser forms, category reset, acknowledgement reset, invalid lists and responsive saved views. Populated upgrade checks a real pre-migration observation, then restores null legacy records and structured source/job/run data. Exact executed counts and publication state belong to the dated QA receipt and current checkpoint.

Next after exact-source RESEARCH-01G verification/publication/CI: RESEARCH-01H bounded seasonal/calendar-context audit from master sections 22–23. Preserve manual provenance, source review, selection/coverage and explicit assumptions. Wider competitor/search/audience/community workflows, live adapters, semantic/factual-quality acceptance and full master acceptance remain open. The CI pipeline verifies and does not deploy.
