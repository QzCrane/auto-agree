# Auto Agree Login Terms v6.0 — Verification & Optimization Report

Generated: 2026-08-08

## 1. Final architecture

v6 retains the v5 three-tier Manifest V3 structure but adds explicit lifecycle ownership and tighter bounded-input guarantees:

1. `bootstrap.js` — always-present micro-probe.
   - Bounded auth/legal/structure discovery only; never clicks.
   - Sleeps on footer Terms/Privacy, newsletter/contact/search, generic checkbox-heavy pages.
   - Prerender-aware and Page-Lifecycle-aware.
   - Hidden/frozen/BFCache-resident documents quiesce observers/events/queues.
   - Background drains are lifecycle-generation-owned; stale pre-freeze tasks cannot mutate a restored generation.
   - Closed-Shadow seed hosts can be carried to the gate.

2. `gate.js` — semantic activation gate injected only into suspicious frames.
   - Requires co-occurring evidence rather than a single keyword.
   - Supports fragmented legal/assent semantics and closed-Shadow seed reacquisition.
   - Page Lifecycle generations prevent stale asynchronous work from crossing freeze/restore.

3. `engine.js` — full decision/activation engine.
   - Candidate snapshots, context epoch snapshots, WeakRef candidate indexes, O(K) indexed re-evaluation.
   - Separate discovery/context mutation paths and budgeted background queues.
   - Open/closed/nested Shadow DOM plus dynamic `slotchange` / composed-tree semantics.
   - Seed ShadowRoots become persistent observed roots and are reacquired after lifecycle restoration.
   - Event/mutation-driven checked-state verification; stale click verifiers are cancelled on lifecycle transition.
   - Hidden/frozen pages do not continue routine semantic processing.
   - Site-learning fast paths never bypass live semantic/risk validation.

4. `worker.js` — event-driven service worker.
   - Exact document/frame injection and duplicate injection coalescing.
   - Serialized profile merge and exact invalidation operations.
   - Session + persistent local profile cache with hard caps and TTL.

No page-network API, telemetry, analytics, remote code, polling interval, `eval`, or whole-page wildcard scanning is used.

## 2. v6 changes relative to v5

### 2.1 Page Lifecycle / BFCache state machine

All three runtime tiers now explicitly model lifecycle generations.

When hidden/frozen/BFCache-resident:
- active MutationObservers are disconnected;
- non-lifecycle input/pointer listeners are detached;
- queued semantic work is cleared or invalidated;
- engine click verifiers/timers are cancelled;
- ResizeObserver work is stopped;
- scheduler ownership advances to a new lifecycle generation.

When restored/visible:
- observers/events are reattached;
- lifecycle-local candidate/click memo state is reset;
- known ShadowRoots are reacquired;
- current relevant DOM is re-evaluated.

Old postTask/idle/RAF/timer callbacks capture their originating lifecycle generation. A stale callback may self-abort but cannot clear or overwrite the scheduler state of the restored generation.

No `beforeunload` or `unload` listener is present.

### 2.2 Closed Shadow root ownership across restore

A seed element that triggered engine injection from inside a ShadowRoot now causes that root/host to be registered as an observed root. The host is retained only through weak ownership. On restore, the extension reacquires the current open/closed root and reattaches observation.

This closes a v5 gap where the current closed-Shadow form could be processed once but subsequent dynamic changes or BFCache restoration were not guaranteed to remain observed.

### 2.3 Composed-tree / slot semantics

Text collection understands `HTMLSlotElement.assignedNodes({flatten:true})` under bounded budgets.

Observed ShadowRoots receive a scoped `slotchange` handler. When assignment changes:
- affected contexts are invalidated;
- the slot and assigned nodes are queued;
- agreement candidates are re-evaluated without rescanning the whole document.

### 2.4 Site Learning v6 self-healing

- Cache fast paths are filtered by normalized pathname / flow fingerprint before selectors are queried.
- A cached locator is acceleration only, never click authority.
- If the cached selector still resolves but the live control repeatedly fails current semantic/risk validation, failures are recorded.
- Three failures trigger an exact `AUTO_AGREE_PROFILE_INVALIDATE` operation.
- Invalidation is serialized by `worker.js`; deletion no longer depends on merge-only semantics.
- Locator selector/Shadow-host path lengths and shapes are bounded before persistence.
- Legacy profile index keys are migrated to the generic v6 index.
- At most 8 flows/origin, 256 persisted origins, 180-day flow TTL, 32-entry worker hot LRU.

### 2.5 Pathological single-string hard bounds

Earlier versions eliminated unbounded subtree `textContent`, but one pathological input remained: a single multi-megabyte TextNode/ARIA/attribute string could still be passed through whole-string whitespace normalization before output truncation.

v6 now performs fixed-budget head/center/tail semantic sampling for oversized individual strings. Windows are separated by an internal semantic boundary so compact-token recovery cannot accidentally synthesize a keyword across distant sampled regions.

Properties:
- CPU work is bounded by configured semantic output budgets rather than raw string length;
- legal/risk semantics at the head, center, or tail are retained in the tested pathological cases;
- normal short strings remain exact.

## 3. Correctness regression

All browser behavior tests below used Chromium 144's real DOM/event/layout/MutationObserver/ResizeObserver/Shadow DOM machinery. Extension-only Chrome APIs were supplied by test shims where the managed environment does not permit installing the unpacked extension.

### 3.1 Core v6 behavior/lifecycle matrix

**10/10 PASS**

Covered:
- ordinary three-tier login Terms flow;
- footer/newsletter sleep;
- freeze -> mutation -> resume;
- simulated BFCache pagehide/pageshow with `persisted=true`;
- closed Shadow restore and re-check after page state reset;
- dynamic slot reassignment;
- 40 simultaneous login contexts;
- path-filtered site-learning fast path;
- cached-locator negative feedback;
- full closed-Shadow focus -> probe -> gate -> engine chain.

### 3.2 Dedicated lifecycle race matrix

**6/6 PASS**

Covered:
- Probe frozen before evidence appears;
- Gate frozen before final evidence appears;
- Engine hidden-tab quiescence and visible restore;
- 25 freeze/resume cycles with stable active-listener count: **16 -> 16**;
- 30 rapid lifecycle-generation transitions with exactly one final toggle;
- full Probe -> Gate -> Engine dynamic `slotchange`.

### 3.3 Worker/profile contract

**8/8 PASS**

Covered:
- valid profile persistence/read;
- legacy index migration;
- newer failure state winning over older state;
- later success resetting failure state;
- exact persisted-flow invalidation;
- removal of empty profile storage key;
- oversized/malformed locator rejection;
- normal merge behavior.

Additional concurrency/cap stress:
- **64 concurrent flow writes -> exactly latest 8 flows retained**;
- **300 concurrent origins -> exactly 256 persisted origins retained**.

### 3.4 Engine structural/semantic fuzz

**1200/1200 PASS**

Final counters:
- false positives: **0**;
- false negatives: **0**;
- successful positive clicks: **700**;
- total checked positives including initially checked cases: **800**.

Corpus includes:
- 2-5 arbitrary DOM text fragments;
- nested labels;
- detached `label[for]` before/after input;
- `aria-labelledby`;
- random nested wrappers;
- English, Chinese, Japanese, Korean, Arabic;
- consequential negatives including biometric/facial recognition, payment/debit authorization, age/factual attestations, marketing and related risk semantics.

### 3.5 Full three-tier pipeline fuzz

**300/300 PASS**

Final counters:
- false positives: **0**;
- false negatives: **0**;
- positive clicks: **180**;
- only **1 Gate injection** and **1 Engine injection** in the shared pipeline test environment.

### 3.6 Multi-megabyte string adversarial tests

A required onboarding agreement used a **2,000,000-character** ARIA value, with the real legal/assent sentence placed independently at:
- head;
- exact middle;
- tail.

Full Probe -> Gate -> Engine chain: **3/3 PASS**.

Direct engine tail case:
- v5: **0/3 detected within 3 s**;
- v6: **3/3 detected**, median ~**90 ms** from engine injection to checked state.

Gate synchronous script-start benchmark with a 2 MB pathological ARIA value:
- v5 median: ~**49 ms**;
- v6 median: ~**7.7 ms**.

The finite sampler cannot mathematically guarantee discovery of arbitrary semantics placed at every possible byte offset of an unbounded string without reading the entire string. v6 deliberately chooses fixed CPU bounds plus head/center/tail coverage; this is the explicit performance/correctness boundary.

## 4. Long-lived memory / ownership tests

### 4.1 Persistent SPA control churn

A persistent login form created, processed, and removed **2,000** agreement controls.

After drain + forced GC:
- baseline DOM nodes: **20**;
- final DOM nodes: **20**;
- final JS event listeners reported by target: **28**.

No retained-node growth was observed in this test.

### 4.2 Frozen pending click verifier

A model freezes the browser scheduler while an agreement click verifier/timer is pending, then removes the control and forces GC.

- v5: pending timer **1 -> 1**, DOM nodes **22**;
- v6: pending timer **1 -> 0**, DOM nodes **14**.

v6 explicitly cancels active verifier timers/observers/listeners on lifecycle pause rather than waiting for a frozen timer to fire.

## 5. Performance stress tests

All values are synthetic Chromium measurements, not universal speed multipliers.

### 5.1 30,000 ordinary DOM nodes — always-present Probe startup

Seven runs:

- v5 bootstrap median: **7.1 ms**, max 7.3 ms;
- v6 bootstrap median: **7.9 ms**, max 8.0 ms.

**Tradeoff:** v6 intentionally pays about **+0.8 ms median** in this synthetic cold-start benchmark because the always-present Probe now contains Page Lifecycle generation safety and pathological-string hardening.

### 5.2 5,000 unrelated checkboxes + login agreement at page tail

Full Probe -> Gate -> Engine chain, seven runs:

- v5 median: **75.4 ms**, max 79.7 ms;
- v6 median: **71.3 ms**, max 85.7 ms.

There is no median production-path regression despite the larger defensive Probe.

### 5.3 1,500 simultaneous ordinary checkbox attribute mutations

Seven runs:

- v5 median: **2.8 ms**;
- v6 median: **2.5 ms**;
- v6 hidden median: **2.4 ms**.

This particular benchmark is dominated by the browser's underlying attribute mutation cost and is therefore not the best measure of lifecycle quiescence.

### 5.4 Representative semantic attribute workload while visible vs hidden

1,500 checkboxes simultaneously receive `aria-label` values that would normally enter semantic discovery.

Nine-run medians:
- v5 visible: **52.4 ms**;
- v6 visible: **53.4 ms**;
- v6 hidden/quiescent: **2.7 ms**.

v6 visible performance is essentially the same order as v5 in this workload, while lifecycle quiescence removes almost all extension semantic work when the document is hidden.

## 6. Final source/permission audit

Final production file sizes:
- `manifest.json`: 834 B
- `bootstrap.js`: **18,208 B**
- `gate.js`: **31,758 B**
- `worker.js`: **10,042 B**
- `engine.js`: **92,545 B**
- `README.txt`: ~7.7 KB

The v6 Probe is larger than v5 because lifecycle generation ownership and pathological-string bounding are implemented in the always-present layer. This is an intentional correctness/resource-governance tradeoff rather than an unreported size regression.

JavaScript syntax: **PASS**
Manifest JSON/schema invariants used by the test: **PASS**

Executable-source findings:
- `textContent`: 0
- `innerText`: 0
- `setInterval`: 0
- `fetch(`: 0
- `XMLHttpRequest`: 0
- `WebSocket`: 0
- `eval(`: 0
- `new Function`: 0
- whole-page `querySelectorAll('*')`: 0
- whole agreement-row click fallback: 0
- `beforeunload`: 0
- `unload`: 0

Bounded/local browser primitives:
- `createTreeWalker`: 6 source occurrences, all synchronous bounded/local; none is retained across a scheduling yield.
- `getComputedStyle`: 1
- `getBoundingClientRect`: 2
- `elementsFromPoint`: 1
- `scheduler.postTask`: 3
- `scheduler.yield`: 2
- `WeakRef`: 22

Manifest permissions remain:
- `scripting`
- `storage`
- `<all_urls>` host access

No cookies/history/webRequest/downloads/debugger/nativeMessaging/proxy/clipboard/tabs/management permission is requested.

## 7. Test-environment boundary

The managed Chromium environment available during development has machine policy preventing arbitrary real-site navigation and unpacked-extension installation. That policy was not bypassed.

Therefore, v6 verification consists of:
- Chromium 144 real DOM/layout/event/MutationObserver/ResizeObserver/Shadow DOM behavior;
- composed-tree and closed-root test shims for extension-only DOM access;
- full in-page Probe -> Gate -> Engine integration with worker-equivalent injection;
- independent Worker/profile contract and concurrency tests;
- lifecycle/BFCache simulations using the platform lifecycle events;
- performance/GC/fuzz tests;
- static manifest/source/ZIP validation.

It does **not** claim that the final ZIP was installed as an unpacked extension inside this managed container and navigated through arbitrary production websites.

The user's earlier real-world test confirmed that the older classless-control path works on `work.trae.cn`; v6 retains and extends that mechanism.

## 8. Remaining hard boundaries

No ordinary website content-script extension can mathematically guarantee every possible UI/control.

Remaining boundaries include:
- browser-owned Chrome/internal permission UI;
- sites that explicitly require trusted physical user input and reject programmatic activation;
- pure Canvas/WebGL controls with no useful DOM/accessibility surface;
- completely opaque UI outside accessible site/frame/extension boundaries;
- arbitrarily long single strings where meaningful semantics are deliberately placed outside all finite sampled windows (full guaranteed discovery would require O(raw-string-length) work and violates the hard CPU bound).

Within those boundaries, v6 prioritizes routine low-discretion access agreements while refusing consequential consent/attestations.
