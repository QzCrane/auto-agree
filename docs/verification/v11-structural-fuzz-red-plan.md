# v11 structural fuzz red gate

This clean branch restores only the deterministic 300-case real-Chrome structural corpus that was isolated on the closed research PR #7. The production runtime is intentionally unchanged in this commit.

The gate starts from one ordinary seed agreement so Engine is already legitimately active, then mounts 300 dynamic cases across mutation timing, native/external labels, ARIA IDREFs, custom controls, wrapper depth, arbitrary text fragmentation, multilingual routine semantics, blocked consent, already-checked, disabled, and mixed state.

Required aggregate invariant:

```text
false positive   = 0
false negative   = 0
duplicate toggle = 0
```

The known hypothesis is that `Engine.enqueueRootBatch()` can silently discard unfinished discovery work at `MAX_ROOT_BATCHES`. This document is not proof of the hypothesis; the exact-head real Chrome failure is the proof prerequisite before production repair.
