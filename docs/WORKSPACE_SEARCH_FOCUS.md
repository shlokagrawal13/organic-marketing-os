# UX-01L: Keyboard focus in publication search details

The publication preparation detail is shown inside workspace search, without a route transition. Opening it used to remove the focused result button and leave keyboard focus on the page body. Returning also left focus behind the visible search results. Keyboard and screen-reader users then had to find their place again.

Opening a preparation now focuses its detail heading. The heading is programmatically focusable but does not join the normal Tab order. Back to search results restores focus to the exact result button. If the result is no longer present, focus falls back to the search input. The search query, type/archive filters and loaded results are preserved. No publication write or provider call is introduced.

The existing production-browser publication search scenario now activates the result and Back with Enter, checks Shift+Tab to Back and asserts both focus transitions. It retains its frozen preparation, current-content, mobile and no-publication-mutation assertions. This bounded improvement does not close the wider accessibility/device audit or other workspace-search domains.
