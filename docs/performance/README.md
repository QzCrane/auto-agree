# Performance evidence

`ledger.json` is the canonical machine-readable performance history for Auto Agree.

## Rules

1. A number without a `benchmarkId`, harness/evidence class and source is not a cross-version performance claim.
2. `synthetic-in-page` and `real-unpacked-extension` are separate evidence classes and must not be silently plotted as one continuous benchmark.
3. Historical records preserve the measurement that actually existed; missing medians/p95/memory fields stay missing rather than being reconstructed.
4. New benchmark revisions receive a new `benchmarkId` or explicit `harnessRevision`; changing fixture dimensions while keeping the same identity is forbidden.
5. Release/main records should include Chrome, Node, commit, repetitions when available, latency, TaskDuration and CPU samples when the harness emits them.
6. Performance gates use broad hard ceilings for correctness/CI stability; trend analysis uses repeated samples/median/p95 where available.
7. A claimed speedup/regression must compare records with compatible benchmark/harness/environment dimensions or explicitly state the mismatch.

The narrative historical reports remain under `docs/verification/`; this ledger is the normalized index, not a replacement for those reports.
