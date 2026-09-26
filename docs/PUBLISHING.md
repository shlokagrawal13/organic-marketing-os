# Publishing status

The current content states are DRAFT → REVIEW → APPROVED, plus ARCHIVED. Editing invalidates approval. An optional `plannedAt` records editorial intent only and does not enqueue a publication. Calendar copy makes that limitation explicit. Content can be exported as JSON for manual use.

No social OAuth connector, token storage/rotation, platform variant, automatic scheduler, publication worker or provider post ID is implemented. No UI should label a planned item as scheduled or published.

The next phase must use official APIs and authorized accounts. Persist immutable approved revisions, publication attempts, idempotency keys, provider IDs and unknown-outcome states. A timeout must not trigger a blind duplicate post. Apply platform policy/metadata validation immediately before send; respect revoked authorization and manual overrides.
