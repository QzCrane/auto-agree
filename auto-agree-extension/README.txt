Auto Agree Login Terms v6.0

Purpose
- Automatically checks routine mandatory Terms of Service / Privacy / User Agreement controls that gate login, registration, verification-code flows, onboarding, and similar low-discretion access flows.
- Does NOT automatically confirm consequential actions or factual attestations: purchases/orders, payment/debit authorization, loans/credit, investment-risk or trading authorization, insurance application/purchase, medical informed consent, employment contracts, arbitration/rights/class-action waivers, electronic signatures, biometric/facial-recognition consent, powers of attorney/guarantees, auto-renewal, age/identity/fact attestations, marketing, cookies, CAPTCHA, or "remember me".
- Industry names alone are not blocked. An insurance, investment, banking, medical, trading, or payment service can still have an ordinary login Terms/Privacy checkbox that may be handled.

Three-tier architecture
1. bootstrap.js — micro-probe in every matching frame at document_start.
   - Never clicks and never decides consent.
   - Uses bounded structural/auth/legal hints only to decide whether the richer semantic gate is worth loading.
   - Footer Terms/Privacy, newsletter email, contact forms, site search, ordinary checkboxes, and ordinary required settings stay asleep.
   - Defers all work while a document is prerendering.
   - Explicitly quiesces while the document is hidden/frozen/BFCache-resident and resumes on the next lifecycle epoch.
   - Scheduled drains carry lifecycle-generation ownership, so stale pre-freeze callbacks cannot mutate new-generation scheduler state after restore.
   - Can hand a focus/pointer seed host to the gate so a first interaction with a completely closed Shadow login component is not lost.
   - Background deep work uses weak root/cursor traversal; it does not keep detached subtrees alive while scheduling is frozen.

2. gate.js — bounded semantic activation gate, injected only into suspicious frames.
   - Requires co-occurring evidence: strong auth; auth+credential; legal+assent+control; legal+required+control; or auth+legal+control.
   - Reconstructs legal/assent semantics split across inline DOM fragments without reverting to whole-page text concatenation.
   - Large mutation batches and deep scans use weak references/range cursors and hard budgets.
   - Inherits closed-Shadow seed hosts from the probe and can reacquire their roots through chrome.dom.openOrClosedShadowRoot().
   - Quiesces/resumes with Page Lifecycle generations; stale background work self-aborts after a generation change.
   - On successful handoff it disconnects observers, removes global listeners, and clears queued strong work before engine injection.

3. engine.js — full agreement decision/activation engine, injected only after the gate accepts the frame.
   - Bounded text and accessibility-name resolution; no unbounded textContent/innerText.
   - Candidate snapshots plus per-context epoch snapshots.
   - WeakRef candidate indexes; preflight and credential changes re-evaluate only indexed agreement candidates (O(K)), not the whole form.
   - Separate discovery/context MutationObservers, time-budgeted queues, generation superseding, and scheduler.yield/postTask fallbacks.
   - Open, closed, and nested Shadow DOM discovery via the Chrome extension DOM API where available.
   - Seed ShadowRoots are registered as persistent observed roots, including after lifecycle/BFCache restore.
   - Composed-tree slot semantics: assignedNodes({flatten:true}) are boundedly analyzed and dynamic slotchange re-evaluates affected candidates.
   - Precise classless visual hit-target resolution for TRAE-style controls; no whole-row click fallback.
   - Event/mutation-driven state verification; active verifiers are cancelled on lifecycle transition and stale callbacks cannot cross epochs.
   - Unknown custom toggle state is one-shot and is never blindly clicked twice.
   - Async visibility proof and hidden-to-visible recovery; hidden/background tabs do not keep doing agreement work.
   - Hidden pending controls, mutation ranges, walk cursors, shadow cursors, and queued roots use weak ownership so background/frozen tabs do not make the extension a detached-DOM owner.
   - Multi-flow site learning with ordinary DOM and Shadow-host locator paths. Cached locators accelerate discovery only; the live element must pass the full current semantic/risk decision before any click.

Page Lifecycle / BFCache behavior
- Prerendered documents remain inert until activation.
- Hidden/frozen/BFCache-resident pages disconnect active observers and non-lifecycle event listeners, clear scheduled semantic work, cancel click verifiers, and reset scheduler ownership.
- On pageshow/resume/visibility restoration, observers/events are reattached, known ShadowRoots are reacquired, context/candidate state is re-evaluated, and lifecycle-local cooldown/memo state is reset.
- No beforeunload/unload listener is used.

Site learning v6
- Fast paths are scoped to normalized pathname/flow fingerprints; unrelated routes on the same origin do not query irrelevant cached locators.
- A cached locator is never click authority. It must resolve to a live element that passes current semantic, risk, state, and context checks.
- Semantic rejection of a still-resolving cached locator records negative feedback; repeated failures invalidate the exact persisted flow through the service worker.
- Profile mutation authority is serialized in worker.js to avoid concurrent-frame last-write-wins loss.
- Locator inputs are sanitized and bounded before persistence.
- At most 8 flows/origin, 256 persisted origins, 180-day flow TTL, 32-entry worker hot LRU.
- chrome.storage.session is used as the hot session layer; chrome.storage.local provides persistent profiles.
- Legacy profile-index keys are migrated to the v6 generic index.

worker.js
- Event-driven Manifest V3 service worker.
- Independently coalesces gate and engine injections per live document/frame.
- Serializes profile merge and exact invalidation operations.
- Uses documentId when available and frameId fallback for precise injection targeting.

Performance / ownership invariants
- No polling interval.
- No whole-document querySelectorAll('*').
- No unbounded textContent/innerText subtree stringification.
- Single pathological TextNode/ARIA strings are normalized through fixed-budget head/center/tail sampling; multi-megabyte values cannot force whole-string regex normalization.
- No page-network calls, telemetry, analytics, eval, or dynamic remote code.
- Mutation callbacks perform bounded filtering/queueing; semantic work is sliced outside mutation microtasks.
- Ordinary checkbox-heavy pages do not resolve labels/control semantics for every checkbox.
- Large addedNodes batches are not retained as strong NodeLists across yields.
- No TreeWalker survives a background yield in bootstrap/gate/engine; resumable background traversal uses weak root/cursor state.
- Local synchronous TreeWalker use is bounded to one call and never stored across scheduling points.
- Hidden/frozen pages quiesce the three tiers instead of spending CPU on DOM churn that the user cannot interact with.

Install
1. Remove or disable older Auto Agree versions; do not run multiple versions simultaneously.
2. Open chrome://extensions
3. Enable Developer mode.
4. Load unpacked and choose this folder.
5. Keep site access allowed on all sites if you want arbitrary-site coverage.

Permissions
- scripting
- storage
- <all_urls> host access

No cookies/history/webRequest/downloads/debugger/nativeMessaging/proxy/clipboard/tabs/management permissions.

Minimum Chrome: 120
Version: 6.0.0
