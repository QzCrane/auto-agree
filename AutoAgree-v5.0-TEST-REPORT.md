# Auto Agree Login Terms v5.0 — Extreme Verification & Optimization Report

Generated: 2026-08-08

## 1. Final architecture

v5 is a three-tier Manifest V3 extension:

1. **`bootstrap.js` micro-probe** runs in every matching frame at `document_start`.
   - It never clicks and never decides consent.
   - It performs only bounded structural/auth/legal suspicion detection.
   - Plain footer Terms/Privacy, newsletters, contact forms, site search, ordinary checkboxes, and ordinary required settings remain asleep.
   - It defers discovery while `document.prerendering` is true.
   - A focus/pointer seed can preserve the first interaction with a completely closed Shadow host.

2. **`gate.js` semantic gate** is dynamically injected only into suspicious frames.
   - It requires co-occurring evidence rather than a single keyword.
   - It reconstructs legal/assent semantics split across inline DOM fragments.
   - It does not make the final consent decision and never clicks.

3. **`engine.js`** is injected only after the gate accepts the frame.
   - It performs the full legal/assent/risk/context/control decision.
   - It handles native/ARIA/custom controls, classless controls, open/closed/nested Shadow DOM, dynamic insertion, hidden-to-visible controls, accessibility labels, iframe-scoped execution, and multi-flow local locator learning.

`worker.js` coalesces gate/engine injections per document/frame and serializes local profile writes.

## 2. v5 changes beyond v4

### 2.1 Three-tier lazy activation

v4's all-frame bootstrap still contained the full evidence classifier. v5 moves the richer multilingual/evidence classifier into `gate.js`.

Final production source sizes:

- `bootstrap.js`: **13,406 bytes**
- `gate.js`: 26,631 bytes
- `worker.js`: 6,651 bytes
- `engine.js`: 79,738 bytes
- manifest: 834 bytes

Only the 13.4 KB micro-probe is statically present in every matching frame.

### 2.2 Explicit handoff teardown

After a successful probe -> gate or gate -> engine handoff:

- MutationObserver is disconnected;
- global focus/pointer listeners owned by the retired tier are removed;
- queued work is dropped;
- the retired tier does not continue observing the page.

Listener comparison after full handoff:

- v4: **10** JS event listeners
- v5: **8** JS event listeners

### 2.3 Detached-DOM ownership hardening

The extreme audit found three independent retention mechanisms that normal foreground tests did not expose:

1. hidden pending controls stored as `Set<Element>`;
2. queued `MutationRecord.addedNodes` NodeLists;
3. `TreeWalker` instances stored across background scheduling/yield points.

All three were removed as strong ownership paths.

v5 now uses weak target/blocker entries, weak sibling-range boundaries, and resumable `WeakRef(root) + WeakRef(cursor)` DFS state. No TreeWalker survives a scheduling point in bootstrap, gate, or engine.

### 2.4 Fragmented DOM semantics

Randomized fuzzing exposed cases where frameworks split words inside legal/risk semantics:

- `facial reco` + `gnition`
- fragmented Chinese `人脸识别` / `授权扣款` / `已满18岁`
- fragmented `User Agreement`
- Japanese/Korean/Arabic legal strings split across several spans

v5 keeps normal whitespace-preserving text as the primary semantic representation and uses a bounded compact companion only to reconstruct high-value legal/assent/risk tokens. Negative/risk/attestation semantics receive the same fragmentation recovery as positive agreement semantics.

A second structural fallback aggregates text only for labels that actually exhibit multi-fragment structure, avoiding the old broad `input.labels` hotspot on settings pages.

### 2.5 Gate support for non-auth mandatory onboarding

A required agreement can be a prerequisite for a generic Continue/Welcome flow with no phone/password field. The gate now recognizes locally co-occurring:

- legal semantics;
- assent or required semantics;
- an actual consent control;

without reverting to a global `Terms -> activate` rule.

### 2.6 Profile concurrency and bounded persistence

Worker profile writes are serialized and merged.

- maximum flows per origin: **8**
- persistent origin cap: **256**
- stale-flow TTL: **180 days**
- worker hot LRU: **32 profiles**

A locator remains discovery acceleration only. The live element must pass the current semantic/risk decision before activation.

## 3. Correctness verification

Test runtime: **Chromium 144.0.7559.96** DOM/layout/events implementation.

### 3.1 Fixed three-tier pipeline matrix

Full path:

`micro-probe -> gate -> engine -> decision -> click/no-click`

Final result: **11 / 11 PASS**.

Includes:

- footer Terms/Privacy: 0 gate / 0 engine;
- newsletter footer: 0 / 0;
- contact/verify false-auth case: 0 / 0;
- password auth;
- email login;
- standard Terms agreement;
- marketing negative;
- TRAE-style classless agreement control;
- closed Shadow first-focus path;
- dynamic insertion;
- 5,000 ordinary checkboxes before a tail login agreement.

### 3.2 Micro-probe fixed activation matrix

Final result: **8 / 8 PASS**.

Negative frames stay asleep while password/auth/legal/control/OTP/closed-shadow event cases trigger the gate.

### 3.3 Direct engine structural/semantic fuzz

Final result: **800 / 800 PASS**.

The corpus mixes:

- routine Terms/Privacy positives;
- classless controls;
- consequential/risky negatives;
- already-checked controls;
- disabled controls;
- nested labels;
- external `label[for]` before/after inputs;
- `aria-labelledby`;
- random wrapper depth;
- arbitrary 2–5 fragment splits through words;
- English, Chinese, Japanese, Korean, Arabic.

Final fuzz result: **0 false positives, 0 false negatives, 0 duplicate classless toggles** in this corpus.

### 3.4 Extended full three-tier random fuzz

Final result: **200 / 200 PASS**.

This test exercises the actual probe -> gate -> engine chain and includes:

- non-auth footer/newsletter/contact/search negatives;
- auth-only flows;
- routine legal agreements;
- risky agreements;
- generic required onboarding with no auth credential;
- external/nested/ARIA labels;
- randomly fragmented legal text.

### 3.5 Prerender lifecycle

Simulated prerender activation contract:

- messages before activation: **0**
- messages after `prerenderingchange`: **1**
- result: **PASS**

The extension therefore does not synthesize agreement activity while the document is still in its prerender state in the tested lifecycle model.

### 3.6 Worker/profile concurrency

Base worker contract: **PASS**.

- two concurrent flows for one origin merged without loss;
- stale flow pruning passed;
- 256-origin cap passed;
- duplicate gate injection coalesced;
- duplicate engine injection coalesced.

Extreme concurrent profile test:

- **64 concurrent writes** to one origin;
- final retained flow IDs: **63, 62, 61, 60, 59, 58, 57, 56**;
- exactly the newest 8 were retained;
- **300 concurrent origin writes** still converged to **256 persisted origins**.

## 4. Performance verification

All measurements below are synthetic stress tests. They establish particular worst-path properties; they are not universal speed multipliers for all websites.

### 4.1 All-frame startup cost: v4 vs v5

30k ordinary DOM startup benchmark, 9 runs:

| Metric | v4 bootstrap | v5 micro-probe |
|---|---:|---:|
| static bytes | 19,051 | **13,406** |
| synchronous init median | ~2.10 ms | **~1.10 ms** |
| max in this run | ~3.90 ms | **~3.20 ms** |

The always-present code footprint dropped about **29.6%**, while median synchronous startup time in this benchmark dropped about **47.6%**.

### 4.2 Full 5,000-checkbox tail-login pipeline

9-run full-pipeline comparison:

- v4 median: **~79.7 ms**
- v5 median: **~79.1 ms**
- v4 max: ~89.1 ms
- v5 max: ~133.3 ms (single scheduling outlier)

The extra semantic gate did not produce a median latency penalty in this benchmark. The maximum remains scheduler/jitter sensitive and is not presented as an improvement.

A separate fixed three-tier run measured the 5,000-tail case at **~88.8 ms**.

### 4.3 1,500 simultaneous checkbox attribute mutations

Final v5 five-run microtask blocking values:

- ~0.8 ms
- ~0.6 ms
- ~0.6 ms
- ~0.6 ms
- ~0.7 ms

Median: **~0.6 ms**.

### 4.4 Large-tail direct-engine stress

Final three runs:

- ~80.7 ms
- ~94.7 ms
- ~82.2 ms

Median: **~82.2 ms**.

This path intentionally bypasses the normal three-tier lazy architecture and forces the engine to deal with a large existing DOM.

## 5. Memory / detached-DOM adversarial verification

### 5.1 Hidden pending-control retention

Normal hidden-control GC comparison from the Chromium regression:

- v4 after GC: **1,357 nodes**
- v5 after GC: **7 nodes**

A stricter test froze timers, created/removed 1,000 hidden agreement controls, then forced GC:

- final v5: **6 nodes**

This verifies that pending visibility recovery no longer strongly owns removed controls merely because rescue timers did not run.

### 5.2 Huge MutationRecord NodeList retention

Background scheduler deliberately never executes. A 12,000-node batch is inserted, queued, removed, then GC is forced.

- v4: **24,007 nodes retained**
- v5: **7 nodes**

v5 queues only weak range boundaries instead of retaining the full `addedNodes` NodeList across background scheduling.

### 5.3 Cross-yield TreeWalker retention

Background scheduler again never executes. A 12,000-node subtree enters an unfinished walk, is then removed, MutationObserver delivery is allowed to settle, and GC is forced.

- v4: **24,008 nodes retained**
- v5: **6 nodes**

v5 stores weak DFS root/cursor state instead of retaining a TreeWalker across yields.

### 5.4 Probe/gate frozen-queue retention

With background scheduling frozen and the queued DOM removed:

- probe deep scan: **6 nodes**
- gate deep scan: **6 nodes**
- gate large-batch scan: **6 nodes**

Thus the thin tiers also do not become detached-DOM owners while waiting for background execution.

## 6. Static and permission audit

Final production files (`bootstrap.js`, `gate.js`, `worker.js`, `engine.js`):

- `textContent`: **0**
- `innerText`: **0**
- `setInterval`: **0**
- `fetch(`: **0**
- `XMLHttpRequest`: **0**
- `WebSocket`: **0**
- `eval(`: **0**
- `new Function`: **0**
- whole-page `querySelectorAll('*')`: **0**
- whole agreement-row `row.click`: **0**
- TODO/FIXME/HACK markers: **0**

Remaining layout/geometry call sites in the full engine:

- `getComputedStyle`: **1**
- `getBoundingClientRect`: **2**
- `checkVisibility`: **1**
- `elementsFromPoint`: **1**

Remaining `createTreeWalker` call sites across probe/gate/engine: **6**. All are local bounded synchronous calls; no TreeWalker object is stored across a scheduling/yield point.

Manifest permissions:

- `scripting`
- `storage`
- `<all_urls>` host access

No cookies/history/webRequest/downloads/debugger/nativeMessaging/proxy/clipboard/tabs/management permission is declared.

No production network/telemetry path is present.

## 7. Optimization decisions deliberately rejected

### Trie / Aho-Corasick / language-router rewrite

Not adopted. Earlier CPU profiling identified DOM/label resolution and scheduling/retention as the controlling costs, not regex execution. Replacing the mature regex layer with a more complex automaton would enlarge code/state space without measured evidence of a controlling performance gain.

### TaskController as a second cancellation authority

Not adopted. Generation superseding, weak cursors, TTLs, queue caps, connectivity checks, and handoff teardown already provide the required cancellation behavior. Adding a second independent cancellation state machine would make correctness harder to prove.

### Main-world instrumentation / attachShadow monkey-patching

Not adopted. Closed-root support uses the Chrome extension DOM capability rather than modifying page runtime behavior.

## 8. Test-environment boundary

The managed Chromium environment used here has machine policy that blocks arbitrary external navigation / unpacked-extension installation. That policy was not bypassed.

Therefore this report does **not** claim that the final ZIP was installed as an unpacked extension in this container and driven through arbitrary live websites end-to-end.

Instead, the final code was exercised against Chromium 144's real DOM/layout/events/MutationObserver/ResizeObserver/Shadow DOM machinery, with extension-specific injection/closed-root APIs tested through controlled contracts/shims. Worker, probe, gate, engine, manifest, scheduling, memory, fuzz, and injection-target logic were tested independently and in composed pipelines.

An earlier v1.1 build was independently confirmed by the user to work on the real `work.trae.cn` login agreement control. v5 retains and repeatedly regresses that classless-control mechanism.

## 9. Remaining hard boundaries

No ordinary content-script extension can guarantee control over every possible UI. Remaining hard boundaries include:

- browser-owned Chrome UI/permission surfaces;
- sites that explicitly require trusted physical input rather than programmatic DOM activation;
- completely self-drawn Canvas/WebGL controls with no useful DOM/accessibility surface;
- a completely closed Shadow component that exposes no external semantic signal and receives no user interaction from which a host can be discovered.

These require a different automation/security boundary, not another selector or regex inside this extension.

## 10. Final verdict

v5's largest gains are architectural rather than cosmetic:

- three-tier lazy activation reduces all-frame permanent work;
- legal/risk semantics survive arbitrary inline fragmentation;
- profile writes are race-safe and bounded;
- prerender pages stay inactive until activation;
- hidden controls, mutation batches, walk jobs, shadow jobs, probe jobs, and gate jobs no longer make the extension a detached-DOM owner across frozen scheduling;
- all of those changes retained full correctness in the final fixed and randomized regressions.

The next high-value source of improvement is no longer additional generic rules. It is a growing corpus of real-world false-positive/false-negative sites, because those provide new DOM/interaction mechanisms that synthetic fuzz cannot invent with confidence.
