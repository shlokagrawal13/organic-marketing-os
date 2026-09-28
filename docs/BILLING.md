# Billing and credits — 0.6.1

The app has a real product-credit ledger, AI reservation lifecycle, database-backed subscriptions and durable invoice views. Version 0.6 added an official Stripe SDK adapter for hosted Checkout, Customer Portal and signed subscription/invoice webhooks. The 0.6.1 local increment adds `BillingInvoice`, invoice list/detail APIs, invoice visibility in Credits & usage and explicit refund/dispute/fraud/proration policy. The contract is locally verified against isolated fixtures and direct PGlite processing; no real Stripe account, card, charge or sandbox lifecycle was used.

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

## Plans, entitlements and signed billing events

The eighth migration adds `BillingPlan`, `BillingSubscription` and `BillingEvent`. Free, Starter and Growth plan records are seeded as configuration data; the active subscription stores the workspace entitlement source and current billing period. `GET /api/workspaces/:organizationId/billing` returns the current plan/entitlements to OWNER, ADMIN and ANALYST members without exposing provider identifiers.

`POST /api/billing/webhooks/test` is public only at the session layer and is protected by a raw-body HMAC. Set a random `BILLING_WEBHOOK_SECRET` of at least 32 characters. Send Unix seconds in `X-MOS-Billing-Timestamp` and lowercase/uppercase hex HMAC-SHA256 in `X-MOS-Billing-Signature`, calculated over `<timestamp>.<exact raw JSON body>`. Timestamps outside five minutes, malformed headers and wrong signatures return 401. This endpoint is a deterministic integration contract, not a claim of Stripe compatibility.

The inbox stores provider event ID, exact payload hash, source timestamp, processing state and workspace. An exact replay returns the stored result; the same event ID with a changed payload returns 409. Processing locks the event row. Subscription changes compare source timestamp and event ID, so a late older event is recorded but cannot overwrite newer state. A signed `invoice.paid` event grants the plan's database-configured monthly credits once and only for an ACTIVE/TRIALING subscription. Signed `credits.refunded` and `credits.expired` events append negative corrections; they never rewrite ledger rows or make balances negative. Insufficient unused credits leaves the event failed for operator review instead of silently changing reserved/spent usage.

Supported test event types are `subscription.upserted`, `subscription.canceled`, `invoice.paid`, `credits.refunded` and `credits.expired`. Entitlement changes come from processed signed events, never a browser success redirect. `invoice.paid` may include `externalInvoiceId`, `status`, `currency`, `amountDue`, `amountPaid`, `hostedInvoiceUrl` and `invoicePdfUrl`; these values are stored for workspace invoice views and do not by themselves change entitlements beyond the verified paid-invoice event.

## Stripe Checkout, Portal and webhook mapping

Stripe is off by default. `STRIPE_MODE=test` accepts only `sk_test_` keys and test-mode webhook events; `live` accepts only `sk_live_` keys and live events. Both enabled modes require `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER` and `STRIPE_PRICE_GROWTH`. Price IDs must be distinct. Invalid or partial configuration refuses API startup. The optional API-base override exists only for loopback development tests and is rejected in production.

OWNER/ADMIN members can request idempotent hosted sessions with UUID request keys. Checkout sends one configured recurring price, workspace/plan metadata, the signed-in email or bound Stripe customer, and server-owned success/cancel URLs. Active Stripe subscriptions must be changed through Portal. Returned redirects are accepted only from `checkout.stripe.com` or `billing.stripe.com`. The UI shows plan actions only when configured.

`POST /api/billing/webhooks/stripe` uses the official raw-body Stripe signature verifier with a five-minute tolerance and rejects test/live mismatches. `customer.subscription.created`, `.updated` and `.deleted` map into the durable ordered subscription inbox; exactly one configured plan price is required. `invoice.paid` maps to the existing one-time monthly grant and persists invoice metadata such as amount, currency, period and hosted invoice/PDF URLs when Stripe supplies them. Events without this product's workspace metadata are acknowledged as ignored. Webhook state—not Checkout redirect state—controls entitlements and credits.

`GET /api/workspaces/:organizationId/billing/invoices` returns the latest verified invoices for OWNER, ADMIN and ANALYST members. `GET /api/workspaces/:organizationId/billing/invoices/:invoiceId` returns a tenant-scoped invoice detail with its source billing event and subscription snapshot. The Credits & usage UI lists invoice periods, status, granted credits, paid amount when known and provider invoice/PDF links when available.

Refund/dispute/fraud/proration policy is explicit but deliberately conservative:

| Area | Current behavior |
|---|---|
| Refunds | Money refunds are initiated in the payment provider. The app only reverses unused product credits after a signed refund event; insufficient unused credits fail for operator review. |
| Disputes | Disputed or chargeback payments do not rewrite ledger history. Access changes require signed subscription events, and disputed credits should be reversed through signed provider or platform adjustments. |
| Fraud warnings | Fraud warnings pause operational trust for the account until an operator reviews the provider record. No automatic credit grant is made from a browser redirect or unsigned notice. |
| Proration | Plan changes are made through the billing portal. The payment provider owns currency proration; Organic Marketing OS applies entitlements and monthly credits only from verified subscription and paid-invoice webhooks. |

Actual Stripe sandbox/live acceptance, provider-originated refund/dispute/fraud event mapping and real money movement remain open. The provider-neutral signed test endpoint remains for deterministic contract tests and refund/expiry ledger behavior.

## Verification and limits

Local HTTP checks cover duplicate concurrent grants, changed-key conflicts, platform/tenant boundaries, quote rejection, reservation/settlement/cancellation, insufficient-credit contention, review resolution, invalid/stale provider-neutral and Stripe signatures, event replay/payload conflict, out-of-order subscriptions, one-time monthly grants and idempotent refund/expiry reversals. The Stripe fixture additionally inspects Checkout/Portal form fields, tenant metadata, role denial, idempotency keys, customer binding and paid-invoice mapping. The 0.6.1 direct PGlite verification applied all nine migrations, processed subscription and invoice events idempotently, persisted one invoice and verified the monthly credit grant. Worker SIGKILL recovery preserves an unknown outcome in REVIEW without another accepted provider call. Direct PGlite SQL tests reject ledger edits/deletes and retain immutability after restore. Native Prisma-trigger and locking checks remain a CI gate; PGlite's socket bridge is not native PostgreSQL concurrency evidence.

Next BILLING-01 gate: authorized Stripe sandbox Checkout/renewal/cancel/refund lifecycle plus provider-originated dispute/fraud/proration evidence. Never grant entitlement solely from a frontend success redirect.
