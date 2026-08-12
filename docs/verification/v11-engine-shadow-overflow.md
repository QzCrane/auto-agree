# Pre-v11 Engine broad closed-Shadow queue hardening

The runtime version remains `10.0.0`. This record documents a correctness defect found and repaired before the formal v11 release cut.

## Red evidence

Evidence-only PR #21 ran from main `1f07e8246026801207be1bf4f6e02390e609f54e` with production Engine unchanged. Canonical run `31574192448` first passed the established gates: deterministic core/package, ordinary real-Chrome behavior, structural fuzz 300/300, Probe/Gate saturation with Gate deep 5/5, Gate live-TTL, Engine walk saturation, Engine RootBatch live-TTL, and Engine sibling-batch live-TTL.

The new closed-shadow discriminator then failed. It created 14 roots × 900 nodes after initial shadow work had drained. The only fresh routine agreement lived near the tail of root 0 inside a **closed ShadowRoot on a plain DIV host**. Ordinary `probeShadow(host, false)` could not discover that root; only broad Shadow traversal could reach it through `chrome.dom.openOrClosedShadowRoot`.

At the fixed 9-second deadline the page still contained all 14 roots, the host existed and reported ready, the page was visible, and the full Engine isolated world remained active, but the target remained unchecked with zero clicks. The historical `while (shadowJobs.length >= MAX_SHADOW_JOBS) shadowJobs.shift()` policy had converted queue pressure into a permanent false negative.

## Repair

The repair preserves `MAX_SHADOW_JOBS = 8`.

- Existing FIFO shadow cursors remain in place.
- Only a new excess broad-sweep root is weakly coalesced through `shadowRecoveryRef`.
- Recovery uses the same bounded common-root mechanism used for final-state convergence; it does not strongly retain detached DOM.
- Recovery is promoted only after RootBatch, walk, mutation-batch, and ordinary shadow work drain.
- `hasBackgroundWork()` includes recovery.
- lifecycle retirement clears recovery.
- no permission, semantic vocabulary, cap, timeout, synchronous full-document scan, or network surface changed.

The clean product candidate was constructed directly from exact main using Git objects, then audited before the branch ref moved. The candidate diff contained only the production Engine recovery, the permanent read-only CI step, and `tests/e2e-engine-shadow-overflow.mjs`. The Engine patch itself was limited to recovery state/helpers, bounded admission, scheduler liveness/promotion, and lifecycle cleanup.

## Green evidence

Clean product commit `202a9e15a5700137f4cee83df7d8291b022687e7` turned the previously red closed-shadow discriminator green while all preceding real-Chrome gates and generation lease remained green. The deterministic contract was then added as `tests/static-engine-shadow.mjs` and wired into `npm test`.

The permanent browser gate retains the adversarial dimensions: 14 roots, 900 nodes/root, plain DIV closed-shadow host, fixed 9-second eventual-progress deadline, and exactly one final activation.

Scheduling-sensitive final-head verification and the same-SHA E2E rerun are recorded in the PR result because adding those final run identifiers to this file would itself create another candidate SHA.
