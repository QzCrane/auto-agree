# Changelog

## 12.1.0 — 2026-08-13

- Made Worker update recovery replay only the durable unresolved tab set, classify permanently inaccessible browser pages as terminal, and stop successful tabs from being reinjected on every MV3 restart.
- Completed Engine candidate-index saturation with one weak recovery obligation per context epoch and a real Chromium discriminator above the 96-candidate cap.
- Added an exact-base/exact-head paired performance matrix for positive, negative-idle, mutation-churn, hidden-quiescence and multi-tab workloads, with raw samples, relative distribution limits and absolute safety ceilings.
- Added a machine-readable release package manifest and exact-head local closeout attestation/validator. The original v12 archive identity remains historical evidence; 12.1.0 owns a new production closure and package identity.
- Preserved the v12 permission and consent boundary: no new permission, network client, telemetry, remote code, or broader automated-action authority.

## 12.0.0 — 2026-08-13

- Converged shared runtime/lifecycle/bounded-work mechanics into **RuntimeKernel** while preserving tier-specific Probe/Gate/Engine budgets and all hard queue/object caps. Connected work remains recoverable through FIFO/weak final-state semantics rather than being silently discarded by pressure or age.
- Made **DecisionKernel** the sole severity lattice and click-policy owner, including the classless policy path. Removed the dead Semantic Core severity duplicate and machine-forbid another competing policy lattice.
- Extracted **SchedulerCore** and **ProfileCore** as pure policy/governance authorities. Worker scheduling now has one source for caps/aging/stale/fairness/preemption; persisted acceleration has one bounded schema/identity/merge/compatibility owner while cache remains non-authoritative.
- Added topology-only **DomCore** and removed duplicate composed-parent/root-IDREF implementations from Engine and Handover Guard. DomCore is statically forbidden from growing into a full text/tree scanner.
- Added 31-line **ActionAuthority** as the single Engine automated-click protocol: current Generation Lease → Handover Guard authorization → exactly one click attempt. Generation Lease and Guard remain independent defense layers; Engine's live verifier remains the sole DOM-success observer.
- Promoted one executable **23-language safety contract**. Deliberate red testing exposed Chinese automatic-renewal semantics as weaker than the multilingual consequential baseline; `自动续费/自動續費/连续包月/连续包年` now fail closed at consequential severity, including fragmented/compact paths.
- Replaced the fragile manual deterministic-test command with **auto-discovery**. Audit proved `tests/classless-decision.mjs` existed but was not previously executed by `npm test`; v12 now auto-registers 27 deterministic gates and recovers that 6,000-case classless DecisionKernel property proof.
- Strengthened real-Chrome action discrimination into three independent proofs: rejected ActionAuthority dispatches no synthetic primitive; a separately forced current-generation isolated synthetic click reaches the primitive but is still blocked by Handover Guard; trusted browser input remains usable.
- Upgraded performance evidence from single hosted-runner snapshots to a separate **7-run statistical real-unpacked job** preserving the same 5,000-checkbox tail-login benchmark. The ledger now stores raw runs plus median/p90/max. Same-code runs showed meaningful hosted-runner regime variance, so v12 explicitly rejects speculative runtime optimization based on one CI wall-clock sample.
- Hardened release-generation governance: manifest/package/package-lock top+root/RuntimeKernel coherence is machine-enforced; Worker/current-generation tests derive the manifest. The first v12 cut correctly failed because `tests/runtime-kernel.mjs` still hardcoded `11.0.0`; that historical v11 overclaim was corrected upstream before the pure four-file cut was retried.
- Physically proved a non-reloaded **v11.0.0 → v12.0.0** update with complete old/new isolated contexts simultaneously observable. Current routine behavior remained exactly once; mixed, external-IDREF, non-English, wide/ambiguous wrapper and action-inside-label negative paths remained zero-click.
- Physically proved **v12.0.0 → v13.0.0** cooperative stale-generation revocation without page reload: stale automated clicks = 0, direct stale isolated-world `.click()` = 0, trusted click = 1.
- Canonical physical candidate package: `AutoAgree-v12.0.0.zip`, sha256 `1cee531a26272160df70909815089a80d1d45814ce3d138d7dd2c2efbc00e859`. Permissions remain `scripting`, `storage`, `<all_urls>`; no debugger, telemetry/network client, remote code or new permission was added.
- Canonical seven-run release-candidate performance on Chrome 149.0.7827.22 / Puppeteer 25.1.0 / Node 24: latency median/p90/max **259.1/288.2/288.5 ms**; TaskDuration **0.2524/0.2803/0.2812 s**; all raw runs remained below the existing <1000 ms / <0.8 s broad ceilings.

## 11.0.0 — 2026-08-12

- Cut a **coherent v11 runtime generation** across Probe, Gate, generation lease, shared semantic/risk cores, handover guard, Engine, Worker, manifest and package. Added `tests/version-contract.mjs` so manifest/package and all eight runtime JavaScript sentinels must remain one generation and production JavaScript cannot carry a second stale generation literal.
- Removed release-number magic from current-generation tests. Basic unpacked E2E, generation-lease unit modeling, Worker contract/profile governance and Worker restart/update-rehydration now derive the active generation from the manifest instead of encoding `10.0.0`.
- Promoted multilingual risk parity into the release baseline: routine-supported language families now have native-language fail-closed optional/consequential/attestation evidence, with 10,188 deterministic consent/risk assertions and 644 fragmentation assertions.
- Promoted the permanent **300-case real-Chrome structural fuzz** gate: false positives = 0, false negatives = 0, duplicate toggles = 0 across labels, ARIA IDREFs, custom controls, wrapper depth, fragmentation, multilingual semantics and blocked/already/disabled/mixed states.
- Preserved hard Probe/Gate bounds while repairing silent loss. Probe deep work uses weak final-state recovery; Gate batch owners re-enter bounded traversal; Gate deep preserves old FIFO cursors and weakly coalesces only new excess state. A zero-budget Gate slice no longer marks a job started before processing its first node.
- Preserved `JOB_TTL_MS = 2400`: connected Gate work is not deleted by age alone. The permanent browser gate crosses the TTL with a ~2.7-second renderer stall and still requires exactly-one eventual progress; Gate deep saturation is repeated on five independent pages.
- Preserved Engine `MAX_ROOT_BATCHES = 8` and repaired both pressure and lifetime semantics. Live RootBatch work is recoverable under overflow and continues its existing index after crossing `ROOT_BATCH_TTL_MS = 3000` rather than being discarded by age alone.
- Preserved Engine `MAX_WALK_JOBS = 12`: old FIFO cursors remain authoritative and only new excess roots are weakly coalesced into final-state walk recovery.
- Preserved Engine mutation-batch `MAX_BATCH_JOBS = 8` and `BATCH_JOB_TTL_MS = 3000`: a connected `enqueueSiblingRange` job survives queue age while retaining its existing `currentRef` / `subjob` / `reachedLast` state. The permanent test forces the >96-node path with 140 siblings and a target at sibling 70.
- Preserved Engine `MAX_SHADOW_JOBS = 8`: real Chrome proved oldest-job eviction could permanently lose a routine target located only in a closed ShadowRoot on a plain `DIV`. Existing Shadow FIFO cursors now remain authoritative and only new excess roots are weakly coalesced through `shadowRecoveryRef`.
- Added a permanent rejected-authorization browser discriminator. Even when Engine's public guard API is replaced with `authorize() => false`, two automated authorization attempts produce zero DOM click effect while a subsequent trusted browser click succeeds once; the existing guard event boundary is therefore behaviorally fail-closed without a redundant Engine return-value branch.
- Retained exact source-event causal authority: local delegated control authority is bound to the exact source `Event`, valid only while browser dispatch remains live, and cannot survive `stopPropagation()` into a later task.
- Proved the formal **v11 → v12** cooperative generation lease in Chrome 149.0.7827.22 without page reload: stale v11 automated clicks = 0, direct stale isolated-world `.click()` = 0, trusted click = 1.
- Proved the formal **v10 → v11** update transition with both old v10 and current v11 isolated worlds simultaneously observable and no page reload. Current routine behavior remained exactly once; mixed-state, external-IDREF stale semantics, non-English stale semantics, wide causal wrappers, ambiguous wrappers and action-inside-label negatives remained zero-click.
- Preserved v5-v10 profile governance: 256 origins, 8 flows/origin, 180-day TTL, 32-entry hot LRU, `storage.session` + `storage.local`, fingerprint+exact-locator identity, serialized writes and propagated persistence failures.
- Preserved deterministic package closure derived from the complete production `extension/*.js` set. Permissions remain `scripting`, `storage`, `<all_urls>`; no debugger, telemetry/network client, remote code or polling loop was added.
- First fully clean v11 release candidate profile: **200.9 ms latency / 0.1945 s TaskDuration / 168 samples** on Chrome for Testing 149.0.7827.22, below the existing `<1000 ms` / `<0.8 s` broad ceilings.

## 10.0.0 — 2026-08-09

- Added a **cooperative generation lease** to every static/dynamic Auto Agree execution world. The lease is isolated-world local and revokes that generation's `HTMLElement.prototype.click()` when `chrome.runtime.getManifest()` is invalidated or no longer matches the compiled generation.
- Added a real Chrome 10→11 manifest-generation probe proving that the old v10 Engine world remains JavaScript-executable while its extension Runtime becomes stale; stale automation and direct stale-world `.click()` both produce zero clicks, while trusted browser input still succeeds once.
- Retained the v9 generation handover firewall for non-cooperative historical generations and made stale guards passive toward future legitimate generations after their own Runtime is invalidated.
- Converged handover semantics on the shared bounded `semantic-core.js`; added explicit `aria-labelledby` / `aria-describedby` and native external-label resolution so the update firewall does not maintain a narrower private Terms vocabulary.
- Replaced generic descendant `querySelector(CONTROL)` causal discovery with hard-bounded, exact local-wrapper traversal. Broad containers, proceed actions and ambiguous multi-control wrappers cannot mint sibling-control authority.
- **Post-merge causal hardening:** real Chrome red testing proved that `stopPropagation()` could prevent bubble cleanup and leave a local delegation token reusable by a later-task synthetic click. Local authority now maps the exact delegated control to the exact source `Event` and is valid only while `sourceEvent.eventPhase != Event.NONE`; synchronous same-dispatch delegation still works exactly once while later asynchronous reuse is blocked.
- Generalized `e2e-update.mjs` so previous/current versions come from the staged PR-base/current manifests and old/current isolated worlds are identified by execution-context IDs. The release-transition gate now works for major releases, patches, and same-version hotfix/reload candidates without hardcoded `9.0.0 → 10.0.0` glue.
- Restored the v6 bounded-string invariant inside handover semantics so a pathological multi-megabyte attribute/text value is sampled before normalization rather than scanned in full.
- Re-audited a handover-focused Worker rewrite and rejected its unrelated regressions. v10 preserves the verified learning governance: 256 origins, 8 flows/origin, 180-day TTL, 32-entry hot LRU, `storage.session` + `storage.local`, fingerprint+locator identity, strict sanitization and propagated persistence errors.
- Added profile-governance regression tests for 64 concurrent flow writes, precise same-fingerprint/different-locator identity, 300-origin bounded persistence and storage-failure propagation.
- Fixed deterministic packaging to derive its runtime JavaScript closure from `extension/*.js`. The audit found that the previous hand-maintained package list could pass ZIP verification while omitting newly introduced runtime modules such as the generation handover guard.
- Expanded real update E2E with external-IDREF semantics, non-English shared semantics, broad-wrapper causal negatives, ambiguous controls and action-inside-label negatives.
- Added a permanent 300-case real-Chrome structural fuzz corpus and repaired Engine RootBatch pressure so a hard queue-object cap no longer silently discards unfinished final DOM state.
- Added fail-closed multilingual risk parity across the language families already supported for routine Terms/Privacy assent; localized optional, financial, medical, biometric, arbitration/rights and age-attestation evidence can suppress automation but cannot create click authority.
- Hardened Probe/Gate bounded work with real-Chrome saturation tests. Probe deep, Gate large-batch and Gate deep pressure preserve hard caps while retaining bounded weak recovery instead of naked oldest-work drops.
- Hardened Gate scheduling lifetime after repeated real-Chrome falsification: existing FIFO deep cursors outrank new overflow, connected work is not erased by age alone, a >2.4-second live-TTL test is permanent, and a zero-budget slice no longer marks a deep job started before processing any node.
- Repaired Engine walk saturation at `MAX_WALK_JOBS = 12`: existing FIFO walk cursors remain authoritative, while only new excess roots are weakly coalesced into final-state recovery and promoted after ordinary RootBatch/walk work drains. The permanent 20×900-node Chrome discriminator proved the historical oldest-walk drop caused a permanent false negative.
- Kept permissions unchanged: `scripting`, `storage`, `<all_urls>`; no debugger, telemetry, network client or remote code.

## 9.0.0 — 2026-08-08

- Restored the historical UNKNOWN-state invariant: a classless control with no observable checked contract is one-shot for that DOM element, even after the normal click cooldown expires.
- Treat native `indeterminate`, ARIA `mixed`, and data `indeterminate` / `mixed` states as non-authoritative tri-state controls and never auto-toggle them.
- Fixed Gate→Engine seed consumption so Shadow probing and scoped Engine bootstrap can both reuse the same weakly-owned handoff without retaining detached DOM.
- Moved Gate/Engine sentinels behind dependency validation so a partial or out-of-order injection cannot permanently poison later retries.
- Made semantic/risk cores version-refreshable and included `semantic-core.js` in Engine injection dependency closure for safer cross-version worker/content-tier transitions.
- Bound site-learning identity to Chrome `MessageSender.origin`/`url` rather than a content-provided `message.origin`; profile operations fail closed without a usable sender origin.
- Added a high-priority generation handover firewall after real Chrome proved that old and new Engine isolated worlds can coexist and remain executable across an extension update. Current Engine clicks receive one-shot authorization; stale-generation synthetic agreement clicks are blocked while trusted user clicks remain unaffected.
- Added real unpacked-Chrome regressions for tri-state controls, classless UNKNOWN one-shot behavior, simultaneous v8/v9 Engine worlds, exactly-one routine update clicks, and zero legacy mixed-state clicks.

## 8.0.0 — 2026-08-08

- Added real unpacked-extension Puppeteer E2E with explicitly installed Chrome for Testing, including the actual MV3 service worker, dynamic `chrome.scripting` injections, isolated worlds, frame handling, closed-Shadow extension API path and extension update lifecycle under test.
- Added Worker `documentLifecycle` defense-in-depth: explicit prerender/cached/pending-deletion senders cannot schedule Gate/Engine or profile work.
- Rebuilt injection scheduling with bounded aging, per-tab tie rotation, stale-job eviction, and Engine admission that can preempt younger queued Gate work instead of failing behind a full low-priority queue.
- Added bounded handoff retries in Probe/Gate and idempotent profile-message retries so unexpected service-worker termination does not strand an otherwise live page.
- Added update rehydration: an updated/reloaded MV3 worker persistently resumes a bounded bootstrap sweep over existing tabs without requesting the `tabs` permission.
- Strengthened disabled-action causality with native `ValidityState`; a non-empty but invalid credential no longer makes a disabled Login button look like evidence that Terms is the blocker.
- Converted Probe→Gate and Gate→Engine seed handoff to WeakRef ownership with backward-compatible v7 seed reading and consumption cleanup.
- Added a sanitized real-world-derived regression corpus (TRAE classless, fragmented consequential language, closed Shadow, iframe, dynamic SPA, native-validity gating).
- Real unpacked E2E exposed and fixed a classless reverse-discovery `ReferenceError` caused by stale pre-`risk-core.js` private identifiers; a static contract now prevents that module-boundary regression.
- Used the real 5,000-checkbox CPU profile to remove broad nearby-text extraction from ordinary checkbox Probe paths. The profiled workload moved from ~330.9 ms / 0.3056 s TaskDuration to ~286.1 ms / ~0.2662 s, and Probe text-scan functions dropped out of the top sampled hotspots.
- Tightened the real-extension performance gate to `<1000 ms` wall latency and `<0.8 s` TaskDuration while keeping the independent v7→v8 update-transition gate.

## 7.0.0 — 2026-08-08

- Split shared semantics into `semantic-core.js` plus engine-only `risk-core.js` so Gate and Engine cannot silently drift while high-risk rules remain lazily loaded.
- Added explicit consent severity: routine, routine privacy, optional, consequential, attestation.
- Rebuilt decision synthesis around a small semantic graph of control → semantic row → context → proceed action relationships.
- Added per-context mutation transactions that coalesce DOM churn before epoch invalidation/O(K) candidate re-evaluation.
- Added intent-driven prewarming using existing focus/input/Enter/proceed events; no continuous pointer tracking.
- Extended site learning with privacy-preserving behavioral descriptors; cached locators remain acceleration only.
- Added bounded global/per-tab worker injection scheduling.
- Added dependency-free property, static, worker, and scheduler tests plus CI.
- Reorganized repository: current extension in `extension/`, historical verification under `docs/verification/`, ADRs under `docs/decisions/`; removed dead legacy `content.js` from the live tree.

## 6.0.0

- Page Lifecycle/BFCache generations, composed slot semantics, closed-Shadow restore, self-healing site profiles, bounded pathological single-string sampling.

## 5.0.0

- Three-tier Probe → Gate → Engine architecture, weak ownership across background queues, fragmented semantics, serialized learning.

## 4.0.0

- Evidence-co-occurrence bootstrap, context indexing, candidate snapshots, time-budgeted mutation queues, behavioral fast path and stronger risk model.

## 3.0.0

- Lazy frame-specific MV3 injection, bounded text/accessibility resolution, WeakRef candidate indexing, closed Shadow support and adversarial consent testing.

## 2.0.0

- Incremental DOM processing, Shadow/frame expansion, classless control handling and major mutation-storm performance improvements.

## 1.1.0

- Added reverse discovery from legal text to classless controls and fixed blind retry toggling. Confirmed on the real TRAE login agreement flow.

## 1.0.0

- Initial cross-site agreement-control detector.
