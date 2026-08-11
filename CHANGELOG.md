# Changelog

## 10.0.0 — 2026-08-09

- Added a **cooperative generation lease** to every static/dynamic Auto Agree execution world. The lease is isolated-world local and revokes that generation's `HTMLElement.prototype.click()` when `chrome.runtime.getManifest()` is invalidated or no longer matches the compiled generation.
- Added a real Chrome 10→11 manifest-generation probe proving that the old v10 Engine world remains JavaScript-executable while its extension Runtime becomes stale; stale automation and direct stale-world `.click()` both produce zero clicks, while trusted browser input still succeeds once.
- Retained the v9 generation handover firewall for non-cooperative historical generations and made stale guards passive toward future legitimate generations after their own Runtime is invalidated.
- Converged handover semantics on the shared bounded `semantic-core.js`; added explicit `aria-labelledby` / `aria-describedby` and native external-label resolution so the update firewall does not maintain a narrower private Terms vocabulary.
- Replaced generic descendant `querySelector(CONTROL)` causal discovery with hard-bounded, exact local-wrapper traversal. Broad containers, proceed actions and ambiguous multi-control wrappers cannot mint sibling-control authority.
- **Post-merge causal hardening:** real Chrome red testing proved that `stopPropagation()` could prevent bubble cleanup and leave a local delegation token reusable by a later-task synthetic click. Local authority now maps the exact delegated control to the exact source `Event` and is valid only while `sourceEvent.eventPhase != Event.NONE`; synchronous same-dispatch delegation still works exactly once while later asynchronous reuse is blocked.
- Generalized `e2e-update.mjs` so previous/current versions come from the staged PR-base/current manifests and old/current isolated worlds are identified by execution-context IDs. The release-transition gate now works for major releases, patches, and same-version hotfix/reload candidates without hardcoded `9.0.0 → 10.0.0` glue.
- Restored the v6 bounded-string invariant inside handover semantics so a pathological multi-megabyte attribute/text value is sampled before normalization rather than scanned in full.
- Re-audited a handover-focused Worker rewrite and rejected its unrelated regressions. v10 preserves the verified learning governance: 256 origins, 8 flows/origin, 180-day TTL, 32-entry hot LRU, `storage.session` + `storage.local`, fingerprint+locator identity, strict sanitization and propagated persistence errors.
- Added profile-governance regression tests for 64 concurrent flow writes, precise same-fingerprint/different-locator identity, 300-origin bounded persistence and storage-failure propagation.
- Fixed deterministic packaging to derive its runtime JavaScript closure from `extension/*.js`. The audit found that the previous hand-maintained package list could pass ZIP verification while omitting newly introduced runtime modules such as the generation handover guard.
- Expanded real update E2E with external-IDREF semantics, non-English shared semantics, broad-wrapper causal negatives, ambiguous controls and action-inside-label negatives.
- Added a permanent 300-case real-Chrome structural fuzz corpus and repaired Engine RootBatch pressure so a hard queue-object cap no longer silently discards unfinished final DOM state.
- Added fail-closed multilingual risk parity across the language families already supported for routine Terms/Privacy assent; localized optional, financial, medical, biometric, arbitration/rights and age-attestation evidence can suppress automation but cannot create click authority.
- Hardened Probe/Gate bounded work with real-Chrome saturation tests. Probe deep, Gate large-batch and Gate deep pressure preserve hard caps while retaining bounded weak recovery instead of naked oldest-work drops.
- Hardened Gate scheduling lifetime after repeated real-Chrome falsification: existing FIFO deep cursors outrank new overflow, connected work is not erased by age alone, a >2.4-second live-TTL test is permanent, and a zero-budget slice no longer marks a deep job started before processing any node.
- Repaired Engine walk saturation at `MAX_WALK_JOBS = 12`: existing FIFO walk cursors remain authoritative, while only new excess roots are weakly coalesced into final-state recovery and promoted after ordinary RootBatch/walk work drains. The permanent 20×900-node Chrome discriminator proved the historical oldest-walk drop caused a permanent false negative.
- Kept permissions unchanged: `scripting`, `storage`, `<all_urls>`; no debugger, telemetry, network client or remote code.

## 9.0.0 — 2026-08-08

- Restored the historical UNKNOWN-state invariant: a classless control with no observable checked contract is one-shot for that DOM element, even after the normal click cooldown expires.
- Treat native `indeterminate`, ARIA `mixed`, and data `indeterminate` / `mixed` states as non-authoritative tri-state controls and never auto-toggle them.
- Fixed Gate→Engine seed consumption so Shadow probing and scoped Engine bootstrap can both reuse the same weakly-owned handoff without retaining detached DOM.
- Moved Gate/Engine sentinels behind dependency validation so a partial or out-of-order injection cannot permanently poison later retries.
- Made semantic/risk cores version-refreshable and included `semantic-core.js` in Engine injection dependency closure for safer cross-version worker/content-tier transitions.
- Bound site-learning identity to Chrome `MessageSender.origin`/`url` rather than a content-provided `message.origin`; profile operations fail closed without a usable sender origin.
- Added a high-priority generation handover firewall after real Chrome proved that old and new Engine isolated worlds can coexist and remain executable across an extension update. Current Engine clicks receive one-shot authorization; stale-generation synthetic agreement clicks are blocked while trusted user clicks remain unaffected.
- Added real unpacked-Chrome regressions for tri-state controls, classless UNKNOWN one-shot behavior, simultaneous v8/v9 Engine worlds, exactly-one routine update clicks, and zero legacy mixed-state clicks.

## 8.0.0 — 2026-08-08

- Added real unpacked-extension Puppeteer E2E with explicitly installed Chrome for Testing, including the actual MV3 service worker, dynamic `chrome.scripting` injections, isolated worlds, frame handling, closed-Shadow extension API path and extension update lifecycle under test.
- Added Worker `documentLifecycle` defense-in-depth: explicit prerender/cached/pending-deletion senders cannot schedule Gate/Engine or profile work.
- Rebuilt injection scheduling with bounded aging, per-tab tie rotation, stale-job eviction, and Engine admission that can preempt younger queued Gate work instead of failing behind a full low-priority queue.
- Added bounded handoff retries in Probe/Gate and idempotent profile-message retries so unexpected service-worker termination does not strand an otherwise live page.
- Added update rehydration: an updated/reloaded MV3 worker persistently resumes a bounded bootstrap sweep over existing tabs without requesting the `tabs` permission.
- Strengthened disabled-action causality with native `ValidityState`; a non-empty but invalid credential no longer makes a disabled Login button look like evidence that Terms is the blocker.
- Converted Probe→Gate and Gate→Engine seed handoff to WeakRef ownership with backward-compatible v7 seed reading and consumption cleanup.
- Added a sanitized real-world-derived regression corpus (TRAE classless, fragmented consequential language, closed Shadow, iframe, dynamic SPA, native-validity gating).
- Real unpacked E2E exposed and fixed a classless reverse-discovery `ReferenceError` caused by stale pre-`risk-core.js` private identifiers; a static contract now prevents that module-boundary regression.
- Used the real 5,000-checkbox CPU profile to remove broad nearby-text extraction from ordinary checkbox Probe paths. The profiled workload moved from ~330.9 ms / 0.3056 s TaskDuration to ~286.1 ms / ~0.2662 s, and Probe text-scan functions dropped out of the top sampled hotspots.
- Tightened the real-extension performance gate to `<1000 ms` wall latency and `<0.8 s` TaskDuration while keeping the independent v7→v8 update-transition gate.

## 7.0.0 — 2026-08-08

- Split shared semantics into `semantic-core.js` plus engine-only `risk-core.js` so Gate and Engine cannot silently drift while high-risk rules remain lazily loaded.
- Added explicit consent severity: routine, routine privacy, optional, consequential, attestation.
- Rebuilt decision synthesis around a small semantic graph of control → semantic row → context → proceed action relationships.
- Added per-context mutation transactions that coalesce DOM churn before epoch invalidation/O(K) candidate re-evaluation.
- Added intent-driven prewarming using existing focus/input/Enter/proceed events; no continuous pointer tracking.
- Extended site learning with privacy-preserving behavioral descriptors; cached locators remain acceleration only.
- Added bounded global/per-tab worker injection scheduling.
- Added dependency-free property, static, worker, and scheduler tests plus CI.
- Reorganized repository: current extension in `extension/`, historical verification under `docs/verification/`, ADRs under `docs/decisions/`; removed dead legacy `content.js` from the live tree.

## 6.0.0

- Page Lifecycle/BFCache generations, composed slot semantics, closed-Shadow restore, self-healing site profiles, bounded pathological single-string sampling.

## 5.0.0

- Three-tier Probe → Gate → Engine architecture, weak ownership across background queues, fragmented semantics, serialized learning.

## 4.0.0

- Evidence-co-occurrence bootstrap, context indexing, candidate snapshots, time-budgeted mutation queues, behavioral fast path and stronger risk model.

## 3.0.0

- Lazy frame-specific MV3 injection, bounded text/accessibility resolution, WeakRef candidate indexing, closed Shadow support and adversarial consent testing.

## 2.0.0

- Incremental DOM processing, Shadow/frame expansion, classless control handling and major mutation-storm performance improvements.

## 1.1.0

- Added reverse discovery from legal text to classless controls and fixed blind retry toggling. Confirmed on the real TRAE login agreement flow.

## 1.0.0

- Initial cross-site agreement-control detector.