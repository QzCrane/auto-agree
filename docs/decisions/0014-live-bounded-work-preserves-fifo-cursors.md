# ADR 0014 — Live bounded work preserves FIFO cursors

## Status

Accepted.

## Context

ADR 0012 established that a hard queue-object cap is not permission to forget correctness-relevant final state. The first Gate-deep implementation satisfied that rule by moving an evicted old job into a weak coalesced recovery scope. A real-Chrome exact-head run passed, but the next clean replay failed on the same Gate-deep saturation fixture.

Two scheduling-dependent gaps remained:

1. pressure still removed an **existing unfinished FIFO cursor** and replaced it with a broader future rescan;
2. `JOB_TTL_MS` could discard a still-connected live cursor merely because it waited behind other bounded work for more than the configured age.

Both make scheduler latency part of semantic correctness.

## Decision

For bounded discovery queues whose jobs carry incremental cursors:

1. **Existing live FIFO work has priority over newly arriving overflow.** When the hard object cap is full, preserve current jobs/cursors and compress the new request into an already-bounded weak recovery representation.
2. **TTL expires dead/stale ownership, not live correctness state.** If the owner/root remains connected and the cursor is still valid, crossing TTL refreshes its liveness age and processing continues from the existing cursor.
3. Disconnected owners/roots, lifecycle-obsolete generations, completed jobs and invalid cursors may still retire immediately.
4. Weak recovery may coalesce several roots, but any semantic authority that would become broader through coalescing must fail closed. Gate therefore tracks `allowComposite` separately and disables it when distinct scopes merge into a broader ancestor.
5. Hard caps and per-slice budgets remain unchanged. This decision does not permit unbounded queues, synchronous full-document rescans, or strong retention of detached DOM.

## Evidence requirement

A single green asynchronous run is insufficient for a schedule-sensitive queue. The permanent Gate-deep saturation fixture is therefore repeated on five independent pages in one canonical real-Chrome run. All repetitions must produce exactly one final routine activation under the unchanged timeout and queue bounds.

## Consequences

- throughput/backpressure optimizations may delay live work but cannot erase it;
- new queue designs should prefer `preserve old cursor + weakly compress new final state` over `evict old cursor + hope to reconstruct later`;
- TTL remains useful for disconnected or ownership-invalid work, but not as a generic age-based correctness cutoff;
- future changes to this policy require new real-browser adversarial evidence, not only static reasoning or a single successful run.
