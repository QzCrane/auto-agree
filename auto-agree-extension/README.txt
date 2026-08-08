Auto Agree Login Terms v5.0

Purpose
- Automatically checks routine mandatory Terms of Service / Privacy / User Agreement controls that gate login, registration, verification-code flows, onboarding, and similar low-discretion access flows.
- Does NOT automatically confirm consequential actions or factual attestations: purchases/orders, payment/debit authorization, loans/credit, investment-risk or trading authorization, insurance application/purchase, medical informed consent, employment contracts, arbitration/rights/class-action waivers, electronic signatures, biometric/facial-recognition consent, powers of attorney/guarantees, auto-renewal, age/identity/fact attestations, marketing, cookies, CAPTCHA, or "remember me".
- Industry names alone are not blocked. An insurance, investment, banking, medical, trading, or payment service can still have an ordinary login Terms/Privacy checkbox that may be handled.

Three-tier architecture
1. bootstrap.js — micro-probe in every matching frame at document_start.
   - Never clicks and never decides consent.
   - Uses bounded structural/auth/legal hints only to decide whether the richer semantic gate is worth loading.
   - Footer Terms/Privacy, newsletter email, contact forms, site search, ordinary checkboxes, and ordinary required settings stay asleep.
   - Defers all discovery while a document is prerendering and starts on prerenderingchange.
   - Can hand a focus/pointer seed host to the gate so a first interaction with a completely closed Shadow login component is not lost.
   - Background deep work uses weak root/cursor traversal; it does not keep detached subtrees alive while scheduling is frozen.

2. gate.js — bounded semantic activation gate, injected only into suspicious frames.
   - Requires co-occurring evidence: strong auth; auth+credential; legal+assent+control; legal+required+control; or auth+legal+control.
   - Reconstructs legal/assent semantics split across inline DOM fragments without reverting to whole-page text concatenation.
   - Large mutation batches and deep scans use weak references/range cursors and hard budgets.
   - On successful handoff it disconnects its observer, removes global listeners, and clears queued work before engine injection.

3. engine.js — full agreement decision/activation engine, injected only after the gate accepts the frame.
   - Bounded text and accessibility-name resolution; no unbounded textContent/innerText.
   - Candidate snapshots plus per-context epoch snapshots.
   - WeakRef candidate indexes; preflight and credential changes re-evaluate only indexed agreement candidates (O(K)), not the whole form.
   - Separate discovery/context MutationObservers, time-budgeted queues, generation superseding, and scheduler.yield/postTask fallbacks.
   - Open, closed, and nested Shadow DOM discovery via the Chrome extension DOM API where available.
   - Precise classless visual hit-target resolution for TRAE-style controls; no whole-row click fallback.
   - Event/mutation-driven state verification; unknown custom toggle state is one-shot and is never blindly clicked twice.
   - Asynchronous visibility proof and hidden-to-visible recovery.
   - Hidden pending controls, mutation ranges, walk cursors, shadow cursors, and queued roots use weak ownership so background/frozen tabs do not make the extension a detached-DOM owner.
   - Multi-flow site learning with ordinary DOM and Shadow-host locator paths. Cached locators accelerate discovery only; the live element must pass the full current semantic/risk decision before any click.

worker.js
- Event-driven Manifest V3 service worker.
- Independently coalesces gate and engine injections per live document/frame.
- Serializes/merges profile writes to prevent concurrent-frame last-write-wins loss.
- Retains at most 8 flows per origin and 256 persisted origins; stale flows expire after 180 days.
- Uses a 32-entry worker hot LRU, chrome.storage.session for session cache, and chrome.storage.local for persistence.

Performance invariants
- No polling interval.
- No whole-document querySelectorAll('*').
- No unbounded textContent/innerText subtree stringification.
- No page-network calls, telemetry, analytics, eval, or dynamic remote code.
- Mutation callbacks perform bounded filtering/queueing; semantic work is sliced outside mutation microtasks.
- Ordinary checkbox-heavy pages do not resolve labels/control semantics for every checkbox.
- Large addedNodes batches are not retained as strong NodeLists across yields.
- No TreeWalker survives a background yield in bootstrap/gate/engine; resumable background traversal uses weak root/cursor state.
- Local synchronous TreeWalker use is bounded to one call and never stored across scheduling points.

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
Version: 5.0.0
