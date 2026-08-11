# v11 RootBatch structural discovery hardening

## Red evidence

Clean test-only PR #8 ran the restored 300-case structural corpus against unmodified v10 main. Deterministic core/package and the existing basic real-Chrome matrix passed, the Engine world was physically present, but structural fuzz timed out with large later portions of routine dynamic cases remaining unchecked (`clicks=0`).

## Production repair

`Engine.enqueueRootBatch()` no longer evicts an unfinished batch with a naked `shift()` when `MAX_ROOT_BATCHES` is reached. Same-parent overflow is represented by a live parent final-state rescan through the existing bounded `queueRoot()` path; mixed-root overflow remains weakly represented in an existing bounded batch. Detached DOM is therefore not strongly retained and the hard batch-object cap remains.

The branch-local patch runner executed syntax, `npm test`, deterministic package verification, and `git diff --check` before committing the repair. Canonical real-Chrome CI on this ordinary GitHub-App head is the release authority for the green result.
