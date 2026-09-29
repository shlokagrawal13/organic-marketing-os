# Provider catalog

| Capability | Implementation | Configuration | Verification |
|---|---|---|---|
| Text strategy/script/scene | Policy-aware compatible chat-completions adapter | AI_PRIMARY_*; optional AI_FALLBACK_*; declared capability/quality/plan/rates and optional request cap | 0.7 unit contracts for quality/capability/plan/cost/failure policy; earlier HTTP fixture; live account pending |
| Transactional email | Nodemailer SMTP | SMTP_* and MAIL_FROM | Local SMTP capture; real inbox pending |
| PostgreSQL | Prisma PostgreSQL connector | DATABASE_URL | Ten migrations; populated upgrade/fresh restore on PGlite; native CI/restore pending |
| Queue | BullMQ/Redis; separate text/render workers | REDIS_URL | Native Redis locally; AI process-kill/queue-loss and render cancellation/SIGTERM/retry passed; native host-loss/load pending |
| Uploaded media storage | Private S3-compatible adapter | S3_*; optional operator AWS credentials | Real SDK against signed/private S3Proxy 4.1.1; Compose MinIO/cloud S3/R2 pending |
| MP4 rendering | Local FFmpeg/ffprobe, H.264/AAC | FFMPEG_PATH, FFPROBE_PATH, RENDER_FONT_PATH | Real rendering, audio, playback/download and three ratios |
| Generated images/video/voice | Missing | Not active | Not tested |
| Social publishing/analytics | Missing | No active OAuth adapters | Not tested |
| Stripe | Official SDK Checkout/Portal/webhook contract plus durable invoices | STRIPE_* | Isolated contract fixture and direct PGlite; live sandbox pending |

No runtime mock fallback, scraping fallback or fake analytics seed is installed. S3 credentials and text-provider keys are server-side only. File links are authenticated API paths, not public object URLs.

The template defaults `AI_PRIMARY_URL` to `https://api.openai.com/v1`; the adapter calls `/chat/completions`. Keys/models and quality declarations are blank. An undeclared provider defaults to standard, so it cannot silently serve premium strategy/scene work. No paid model was selected or called in verification. The primary/fallback fixture names belong only to the local harness. Other compatible providers must meet the request/response contract and be independently verified; there is no native Gemini/Anthropic/image/video/voice adapter in this release. See ACCESS_REQUIREMENTS.md for required live access.
