# Project history

The repository began as a single all-page content script and evolved through repeated adversarial failures into a bounded, lazy, lifecycle-aware decision system.

| Version | Historical commit | Architectural milestone |
|---|---|---|
| v1 | `3737737` | checkbox-first detector; whole-page/Shadow scans |
| v1.1 | `56c6954` | text→control reverse discovery; TRAE classless fix; safe retry semantics |
| v2 | `8305627` | incremental processing and major DOM-mutation performance work |
| v3 | `1fb437a`, `afe288c` | MV3 lazy frame injection, bounded text, WeakRef indexing, closed Shadow support |
| v4 | `b2054e9` | evidence-co-occurrence bootstrap, context indexing, stronger risk model |
| v5 | `6fe3fe3` | Probe→Gate→Engine, weak scheduled ownership, fragmented semantics, serialized learning |
| v6 | `1b65137` | Page Lifecycle/BFCache, slot/composed tree, profile self-healing, bounded giant strings |
| v7 | `baa7452` | shared semantic base + lazy risk core, severity lattice/semantic graph, mutation transactions, intent prewarm, behavioral descriptors, bounded global injection scheduler, repository convergence |
| v8 | current candidate | real unpacked-extension E2E, worker termination/restart recovery, document-lifecycle defense, update rehydration, fair/stale-aware injection scheduling, native validity causality, real-world-derived regression corpus |

The complete version-by-version record is indexed at [`docs/verification/README.md`](verification/README.md). v1–v2 are explicitly marked as reconstructed historical records because standalone reports did not yet exist; v3 onward preserves contemporaneous verification reports. Git history remains the authoritative archive for obsolete executable source, so dead implementations are not kept in the current extension directory.
