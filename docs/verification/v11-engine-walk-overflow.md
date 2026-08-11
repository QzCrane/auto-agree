# v11 Engine walk-queue saturation

## Red evidence

This work attacks Engine's bounded background subtree traversal independently from the already-closed Probe/Gate queues.

The real-Chrome discriminator first activates the full Engine and proves a seed routine agreement clicked exactly once. It then appends 20 large roots, each with 900 descendants. The only fresh routine agreement is placed near the tail of an early root while enough later roots are present to exceed the historical `MAX_WALK_JOBS = 12` cap.

With production Engine code unchanged, canonical run **31469631388** kept all prerequisites green:

```text
core/package: PASS
ordinary real Chrome E2E: PASS
300-case structural fuzz: PASS, FP=0/FN=0/duplicate=0
Probe/Gate saturation: PASS
Gate live-TTL: PASS
```

The Engine discriminator then failed after the fixed 9-second eventual-progress deadline:

```json
{
  "exists": true,
  "checked": false,
  "clicks": 0,
  "rootCount": 20,
  "started": true,
  "visibility": "visible"
}
```

The isolated world still contained the complete v10 Engine dependency closure. Therefore the failure was not Gate activation, Worker injection, page lifecycle, generation revocation or missing DOM. It proved that the historical admission rule:

```text
while walkJobs.length >= MAX_WALK_JOBS
→ release and drop oldest unfinished walk job
```

could permanently forget unique live semantic work.

## Production invariant

The hard resource limit remains:

```text
MAX_WALK_JOBS = 12
```

The repair changes only overflow representation:

1. the 12 existing FIFO walk cursors remain authoritative and keep their order;
2. a **new excess** root is weakly coalesced into one `walkRecoveryRef` final-state scope instead of evicting an older cursor;
3. `walkRecoveryUrgent` preserves whether any coalesced work is urgent without retaining the DOM strongly;
4. recovery is promoted only after ordinary RootBatch and walk work drains, so it cannot overtake the existing FIFO;
5. lifecycle retirement clears the recovery state together with ordinary background work.

The recovery scope is a `WeakRef`; no hard cap is raised, no synchronous unbounded document scan is introduced, and detached DOM is not retained strongly.

`tests/static-bounded-work.mjs` rejects the historical oldest-walk drop, requires `MAX_WALK_JOBS = 12`, the weak recovery helpers, FIFO-before-recovery ordering, lifecycle cleanup, and the permanent real-Chrome discriminator dimensions (`20` roots × `900` nodes, fixed `9000 ms` deadline).

## Exact-head green evidence

Exact product head **`eade7dd3bacabcb121da2a4ef4381cf415a29a5b`**, canonical verify run **31471368878**, completed both jobs successfully.

The real-Chrome job proved in the same run:

```text
e2e-basic: PASS
structural fuzz: 300/300
  falsePositive = 0
  falseNegative = 0
  duplicateToggle = 0
worker termination: PASS
Probe deep saturation: PASS
Gate deep saturation: PASS 5/5
Gate batch saturation: PASS
Gate live-TTL (>2.4 s): PASS
Engine walk saturation: PASS
generation lease: PASS
PR-base → candidate update transition: PASS
```

The 5,000-checkbox profile remained within the established ceilings:

```text
wall latency: 210.3 ms
TaskDuration: 0.2038 s
CPU samples: 167
```

Generation protection remained fail closed (`staleAutomatedClicks = 0`, `directStaleClicks = 0`) while trusted browser input still succeeded exactly once. The same-version update transition retained simultaneous old/current execution contexts and preserved exactly-one current routine activation plus all historical stale/ambiguous negative paths.

A later documentation-only exact head must pass the same canonical gates again before merge. Because this is scheduling correctness, the final documentation head should also rerun the unpacked-E2E job without changing the SHA before squash merge.
