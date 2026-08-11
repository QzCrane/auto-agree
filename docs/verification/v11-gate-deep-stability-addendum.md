# v11 Gate-deep stability addendum

## Why this addendum exists

PR #12 established real-Chrome red/green evidence for Probe deep, Gate large-batch and Gate deep bounded-work recovery and merged at `b5ca363b4d57b019bc485950415f1cdf7584bdf2`. Its final exact-head verify was green, including one Gate-deep saturation pass.

The next clean run, **31461607013**, reproduced Gate deep before any Engine-queue experiment ran:

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

That invalidated “one green scheduling instance = lossless” as a closure rule.

## First stability hardening: preserve FIFO and live TTL

The first Gate-deep recovery design could remove an older unfinished FIFO job under pressure and defer it through a coalesced recovery root. Separately, connected work could cross `JOB_TTL_MS = 2400` while waiting behind other work and be discarded by age alone.

The stability branch therefore keeps `MAX_DEEP_JOBS = 10` but changes the representation policy:

1. existing live FIFO jobs/cursors stay in place;
2. only a **new** excess root is weakly folded into final-state recovery;
3. recovery is promoted after ordinary batch/deep work drains;
4. distinct scopes coalesced to a broader ancestor lose composite authority rather than gaining it;
5. connected live batch/deep work that crosses `JOB_TTL_MS` refreshes its age and continues; disconnected/dead work still retires.

`tests/e2e-gate-live-ttl.mjs` independently blocks the renderer for about 2.7 seconds after the MutationObserver checkpoint, crossing the 2.4-second production TTL while a live Gate deep cursor is queued. The cursor must still activate exactly once.

## Intermediate green was intentionally not accepted as final proof

Exact head `bc2b0402569329f6cf927714d02a0e94d2150264`, run **31467318094**, passed core/package, 300-case structural fuzz, Gate deep 5/5, Gate live-TTL, generation lease and update transition. This was useful evidence for FIFO/TTL behavior, but later exact-head repetitions again produced intermittent Gate-deep false negatives.

A same-candidate rerun showed failed pages with:

```text
Gate = 10.0.0
Engine = null
bootstrapReason = null
```

So Gate never reached `activate()`; Worker injection slots and Gate→Engine handoff were not the failure boundary.

## Diagnostic isolation of the remaining state-machine bug

Research PR #15 was created only for instrumentation and closed unmerged after locating the defect.

Real-Chrome diagnostics established:

- Gate background scheduling was healthy: `scheduled=2`, `started=2`, `finished=2`, `rejected=0` on failed pages;
- the target root was admitted to synchronous evidence scans, but the checkbox tail was never reached;
- a deeper single-root traversal survived explicit renderer GC 3/3, so generic WeakRef/GC failure was not the demonstrated cause;
- the decisive manual cursor trace on run **31468812721** failures reported:

```text
manualRootStarts = 1
manualMaxNeutral = -1
manualFormSiblingReads = 0
manualTargetReads = 0
bootstrapReason = null
```

This means `drainDeep()` resolved `root.firstChild`, but the shared background budget was already exhausted before the loop processed even that first node.

Historical code then executed:

```text
resolve first node
→ set job.started = true
→ process zero nodes because budget is exhausted
→ cursorRef remains null
→ next slice sees started=true + cursor=null
→ interprets job as complete
→ permanently loses subtree tail
```

The failure was schedule-sensitive because whether the first Gate deep slice arrived with any remaining budget depended on prior batch/deep work in that background round.

## Final production repair

`drainDeep()` now gives `started` its literal meaning: **at least one node was actually processed**. The transition to `job.started = true` occurs only inside the budget-guarded traversal loop.

A zero-budget first slice therefore leaves:

```text
started = false
cursorRef = null
```

and the next slice safely retries `root.firstChild` instead of treating the job as finished.

This repair does not raise any cap, enlarge the background budget, retain detached DOM strongly, weaken semantic classification, or add an unbounded scan.

`tests/static-bounded-work.mjs` now rejects the historical pre-loop `job.started = true` pattern in addition to enforcing FIFO preservation, live-TTL behavior, weak recovery, five-attempt Gate saturation and the >2.4-second live-TTL browser discriminator.

## Final closure rule

The branch is not considered closed merely because an earlier head was green. The exact final head containing the zero-budget state-machine repair, static contract, browser gates and documentation must pass in one canonical run:

```text
core + deterministic package
ordinary real Chrome E2E
300-case structural fuzz: FP=0 / FN=0 / duplicate=0
Probe deep saturation
Gate deep saturation 5/5
Gate batch saturation
Gate live-TTL > 2.4 s
generation lease
PR-base → candidate update transition
existing performance ceilings
```

After that exact-head success, the same E2E job should be rerun without changing the SHA once more to reduce scheduling variance before merge.
