# Auto Agree Login Terms v3.0 — Verification Report

Generated: 2026-08-08

## Final implementation

- Manifest V3 extension.
- `bootstrap.js` runs in every matching frame at `document_start` but does only bounded authentication/legal detection; ordinary checkbox presence alone does not activate the full engine.
- `worker.js` injects `engine.js` only into the triggering document/frame and coalesces duplicate activation.
- `engine.js` uses bounded text collection, accessibility-name resolution, candidate snapshots, WeakRef candidate indexing, incremental time-budgeted queues, open/closed Shadow DOM discovery, precise geometry only for classless visual controls, verified one-shot/retry state handling, and a per-origin local selector fast path.
- No network, telemetry, analytics, `eval`, polling interval, whole-document `querySelectorAll('*')`, `textContent`/`innerText` stringification, or whole-row click fallback.

## Correctness regression

Real Chromium 144.0.7559.96 DOM/event/layout implementation, fresh target, final engine:

- Core behavior matrix: **32/32 PASS**.
- Includes routine Terms/Privacy, required controls, already-checked/disabled states, marketing/remember-me/renewal/age/purchase negatives, `aria-labelledby`, radio/switch, TRAE-style classless control, unknown-state one-shot, dynamic insertion, hidden-to-visible, `aria-hidden`, inert, closed `<details>`, open/closed/nested Shadow DOM, terse login gating, English/Japanese/Korean/Arabic, 5,000 ordinary checkboxes plus one agreement control, and a 30,000-node mutation storm.
- Bootstrap activation matrix: **7/7 PASS**. Generic checkbox-heavy pages stay asleep; legal/auth/password/phone signals activate.
- Huge single-subtree bootstrap test: **PASS**. Legal text beyond the synchronous node budget was found by the low-priority deep scan instead of becoming a permanent blind spot.
- Worker injection contract: **3/3 PASS**. Exact `documentId`, duplicate activation coalescing, and frame fallback were verified.

## Adversarial consent-risk testing

- Fixed risk matrix: **15/15 PASS**.
- Transaction/auth-context matrix: **5/5 PASS**.
- Randomized adversarial corpus: **160/160 PASS**, with **0 false positives, 0 false negatives, 0 multi-toggle controls**.
- The adversarial run initially exposed a real false positive for `consent to facial recognition`; the risk matcher was corrected to cover both word orders, including corresponding Chinese biometric/facial-recognition consent ordering, then the entire corpus passed.
- Industry names alone do not block routine login Terms: insurance, investment, payment, banking, trading, or medical portals may still have ordinary login Terms/Privacy controls. Consequential actions are blocked by action semantics, such as payment/debit authorization, loan/credit agreements, investment-risk/trading authorization, insurance application/purchase, medical informed consent, employment contracts, e-signatures, arbitration/rights waivers, biometric/facial-recognition consent, powers of attorney/guarantees, and auto-renewal.

## Performance stress tests

All figures below are synthetic stress-test measurements, not universal speed multipliers.

### 30,000-node append + agreement control at tail

Five final-v3 runs in Chromium 144:

- MutationObserver synchronous blocking median: **~0.10 ms**; max **0.50 ms**.
- Agreement checked median after append: **~5.90 ms**.
- Exactly one click in all 5 runs.

A same-style earlier v2 comparison produced approximately:

- v2 MutationObserver blocking median: **~23.2 ms**.
- v2 agreement-check median: **~142.3 ms**.

The improvement comes from moving large mutation batches to background time slices and removing synchronous subtree semantic parsing from the observer callback.

### 1,500 simultaneous checkbox attribute mutations

Seven-run synthetic benchmark:

- Baseline observer median: approximately **0 ms** (0–0.1 ms noise band).
- v2 observer median: **~614.45 ms**.
- v3 observer median: **~0.95 ms**, max **~1.30 ms**.

The v3 observer only filters/deduplicates and queues relevant work; it does not synchronously snapshot every changed checkbox.

## Long-lived SPA / detached-DOM retention

Test: a persistent form repeatedly created, processed, and removed 2,000 agreement controls, followed by delay and forced GC.

- Before: 18 DOM nodes reported by the test target.
- During transient work: 3,481 nodes.
- After drain + forced GC: **10 nodes**, 1 document, 6 event listeners.
- Used JS heap after GC: ~1.24 MB in that isolated test target.

This supports that WeakRef candidate indexing and expiring/cancellable queues are not retaining removed agreement controls as strong long-lived DOM references in the tested scenario.

## Static/permission audit

Final JavaScript and manifest syntax: PASS.

Executable-source findings:

- `textContent`: 0
- `innerText`: 0
- `setInterval`: 0
- `fetch`: 0
- `XMLHttpRequest`: 0
- `WebSocket`: 0
- `eval`: 0
- `new Function`: 0
- whole-page `querySelectorAll('*')`: 0
- whole agreement-row click fallback: 0
- `getComputedStyle`: 1 executable call, restricted to the classless visual-control fallback path
- `getBoundingClientRect`: 2 executable calls, restricted to precise classless-control geometry
- `elementsFromPoint`: 1 executable call for Chromium hit-target resolution
- `querySelectorAll`: 3 calls, only for verifying uniqueness of a selector after a successful agreement click before caching it

Manifest permissions are limited to `scripting`, `storage`, and `<all_urls>` host access. `<all_urls>` is required by the product goal of working on arbitrary login/register sites; no network-request permission or telemetry path is present.

## Test-environment boundary

The managed Chromium environment used here has machine policy blocking arbitrary URLs and extension installation. I did not bypass that policy. Consequently, a true unpacked-extension end-to-end load/navigation test could not be completed in this environment.

Instead:

- the final engine ran against Chromium 144's real DOM, layout, events, MutationObserver, ResizeObserver, and Shadow DOM machinery;
- closed-shadow access was exercised through a test-only `chrome.dom` shim that returns test-created closed roots;
- `worker.js`, `bootstrap.js`, manifest syntax, scheduling behavior, and injection targeting were verified separately;
- the production extension uses Chrome's `chrome.dom.openOrClosedShadowRoot()` for closed roots and `chrome.scripting.executeScript()` for per-document/frame engine injection.

The earlier v1.1 extension was also confirmed by the user to work on the real `work.trae.cn` login agreement control; v3 retains that classless-control path and covers it in regression testing.

## Remaining browser hard boundaries

No normal content-script extension can guarantee 100% control over every possible UI. Browser-owned internal/permission UI is outside ordinary site content-script scope, and sites that explicitly require trusted physical user input can reject programmatic activation. The extension therefore optimizes for routine website agreement controls without attempting to defeat browser or site security boundaries.
