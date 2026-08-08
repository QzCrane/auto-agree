# Changelog

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

- Three-tier Probe → Gate → Engine architecture, weak ownership across background queues, fragmented semantic recovery, serialized profile writes.

## 4.0.0

- Evidence-co-occurrence bootstrap, context indexing, candidate snapshots, time-budgeted mutation queues, behavioral fast path and stronger risk model.

## 3.0.0

- Lazy frame-specific MV3 injection, bounded text/accessibility resolution, WeakRef candidate indexing, closed Shadow DOM support and adversarial consent testing.

## 2.0.0

- Incremental DOM processing, Shadow/frame expansion, classless control handling and major mutation-storm performance improvements.

## 1.1.0

- Added reverse discovery from legal text to classless controls and fixed blind retry toggling. Confirmed on the real TRAE login agreement flow.

## 1.0.0

- Initial cross-site agreement-control detector.
