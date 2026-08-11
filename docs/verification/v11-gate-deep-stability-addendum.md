# v11 Gate-deep stability addendum

## Why this addendum exists

PR #12 established real-Chrome red/green evidence for Probe deep, Gate large-batch and Gate deep bounded-work recovery and merged at `b5ca363b4d57b019bc485950415f1cdf7584bdf2`. Its final exact-head verify was green, including one Gate-deep saturation pass.

The very next clean research run, **31461607013**, replayed the permanent tier saturation suite before attempting any Engine queue experiment and reproduced Gate deep again:

```text
Probe deep overflow: PASS
Gate batch overflow: PASS
Gate deep overflow: FAIL
  agreement exists = true
  checked = false
  clicks = 0
  Gate = 10.0.0
  Engine = null
```

Because the Engine experiment never ran, that run contains no Engine-walk conclusion. More importantly, it proves that a single green scheduling instance is insufficient evidence for Gate-deep losslessness.

## Remaining race in the first recovery design

The first Gate-deep repair still allowed an existing unfinished FIFO job to be removed at pressure time and represented later through a coalesced recovery root. Separately, a live job could wait behind batch work long enough to cross `JOB_TTL_MS = 2400` and be dropped even though its root remained connected and its cursor still represented unique semantic work.

Both mechanisms turn scheduling latency into correctness authority.

## Stronger production invariant

The stability hotfix keeps all resource bounds unchanged but changes which representation is compressed:

```text
MAX_DEEP_JOBS = 10
```

When the Gate deep queue is full:

1. existing FIFO jobs and their cursors stay in place;
2. only the **new** excess root is folded into the bounded weak final-state recovery scope;
3. recovery is promoted only after ordinary batch/deep work drains;
4. distinct scopes coalesced to a broader ancestor lose composite authority rather than gaining it.

TTL also changes meaning for live bounded work:

```text
live + connected + cursor still valid + age > TTL
→ refresh liveness age and continue cursor
```

not:

```text
age > TTL
→ forget work
```

Disconnected/dead owners and roots are still discarded. Hard queue caps, per-slice budgets, lifecycle generations and WeakRefs continue to bound resources.

## Variance-reducing browser gate

`tests/e2e-tier-overflow.mjs` now runs Gate-deep saturation on **five independent pages per canonical CI run**, while Probe deep and Gate batch retain their independent discriminators. Every Gate-deep attempt must end with exactly one activation within the existing timeout. The timeout, queue cap and fixture are not relaxed to obtain green status.

Final closure requires the exact final head to pass core/package, structural fuzz, Probe deep, Gate deep **5/5**, Gate batch, generation lease, PR-base update transition and existing profile ceilings in one canonical run.
