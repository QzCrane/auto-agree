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

`tests/e2e-gate-live-ttl.mjs` independently creates a live Gate deep cursor and blocks the renderer for about 2.7 seconds after the MutationObserver checkpoint. That crosses `JOB_TTL_MS = 2400` before background traversal resumes, so the test proves that age alone cannot erase connected unfinished work.

## Exact-head green closure

Exact production head **`bc2b0402569329f6cf927714d02a0e94d2150264`**, canonical verify run **31467318094**, completed both jobs successfully with the actual FIFO/TTL production code present.

The real-Chrome job proved in one run:

```text
e2e-basic: PASS
structural fuzz: 300/300
  falsePositive = 0
  falseNegative = 0
  duplicateToggle = 0
worker termination: PASS
Probe deep overflow: PASS
Gate deep overflow #1: PASS
Gate deep overflow #2: PASS
Gate deep overflow #3: PASS
Gate deep overflow #4: PASS
Gate deep overflow #5: PASS
Gate batch overflow: PASS
Gate live-TTL (> 2.4 s): PASS
generation lease current → next generation: PASS
PR-base → candidate update transition: PASS
```

The same run measured the 5,000-checkbox profile at approximately **274.7 ms latency / 0.2648 s TaskDuration / 231 samples**, within the established performance ceilings.

Generation-lease evidence remained fail-closed (`staleAutomatedClicks = 0`, `directStaleClicks = 0`) while one trusted browser click still succeeded. The same-version update transition kept old/current isolated worlds simultaneously observable, produced exactly one current routine click, zero mixed-state stale clicks, one legitimate trusted delegated click, and zero clicks for the external-IDREF, Spanish semantic, broad-wrapper, ambiguous-wrapper and action-inside-label negatives.

`npm test` and deterministic packaging also passed on this exact head. The static bounded-work contract now rejects old-FIFO eviction, age-only live-work deletion, weakening Gate-deep repetition below five attempts, and removing the explicit >2.4-second live-TTL discriminator.

Any later documentation-only closure commit must pass the same canonical gate again before merge so the merged head and recorded repository state remain aligned.
