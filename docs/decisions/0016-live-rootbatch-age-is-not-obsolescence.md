# ADR 0016: Live RootBatch age is liveness, not obsolescence

## Status

Accepted as pre-v11 correctness hardening while the runtime version remains `10.0.0`.

## Context

Engine coalesces roots that cannot be handled inside the synchronous flush budget into bounded `rootBatches`. The queue remains capped at:

```text
MAX_ROOT_BATCHES = 8
```

and historically attached a three-second age limit:

```text
ROOT_BATCH_TTL_MS = 3000
```

The previous `runRootBatch()` treated age alone as proof that the batch was obsolete:

```text
age > ROOT_BATCH_TTL_MS
→ return false
→ caller shifts the unfinished batch
```

That is not valid when the roots are still connected and the batch index still represents unvisited live DOM. A renderer can simply be busy or blocked for longer than three seconds.

A real-Chrome discriminator created 60 connected roots × 420 descendants, placed the only fresh routine agreement in root 42, let MutationObserver + `flushRoots()` produce RootBatch backlog, then blocked the renderer for about 3.4 seconds. With production code unchanged, all earlier gates remained green but the target was permanently missed. This proved age-only RootBatch retirement is a correctness defect rather than a harmless stale-work optimization.

## Decision

The constants remain unchanged:

```text
MAX_ROOT_BATCHES = 8
ROOT_BATCH_TTL_MS = 3000
```

For an existing live RootBatch:

```text
age > ROOT_BATCH_TTL_MS
→ refresh createdAt
→ continue from the existing batch index
```

The TTL is therefore a liveness checkpoint, not independent authority to erase connected unfinished work.

Individual dead or disconnected weakly referenced roots remain skippable during the ordinary indexed traversal. Existing RootBatch overflow recovery and queue-object bounds remain unchanged.

## Consequences

- renderer scheduling delay cannot silently delete unique live semantic work;
- the hard RootBatch object cap is preserved;
- the three-second constant remains available for liveness/accounting semantics without becoming a correctness oracle;
- traversal continues from the existing index rather than restarting the batch;
- no strong detached-DOM ownership, unbounded synchronous scan, permission change or click-authority expansion is introduced.

This decision does not automatically change Engine mutation-batch TTL or shadow-job overflow. Those mechanisms require their own red evidence.

## Verification

Permanent verification requires:

- `ROOT_BATCH_TTL_MS = 3000` remains explicit;
- age-only `return false` from live RootBatch is rejected statically;
- live RootBatch age refresh is required statically;
- the real-Chrome discriminator keeps 60 roots, target root 42, a ~3.4-second renderer stall and exactly-once completion;
- ordinary E2E, structural fuzz, Probe/Gate saturation, Gate live-TTL, Engine walk saturation, generation lease and update transition remain green on the same candidate.

The red/green evidence is recorded in `docs/verification/v11-engine-rootbatch-live-ttl.md`.
