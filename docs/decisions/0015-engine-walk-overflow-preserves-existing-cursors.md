# ADR 0015: Engine walk overflow preserves existing cursors

## Status

Accepted as pre-v11 correctness hardening while the runtime version remains `10.0.0`.

## Context

Engine time-slices subtree traversal through `walkJobs`. The queue has a hard object cap:

```text
MAX_WALK_JOBS = 12
```

The historical overflow rule admitted newer work by removing the oldest unfinished walk job. That bounded queue objects but made queue pressure an authority to forget live final DOM state.

A real-Chrome discriminator activated Engine, then appended 20 roots × 900 nodes with the only new routine agreement near the tail of an early root. Canonical run `31469631388` kept the entire precondition chain green while the target remained present, unchecked and at zero clicks after the fixed eventual-progress deadline. Engine itself remained active.

The defect was therefore not theoretical resemblance to another queue: `MAX_WALK_JOBS` oldest-drop was directly proven to cause a permanent false negative.

## Decision

The hard cap remains 12.

When ordinary walk admission reaches the cap:

1. existing FIFO walk jobs and their cursors stay authoritative;
2. a new excess root is not admitted as a 13th walk job;
3. instead, its live final state is weakly coalesced into one `walkRecoveryRef` scope;
4. urgency is accumulated separately in `walkRecoveryUrgent`;
5. recovery is promoted only after ordinary RootBatch and walk queues drain;
6. lifecycle retirement clears recovery together with ordinary background work.

Recovery ownership is weak. No TreeWalker survives a scheduling yield, detached DOM is not strongly retained, and no synchronous whole-document fallback is introduced.

## Consequences

- queue-object memory remains bounded;
- older unique work cannot be displaced by newer churn;
- multiple excess roots may intentionally collapse to a broader final-state scope and be rescanned later through the ordinary bounded walker;
- recovery may increase eventual work after extreme bursts, but it cannot bypass FIFO or expand click authority;
- the same mechanism is not automatically applied to `shadowJobs`, RootBatch TTL or mutation-batch TTL. Those queues require their own red evidence before production changes.

## Verification

Permanent gates require:

- deterministic rejection of the historical oldest-walk drop;
- `MAX_WALK_JOBS = 12` remains unchanged;
- weak recovery plus FIFO-before-recovery ordering;
- lifecycle cleanup;
- real Chrome `20 × 900` walk saturation with a fixed 9-second eventual-progress deadline;
- the ordinary real-Chrome, Probe/Gate, Gate TTL, generation-lease and update-transition gates remain green in the same candidate run.

The red/green evidence is recorded in `docs/verification/v11-engine-walk-overflow.md`.
