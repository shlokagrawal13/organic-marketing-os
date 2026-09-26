# AI orchestration

Implemented tasks: marketing strategy, content/script generation, and an individual scene rewrite. New jobs preserve the organization's Brand Brain/Creative DNA and revision when queued; the worker uses that snapshot and delegates through a centralized ModelRouter. Structured outputs are validated before being accepted.

The current system prompt coordinates brand, audience, strategy, writing and editorial responsibilities in a single generation call. **The specified 18-agent execution graph is not implemented.** Agent names in a prompt are not independently operating agents. Research, retrieval, SEO/AEO, visual/voice/video, localization, publishing, analytics, growth and compliance agents need dedicated contracts and tests.

The model receives structured business data, not a historical conversation dump. It is instructed to treat brand/input fields as data, avoid inventing external evidence or current trends, record assumptions and preserve scene IDs. This prompt is not a substitute for factual or policy verification. A human must review all generated claims and usage rights.

Legacy queued jobs created before migration 6 have no snapshot and use the current brand. Worker heartbeats, ownership tokens, abort/deadline handling and no-replay failure semantics are documented in MODEL_ROUTER.md. Fixture tests establish contracts and failure behavior, not live model quality.
