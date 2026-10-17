## Current continuation — POLICY-01E–G published native CI, 2026-10-18 IST

Accumulated POLICY-01E/F/G source is public on main at `a8495b7179b25f4246716b1a8e00e5f560baa0ec` (tree `32cacfb1c795ffa0426d62b18af4d95965e33a65`); all 54 published paths and the complete tree matched local Git. Exact-source Actions run `39059080016` succeeded: 214 unit/export, 18 HTTP, 12 production browser and 5 recovery cases. API/web builds, bounded English readability, 22 fresh native PostgreSQL migrations, Redis, populated upgrade/archive restore and both zero-vulnerability dependency audits passed. The final native log summary records 214 unit passes; the bounded reporter prints 19 media-case names. Artifact metadata and successful upload were checked; independent ZIP/digest/image inspection is blocked by the environment download-host policy (CONNECT 403).

Standing user instruction: implement, verify, push routine project changes and inspect/fix exact-commit CI before claiming completion. No repeated push permission is required; preserve unrelated changes and never force-push. See AGENTS.md.

POLICY-01 and full master acceptance remain partial. CI is verification-only: deployment, live-provider acceptance and native PostgreSQL plus private-media cross-store restore remain open. Historical local/unpublished notes below are superseded by this publication record; their dated test scopes remain historical.

This evidence/continuity commit follows the verified application source. Its own commit identity and follow-up CI result are read from Git/Actions; the source receipt does not claim that follow-up result in advance.

Next: Start RESEARCH-01 with a bounded source-backed research/evidence foundation: read MASTER_SPEC sections 18-23 and 47, define tenant-scoped research records with citations, collection/review timestamps, provenance and stale/missing-data states, then implement and verify the first ingestion/review workflow. Do not invent source metrics or claim live research from fixtures. POLICY-01 remains partial for wider semantic/multi-platform checks.

Evidence: `docs/qa/policy01g-native-ci-evidence.json` and `docs/qa/policy01g-native-unit-receipts.json`.

Earlier dated records below are historical.

# POLICY-01G — workspace upload-rule management UI

Open Connections → YouTube upload rules as a current workspace owner/admin.
The form uses the POLICY-01F GET/PUT API, displays the saved revision and deployment
bounds, and supports title/description limits, allowed visibility and an optional
restriction to accurate affirmative synthetic-media declarations. It never changes
provider credentials or enables live posting.

A nonempty allowed visibility set and integer limits within deployment bounds are
required. The save action needs actual changes (or repair of invalid stored rules)
and explicit acknowledgment of the effect on existing upload reviews/schedules.
Changing any field resets that acknowledgment. A successful save displays the new
revision; saving never silently overwrites a newer server revision.

A 409 preserves the draft, blocks saving, and offers an explicit discard/reload.
Transient failures preserve inputs and require fresh acknowledgment before retry.
Invalid stored rules show deployment defaults with a repair notice; saving requires
review. A 403/404 removes editable controls. The backend remains authoritative.

Workspace/role/navigation keys and request-generation guards prevent stale responses
from populating another workspace. Unsaved edits trigger navigation/workspace-change
confirmation and browser unload protection. Cancel retains inputs; confirmed discard
remounts the editor with the selected workspace's current rules. Other roles have no
editor and make no management GET from this component. These checks do not certify
full accessibility or all cross-browser behavior.

## Current-source verification

- Production web build passed. Backend/core/schema, prior migrations and dependencies
  are unchanged from POLICY-01F; its native/HTTP results remain dated backend evidence.
- All 12 production browser cases passed, including 3 new real-API policy-management
  workflows. A final focused 3/3 rerun normalized and recaptured visual artifacts.
- New cases cover real owner/admin persistence and audits; numeric/visibility bounds;
  acknowledgment reset/keyboard operation; concurrent update conflict and retained
  draft; a browser-only 503 fault; invalid-record repair; workspace cancel/discard;
  stale owner permission failure; all four restricted roles; and cross-tenant denial.
- Desktop, dark and 390px mobile captures were visually reviewed. Mobile capture
  waits for the sidebar transition, checks no horizontal overflow and captures from
  document top. This is bounded visual evidence, not a full device/a11y audit.
- Independent new test cases reset only disposable fixture auth/API counters because
  one shared loopback IP inherited earlier cases' rate budget. The runtime limiter
  remains enabled and unchanged. Tests cannot run outside the isolated harness.

Initial selector failures were corrected (Connections sits outside the main nav).
The first combined run passed 11 cases but the final case hit inherited auth rate
limits; fixture counter isolation resolved it and the final combined run passed 12/12.
No application/production rate-limit bypass was added. Raw logs stay local; sanitized
scope, hashes and image references are in `docs/qa/policy01g-management-ui-evidence.json`.

The policy management form is complete for this bounded API. Wider brand/IP/semantic
quality, additional platforms/formats, live providers, full Compose/MinIO, native
cross-store restore and master acceptance remain open. The next engineering increment
is RESEARCH-01 source-backed research; all earlier gaps remain on the task board.
