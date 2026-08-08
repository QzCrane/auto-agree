# Structural fuzz branch status

This branch is **research-only and non-mergeable**.

Real Chrome structural fuzz exposed a probable Engine correctness defect: `enqueueRootBatch(...)` silently drops unfinished work when `rootBatches` reaches `MAX_ROOT_BATCHES`, which can create permanent false negatives under bursty dynamic DOM insertion.

The branch also contains temporary CI transport changes used while attempting an exact local Engine edit with a connector that exposes whole-file replacement but no line-patch action. Those transport changes are not production design and must never be merged.

Canonical follow-up is tracked in the repository issue created from this research. Main remains on the last fully verified v10 state until the runtime repair and permanent structural fuzz gate pass from a clean branch.