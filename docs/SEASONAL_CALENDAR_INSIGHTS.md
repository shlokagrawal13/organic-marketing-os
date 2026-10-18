# Seasonal and calendar source context

RESEARCH-01H adds an optional SEASONAL interpretation to a manually recorded, cited observation. This is a bounded slice of master sections 22–23, not a verified holiday feed or scheduling engine. RESEARCH-01 remains Partial.

| Requirement | Implemented slice | Remaining acceptance |
| --- | --- | --- |
| 22 — cultural/market context, time zone and seasonal events | Source-scoped cultural context, business relevance, market/language selection and declared or unknown event timing | Verified localization, cultural suitability and live/deployed usefulness |
| 23 — festivals, holidays, industry events, seasonal demand, launches, promotions, important dates, business events | Eight manual event classifications, proposed calendar opportunity, date window, named zone and explicit assumptions | Authorized calendar ingestion, verified dates/recurrence, measured demand, scheduling and semantic/factual quality |

## Manual interpretation contract

A seasonal insight requires eventName (160 characters), eventType, culturalContext (500), businessRelevance (500), proposedOpportunity (500) and assumptions (500). Event types are FESTIVAL, HOLIDAY, INDUSTRY_EVENT, SEASONAL_DEMAND, PRODUCT_LAUNCH, PROMOTION, IMPORTANT_DATE and BUSINESS_EVENT. These are operator classifications; choosing HOLIDAY does not verify a holiday and choosing SEASONAL_DEMAND does not establish measured demand.

Timing is explicit. dateStatus UNKNOWN requires both startDate and endDate to be empty strings. DECLARED requires both valid Gregorian YYYY-MM-DD dates with startDate <= endDate; impossible dates, normalization and year zero are rejected. Dates describe inclusive local calendar days, not UTC instants or scheduled publication times. timeZone is a named IANA zone (or UTC), at most 100 characters, or an empty string when unknown. Unknown date or zone remains unknown; no default zone, recurrence, observance, year or local custom is invented. The editor clears both dates when switching back to UNKNOWN. Known dates with unknown zone remain an unscheduled hypothesis requiring confirmation.

Complete structured insights share the existing 6,000 UTF-8 byte cap. Category/kind must match, unsupported fields are rejected and existing null/absent insights preserve their earlier source fingerprints. No migration, dependency or pipeline changes were made.

## Eligibility, history and generation

Existing citation, authorization, review, tenant membership, role, revision, freshness and temporal-scope gates remain. A new observation and repeated review cannot renew a declared event window after its inclusive end date in its named zone. The API, capture, execution, provider boundary and current browser view enforce that window in addition to the existing 30-day observation expiry. Local-date comparison uses the named zone, including DST; it does not assume a fixed 24-hour event day. Unknown timing/zone cannot be evaluated as a confirmed current event; such context remains an explicitly uncertain research hypothesis under the existing source review gates. Old SEASONAL observations without an insight retain their previous source-only behavior.

A saved snapshot is validated as of capture time. A later ended window withdraws that source before generation without erasing captured history or substituting newly edited values. Changes to any insight field clear acceptance and change its fingerprint. Selection by category/market/language, the latest-100 matching window, 10-source cap and 24,000-byte snapshot budget remain; expired windows contribute to the existing expired rejection count. Actual provider and research/audience/community traces receive the same frozen context. Policies require verification before scheduling and prohibit inventing timing, recurrence, customs, event occurrence or demand. Source references still quote source summaries, not analyst opportunity text.

Tenant export preserves current source data separately from queued snapshots and completed runs. Populated upgrade/archive restore verifies both unknown and declared seasonal timing alongside SEARCH/AUDIENCE/COMMUNITY, empty lists, legacy nulls, selection, coverage and recommendation references. The archive test uses PGlite; native PostgreSQL/private-media cross-store restore remains open. A portable source ZIP is not a database or media backup.

## Verification and next work

Unit checks cover all eight event types, strict fields, unknown timing, impossible/leap dates, date ordering, IANA zones, inclusive midnight/DST, source edits, expiry at capture/execution/provider boundary, history compatibility, selection and UTF-8 capacity. Native HTTP checks include persistence of all five insight kinds, invalid timing/zone rejection, review invalidation, ended-window rejection, provider/three-agent context equality, tenant isolation, export and unchanged completed history. Production browser checks cover unknown timing, validation, source acknowledgement reset, saved strategy history, ended-window acceptance blocking and desktop/dark/mobile readability. Dated QA receipts record completed checks and exact-source publication separately.

Next: RESEARCH-01I bounded industry/trend opportunity audit from master sections 18–19, preserving current/historical/evergreen/emerging/expired distinctions, manual-source provenance, selection, coverage and assumptions. Live research/provider/deployed acceptance, factual/semantic quality, native PostgreSQL/private-media restore and full master acceptance remain open. CI verifies and does not deploy.
