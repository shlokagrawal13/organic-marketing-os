# Industry and trend interpretations

RESEARCH-01I adds optional INDUSTRY interpretation to the existing manually cited source record. It completes structured interpretation support for all six research categories. This implements a bounded part of master sections 18–19; RESEARCH-01 remains Partial because live source collection, trend measurement and factual/semantic acceptance are open.

| Requirement | Implemented slice | Remaining acceptance |
| --- | --- | --- |
| 18 — industry trends and market opportunities feed strategy | Source-scoped industry topic, observed pattern, business relevance, proposed opportunity, counter-signals and assumptions frozen into strategy context | Authorized research ingestion and demonstrated relevance, factual quality and usefulness |
| 19 — distinguish current, historical, evergreen, emerging and expired; never present stale information as current | Existing temporal scope stays on the source and snapshot, with unchanged observation expiry, review and execution/provider rechecks | Live trend tracking, verified momentum and quality evaluation where data/API access permits |

## Bounded manual contract

An industry insight requires topic (200 characters), observedPattern (500), businessRelevance (500), proposedOpportunity (500) and assumptions (500). counterSignals is an explicit array with zero to five entries of at most 200 characters each. Empty means not recorded; it does not prove that contrary evidence is absent. An enabled insight still requires its observed pattern and assumptions. The UI displays an empty list as “Not recorded”. Alternatives may be analyst hypotheses and must not impersonate source quotations.

Unknown fields, unsupported measurements/forecasts and category mismatches are rejected. The complete serialized insight shares the existing 6,000 UTF-8 byte cap. All predecessor insight kinds remain supported; old null/absent insights retain the same source fingerprints. No migration, dependency or pipeline changes are required.

## Temporal scope, review and generation

The source's existing temporalScope is authoritative for its declared classification. The insight does not introduce a second, conflicting trend status. A fresh reviewed CURRENT, EVERGREEN or EMERGING source can be selected as source context. These labels do not verify an actual current trend, growth, market size or forecast. HISTORICAL records remain historical context and cannot support current strategy evidence even when team-reviewed. Their library status says “Historical context only”; a recent observation is labeled “Observation: Fresh” separately, rather than presenting historical context as current evidence. EXPIRED records cannot be accepted for current use. Every scope shares the existing 30-day observation gate: repeating review does not renew source age, and labeling an old source evergreen/emerging does not make it current.

Tenant membership, writer/reviewer roles, optimistic revisions, source authorization, review invalidation, selection by category/market/language, latest-100 matching window, 10-source cap and 24,000-byte snapshot budget remain unchanged. Industry insight edits, including counter-signals, clear acceptance and change fingerprints. Captured history stays immutable; execution and actual provider boundary rechecks withdraw changed, unavailable or expired evidence. Actual provider and research/audience/community trace inputs retain the same frozen context. Their policy preserves temporal distinctions and explicitly rejects converting source recency into verified momentum or interpreting missing counter-signals as absence of contrary evidence.

Recommendation source references quote exact source summary text. Proposed industry opportunities and alternative explanations are analyst text and cannot become source quotations. Neither team review nor lexical reference checks establish source truth, relevance, semantic entailment or content effectiveness.

Tenant export keeps current interpretations separately from queued source snapshots and completed run history. Populated upgrade/archive restore retains industry insights with both empty and recorded counter-signals alongside SEARCH/AUDIENCE/COMMUNITY/unknown-and-declared-SEASONAL, legacy nulls, selection, coverage and recommendation references. This archive check uses PGlite; it does not establish native PostgreSQL/private-media cross-store recovery. A source ZIP is not a database/media backup.

## Verification and next work

Units cover strict fields and measurement rejection, list/scalar/UTF-8 bounds, all five temporal scopes, exact age boundary, review without age renewal, source/insight edits, provider-boundary withdrawal, history tampering, tenant exclusion, selection, legacy fingerprints, shared byte capacity and summary-only quotations. Native HTTP verifies all six insight kinds, temporal/review rules, actual provider/three-agent context equality, replay, queued edits, tenant isolation and exported frozen history. Production browser checks cover required assumptions, missing-list validation, acknowledgement reset, historical context, reviewed strategy history and desktop/dark/mobile readability. Dated receipts record checks actually completed and exact-source CI separately.

With structured manual support present across all six categories, the next priority is NATIVE-01: verify complete disposable Compose/MinIO startup and audit native populated PostgreSQL/private-media restore readiness, using current available infrastructure and preserving populated services. Broader research/live provider/semantic quality, deployed acceptance and full master acceptance remain open. CI verifies and does not deploy.
