# Audience and community insights

RESEARCH-01G extends the existing manually reviewed source contract with optional AUDIENCE and COMMUNITY interpretations. It implements a bounded part of master sections 18 and 47. RESEARCH-01 remains Partial; no interaction collection, audience measurement, sentiment analysis or outbound response occurs.

| Master requirement | Implemented slice | Remaining acceptance |
| --- | --- | --- |
| 18 — audience interests, questions and pain points feeding strategy | Source-scoped audience segment, observed need, optional interests/questions/pain-points, proposed content test and explicit assumptions | Authorized collection; representativeness, factual/relevance and usefulness evaluation |
| 47 — questions, objections, pain points and requests become structured knowledge | Manually classified community signal, general context, observed topic/theme, proposed response/content test and assumptions | Authorized interaction ingestion; verified repetition/frequency; generated FAQ/product-insight workflows; semantic quality acceptance |
| Strategy orchestration | Actual provider plus research, audience and community-intelligence trace inputs use the same frozen research context | Live model/deployed acceptance and demonstrated content effectiveness |

## Bounded interpretation contract

An audience insight requires segment (160 characters), observedNeed (500), proposedResponse (500) and assumptions (500). It also retains explicit interests, questions and painPoints arrays. These lists may be empty when not observed; each has at most five entries. Interests allow 160 characters per entry; questions and pain points allow 200. A source's observed need remains required, so an enabled insight cannot be only an empty audience label. The UI displays empty lists as “Not recorded”; no missing interests or questions are invented.

A community insight requires channelContext (160), signal (QUESTION, OBJECTION, PAIN_POINT, REQUEST or FEEDBACK), topic (200), observation (500), proposedResponse (500) and assumptions (500). Use authorized, de-identified themes rather than personal identifiers or private message text. The schema supplies no person/message identifiers, counters, sentiment scores or automatic send action. Free text is operator supplied; this is not automated redaction or rights verification.

All scalar fields must be nonempty. List entries must be nonempty if supplied. Categories must match the insight kind; unknown fields and unsupported measurements are rejected. Both kinds share the existing 6,000-byte serialized UTF-8 insight bound. Existing COMPETITOR, SEARCH and null/absent records remain supported. No migration, schema, dependency, rate-limit or pipeline change is required.

## Review, strategy and history

Existing tenant membership, writer/reviewer roles, optimistic revision checks, lock ordering and citation freshness apply to both kinds. An insight-only edit clears acceptance. Captured full insights participate in source fingerprints and the 24,000-byte snapshot limit, latest-100 matching window and 10-source cap. Capacity omissions are recorded by existing coverage. Edited, rejected, unavailable or expired sources cannot be substituted into queued jobs.

The actual strategy provider receives the same frozen research context as the research, audience and community-intelligence agent traces. The audience trace also retains the separately declared Brand Brain audience. Content/scene tasks have no newly captured research. Provider and trace policies keep audience/community interpretations source-scoped: missing lists remain missing; neither a manual classification nor a single source establishes prevalence, sentiment, representativeness or a personal profile. Proposed responses are content hypotheses. Nothing is sent to a community.

Recommendation references continue to require exact excerpts from the source summary, never analyst insight text. Source matching, team review and explicit assumptions do not establish truth, semantic entailment, usefulness or factual quality. Old strategy histories retain their original context. Tenant export and populated archive restore retain current source interpretations separately from queued snapshots and completed run history, including empty lists. All 24 existing migrations and the master specification are preserved.

## Verification and next work

Units cover type/category/measurement rejection, empty lists, field/list/UTF-8 bounds, source tampering/withdrawal/expiry, shared snapshot capacity, foreign-source exclusion, summary-only references and actual provider/three-agent trace equality. Native HTTP verifies all four insight kinds, review invalidation, replay, queued withdrawal, tenant isolation, export and unchanged completed history. Production browser cases cover missing-list validation, source acknowledgement reset, community classification/review/edit, saved strategy history and desktop/dark/mobile views. Populated restore retains the prior SEARCH source plus new AUDIENCE/COMMUNITY source/job/run context and old null records. Dated receipts record only checks actually completed.

Next: RESEARCH-01H should audit and implement a bounded seasonal/calendar-context slice from master sections 22–23, preserving manual event/date/timezone uncertainty, market/language selection, source review, coverage and assumptions. Live collection/provider/deployed acceptance, broader research and policy quality, native PostgreSQL/private-media cross-store restore and full master acceptance remain open. CI verifies and does not deploy.
