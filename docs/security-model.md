# Security and trust model

## Permission budget

Production permissions are deliberately limited to `scripting`, `storage`, and host access on `<all_urls>`.

No network API, telemetry, remote configuration, remote code, cookies/history inspection, debugger attachment, proxy control or native host is used.

## Consequential-consent boundary

The extension blocks independent or combined clauses involving payment/debit authorization, loans/credit, investment/trading authorization, insurance purchase/application, medical informed consent, employment contracts, e-signatures, arbitration/waivers/class actions, biometric/facial-recognition consent, guarantees/powers of attorney, auto-renewal and factual attestations.

The boundary is action-semantic, not industry-semantic. A bank's ordinary login Terms may still be routine; an authorization to debit an account is not.

## Threats considered

- misleading CSS/class names;
- split legal/risk words across DOM fragments;
- stale learned selectors after site redesign;
- hidden templates and duplicated inactive modals;
- cross-frame injection storms;
- closed/nested Shadow DOM;
- BFCache/frozen-page stale callbacks;
- detached-DOM retention through queues/observers;
- pathological multi-megabyte attributes/text nodes;
- mutation storms designed to force synchronous work.

## Hard boundaries

Ordinary content-script extensions cannot guarantee control over Chrome-owned UI, trusted-physical-input checks, opaque Canvas/WebGL UI with no usable DOM/accessibility surface, or semantics intentionally placed outside any finite bounded sample of an unbounded string.
