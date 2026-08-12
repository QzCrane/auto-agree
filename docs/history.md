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
| **v11** | **PR #26 formal release cut** | **coherent 11.0.0 generation; manifest/package/runtime version contract; real v10→v11 non-reloaded transition; v11→v12 cooperative stale-world probe; pre-v11 bounded-work/Shadow/risk/authority hardening promoted into one release baseline** |
| **v12** | **candidate #56 + formal 12.0.0 release** | **RuntimeKernel/DecisionKernel/SchedulerCore/ProfileCore/DomCore/ActionAuthority convergence; sole severity/click policy ownership; 23-language safety parity including Chinese automatic-renewal fix; deterministic-test auto-registration; 27-gate core closure; three-layer action discriminator; statistical real-unpacked performance; real v11→v12 transition and v12→v13 stale-generation proof** |

The complete version-by-version record is indexed at [`docs/verification/README.md`](verification/README.md). v1–v2 are explicitly marked as reconstructed historical records because standalone reports did not yet exist; v3 onward preserves contemporaneous verification reports. Git history remains the authoritative archive for obsolete executable source, so dead implementations are not kept in the current extension directory.

A recurring engineering pattern is explicit: a release claim is not inherited merely because an earlier version implemented or documented it. Later changes are adversarially checked against historical invariants. v10 rejected an initially green handover-focused Worker rewrite because it silently removed v5–v9 profile caps, session caching, precise flow identity and persistence-error semantics; those properties became independently regression-gated.

v11 extended that principle to release identity. The first generation migration exposed Worker as an omitted generation surface and exposed several current-generation tests that had hard-coded `10.0.0`. The release proceeded only after those assumptions were made manifest-derived and a dedicated version contract enforced a coherent v11 generation. The formal candidate then had to pass the real-browser queue/lifetime/authority suite, a physical v10→v11 update transition and a v11→v12 stale-generation probe.

v12 attacked that v11 claim again rather than treating it as settled. The first pure 11→12 cut (#52) changed RuntimeKernel to 12.0.0 and immediately failed because `tests/runtime-kernel.mjs` still asserted the literal `11.0.0`. That falsified the historical statement that all current-generation release magic had already been removed. #54 made RuntimeKernel tests candidate-relative, added package-lock top/root coherence and an anti-hardcode contract, and only then allowed the four-file release cut to be retried.

v12 also found a different governance failure: `tests/classless-decision.mjs` existed but the old manual `package.json` test chain did not execute it. #50 replaced manual registration with deterministic root-test auto-discovery, turning the missing 6,000-case property gate from latent repository content into actual CI evidence.

The physical v12 candidate (#56) finally passed core, full real Chrome/update and seven-run statistical performance twice on the same SHA. A live page simultaneously exposed complete v11 and v12 isolated contexts without reload; current routine behavior remained exactly once, historical/dangerous paths remained zero-click, and a separate v12→v13 probe revoked stale automated/direct isolated clicks while trusted input remained usable. v12 therefore closes not only an architecture cycle but also a verification-governance cycle: policy/mechanism ownership, test registration, version identity and performance evidence are all machine-enforced rather than carried as manual release assumptions.
