# Structural fuzz recovery research — v10 runtime

Generated: 2026-08-09

## Purpose

This branch reintroduced a verification layer that existed in the pre-v7 development line but was no longer present in the canonical v10 test suite: deterministic structural DOM fuzz over real unpacked Chrome.

The research is intentionally **not a release claim**. The branch must not be merged until the runtime fix is present as ordinary source, all temporary transport workflows are removed, and a clean exact-head canonical verify run passes.

## Corpus

Fixed-seed, replayable 300-case matrix:

- 120 routine positives;
- 60 optional/consequential/attestation negatives;
- 40 already checked;
- 40 disabled;
- 40 mixed/indeterminate.

Structural axes include nested labels, external labels before/after controls, `aria-labelledby`, `aria-describedby`, role/data-state controls, random wrapper depth, arbitrary 2–5 fragment word splitting, multiple languages, and dynamic mount timing across microtasks / animation frames / tasks.

The desired invariant is simultaneously:

```text
false positive   = 0
false negative   = 0
duplicate toggle = 0
```

## Experiment correction

The first corpus mounted all 300 independent forms before Engine activation. That produced one handled seed context followed by broad misses, but this was not a valid runtime-failure conclusion: Auto Agree intentionally activates/scans the local context that earned Engine activation rather than retroactively scanning every unrelated pre-existing form/template on the document.

The experiment was corrected to:

1. load one ordinary seed login agreement;
2. wait until the real Engine is active;
3. dynamically mount the 300-case corpus afterward.

This isolates Engine mutation/discovery coverage from the separate Probe/Gate activation policy.

## Real defect exposed after the correction

Even after Engine activation was physically confirmed before fuzz mounting, the corpus still showed the same characteristic pattern: the first dynamically discovered case succeeded while large later portions remained unprocessed.

Source audit found an exact loss mechanism in `enqueueRootBatch(...)`:

```js
while (rootBatches.length >= MAX_ROOT_BATCHES) rootBatches.shift();
```

with `MAX_ROOT_BATCHES = 8`.

A burst creating more than eight unfinished root batches can therefore delete older discovery work with **no recovery path**. This is a correctness failure, not merely backpressure: a dropped root can contain the only routine agreement candidate and create a permanent false negative.

`batchJobs` already demonstrates the safer pattern: when work is dropped, it attempts a recoverable parent/root path rather than silently forgetting the DOM state. `rootBatches` lacks an equivalent guarantee.

## Intended repair

Do not remove the hard queue cap and do not fall back to unconditional document-wide rescans.

The intended bounded repair is:

- if overflow roots share one live parent, coalesce the final DOM state to that parent via the normal generation/time-sliced root path;
- otherwise retain the remaining roots only as `WeakRef`s in an existing bounded batch rather than deleting older work;
- preserve weak DOM ownership and detached-DOM collectability;
- preserve a hard bound on batch objects;
- never use silent false negatives as the overflow policy.

## Why this research branch is not mergeable yet

The GitHub connector available in this session has whole-file content replacement but no line-patch mutation. A temporary branch-only Actions transport was explored to apply the exact local Engine edit, but the resulting branch still contains transport/CI artifacts and has not produced a clean exact-head proof of the source repair.

Therefore this branch is evidence, not a release candidate. Main must remain on the last fully verified v10 state until the Engine patch is represented as normal source and independently verified.

## Next independent test layer

After Engine RootBatch overflow is closed, Probe/Gate queue overflow must be attacked separately. Their bounded deep/batch queues also contain lossy eviction paths, and a Probe/Gate drop can be even more consequential because the dropped work may be the only evidence that would ever activate the next tier.
