# Upgrade to 0.6 / 0.6.1

Version 0.6 adds the official Stripe SDK, hosted Checkout/Portal routes and Stripe webhook mapping. It adds no database migration; all eight existing migrations remain unchanged. Preserve `.env`, the Compose project name and every database/storage volume.

Version 0.6.1 adds the ninth migration, `202609280001_billing_invoices`, for durable billing invoice records. Apply migrations normally with `npm run db:migrate` or your deployment's `prisma migrate deploy` step before starting the updated API.

Run `npm ci`, rebuild the API/web images and deploy normally. Stripe remains disabled unless explicitly configured. For test mode set `STRIPE_MODE=test`, a `sk_test_...` secret key, a `whsec_...` webhook secret, and distinct recurring `STRIPE_PRICE_STARTER`/`STRIPE_PRICE_GROWTH` price IDs. Register `/api/billing/webhooks/stripe` for `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` and `invoice.paid`.

Test Checkout, Portal, renewal, cancellation, invoice delivery, refunds, disputes and webhook retries in a disposable Stripe sandbox before considering live mode. A frontend success redirect is never proof of payment or entitlement. Keep `STRIPE_MODE=disabled` if Stripe is not intentionally configured. Never place Stripe secrets in frontend code or commit `.env`.
