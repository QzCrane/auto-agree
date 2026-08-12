# ADR 0018: bounded broad-Shadow pressure preserves FIFO and weak recovery

## Status

Accepted during pre-v11 correctness convergence.

## Context

Engine broad Shadow discovery is intentionally bounded by `MAX_SHADOW_JOBS = 8`. Broad discovery matters because a plain element can own a closed `ShadowRoot` that ordinary `probeShadow(host, false)` is intentionally not allowed to open; when authentication intent has enabled broad discovery, `probeShadow(..., true)` may use `chrome.dom.openOrClosedShadowRoot`.

A real-Chrome saturation discriminator proved that the historical admission policy was lossy. When eight shadow jobs were already queued, `queueShadowSweep()` removed the oldest job with `shadowJobs.shift()` to admit a newer root. If the oldest root contained the only closed-Shadow agreement, the live DOM remained present while its only discovery representation disappeared permanently.

Evidence-only PR #21 reproduced this against unmodified production Engine after every earlier saturation/lifetime gate had passed. The test used 14 roots × 900 nodes, with the only fresh agreement near the tail of root 0 inside a closed ShadowRoot hosted by a plain `DIV`. At the fixed 9-second deadline the host and Engine remained live but the agreement had received zero clicks.

## Decision

`MAX_SHADOW_JOBS = 8` remains a hard bound. Pressure changes admission semantics, not the cap:

1. Existing `shadowJobs` FIFO cursors remain authoritative and are never evicted merely to admit newer work.
2. A new excess broad-sweep root is weakly coalesced into one `shadowRecoveryRef` final-state scope.
3. Recovery uses `WeakRef`; it must not keep detached DOM alive.
4. Recovery is promoted only after RootBatch, walk, mutation-batch, and ordinary shadow work have drained. It therefore cannot overtake already-admitted correctness work.
5. Promotion re-enters the same bounded shadow-job mechanism with the current shadow generation; it does not create a synchronous document-wide fallback.
6. Lifecycle retirement clears both ordinary shadow jobs and the recovery reference.
7. `hasBackgroundWork()` includes recovery so a compressed final state cannot become invisible to the scheduler.

## Consequences

The queue-object count remains bounded at eight while live final state remains recoverable. Burst pressure may coalesce several newer roots into a broader weak scope, trading redundant traversal for bounded memory without silently forgetting an older cursor.

This is an evidence-backed specialization of ADR 0012's general rule:

> a hard representation cap is not permission to forget live semantic work.

Future changes must preserve the permanent real-Chrome closed-shadow saturation discriminator and deterministic static contract. Increasing the cap, exposing the fixture's closed root to ordinary probing, weakening the root sizes/deadline, strongly retaining detached DOM, or adding an unbounded synchronous scan is not an equivalent repair.
