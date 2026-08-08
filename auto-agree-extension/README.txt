Auto Agree Login Terms v4.0

Purpose
- Automatically checks routine mandatory Terms of Service / Privacy / User Agreement controls used as prerequisites for login, registration, verification-code flows, and similar account-access flows.
- Does NOT automatically confirm consequential actions or attestations: purchases/orders, payment or debit authorization, loans/credit, investment-risk or trading authorization, insurance application/purchase, medical informed consent, employment contracts, arbitration/rights waivers/class-action waivers, electronic signatures, biometric/facial-recognition consent, powers of attorney/guarantees, auto-renewal, age/identity/fact attestations, marketing, cookies, CAPTCHA, or "remember me".
- Industry names alone are not blocked: an insurance, investment, banking, medical, trading, or payment service can still have an ordinary login Terms/Privacy checkbox that the extension may handle.

Architecture
- bootstrap.js: bounded all-frame evidence gate. A footer Terms/Privacy link, newsletter email field, contact phone/email, generic checkbox, or generic required setting does not load the full engine by itself. Strong authentication signals or locally co-occurring authentication/legal/assent/control evidence activate it. Large/truncated subtrees are continued in low-priority slices. Normal focus/pointer composed paths can probe closed Shadow hosts without a whole-page host sweep.
- worker.js: event-driven Manifest V3 service worker. It coalesces duplicate activation and injects engine.js only into the triggering document/frame. Site profiles use a small 32-entry worker hot LRU, chrome.storage.session as session cache, and chrome.storage.local for persistence.
- engine.js: bounded incremental semantic engine with candidate snapshots, per-context epoch snapshots, WeakRef candidate indexes, split discovery/context MutationObservers, time-budgeted/generation-coalesced work queues, open/closed Shadow DOM discovery, accessibility-name resolution, precise classless hit-target geometry, event-driven state verification, asynchronous visibility proof, and multi-flow locally verified site locators including Shadow paths.

Performance invariants
- No unbounded textContent/innerText subtree stringification.
- No whole-document querySelectorAll('*').
- No polling interval.
- Large mutation callbacks filter/deduplicate and enqueue work instead of synchronously interpreting every changed control.
- Plain native checkboxes do not each resolve input.labels during broad discovery; legal text discovers and marks only relevant controls.
- Preflight re-evaluates indexed agreement candidates for the current context instead of synchronously rescanning the whole form.
- Credential value changes invalidate the context epoch and re-evaluate only indexed agreement candidates (O(K)).

Privacy / networking
- No fetch/XHR/WebSocket/telemetry/analytics.
- No page content is uploaded anywhere.
- Local profiles contain only verified structural locators/fingerprints after a successful agreement click. A cached locator is an acceleration hint, never click authority: the current element must pass the full semantic/risk decision again.

Install
1. Remove or disable older Auto Agree versions so two versions cannot toggle the same control.
2. Open chrome://extensions
3. Enable Developer mode.
4. Load unpacked and choose this folder.
5. Allow site access on all sites.

Minimum Chrome: 120
Version: 4.0.0
