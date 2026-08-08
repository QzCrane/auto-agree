# Auto Agree Login Terms v4.0 — Final Verification & Optimization Report

Generated: 2026-08-08

## 1. Final product boundary

AutoAgree v4 automatically confirms routine login/register/account-access Terms of Service, Privacy Policy, User Agreement, and equivalent mandatory agreement controls when the local UI evidence is strong enough.

It deliberately does not auto-confirm consequential or factual declarations such as purchases/orders, payment/debit authorization, loans/credit, investment/trading authorization, insurance application/purchase, medical informed consent, employment contracts, e-signatures, arbitration/rights/class-action waivers, biometric/facial-recognition consent, powers of attorney/guarantees, auto-renewal, age/identity/fact attestations, marketing, cookies, CAPTCHA, or remember-me options.

Industry names are not risk decisions. Routine login Terms on insurance, banking, investment, trading, medical, or payment sites remain eligible; the classifier blocks consequential action semantics, not industries.

## 2. v4 architecture convergence

### 2.1 Two-stage lazy activation

`bootstrap.js` remains in every matching frame and performs bounded local evidence collection only. It does not wake `engine.js` for any of these alone:

- generic checkbox
- generic required setting
- footer Terms / Privacy links
- newsletter email field
- contact phone/email fields

The full engine activates only for locally co-occurring strong evidence such as:

- password / OTP / strong auth signal
- auth action + credential field
- legal + assent + agreement control
- legal + required + agreement control
- auth + legal + agreement control

Large/truncated subtrees are moved to background slices; head/tail edge probes prevent a login form at the end of a large SPA from waiting for a full document walk.

### 2.2 Per-document/frame injection

`worker.js` coalesces duplicate activation and injects `engine.js` only into the triggering document/frame. It does not inject the full engine into every frame by default.

### 2.3 Split observation model

`engine.js` uses:

- a light discovery observer for document/Shadow-root discovery;
- detailed context observation only after a form/dialog/auth context is registered;
- candidate indexes keyed by context;
- context epochs + cached `ContextSnapshot`s;
- WeakRef candidate references;
- time-budgeted, generation-coalesced root/walk/batch/shadow queues.

Preflight never performs a synchronous full-form scan. It re-evaluates the indexed agreement candidates for the current context, so the intended hot-path complexity is O(K), where K is the number of legal candidates rather than the DOM size.

### 2.4 Credential/context state coupling

A final adversarial test found a real v4 bug: a terse `Terms of Service` control could be correctly rejected while phone/OTP were empty, then remain rejected after the user filled the credentials because the ContextSnapshot epoch was invalidated without re-enqueueing the indexed candidate.

Fix: credential `input/change` now invalidates the current context and re-evaluates only its already-indexed legal candidates. The dynamic transition test now passes with exactly one click.

### 2.5 Text-driven control discovery

CPU profiling found that resolving `input.labels` for every checkbox was the dominant remaining large-checkbox-page hotspot.

Before the fix, in a 5,000-checkbox Chromium CPU profile, `labelFor()` accounted for 412/559 samples (~73.7%).

The final engine no longer resolves labels for every plain native checkbox. Instead:

1. the bounded text walker discovers legal text;
2. the matching legal row/label marks only its linked control relevant;
3. only relevant controls enter CandidateSnapshot/label resolution.

External `label[for]` controls are resolved directly from the discovered legal label, so the optimization does not sacrifice detached-label correctness.

After the fix, a comparable profile contained one `labelFor()` sample out of 110 total samples (~0.9%), and regex matching was not a controlling profile hotspot.

### 2.6 Closed Shadow DOM

The production extension uses `chrome.dom.openOrClosedShadowRoot()` for open or closed Shadow roots. v4 adds composed-path probing on normal focus/pointer interaction so a completely closed component hosted by an otherwise ordinary `<div>` can activate discovery without a permanent whole-page host sweep.

The remaining information-theoretic boundary is a closed Shadow tree with no external auth/legal/control signal and no user event passing through its host; discovering every such tree would require probing arbitrary hosts.

### 2.7 Site learning v2

The old one-selector-per-origin cache is replaced with multi-flow profiles:

- origin-local profile
- up to 8 flow fingerprints
- nested Shadow host paths + target selector
- success metadata / timestamp
- cached locator always re-runs the full semantic/risk decision before click

Worker storage uses:

- 32-entry in-worker hot LRU
- `chrome.storage.session` session cache
- `chrome.storage.local` persistent cache

The cache is discovery acceleration only; it is never click authority.

### 2.8 Click verification

State verification is event-driven first:

- native `input/change`
- temporary state MutationObserver
- immediate/microtask/requestAnimationFrame verification
- bounded timeout only as fallback

Unknown-state classless controls remain one-shot. UNKNOWN never causes a blind second toggle.

### 2.9 Visibility correctness

High-confidence standard controls still receive a visual proof before non-urgent activation, but the proof is moved outside the mutation microtask. This preserves hidden-template correctness without making a large DOM mutation callback synchronously force style/layout.

Classless geometry is only used after strong legal/context evidence. Whole-row click fallback does not exist.

## 3. Final correctness verification

### 3.1 Two-stage end-to-end-equivalent matrix

Bootstrap decision -> simulated exact worker injection -> real Chromium engine behavior:

**33 / 33 PASS**

Coverage includes:

- standard Terms/Privacy checkbox
- required legal checkbox
- already checked
- disabled
- marketing
- remember me
- renewal
- age attestation
- purchase/consequential negative
- required but non-legal setting
- privacy-mode non-consent toggle
- aria-labelledby
- radio agree/disagree
- switch
- TRAE-style classless visual control
- unknown-state one-shot control
- dynamic insertion
- CSS hidden -> visible
- aria-hidden
- inert
- closed details
- open Shadow DOM
- closed Shadow DOM
- nested Shadow DOM
- terse legal with incomplete credentials
- terse legal with filled credentials
- English / Japanese / Korean / Arabic
- 5,000 ordinary checkboxes + one agreement
- 30,000-node mutation storm
- no-signal page: zero activation

### 3.2 Bootstrap fixed matrix

**12 / 12 PASS**

Includes negative sleep cases and strong/local-composite activation, completely closed Shadow activation via normal focus event, and a legal/auth signal at the tail of a huge single subtree.

### 3.3 Randomized bootstrap activation

**120 / 120 PASS**

- 60 randomized non-auth pages: zero false engine activation
- 60 randomized auth/legal-positive pages: correct activation

### 3.4 Worker contract

**8 / 8 PASS**

Covers exact documentId targeting, frame fallback, duplicate activation coalescing, and session/local profile behavior.

### 3.5 Label/accessibility variants

**4 / 4 PASS**

- nested label
- external `label[for]` before input
- external `label[for]` after input
- aria-labelledby

### 3.6 Dynamic context invalidation

**PASS**

Terse legal control remains unchecked with empty phone/OTP, then becomes checked exactly once after credential state changes.

### 3.7 Site learning v2

**5 / 5 PASS**

- learn document locator
- cached fast path
- cache is not authority
- learn closed-shadow locator
- resolve closed-shadow cached locator

### 3.8 Structural/adversarial fuzz

Earlier mixed semantic/structural corpus: **290 / 290 PASS**.

Expanded final structural corpus: **1,000 / 1,000 PASS** with:

- 400 positive routine agreements
- 400 risk/negative controls
- 100 already-checked controls
- 100 disabled controls
- nested labels
- external labels before/after controls
- ARIA controls
- fragmented text
- randomized wrapper depths
- multiple languages / industry contexts

Final expanded corpus: **0 false positives, 0 false negatives, 0 duplicate toggles**.

## 4. Performance verification

All figures are synthetic benchmark results from this environment, not universal speed multipliers.

### 4.1 5,000 unrelated checkbox direct-engine stress

Forced direct full-engine load, agreement at the tail:

- v3 median: ~1,554.3 ms
- final v4 median: ~123.0 ms

This is approximately a 12.6x reduction in this pathological direct-engine test. The main source was eliminating broad `input.labels` resolution.

### 4.2 Production-style 5,000 checkbox page

Actual v4 architecture: bootstrap sees a large settings page with the login form at the tail, then full engine starts only for the login context.

Five runs:

- bootstrap activation median: **~15.9 ms**
- activation -> agreement checked median: **~22.0 ms**

### 4.3 1,500 simultaneous checkbox attribute mutations

Final seven-run benchmark:

- v3 median: **~2.1 ms**, max ~2.7 ms
- v4 median: **~0.7 ms**, max ~0.9 ms

The final v4 observer does not synchronously interpret every changed checkbox.

### 4.4 Superseding mutation generations

120 generations of superseding root changes:

- final agreement clicks: **1**
- final state: checked

This verifies queue generation/coalescing avoids duplicate processing/toggling under rapid replacement.

### 4.5 30,000-node append

A 30,000-node append is dominated by the page's own DOM construction/layout cost. In the final comparison run:

- v3 setTimeout(0) median after append: ~336.8 ms
- v4: ~328.8 ms

Agreement activation latency after the append:

- v3: ~14.3 ms median
- v4: ~78.2 ms median

This v4 latency increase is intentional: v4 waits for asynchronous visual proof so a high-confidence but CSS-hidden template checkbox is not toggled prematurely. Experimental immediate/microtask variants did not materially improve the pathological 30k case because style/layout itself dominated; they preserved the same layout cost and were not adopted. Normal production-style login activation remained ~22 ms after engine activation.

### 4.6 Generic large page false activation

On the 30k generic/footer/newsletter test:

- v3 bootstrap activated full engine: 5/5 runs
- v4 bootstrap: **0/5 runs**

This is the most important whole-browser performance change: unrelated pages stay on the thin bootstrap layer.

## 5. Long-lived SPA / memory verification

### 5.1 Repeated agreement controls

2,000 agreement controls created, processed, removed, followed by forced GC:

- DOM nodes before: 16
- transient nodes: 3,424 in the final run
- DOM nodes after GC: **16**
- JS event listeners before: 23
- JS event listeners after: **23**

**PASS** — no tested detached-control retention.

### 5.2 Repeated context roots

2,000 short-lived login forms/contexts were created and removed to attack MutationObserver/context registration retention.

- before: 18 nodes (2 documents in the measurement instant)
- after drain + GC: 11 nodes (1 document)

**PASS** — no accumulating detached-context retention was observed.

## 6. Static / permission audit

Syntax:

- `bootstrap.js`: PASS
- `engine.js`: PASS
- `worker.js`: PASS
- `manifest.json`: PASS

Forbidden executable patterns:

- `textContent`: 0
- `innerText`: 0
- `setInterval`: 0
- `fetch`: 0
- `XMLHttpRequest`: 0
- `WebSocket`: 0
- `eval`: 0
- `new Function`: 0
- whole-document `querySelectorAll('*')`: 0
- whole agreement-row click fallback: 0
- TODO/FIXME/HACK markers: 0

Layout/extension APIs in source:

- `getComputedStyle`: 1 call site
- `getBoundingClientRect`: 2 call sites
- `checkVisibility`: 1 call site
- `elementsFromPoint`: 1 call site
- `scheduler.yield`: feature-detected
- `scheduler.postTask`: feature-detected
- `chrome.dom.openOrClosedShadowRoot`: used for Shadow discovery
- `chrome.storage.session`: worker-side hot session cache

Manifest permissions remain:

- `scripting`
- `storage`
- `<all_urls>` host access

No network-request, cookies, history, downloads, debugger, nativeMessaging, proxy, clipboard, tabs, or management permission is declared.

## 7. Previously proposed optimizations: final disposition

### Implemented

- evidence-based bootstrap instead of keyword OR activation
- local-scope / edge-probe activation
- two-stage bootstrap -> worker -> engine
- exact document/frame injection
- split discovery/context observers
- CandidateSnapshot
- ContextSnapshot epoch cache
- WeakRef candidate index
- O(K) context preflight/re-evaluation
- bounded text collection
- accessibility name resolver
- open/closed Shadow DOM support
- composed-path closed-shadow bootstrap probing
- generation-coalesced/capped walk/shadow/batch queues
- time-budgeted scheduling
- `scheduler.yield` / scheduler background use with fallback
- precise classless geometry + Chromium hit target
- no row click
- event-driven click verification
- asynchronous visual proof
- site learning v2 with multiple flows and Shadow paths
- session/local caching + worker hot LRU
- behavior-consequence risk model
- randomized semantic + structural fuzzing
- detached-control and detached-context GC testing
- CPU profiling-guided broad-label lookup removal

### Deliberately not added because profiling did not justify it

**Language routing / Trie / Aho-Corasick.**

Before final optimization, Chromium CPU profiling identified DOM label resolution as the overwhelming hot path. After removing it, regex execution was not a controlling hotspot in the sampled profile. Replacing mature native regex matching with a custom trie/state machine would add code size, maintenance surface, and semantic-order complexity without evidence of a meaningful user-visible benefit. It is therefore profiled out, not forgotten.

### Replaced by a simpler mechanism

**TaskController / AbortController for every background job.**

The final engine uses generation tokens, weak/deduplicated root tracking, queue caps, TTL, connectivity checks, and supersede/requeue behavior. The 120-generation adversarial test ends with one click. Adding a second cancellation state machine would duplicate existing authority without a demonstrated correctness/performance gain.

## 8. Test-environment hard boundary

The managed Chromium environment available for this work blocks arbitrary URL navigation and unpacked extension installation by machine policy. That policy was not bypassed.

Therefore this report does NOT claim a true unpacked-extension install + arbitrary public-site navigation E2E in this container.

Instead, verification used:

- Chromium 144 real DOM/layout/events
- MutationObserver / ResizeObserver
- open/closed/nested Shadow behavior (closed roots exposed to the test engine by a test-only chrome.dom shim)
- real geometry / checkVisibility / hit testing
- worker/bootstrap contracts tested separately
- exact injection target logic tested separately
- the user's real TRAE site confirmation from v1.1 as an external real-world regression anchor; v4 retains and repeatedly tests the generalized TRAE-style classless path

Production code uses Chrome's real extension APIs for closed Shadow access and per-document/frame injection.

## 9. Remaining hard boundaries, not optimization backlog

No ordinary content-script extension can guarantee every imaginable UI:

1. Browser-owned internal/permission UI is outside normal site content-script scope.
2. A site may explicitly reject synthetic activation by requiring trusted physical user events.
3. A fully closed Shadow component with no externally observable signal and no user event reaching its host cannot be discovered without probing arbitrary page elements.
4. Canvas-only/custom-rendered controls without useful DOM/accessibility semantics require a different visual automation layer and are intentionally outside this extension's DOM automation architecture.

These are boundary conditions, not unfinished S0-S8 work.

## 10. Final engineering verdict

All previously identified optimizations that remained justified after measurement have been implemented and re-tested. The two previously discussed additions that remain absent (custom language trie/routing and TaskController-based cancellation) were explicitly rejected/replaced based on profiling and invariant coverage rather than omitted.

The next meaningful improvement source is real-site adversarial evidence: a new real page that produces a false positive or false negative should become a generalized mechanism fix plus permanent regression test. Further speculative micro-optimization without such evidence is currently lower value than the complexity it would add.
