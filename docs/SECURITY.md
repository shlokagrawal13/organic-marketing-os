# Security model

Passwords use Node scrypt with random 16-byte salts and 64-byte derived keys. Opaque session tokens have 32 random bytes; only SHA-256 digests are stored. Cookies are HttpOnly, SameSite=Lax and become Secure when configured. Sessions expire after seven days and can be explicitly rotated or revoked. Reset/verification tokens are hashed, expire, and are consumed transactionally; password resets revoke all sessions.

All mutating browser API calls require `X-Requested-With: MarketingOS`; supplied Origin headers must match `WEB_ORIGIN`. CORS permits only that origin. Browser cross-origin scripts cannot supply the custom header without a permitted preflight. Helmet supplies API headers. The UI renders provider content as React text, not unsanitized HTML.

Every tenant route resolves membership in a guard. Roles constrain writes and approvals. Reads, writes, comments, versions and campaign assignments are constrained to the validated organization. There is no user-controlled role on registration. Users cannot invite owners or remove their own owner membership through team removal.

Redis provides atomic per-IP request windows. The service fails closed when the limiter is unavailable. Default: 40 auth requests and 600 other requests per minute. Rate limits are not a complete abuse-prevention system. Configure trusted proxies only behind a restricted ingress, otherwise forwarded IPs can be spoofed. Default proxy trust is off.

## Remaining work before public production

Native database race tests, account lockout/risk controls, stronger password policy evaluation, email enumeration timing review, comprehensive auth event auditing, dedicated CSRF/security review, CSP suitable for the deployed Next.js runtime, audit retention and tamper resistance, service identities, RLS where appropriate, security monitoring, penetration tests and continued dependency scanning. MFA/SSO are not implemented.

No provider key is sent to the browser. Keys are server environment variables. Social connection-token encryption is not implemented because those adapters are missing; S3 service credentials stay in the server environment or operator credential chain. Do not publish the development `.env` or test logs.

## Media boundary

Private S3-compatible objects are accessed through session/membership-scoped API routes. Single ranges support playback without public URLs; responses are private/no-store. Uploads require writer access, rights acknowledgment, a 25 MiB limit, magic-byte checks and ffprobe validation, plus a Redis upload throttle and tenant source quota. Scene inputs must belong to the tenant and match the requested visual/audio role.

FFmpeg/ffprobe use argument arrays without a shell, bounded execution/output, generated local paths, a local-file protocol allowlist and controlled text/font files. User strings are not interpolated into filter commands. Input hashes are verified; failed/canceled jobs cannot publish a successful database result. API/worker containers run as an unprivileged user. Further parser sandboxing, malware scanning, decompression/resource abuse testing, object retention and continued dependency audits remain necessary before public production. No antivirus or DRM assurance is claimed.

Compose's MinIO credentials are local development root credentials. Use a restricted service identity, private bucket, appropriate encryption and private/HTTPS networking for a real deployment. Native access-revocation/concurrency and cloud-storage deployment gates remain open.

## 0.3 hardening and evidence

OWNER/ADMIN alone can access Workspace health/export. Exports omit password/session/token/provider credentials and internal object/run keys, use private temporary files/no-store download headers and enforce per-user/workspace frequency and size/time bounds. All six roles, anonymous/cross-tenant requests, revoked memberships/sessions, invitation single-use/email/expiry/ownership behavior and malformed/oversized multipart are exercised locally. Native transaction races remain a separate gate.

Production startup rejects HTTP WEB_ORIGIN or insecure cookies under NODE_ENV=production; this rejection was executed in a child-process test. It does not establish deployed TLS configuration.

The lockfile updates nodemailer to 10.0.10 and overrides multer to 2.4.0 and deepmerge-ts to 8.0.0. The production dependency audit returned 0 known advisories at release verification. At the 0.3 release, the full tree had 4 advisories (3 high, 1 moderate) through dev-only S3rver 3.7.1/busboy/dicer/fast-xml-parser. The harness binds its S3 emulator to loopback, and runtime images install with `npm ci --omit=dev`; replace/repair this test chain before treating development tooling as cleared. No forced major framework downgrade was applied. The result is time-specific and is not a penetration or supply-chain assurance claim.

## 0.4 credit and tooling boundary — 2026-09-26

Removed S3rver and its vulnerable npm chain. Current production and full npm audits each returned 0 known advisories. Verification uses official S3Proxy 4.1.1 pinned by SHA-256, Java 17+, loopback binding and newly generated SigV4 credentials per run. Anonymous and wrong-signature access were rejected; real private upload/range/render cases passed. The jar's Java dependencies are outside npm audit scope. Native MinIO/cloud policy remains unverified.

Credit mutations require a configured platform-user allowlist and verified email, independently of tenant roles; adjustment and resolution are audited. An append-only SQL ledger, unique operation keys and transaction-scoped organization locks protect ordinary API accounting. The ledger trigger does not defend against database-superuser tampering. Native locking/race verification remains open. Unknown provider outcomes hold credits for review rather than being reported as free calls.
