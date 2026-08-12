# Pre-v11 Engine sibling-batch live-TTL hardening

## Scope

This record isolates Engine's large-`MutationRecord` sibling-range lifetime semantics. It does not claim a formal v11 release; the runtime still reports `10.0.0`.

## Red discriminator

Evidence-only PR #19 was created from main `c564e6d067e6a5f253e07702fdf5c0f0d024b126` with production Engine unchanged.

The real-Chrome test first establishes a fully active Engine and exactly one seed click. It then appends one `DocumentFragment` containing **140 sibling sections**. Because `addedNodes.length > 96`, Engine enters `enqueueSiblingRange()` rather than ordinary per-root mutation processing. The only new routine agreement is sibling **70**, deliberately outside the first-three / last-five edge handling.

A timer queued before the mutation blocks the renderer for approximately **3.4 seconds** after the MutationObserver microtask has queued the sibling-range job. This crosses `BATCH_JOB_TTL_MS = 3000` before background continuation.

Canonical run **31571793619** first passed:

```text
core/package: PASS
ordinary real Chrome E2E: PASS
structural fuzz: 300/300, FP=0, FN=0, duplicate=0
Probe/Gate saturation: PASS, including Gate deep 5/5
Gate live-TTL: PASS
Engine walk saturation: PASS
Engine RootBatch live-TTL: PASS
```

The new step then failed with the target still physically live:

```text
exists = true
checked = false
clicks = 0
siblingCount = 140
blockerComplete = true
visibility = visible
full Engine isolated world = active
```

The historical `runBatchJob()` predicate treated `age > BATCH_JOB_TTL_MS` exactly like owner death and returned `false`; `drainBackground()` then shifted the unfinished job.

## Repair

The production repair keeps all resource constants unchanged:

```text
MAX_BATCH_JOBS = 8
BATCH_JOB_TTL_MS = 3000
```

`runBatchJob()` now separates retirement authority from liveness age:

```text
owner missing -> retire
owner disconnected -> retire
live owner + age > TTL -> refresh createdAt and continue existing cursor state
```

The sibling range is not restarted from index zero and no synchronous document scan is introduced.

## Green evidence

Clean product head `0fcf9e03d3781b45b8ac6e715f29b1d60f6eb1fe` ran canonical verify **31573353246** in Chrome for Testing **149.0.7827.22**. Both jobs passed, including:

```text
ordinary E2E/profile: PASS
structural fuzz 300/300: PASS
Probe/Gate saturation: PASS
Gate live-TTL: PASS
Engine walk saturation: PASS
Engine RootBatch live-TTL: PASS
Engine sibling-batch live-TTL: PASS
generation lease: PASS
PR-base -> candidate update transition: PASS
```

The representative 5,000-checkbox profile was:

```text
wall latency: 294.7 ms
TaskDuration: 0.2802 s
CPU samples: 247
```

This remains below the established `<1000 ms` wall and `<0.8 s` TaskDuration ceilings.

## Permanent gates

- `tests/e2e-engine-batch-ttl.mjs` locks 140 siblings, positive index 70, the >96 large-mutation path, ~3400 ms renderer stall and fixed 9000 ms eventual-progress deadline.
- `tests/static-engine-lifetime.mjs` locks `BATCH_JOB_TTL_MS = 3000`, forbids combining age with owner death as one deletion predicate, and requires dead/disconnected checks before live-age refresh.
- CI runs the discriminator after existing Gate, Engine-walk and RootBatch lifetime gates, so the failure domain remains isolated.
