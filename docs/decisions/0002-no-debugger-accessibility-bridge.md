# ADR 0002 — Do not add a chrome.debugger Accessibility bridge

**Status:** rejected for production default

Chrome's full DevTools Accessibility domain is reachable through `chrome.debugger`, but Chrome requires the `debugger` permission and documents that this permission cannot be optional. That permanently widens the warning/trust surface for every user and allows far more instrumentation than Auto Agree needs.

Decision: continue DOM/ARIA/composed-tree inference with minimum permissions. Reconsider only if measured real-world misses show a decisive accessibility-tree benefit that cannot be achieved safely otherwise.

Primary references:
- https://developer.chrome.com/docs/extensions/reference/api/debugger
- https://developer.chrome.com/docs/extensions/reference/api/permissions
