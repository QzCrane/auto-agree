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

Site-learning governance is itself a trust boundary, not just a cache implementation detail. v10 preserves the established limits and identity rules:

- at most 256 persistent origins;
- at most 8 flows per origin;
- 180-day profile TTL;
- 32-entry Worker hot LRU plus `storage.session` and `storage.local` layers;
- exact flow identity by fingerprint + validated DOM/Shadow locator;
- strict locator/descriptor sanitization;
- serialized mutations with persistence failures reported as failures, never apparent success.

Historical success may accelerate discovery but cannot authorize a click.

## Update-generation authority boundary

An already-open page may contain more than one Auto Agree isolated-world generation after extension replacement. A version sentinel therefore proves presence, not exclusive authority.

v10 uses **two independent generation mechanisms** because they protect different historical states.

### Cooperative generation lease

Every v10 execution world that can reach Gate/Engine work carries `generation-lease.js`. In Auto Agree's own isolated realm it wraps that realm's `HTMLElement.prototype.click` and synchronously checks `chrome.runtime.getManifest().version` immediately before DOM dispatch.

If the Runtime has been invalidated by extension replacement or the installed manifest version no longer matches the compiled generation, the call becomes a no-op. The page MAIN world is not patched; trusted browser input remains outside this wrapper.

Real Chrome testing established the premise: after a same-path v10→11 manifest replacement without page reload, the old v10 Engine execution context remained JavaScript-executable but its extension Runtime reported `Extension context invalidated.`. The release gate then proved zero stale automated clicks, zero direct stale-world `.click()` effects, and one successful trusted browser click.

### Historical-generation handover firewall

v9 and older generations did not ship the cooperative lease, so they cannot be retroactively revoked from inside themselves. On update/reload, the Worker therefore establishes `generation-lease.js` + `semantic-core.js` + `handover-guard.js` before it rehydrates `bootstrap.js` into already-open tabs.

The guard enforces:

- trusted user clicks always pass;
- a current Engine click receives one exact one-shot target/ancestor authorization immediately before dispatch;
- unused direct authorization expires at the next microtask checkpoint;
- agreement-like stale synthetic clicks from non-cooperative old generations are canceled;
- a trusted event or current-authorized click may delegate one descendant synthetic click only inside a small, exact local control wrapper and only during that same DOM event propagation;
- bubble phase revokes the local causal lease;
- broad `form`, `dialog`, `section`, page/document containers and proceed actions cannot mint sibling-control authority;
- ambiguous wrappers containing multiple possible delegated controls fail closed;
- no timer-based lease is permitted to leak authorization into later tasks;
- a guard whose own extension Runtime is stale becomes passive toward later generations, preventing an old firewall from blocking a future legitimate Engine.

The guard consumes the shared `semantic-core.js` and resolves bounded explicit accessibility relations (`aria-labelledby`, `aria-describedby`, native external labels). It does not carry a divergent private Terms/assent vocabulary and does not issue an unbounded generic descendant-control query on the trusted-event hot path.

The extension does not request the `tabs` permission: Chrome's Tabs API is available without it for basic tab operations, and the existing `<all_urls>` host permission supplies the host access needed for injection.

## Artifact boundary

A release ZIP is part of the security/correctness boundary. A successful CRC check is not sufficient if a newly referenced runtime module was never added to a hand-maintained package list.

During v10 audit, the old deterministic packager was found to omit runtime JavaScript that had been added after its static list was written. The packager now derives the executable closure from the production `extension/*.js` set and verifies the resulting deterministic archive. This keeps the packaged runtime aligned with the load-unpacked production root.

## Threats considered

- misleading CSS/class names;
- split legal/risk words across DOM fragments;
- stale learned selectors after site redesign;
- profile namespace spoofing, profile-flow collisions and unbounded profile growth;
- hidden templates and duplicated inactive modals;
- cross-frame injection storms, queue starvation and stale-document jobs;
- closed/nested Shadow DOM;
- BFCache/frozen/prerender/pending-deletion message races;
- detached-DOM retention through queues/observers;
- pathological multi-megabyte attributes/text nodes, including update-guard semantic paths;
- mutation storms designed to force synchronous work;
- MV3 service-worker termination during Probe→Gate, Gate→Engine or profile handoff;
- extension update/reload while old pages remain open;
- simultaneous old/new isolated-world Engine execution after update;
- stale-generation click attempts under superseded semantics;
- page-owned custom controls that synchronously delegate from trusted wrapper interaction to a synthetic descendant click;
- unused, overlong or overly broad authorization tokens being reused by later stale work;
- package-integrity checks that pass despite an incomplete runtime dependency closure.

## Hard boundaries

The v9→v10 handover cannot be made retroactively cooperative: v9 shipped no generation lease, so the new-generation firewall remains necessary until it reaches each surviving frame. Future generations that inherit the v10 lease can self-revoke their ordinary Auto Agree `.click()` primitive as soon as Chrome invalidates their extension Runtime, reducing reliance on that rehydration window.

The cooperative result is a tested Chrome behavior, not a universal browser theorem. `tests/e2e-generation-lease.mjs` remains a release gate so a future Chrome lifecycle change cannot silently invalidate this authority model.

The handover firewall is scoped to Auto Agree's consequential stale authority—agreement-like synthetic clicks. The generation lease is scoped to Auto Agree's isolated-world `HTMLElement.prototype.click`. Neither mechanism is presented as a generic sandbox for arbitrary historical JavaScript side effects.

Ordinary content-script extensions also cannot guarantee control over Chrome-owned UI, trusted-physical-input checks, opaque Canvas/WebGL UI with no usable DOM/accessibility surface, or semantics intentionally placed outside any finite bounded sample of an unbounded string.
