# ADR 0012 — Bounded work must preserve final-state recovery

## Status

Accepted.

## Context

Auto Agree deliberately caps background work objects so adversarial or framework-heavy pages cannot turn DOM churn into unbounded memory, retained detached DOM, or monopolized main-thread work. A cap, however, is a resource invariant rather than a correctness proof.

The restored deterministic structural corpus produced a real Chrome counterexample: Engine could enqueue more unfinished RootBatch work than `MAX_ROOT_BATCHES`, evict the oldest unfinished batch, and permanently miss the only routine agreement carried by that representation. The runtime stayed healthy and bounded, but correctness was lost.

## Decision

Every bounded correctness-relevant work queue must classify overflow, expiry, invalidation and supersession explicitly.

A representation may be discarded only when one of these is true:

1. the represented state is provably obsolete because a newer generation owns the same scope;
2. the represented work is already complete;
3. an equivalent bounded recovery representation remains, such as a weak final-state parent/root rescan;
4. the underlying DOM scope is gone and therefore no live action remains possible.

Queue pressure must not be handled by a naked oldest-item drop when that item can contain unique live semantic evidence.

Recovery must remain bounded. Auto Agree must not trade a false negative for an unbounded synchronous document scan or strong retention of detached subtrees. Prefer `WeakRef`, generation identity, same-owner coalescing and fresh time-sliced final-state rescans.

## Consequences

- hard queue-object caps remain mandatory;
- saturation tests are correctness tests, not merely performance tests;
- TTL is not permission to forget still-live final state;
- static contracts should reject known silent-drop forms;
- Probe, Gate and remaining Engine queue classes must be audited against this same rule rather than fixed by independently increasing caps.
