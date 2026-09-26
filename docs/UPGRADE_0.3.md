# Upgrade 0.1/0.2 → 0.3 (Windows / Docker)

This release adds reliability fixes, Workspace health and private workspace record export. The sixth migration only adds AI context/recovery fields and an index; the first five migrations are unchanged. The ZIP contains no `.env`, node_modules, live database or media objects.

A populated upgrade and fresh-database restore passed on isolated PGlite data. Native PostgreSQL plus media backup/restore and this Docker release were not executed in the build environment. These instructions are for installation when convenient; no user testing is needed to reproduce the evidence already included in this package.

## Preserve the current installation

Keep the original project folder name and Compose project name `organic-marketing-os`, its `.env`, and its named volumes. Save a private copy of the old source/configuration and take a database backup before replacing source. With the original database running, default setup uses:

```powershell
Copy-Item .env ..\organic-marketing-os-env-backup.txt
docker compose exec postgres pg_dump -U marketing -d marketing -f /tmp/marketing-before-v0.3.sql
docker compose cp postgres:/tmp/marketing-before-v0.3.sql ../marketing-before-v0.3.sql
```

If database user/name were customized, use those actual values. Confirm the commands succeeded and the dump exists. Keep backups private. If upgrading from 0.2, preserve the `media_data` volume and take a private backup of its objects using the storage operator's procedure; a SQL dump or workspace NDJSON alone cannot recover media bytes. Full native restore remains a separate unverified gate.

## Replace source and rebuild

From the existing folder:

```powershell
docker compose down
```

Copy the contents of the ZIP's `organic-marketing-os` folder over the existing source folder. Preserve the existing `.env`; do not rerun setup to generate replacement database credentials. Do not create a nested copy and start it as a different Compose project.

```powershell
docker compose up -d --build
docker compose ps -a
```

The migrate service should exit 0; API, web, both workers and storage should run. Default PostgreSQL/Redis host mappings remain removed, preserving the earlier Windows port-conflict fix. The frontend is [http://localhost:3000](http://localhost:3000) and local mail is [http://localhost:8025](http://localhost:8025). Owners/admins see Workspace health in the sidebar after logging in.

If an error occurs, keep all volumes and inspect:

```powershell
docker compose logs --tail=80 migrate api worker render-worker storage web
```

Never use `docker compose down -v`, remove named volumes, rewrite applied migrations or change POSTGRES_PASSWORD as an upgrade repair shortcut. Retain backups and previous source until the upgraded installation is confirmed. This procedure preserves volumes; it is not an executed rollback guarantee.

## Behavior changes

- New AI jobs retain the brand context/revision captured when queued. Existing queued jobs from older releases have no snapshot and use current brand context.
- Same request key plus changed input now returns 409. Interrupted provider calls fail without an automatic repeat, since external charges may be unknown.
- Manual brand/content/uploads/rendering work without AI keys. AI-generated content remains unavailable until a compatible provider is configured.
- Workspace health reports real checks/counts and distinguishes configured providers from live verification. Export includes record pages plus authenticated media references, not media bytes or a restore format.

For host source development, use `npm ci`, `npm run build`, checked-in migrations and restart API/both workers. See SETUP.md for optional host ports and FFmpeg. Do not apply these development commands to a real database without the same configuration/backup care.
