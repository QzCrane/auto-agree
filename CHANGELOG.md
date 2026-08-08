# Changelog

## 9.0.0 — 2026-08-08

- Restored the historical UNKNOWN-state invariant: a classless control with no observable checked contract is one-shot for that DOM element, even after the normal click cooldown expires.
- Treat native `indeterminate` and ARIA `mixed` states as non-authoritative tri-state controls and never auto-toggle them.
- Fixed Gate→Engine seed consumption so Shadow probing and scoped Engine bootstrap can both reuse the same weakly-owned handoff without retaining detached DOM.
- Moved Gate/Engine sentinels behind dependency validation so a partial or out-of-order injection cannot permanently poison later retries.
- Made semantic/risk cores version-refreshable and included `semantic-core.js` in Engine injection dependency closure for safer cross-version worker/content-tier transitions.
- Bound site-learning identity to Chrome `MessageSender.origin`/`url` rather than a content-provided `message.origin`.
- Added real unpacked-Chrome regressions for tri-state controls and classless UNKNOWN one-shot behavior, plus static/worker contracts for the recovered invariants.

## 8.0.0 — 2026-08-08

- Added real unpacked-extension Puppeteer E2E with explicitly installed Chrome for Testing, including the actual MV3 service worker, dynamic isolated-world injection, all-frame behavior, closed Shadow DOM, worker termination recovery, update transition, and CPU-profile capture.
- Added Worker `documentLifecycle` defense-in-depth: explicit prerender/cached/pending-deletion senders cannot schedule Gate/Engine or profile work.
- Rebuilt injection scheduling with bounded aging, per-tab tie rotation, stale-job eviction, and Engine admission that can preempt younger queued Gate work instead of failing behind a full low-priority queue.
- Added bounded handoff retries in Probe/Gate and idempotent profile-message retries so unexpected service-worker termination does not strand an otherwise live page.
- Added update rehydration: an updated/reloaded MV3 worker persistently resumes a bounded bootstrap sweep over existing tabs without requesting the `tabs` permission.
- Strengthened disabled-action causality with native `ValidityState`; a non-empty but invalid credential no longer makes a disabled Login button look like evidence that Terms is the blocker.
- Converted Probe→Gate and Gate→Engine seed handoff to WeakRef ownership with backward-compatible v7 seed reading and consumption cleanup.
- Added a sanitized real-world-derived regression corpus (TRAE classless, fragmented consequential language, closed Shadow, iframe, dynamic SPA, native-validity gating).
- Real unpacked E2E exposed and fixed a classless reverse-discovery `ReferenceError` caused by stale pre-`risk-core.js` private identifiers; a static contract now prevents that module-boundary regression.
- Used the real 5,000-checkbox CPU profile to remove broad nearby-text extraction from ordinary checkbox Probe paths. The profiled workload moved from ~330.9 ms / 0.3056 s TaskDuration to ~286.1 ms / 0.2662 s, and Probe text-scan functions dropped out of the top sampled hotspots.
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

- Three-tier Probe → Gate → Engine architecture, weak ownership across background queues, fragmented semantics, serialized profile writes.

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
