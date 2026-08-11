# v11 Probe/Gate bounded-work saturation

## Red evidence

The ADR 0012 bounded-work rule was attacked at the two pre-Engine discovery tiers with independent real-Chrome discriminators. Each case establishes the expected tier first, places the only valid routine agreement in the oldest bounded work representation, then exceeds the relevant hard queue cap.

Exact-head run **31460056851** kept core/package, ordinary real-Chrome behavior, the permanent 300-case structural corpus and Worker termination green while the saturation matrix produced two product failures:

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

The Gate deep saturation case passed in the same clean run, so this change must not alter Gate deep production semantics merely because its code also contains a bounded queue. Only red-proven mechanisms are repaired.

## Intended repair

- Probe keeps `MAX_DEEP=4`; evicted live roots are weakly coalesced into a final-state recovery root and promoted only after ordinary deep work drains.
- Gate keeps `MAX_BATCH_JOBS=6`; an evicted large-batch job re-enters the existing bounded deep path through its still-live owner.
- no hard cap is raised;
- no synchronous full-document fallback is introduced;
- no strong detached-DOM retention is introduced.

Final green evidence is appended only after an ordinary exact-head canonical run with the temporary migration logic removed.
