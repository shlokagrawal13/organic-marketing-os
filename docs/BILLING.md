# Billing and credits — 0.4.0

The app now has a real product-credit ledger and AI reservation lifecycle. Stripe checkout, subscriptions, invoices, refunds, plan purchases, monthly grants and expiry are not implemented. No money is collected by this release.

## Modes and pricing

`BILLING_MODE=self_hosted` is the default and preserves existing installations: AI jobs use the configured provider directly, with no product-credit requirement. `BILLING_MODE=credits` requires an accepted quote and sufficient available credits before a new text job is saved. Configure the API and text worker consistently. Existing jobs retain their stored reservation; changing mode or prices does not change that reservation.

`AI_STRATEGY_CREDITS`, `AI_CONTENT_CREDITS` and `AI_SCENE_CREDITS` default to 5, 3 and 1 whole credits. Each must be 1–10000. The UI shows the quote before generation. The API requires `maxCredits` at least the current price; a missing/stale allowance returns 409 without starting work. Exact request-key replays return the original job and do not reserve again.

One successful saved AI result consumes its stored quote, including configured fallback attempts. Credits are product units, not dollars or a cap on the provider account's bill. The existing daily-job and pending-job quotas still apply. Uploaded-media rendering is not charged product credits in this increment.

## Accounting and failure behavior

| Event | Credit behavior |
|---|---|
| Authorized grant or correction | Append GRANT or ADJUSTMENT; require a reason and unique operation key |
| New accepted credit-mode AI job | Reserve available credits in the same transaction as the job |
| Insufficient credits | Reject the transaction; no saved job or provider call |
| Cancel while QUEUED | Release the reservation atomically with cancellation |
| Successful saved result | Consume the original quote once, atomically with job success |
| Failure before any provider attempt | Release the reservation |
| Invalid output, failed attempted call or stale interrupted RUNNING job | Retain credits in REVIEW; do not assume the provider charged zero |
| Operator resolves REVIEW | Consume 0 through the reserved amount and release the remainder; append a reasoned settlement |

`CreditAccount` is a cached balance/revision. `CreditEntry` is the append-only record of available/reserved deltas and resulting balances. `CreditReservation` retains the quote and RESERVED/REVIEW/SETTLED/RELEASED state. Shared organization row locks serialize accounting. Unique operation keys and sequences reject duplicates/conflicts. A database trigger rejects UPDATE and DELETE on ledger rows. Corrections require new entries; this is not tamper resistance against a database superuser.

## Administration and visibility

Only authenticated users whose IDs the deployment operator configured in `PLATFORM_ADMIN_USER_IDS`, and whose email is verified, may grant/adjust or resolve review. Tenant OWNER/ADMIN membership does not confer platform authority. Every adjustment/resolution is audited. An ordinary signup cannot select platform authority. Keep this allowlist restricted; full platform account management and MFA remain separate work.

Credits & usage shows actual available/reserved balances, open reservations and paginated history. OWNER/ADMIN have the UI; OWNER/ADMIN/ANALYST can read credit API routes. An authorized platform administrator who also has workspace access sees the adjustment/review forms; cross-workspace platform operations are available through the guarded API. No purchased plan or fake payment balance is shown. The summary currently lists the 100 newest open reservations; history is paginated. Complete platform-wide review tooling remains pending.

Workspace export includes balances, ledger and reservation records while omitting operation keys/request hashes. Financial foreign keys prevent deleting a workspace that retains ledger data. Account deletion, financial retention and anonymization policy must be designed before enabling erasure; do not disable the immutable trigger as a cleanup shortcut.

## Verification and limits

Local HTTP checks cover duplicate concurrent grants, changed-key conflicts, platform/tenant boundaries, quote rejection, reservation/settlement/cancellation, insufficient-credit contention and review resolution. Worker SIGKILL recovery preserves an unknown outcome in REVIEW without another accepted provider call. Direct PGlite SQL tests reject ledger edits/deletes and retain immutability after restore. Native Prisma-trigger and locking checks remain a CI gate; PGlite's socket bridge is not native PostgreSQL concurrency evidence.

Next BILLING-01 increment: database-backed plans and entitlements, signed/idempotent Stripe event inbox, out-of-order subscription/invoice handling, monthly grants, refund/expiry rules, and sandbox checkout/portal verification. Never grant entitlement solely from a frontend success redirect.
