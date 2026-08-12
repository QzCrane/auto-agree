# ADR 0017: Live Engine sibling-batch age is not obsolescence

## Status

Accepted during pre-v11 correctness hardening.

## Context

Engine represents a `MutationRecord` with more than 96 added nodes as a bounded sibling-range job. The job retains only weak range boundaries and a weak owner, then advances through live siblings across background slices.

Historically `runBatchJob()` combined two unrelated conditions:

```text
age > BATCH_JOB_TTL_MS
OR
owner no longer exists
=> retire job
```

The caller then removed the job from `batchJobs`. Real Chrome proved that this converts scheduling delay into a permanent false negative: a connected sibling range may wait longer than the 3000 ms age threshold while the renderer is busy even though the owner, range and target are still live.

## Decision

`BATCH_JOB_TTL_MS = 3000` remains a liveness-age bound, not a deletion authority for connected work.

For a sibling-range job:

1. an owner that can no longer be resolved may retire the job;
2. a resolved but disconnected owner may retire the job;
3. a still-connected owner that crosses `BATCH_JOB_TTL_MS` refreshes `createdAt` and continues from the existing `currentRef` / `subjob` / `reachedLast` state;
4. the job does not restart from the first sibling merely because it aged;
5. `MAX_BATCH_JOBS = 8` remains unchanged;
6. no synchronous full-document scan or strong detached-DOM ownership is introduced.

The permanent browser discriminator must keep the unique positive outside Engine's first-three / last-five edge samples so an edge fast path cannot accidentally satisfy the test.

## Evidence

Evidence-only PR #19, canonical run `31571793619`, kept all prior gates green and then failed the new lifetime discriminator with:

```text
target exists = true
checked = false
clicks = 0
sibling count = 140
renderer blocker complete = true
Engine world = active
```

The clean product branch changes only the lifetime predicate. Canonical run `31573353246` then passed the same 140-sibling / positive-70 / ~3.4-second-stall discriminator exactly once while preserving Gate, Engine walk, RootBatch lifetime, generation-lease and update-transition behavior.

## Consequences

Pure queue age cannot erase connected semantic work. Dead/disconnected ownership remains a valid bounded retirement condition, so the fix does not turn the batch queue into an unbounded retention mechanism.
