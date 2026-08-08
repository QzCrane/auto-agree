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

## Update-generation authority boundary

On update/reload, the Worker rehydrates `handover-guard.js` + `bootstrap.js` into already-open tabs with bounded high-priority scheduling. Dormant old Probes may hand off to current dependencies.

Real Chrome testing proved that an old Engine isolated world can remain executable after the new Engine world appears. The new generation therefore does not treat a version sentinel as revocation authority. Instead:

- a stale synthetic agreement click has no current-generation authorization and is canceled by the handover guard;
- a current Engine click receives one exact one-shot target/ancestor authorization immediately before dispatch;
- unused direct authorization expires at the next microtask checkpoint;
- trusted user events are never blocked merely because they are trusted;
- if a trusted user event or a current-authorized Engine click enters a **small local control wrapper**, one descendant synthetic click may be causally delegated only during that same DOM event propagation;
- bubble phase revokes the local causal lease;
- broad `form`, `dialog`, `section`, page/document containers cannot become local lease roots;
- no timer-based lease is permitted to leak authorization into later tasks.

The local causal rule exists because page component implementations often translate a wrapper click into `input.click()`. That nested event is synthetic despite being directly caused by the user. The rule is intentionally narrower than “allow synthetic clicks after any trusted event”: clicking Login cannot authorize a sibling Terms control.

The extension does not request the `tabs` permission: Chrome's Tabs API is available without it for basic tab operations, and the existing `<all_urls>` host permission supplies the host access needed for injection.

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
- extension update/reload while old pages remain open;
- simultaneous old/new isolated-world Engine execution after update;
- stale-generation click attempts under superseded semantics;
- page-owned custom controls that synchronously delegate from trusted wrapper interaction to a synthetic descendant click;
- unused or overlong authorization tokens being reused by later stale work.

## Hard boundaries

The v8→v9 handover cannot be retroactively atomic: v8 shipped no revocable resident generation lease, so there is a finite interval between extension replacement and successful current-guard injection into a surviving frame. Eliminating that historical gap entirely would require prior-generation cooperation or page navigation/reload.

The handover firewall is scoped to Auto Agree's consequential stale authority—agreement-like synthetic clicks. It is not a generic sandbox for arbitrary historical code side effects.

Ordinary content-script extensions also cannot guarantee control over Chrome-owned UI, trusted-physical-input checks, opaque Canvas/WebGL UI with no usable DOM/accessibility surface, or semantics intentionally placed outside any finite bounded sample of an unbounded string.