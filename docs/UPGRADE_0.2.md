# Upgrade 0.1.0 → 0.2.0 (Windows / Docker)

This release adds the Asset library and Video studio. Your existing project uses the Compose project name `organic-marketing-os`; keep that name and the same database credentials so Docker reuses its volumes. The new media migration is additive. The first four migrations are unchanged. A populated native-PostgreSQL upgrade and restore have not been exercised in the build environment, so make a backup before upgrading.

## 1. Back up before replacing files

Open PowerShell in your **existing** `organic-marketing-os` folder while its database is running:

```powershell
Copy-Item .env ..\organic-marketing-os-env-backup.txt
docker compose exec postgres pg_dump -U marketing -d marketing -f /tmp/marketing-before-v0.2.sql
docker compose cp postgres:/tmp/marketing-before-v0.2.sql ../marketing-before-v0.2.sql
```

Keep both backup files private. Confirm the dump exists and the commands succeeded. This uses a container file copy to avoid PowerShell output-encoding differences. Keep a copy of the old source folder as well.

## 2. Stop, replace source, preserve data

```powershell
docker compose down
```

Extract the new ZIP to a temporary folder. Copy the **contents inside its `organic-marketing-os` folder** over your existing project and allow source-file replacement. Do not create another nested project directory. Preserve your existing `.env`; the ZIP does not contain one. If needed, restore it from the backup above. You do not need to rerun setup or install host npm dependencies when using Docker.

**Do not use `docker compose down -v`, remove volumes, or change `POSTGRES_PASSWORD`.** Those actions can remove data or disconnect the application from its existing database.

## 3. Rebuild and start

From the original project folder:

```powershell
docker compose up -d --build
docker compose ps -a
```

The one-time `migrate` service should finish with exit code 0. Services now also include `storage` and `render-worker`. The first build/image download can take several minutes. PostgreSQL/Redis no longer bind host ports 5432/6379, so the earlier Windows conflicts do not recur from this Compose file.

Open http://localhost:3000, refresh the browser and log in with your existing account. If startup fails, inspect:

```powershell
docker compose logs --tail=80 migrate api render-worker storage
```

Do not delete the database to fix a migration error. Review the error and keep the backup intact.

## 4. Check the new flow

1. **Asset library:** upload a JPEG/PNG/WebP image, H.264 MP4, MP3 or WAV; confirm usage rights. Maximum 25 MiB/file; audio/video at most 180 seconds.
2. **Content library:** create/open a Video draft, add scenes and select visual/narration assets. Save the draft.
3. **Render this video:** choose format/music/captions and queue the render. Preview it and download MP4, thumbnail or SRT.
4. Review and approve the content, then watch the rendered video and approve that exact revision. Editing the content clears the prior approvals.

The narration field holds script text only. Upload/attach recorded audio for speech; AI voice synthesis is a later module. Social publishing and generated-media providers are not part of this release.

Keep the backup until you have confirmed your existing workspace/content and the new media workflow. To stop later, use `docker compose down` without `-v`.
