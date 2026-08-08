# Security and trust model

## Permission budget

Production permissions are deliberately limited to `scripting`, `storage`, and host access on `<all_urls>`.

No network API, telemetry, remote configuration, remote code, cookies/history inspection, debugger attachment, proxy control or native host is used.

## Consequential-consent boundary

The extension blocks independent or combined clauses involving payment/debit authorization, loans/credit, investment/trading authorization, insurance purchase/application, medical informed consent, employment contracts, e-signatures, arbitration/waivers/class actions, biometric/facial-recognition consent, guarantees/powers of attorney, auto-renewal and factual attestations.

The boundary is action-semantic, not industry-semantic. A bank's ordinary login Terms may still be routine; an authorization to debit an account is not.

## Worker/document lifecycle boundary

The Worker treats an explicit `MessageSender.documentLifecycle` other than `active` as non-authoritative. `prerender`, `cached`, and `pending_deletion` senders cannot schedule dynamic injection or mutate site-learning state. Probe/Gate/Engine retain their own lifecycle guards as an independent first line of defense.

Service-worker globals are never correctness authority. Profile state and pending update-rehydration state are stored through `chrome.storage`; content-side handoffs are boundedly retryable after a worker disappears. Profile storage namespaces are derived from Chrome `MessageSender.origin`/`url`; a content tier cannot redirect learning by supplying an arbitrary origin string.

## Update boundary

On update/reload, the Worker rehydrates `bootstrap.js` into already-open tabs with bounded scheduling. Dormant old Probes may hand off to current dependencies; already-active old Engines are left as the sole click authority rather than hot-installing a competing Engine. The extension does not request the `tabs` permission: Chrome's Tabs API is available without it for basic tab operations, and the existing `<all_urls>` host permission supplies the host access needed for injection.

## Threats considered

- misleading CSS/class names;
- split legal/risk words across DOM fragments;
- stale learned selectors after site redesign;
- hidden templates and duplicated inactive modals;
- cross-frame injection storms, queue starvation and stale-document jobs;
- closed/nested Shadow DOM;
- BFCache/frozen/prerender/pending-deletion message races;
- detached-DOM retention through queues/observers;
- pathological multi-megabyte attributes/text nodes;
- mutation storms designed to force synchronous work;
- MV3 service-worker termination during Probe→Gate, Gate→Engine or profile handoff;
- extension update/reload while old pages remain open.

## Hard boundaries

Ordinary content-script extensions cannot guarantee control over Chrome-owned UI, trusted-physical-input checks, opaque Canvas/WebGL UI with no usable DOM/accessibility surface, or semantics intentionally placed outside any finite bounded sample of an unbounded string.
