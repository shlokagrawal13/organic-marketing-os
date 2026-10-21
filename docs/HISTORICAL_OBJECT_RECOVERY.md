# Historical private-object and external-effect prerequisites

RECOVERY-01G adds one phase to the disposable Compose verifier. All fourteen previous phases remain required, together with the unchanged core and native-upgrade/physical jobs. Run `MOS_ALLOW_NATIVE_TESTS=isolated-test-services npm run verify:compose`. On Windows the harness uses Docker Desktop's Linux-engine named pipe; Linux retains the Unix socket. Neither path accepts an inherited Docker host override.

The additional phase runs after the native logical database/object backup is sealed and its rejection controls pass. All five application writers must remain stopped. The host checks the generated Compose project and actual media-volume ownership before launching a temporary fixture container. The experiment uses a separate, initially absent bucket named from that random project. The existing application bucket, backup bytes and restored-queue procedure remain intact.

## Historical version readback

The fixture enables bucket versioning and retains the two initial object version IDs with their exact sizes, SHA-256 hashes, content types, cache controls and metadata. It then overwrites both keys and puts a delete marker on one. Current reads must return later bytes or 404; explicit historical `VersionId` reads must return both originals. Anonymous access to a historical version must remain denied.

Before any readiness callback, the harness validates the entire manifest and every explicitly requested version. Current-version substitution, a wrong historical version, a nonexistent version and mismatched object data are rejection cases. Permanently deleting one original version must produce a native 404 and deny readiness, while the other historical version, current later bytes and the saved manifest remain intact.

Cleanup first checks the exact ownership tag and the entire expected version/delete-marker inventory. It deletes only the listed version IDs, proves that no versions or markers remain, deletes its owned bucket, and proves the bucket absent. The original application's private objects and recovery database rows must still match the sealed backup afterward.

These checks follow the semantics of [S3 GetObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html) and [version/delete-marker behavior](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeleteMarker.html). Execution uses the pinned MinIO fixture, not an AWS account. Protected production version retention, IAM/KMS access, lifecycle rules and remote durability still need separate operational acceptance.

## External effects and readiness

A private synthetic HTTP provider records one effect after the manifest is captured. The fixture reads its confirmed operation identity and checks both accepted effects and submission attempts. Missing or mismatched reviewed receipts must deny readiness. A receipt binds the fixture point, request hash, provider and provider operation ID with an explicit `DO_NOT_REPLAY` disposition. A complete valid object set plus the matching receipt permits exactly one callback. Readback must still show one accepted effect and one submission attempt, making accidental replay requests observable.

The reconciliation helper rejects incomplete inventories, duplicate or ambiguous effects, unknown/duplicate/missing receipts, mismatched identities, unreviewed or ambiguous evidence and replay-permitting dispositions. Empty inventories require an explicit completeness declaration. This is a harness contract with controlled fixture evidence; it does not establish that a real provider inventory is complete or that external financial/publication effects have been reversed.

## Scope and evidence

The sampled database LSN is a correlation label. Objects are created after it is sampled; no database snapshot is bound to those historical versions. `coordinatedRecoveryPointEstablished`, `physicalPitrCombined` and `productionRetentionClaimed` are false. The fifteen-phase logical recovery and the separate application-schema physical recovery remain independent experiments. Coordinated DB/S3/Redis PITR, real-provider reconciliation, production backup operations, deployed behavior and full-master acceptance remain open.

RECOVERY-01F is closed by [its exact-commit CI receipt](qa/recovery01f-native-ci-evidence.json). Current G results and changed paths belong in [G evidence](qa/recovery01g-evidence.json). Every new publication requires all three jobs on its own exact commit. CI verifies fixtures and does not deploy. Source ZIPs exclude private runtime bytes and native backups.
