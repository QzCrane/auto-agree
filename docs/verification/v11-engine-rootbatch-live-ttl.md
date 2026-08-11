# v11 Engine RootBatch live-TTL

## Red evidence

This work isolates lifetime semantics from the already-repaired Engine RootBatch overflow and walk-job admission paths.

The real-Chrome discriminator first activates Engine and proves a seed routine agreement clicked exactly once. It then appends **60 connected roots × 420 descendants** with the only fresh routine agreement in root **42**. A timer queued before the mutation monopolizes the renderer for about **3.4 seconds** after the MutationObserver / `flushRoots()` microtask checkpoint, crossing:

```text
ROOT_BATCH_TTL_MS = 3000
```

before background RootBatch continuation can run.

With production Engine unchanged, canonical red run **31472394769** kept the earlier gates green:

```text
core/package: PASS
ordinary real Chrome E2E: PASS
300-case structural fuzz: PASS, FP=0/FN=0/duplicate=0
Probe/Gate saturation: PASS
Gate live-TTL: PASS
Engine walk saturation: PASS
```

The RootBatch live-TTL step then failed before generation/update steps. The target remained live in the page while the historical `runRootBatch()` age check returned `false`; its caller consequently shifted the unfinished batch.

That proved:

```text
age > 3000 ms
```

was not sufficient evidence that the represented final DOM state was obsolete.

## Production repair

The resource constants remain unchanged:

```text
MAX_ROOT_BATCHES = 8
ROOT_BATCH_TTL_MS = 3000
```

The historical age-only deletion:

```text
if age > ROOT_BATCH_TTL_MS
  return false
```

is replaced by a liveness refresh:

```text
if age > ROOT_BATCH_TTL_MS
  job.createdAt = performance.now()
```

Traversal then continues from the existing `job.index`. Dead weakly referenced roots are still skipped naturally as the batch advances.

No cap or TTL is raised, no synchronous unbounded rescan is added, detached DOM is not strongly retained, and click authority is unchanged.

## Deterministic contract

`tests/static-engine-lifetime.mjs` now requires:

- the 3000 ms constant remains explicit;
- age-only RootBatch `return false` is absent;
- live RootBatch liveness refresh is present;
- the browser discriminator keeps 60 roots, target root 42 and a 3400 ms renderer stall;
- the test requires exactly-one eventual activation.

The file is wired into ordinary `npm test`, so this lifetime invariant is enforced without starting Chrome.

## Exact-head green evidence

Exact product head **`1b5b5f1568b497f2d78d014556b7c6ac419fe3ca`**, canonical verify run **31472827795**, completed both jobs successfully with the production RootBatch TTL repair, permanent read-only CI and the new deterministic lifetime contract present.

The same real-Chrome run passed:

```text
ordinary E2E/profile
300-case structural fuzz
Probe deep saturation
Gate deep saturation 5/5
Gate batch saturation
Gate live-TTL >2.4 s
Engine walk saturation
Engine RootBatch live-TTL >3.0 s
generation lease
PR-base → candidate update transition
```

Representative profile from the same run remained well inside the established ceilings:

```text
wall latency: 214.1 ms
TaskDuration: 0.2070 s
CPU samples: 174
```

Generation protection remained fail closed (`staleAutomatedClicks = 0`, `directStaleClicks = 0`) while trusted browser input still succeeded once. The same-version update transition continued to preserve exactly-one current routine activation and all historical stale/ambiguous negatives.

Because this is scheduling-sensitive lifetime correctness, the final documentation head must pass the canonical gate again and then rerun the unpacked-E2E job without changing the SHA before squash merge.
