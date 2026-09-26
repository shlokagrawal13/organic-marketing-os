# Access requirements — current implementation and future gates

## What AI was actually used

The code implements an OpenAI-compatible text chat-completions adapter. `.env.example` defaults to `AI_PRIMARY_URL=https://api.openai.com/v1`; it leaves the key and model blank. The API calls `/chat/completions` with JSON-object output and `max_completion_tokens`. Strategy, content/script and one-scene rewrite are implemented contracts. Primary and fallback are roles, not model names.

No live paid model was configured or called for the delivered tests. The harness supplies visibly test-only HTTP responses and forces primary failure to exercise fallback. Runtime has no such fallback. Native Gemini/Anthropic and generated image/video/voice integrations are not implemented. A compatible endpoint still needs actual compatibility/quality testing; a key alone does not add missing adapters.

The ChatGPT/Codex account used to develop this code is separate from the product's server-side provider configuration. API-key usage has its own usage-based billing; do not assume a ChatGPT subscription supplies the application's API budget. See [OpenAI API quickstart](https://developers.openai.com/api/docs/quickstart) and [OpenAI ChatGPT/Codex pricing](https://learn.chatgpt.com/docs/pricing). No live model/rate recommendation or test-spend amount was chosen in this handoff.

## Minimum access by task

| Task | Access/configuration needed | What that unlocks | What still needs code or verification |
|---|---|---|---|
| Continue code, docs and isolated tests | Current source checkpoint; available local package downloads | Development without AI keys | Missing modules and local dependency fixes |
| DEP-01: closed npm advisory increment | Package registry; Java 17+ and pinned S3Proxy installer for repeatable verification | Fresh full/production npm audits and actual private upload/render/range checks passed | Java tool dependencies and broader security are outside npm audit scope |
| NATIVE-01: real Postgres/Redis and Compose/MinIO | Agent-executable Linux Docker/Compose environment, or private GitHub repository with an enabled Linux Actions runner and necessary source/workflow/run/log permissions | Execute the existing native gate; build/run a disposable Compose stack | Current CI does not yet exercise a populated native database plus media restore or the complete Compose lifecycle; those cases must be added/executed |
| AI-LIVE-01: text model validation | Authorized provider project, server-side key, allowed compatible model/URL and a bounded test-spend decision | Real strategy/content/scene quality, token/rate/failure tests | Fixture success does not establish quality/cost; provider limits remain applicable |
| MEDIA-01: generated image/video/voice | Selected provider sandbox/project with the required model entitlements and bounded live-test spend | Later live adapter tests | Adapters, async provider job IDs, provenance, costs/cancellation and failure recovery must be built first |
| SOCIAL-01 / ANALYTICS-01 | Official developer app for the chosen first platform, allowed callback URL, authorized test Page/channel/account, approved publishing/insight scopes | OAuth/publish/analytics tests with that platform | Token lifecycle, scheduler, variants, unknown-outcome recovery and ingestion are missing; platform approval may be required |
| BILLING-01 | Stripe sandbox/test access, test publishable/secret key and webhook signing secret supplied through secure configuration | Actual test checkout/subscriptions/webhooks without real charges | Credit ledger/reservations now implemented; plans, payment signatures/events/subscriptions still require code and sandbox verification |
| MAIL-01 / CLOUD-01 | Test SMTP sender, restricted private bucket credentials, staging host and domain/DNS/HTTPS control where deployment is requested | Real inbox, private storage and deployed-origin checks | Deliverability, TLS/proxy behavior, least-privilege storage and backup/restore remain to be verified |
| RECOVERY-01 | Disposable native database and private bucket/volume copies, accessible backup destination, ability to restore into separate test targets | Validate populated migration and cross-store restore | Source ZIP and NDJSON data export cannot restore media/database infrastructure |

For GitHub, install/connect the GitHub integration for the selected private project and verify its actual read/write/CI abilities. Connection was confirmed as shlokagrawal13 on 2026-09-26; no Organic Marketing OS repository was returned. This connector has no repository-create action. The earlier GitHub browser attempt reached a sign-in wall, so account connection did not create a browser session. No repository or push is claimed. A source connector alone is not a Docker terminal. If a connector cannot trigger/inspect execution, use an authorized coding environment with the repository and runner instead. No need for unrestricted access to every repository or the user's whole computer.

GitHub Actions container/service jobs require a Linux runner with Docker; see [official PostgreSQL service-container guidance](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers). The checked-in workflow runs on push/pull_request and provides isolated test credentials. Its existence is not a successful run.

Stripe test and live credentials are distinct; use test/sandbox credentials for development. Keep secret keys server-side. See [Stripe API key documentation](https://docs.stripe.com/keys). Public launch, real charges and posting to real audiences need their own explicit scope; test access does not imply them.

## Configuration names, without secret values

The current text adapter needs:

```dotenv
AI_PRIMARY_URL=https://api.openai.com/v1
AI_PRIMARY_KEY=
AI_PRIMARY_MODEL=
```

An optional second provider uses `AI_FALLBACK_URL`, `AI_FALLBACK_KEY`, `AI_FALLBACK_MODEL`. Estimated costs may use `AI_PRIMARY_INPUT_USD_PER_MILLION`, `AI_PRIMARY_OUTPUT_USD_PER_MILLION` and matching fallback names. Rates must be checked against the selected actual model; null/unknown cost must not be reported as zero. The app has product-credit reservations; these are not a cap on currency charged by the external provider.

Product credits use `BILLING_MODE`, `AI_STRATEGY_CREDITS`, `AI_CONTENT_CREDITS`, `AI_SCENE_CREDITS` and restricted `PLATFORM_ADMIN_USER_IDS`. See BILLING.md before enabling enforcement.

Existing services use `DATABASE_URL`, `REDIS_URL`, `S3_*`, `SMTP_*`, `MAIL_FROM`, `WEB_ORIGIN`, `COOKIE_SECURE` and optional media-binary/font paths. Put credentials in the environment's secret/configuration mechanism, not chat text, Markdown, the repository or a handoff ZIP. The agent needs to know which authorized project/services exist and be able to use their configured access; it does not need a pasted account password.

The names of future social/billing/media integration variables are not yet application contracts. Do not add guessed keys to `.env` and claim a missing module is activated.

## What is needed first

A current private code repository plus a verified execution route would unlock native verification and durable shared progress. AI keys can follow when live model testing is ready; only one compatible text provider is necessary initially, with fallback optional. Continue local engineering while those gates remain closed.

Switching development accounts should use the latest source checkpoint and separately authorized connections. This carries saved engineering context; it does not reset a provider's quota, copy secrets or make the account's previous chat/session state available.
