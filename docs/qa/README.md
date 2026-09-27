# Verification evidence — 0.6.0 / 2026-09-27

Captured from the built Next.js application, NestJS API, PGlite, native Redis, S3Proxy and actual FFmpeg. SMTP/text/Stripe use isolated test fixtures; all five browser scenarios passed. Media and screenshots contain synthetic test workspaces and assets, not customer data, live AI generation, real payments or marketing-performance claims.

| File | Evidence |
|---|---|
| workspace-desktop.png / workspace-dark.png | Saved Brand Brain and Creative DNA |
| content-review-desktop.png | Human-approved draft |
| content-mobile.png / auth-mobile.png | Mobile content and registration |
| asset-library-desktop.png / asset-library-mobile.png | Private uploaded image/audio previews |
| video-studio-desktop.png / video-studio-dark.png / video-studio-mobile.png | Successful render, approval and downloads |
| workspace-health-desktop.png / workspace-health-dark.png / workspace-health-mobile.png | Actual service checks, empty tenant counts and private export interface |
| credits-desktop.png / credits-mobile.png | Actual persisted credit balances, reservation and ledger history; synthetic accounting records |
| browser-render.mp4 | Real 3-second 720×1280 H.264/AAC output played and downloaded in browser automation |
| render-1920x1080.jpg / render-720x720.jpg | Actual alternate-format output thumbnails |
| upgrade-restore-evidence.json | Populated PGlite upgrade and fresh-database archive restore; native restore flag is false |
| dependency-audit-summary.json | Production and full npm trees 0 known advisories; Java dependency scope excluded |
| verification-summary.json | Executed suite counts and explicit scope limits |

QA footage is a labelled synthetic image with a generated tone. Browser playback is muted; the HTTP test decodes and checks non-silent audio. It is not generated footage or synthesized voice. UI dates are browser-local. Brand profile completion is field completion, not platform implementation completeness.

Native PostgreSQL races/restore, Docker/MinIO, live providers, full account/media recovery and full master acceptance remain open. See ../VERIFICATION_REPORT.md and ../TEST_STRATEGY.md. Raw runtime logs, email tokens, databases and `.env` are excluded from the archive.

The 2026-09-20.1 continuity update adds `handoff-verification.json` for the offline source packer. That dated run verified extraction, file hashes, change detection, exclusions and preservation of a previous good ZIP on a rejected pack. The 0.4 archive is separately extracted and checked against every included SHA-256 before delivery. These checks add no new application/native/live acceptance claims.
