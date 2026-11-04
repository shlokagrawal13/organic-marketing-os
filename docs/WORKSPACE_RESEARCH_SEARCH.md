# UX-01K: Research in workspace search

Workspace search now includes saved research observations. A research result shows a bounded title and summary, review status, and the existing result timestamp. Search terms match saved title, summary, source label, market, and language. The query binds every branch to the active organization and does not return source URLs, structured insights, private object keys, or full research bodies. The same read roles and membership checks as the research detail endpoint apply.

Opening a result navigates to the exact tenant-scoped research record. The research library normally loads its 100 most recently updated records; a searched record outside that window is fetched by its ID and included in the list. A missing or inaccessible result reports the read failure rather than silently opening a different record. Existing navigation and workspace-switch guards remain in force. Search and opening do not change evidence, reviews, or publication state.

This is saved-record discovery, not a claim that any source is accurate or current. Freshness and strategy eligibility are evaluated by the existing research detail view. Large-tenant search performance, other domains, and production/deployed acceptance remain open.
