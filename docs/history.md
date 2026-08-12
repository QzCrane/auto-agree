# Project history

The repository began as a single all-page content script and evolved through repeated adversarial failures into a bounded, lazy, lifecycle-aware decision system.

| Version | Historical commit / milestone | Architectural milestone |
|---|---|---|
| v1 | `3737737` | checkbox-first detector; whole-page/Shadow scans |
| v1.1 | `56c6954` | text→control reverse discovery; TRAE classless fix; safe retry semantics |
| v2 | `8305627` | incremental processing and major DOM-mutation performance work |
| v3 | `1fb437a`, `afe288c` | MV3 lazy frame injection, bounded text, WeakRef indexing, closed Shadow support |
| v4 | `b2054e9` | evidence-co-occurrence bootstrap, context indexing, stronger risk model |
| v5 | `6fe3fe3` | Probe→Gate→Engine, weak scheduled ownership, fragmented semantics, serialized learning |
| v6 | `1b65137` | Page Lifecycle/BFCache, slot/composed tree, profile self-healing, bounded giant strings |
| v7 | `baa7452` | shared semantic base + lazy risk core, severity lattice/semantic graph, mutation transactions, intent prewarm, behavioral descriptors, bounded global injection scheduler, repository convergence |
| v8 | `c273dcd` | real unpacked-extension E2E, real worker-termination/update recovery, document-lifecycle defense, fair/stale-aware scheduling, native-validity causality, real-world-derived regression corpus, profile-driven Probe optimization |
| v9 | `d4d3b8a` | recovered historical safety invariants, tri-state refusal, durable one-shot UNKNOWN semantics, seed handoff repair, dependency-safe tier initialization, sender-bound profile identity, cross-version dependency closure and the first generation handover firewall for non-cooperative old Engine worlds |
| v10 | `7e45163` final v10 main | cooperative generation self-revocation, shared-semantic/bounded handover convergence, exact source-event causal delegation, multilingual risk parity, structural fuzz, lossless Probe/Gate/Engine bounded-work and lifetime hardening, restored profile governance and deterministic runtime package closure |
| **v11** | **PR #26 formal release cut** | **coherent 11.0.0 generation across all runtime surfaces; reusable version contract; manifest-derived current-generation tests; real v10→v11 non-reloaded transition; v11→v12 cooperative stale-world revocation; all pre-v11 bounded-work, Shadow, risk and authority invariants promoted to one release baseline** |

The complete version-by-version record is indexed at [`docs/verification/README.md`](verification/README.md). v1–v2 are explicitly marked as reconstructed historical records because standalone reports did not yet exist; v3 onward preserves contemporaneous verification reports. Git history remains the authoritative archive for obsolete executable source, so dead implementations are not kept in the current extension directory.

A recurring engineering pattern is now explicit: a release claim is not inherited merely because an earlier version implemented it. Later changes are adversarially checked against historical invariants. v10 itself rejected an initially green handover-focused Worker rewrite because it silently removed v5–v9 profile caps, session caching, precise flow identity and persistence-error semantics; those properties became independently regression-gated.

v11 extends that principle to release identity itself. The first generation migration was not allowed to produce a partial release: it exposed Worker as an omitted generation surface and exposed several current-generation tests that had hard-coded `10.0.0`. The release was permitted to proceed only after those assumptions were made manifest-derived and a dedicated `version-contract` proved all eight runtime JavaScript sentinels, the manifest and the package are one coherent generation. The same release candidate then had to pass the full real-browser queue/lifetime/authority suite, a physical v10→v11 update transition, and a v11→v12 stale-generation probe.