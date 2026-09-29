# Upgrade to 0.8.0

Version 0.8 adds durable AI-agent graph records and a mandatory human review gate for newly generated results. The migration is additive; existing AI jobs and usage remain readable and do not receive synthetic agent traces.

## Before upgrading

1. Back up PostgreSQL and private object storage using your normal recovery process.
2. Preserve the current `.env`; 0.8 adds no required secrets.
3. Stop the API and AI worker together so no job is running across the schema change.
4. Run the normal populated-upgrade check against a disposable copy where possible.

## Apply

```bash
npm ci
npm run db:generate
npx prisma migrate deploy
npm run build:api
npm run build:web
```

Migration `202609290002_agent_orchestration` creates `AIAgentRun`, `AIAgentStep`, their state enums and an optional `AIUsage.agentStepId` link. It does not rewrite prior jobs.

Restart the API, text worker and web application. A new successful AI job should finish with its agent run in `AWAITING_REVIEW`. OWNER, ADMIN or EDITOR must approve it before the web UI permits draft creation or scene application. Compliance-blocked output must be regenerated; it cannot be approved.

## Verify

```bash
npm test
npm run build:api
npm run build:web
npm run verify:upgrade
```

In a service-capable environment also run `npm run verify`. Inspect `GET /workspaces/:organizationId/ai/jobs/:id/trace` and confirm context, generation, compliance, critique and human-gate steps appear in sequence. Never use a production provider or workspace as an acceptance fixture without explicit authorization.

## Rollback

The safe rollback is application plus database restore from the pre-upgrade backup. Do not manually drop the graph tables while 0.8 workers may still write to them. Generated provider calls are external side effects and are not undone by a database rollback.
