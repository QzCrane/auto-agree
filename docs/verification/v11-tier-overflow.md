# v11 Probe/Gate bounded-work saturation

## Test model

ADR 0012's bounded-work rule is attacked at the two pre-Engine discovery tiers with independent real-Chrome discriminators. Each case first proves the expected isolated-world tier, then places the only valid routine agreement in the oldest bounded work representation and exceeds that queue's hard cap. The three cases are aggregated so one failure cannot hide the others.

## First clean red evidence

Exact-head run **31460056851** kept core/package, ordinary real-Chrome behavior, the permanent 300-case structural corpus and Worker termination green while the saturation matrix proved two product failures:

```text
Probe deep overflow:
  agreement exists = true
  checked = false
  clicks = 0
  isolated world = lease + Probe only

Gate batch overflow:
  agreement exists = true
  checked = false
  clicks = 0
  isolated world = lease + Probe + semantic + Gate, no Engine
```

Gate deep happened to pass in that scheduling instance, so the first production patch intentionally changed only the two red-proven mechanisms.

## Intermediate repair result and Gate deep proof

Canonical run **31460896445** executed the Probe and Gate batch repairs with the permanent read-only workflow. Before the saturation step it kept:

```text
core/package: PASS
ordinary real Chrome E2E: PASS
300-case structural fuzz: PASS, FP=0/FN=0/duplicate=0
Worker termination: PASS
5,000-checkbox profile: ~211.9 ms / 0.2042 s / 176 samples
```

The saturation step then produced:

```text
Probe deep overflow: PASS
Gate batch overflow: PASS
Gate deep overflow: FAIL
  agreement exists = true
  checked = false
  clicks = 0
  isolated world = lease + Probe + semantic + Gate
  risk = null
  Engine = null
```

This establishes Gate deep overflow as a real **schedule-sensitive permanent false negative**. A prior pass is therefore evidence only that the race/interleaving can succeed; it is not proof that the queue is lossless.

Because the tier step failed, generation-lease and PR-base update-transition steps were skipped in this intermediate run. They remained mandatory for final closure.

## Production repair

The final branch preserves all three hard resource bounds:

```text
Probe MAX_DEEP = 4
Gate MAX_BATCH_JOBS = 6
Gate MAX_DEEP_JOBS = 10
```

Recovery semantics are:

- **Probe deep overflow:** evicted live roots are represented by one weak coalesced final-state recovery root; it is promoted only after ordinary deep work drains.
- **Gate large-batch overflow:** an evicted batch's weak live owner re-enters the existing bounded Gate deep path.
- **Gate deep overflow:** evicted live roots are weakly coalesced and promoted only after normal batch/deep work drains. `allowComposite` authority is carried separately; if distinct scopes are coalesced to a broader ancestor, composite authority is conservatively disabled rather than widened.
- all lifecycle/activation cleanup clears recovery state.

No hard cap is raised, no synchronous unbounded document scan is introduced, and no detached subtree is strongly retained. `tests/static-bounded-work.mjs` rejects the three historical naked-drop forms and requires the weak recovery paths.

## Final green evidence

Exact-head canonical run **31461157675** passed both jobs in Chrome for Testing **149.0.7827.22**. The real-browser job reported:

```text
e2e-basic: PASS
structural fuzz: 300/300
  false positive = 0
  false negative = 0
  duplicate toggle = 0
worker termination: PASS

Probe deep overflow: PASS
Gate deep overflow: PASS
Gate batch overflow: PASS
e2e-tier-overflow: PASS

generation lease 10→11 probe: PASS
  stale automated clicks = 0
  direct stale clicks = 0
  trusted clicks = 1

PR-base → candidate update transition: PASS
  previousVersion = 10.0.0
  currentVersion = 10.0.0
  oldContextVisible = true
  currentContextVisible = true
  current routine clicks = 1
  mixed/stale/broad/ambiguous protected paths = 0
```

The same run's 5,000-checkbox profile was approximately:

```text
wall latency: 262.1 ms
TaskDuration: 0.2555 s
CPU samples: 220
```

This remains comfortably below the established `<1000 ms` wall and `<0.8 s` TaskDuration release ceilings.

The final invariant is therefore evidenced at all three pre-Engine bounded-work pressure points: queue-object caps remain hard, while live correctness-relevant final state retains a bounded weak recovery representation instead of being silently forgotten.
