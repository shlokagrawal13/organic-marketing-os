# Private asset library

`apps/api/src/assets.ts`, `packages/core/media.ts` and `packages/core/object-store.ts` implement the media boundary. Files live in a private S3-compatible bucket; PostgreSQL holds tenant ownership, immutable object identity/hash, size/type/dimensions/duration, tags, rights notes and archive state.

## Supported inputs and limits

JPEG, PNG and WebP images; H.264 MP4 video; MP3 and WAV audio. Uploads require an explicit rights acknowledgment. Magic bytes and ffprobe are checked; browser MIME/filename alone are not trusted. Maximum 25 MiB/file, 24 megapixels, 8192 pixels on either dimension, and 180 seconds for audio/video. SVG, HTML, arbitrary remote URLs and unsupported formats are rejected. Codec/container support is intentionally narrower than all formats FFmpeg can decode.

Uploads are limited to 20 per user per minute and 2 GiB of original assets per organization, including archived originals. This source quota does not cover render outputs/segment caches; storage retention and output quotas remain future work. Byte-identical uploads deduplicate within the same organization by SHA-256. Another tenant's file is never returned for deduplication.

## User workflow

Upload → preview → rename/tag → attach to a saved scene → render. Search covers names and tags; filters include image/video/audio and active/archived files. List pagination uses skip/take and total. Writers can upload/edit/archive/restore; all workspace members can read their workspace media. Archived originals remain readable to authorized members and available to existing render snapshots; they cannot be selected for a new render until restored. Archiving is not deletion and does not free quota.

## Access and lifecycle

Asset and render reads recheck the current session and organization membership. The API supports a single byte range for video/audio, rejects invalid ranges, and sends private/no-store headers. Object keys and storage credentials are not exposed. There are no public bucket URLs, signed sharing links or CDN delivery in this milestone.

Failed upload database writes clean up their newly written object when possible. Temporary processing files are removed. Full object reconciliation, orphan collection, malware scanning/quarantine, deletion/retention and large-file multipart uploads are not implemented. Media parsers run as the container's unprivileged user with local-file protocols and timeouts; stronger process isolation remains a production gate.
