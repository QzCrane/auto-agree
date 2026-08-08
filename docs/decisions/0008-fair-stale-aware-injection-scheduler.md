# ADR 0008 — Injection scheduling is bounded, fair and stale-aware

**Decision:** retain hard global/per-tab/queue caps, but do not implement permanent strict Engine-over-Gate priority. Waiting work gains bounded age priority, stale jobs are rejected, equal-score work rotates across tabs, and a new Engine request may preempt younger queued Gate work when the queue is full.

This preserves responsiveness without allowing continuous high-priority traffic to starve Gate discovery indefinitely.
