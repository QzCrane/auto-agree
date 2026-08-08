Auto Agree Login Terms v3.0

Purpose
- Automatically checks routine mandatory Terms of Service / Privacy / User Agreement controls used as prerequisites for login, registration, verification-code flows, and similar account-access flows.
- Does NOT automatically confirm consequential actions or attestations: purchases/orders, payment or debit authorization, loans/credit, investment-risk or trading authorization, insurance application/purchase, medical informed consent, employment contracts, arbitration/rights waivers/class-action waivers, electronic signatures, biometric/facial-recognition consent, powers of attorney/guarantees, auto-renewal, age/identity/fact attestations, marketing, cookies, CAPTCHA, or "remember me".
- Industry names alone are not blocked: an insurance, investment, or payment service can still have an ordinary login Terms/Privacy checkbox that is safe for this extension to handle.

Architecture
- bootstrap.js: lightweight all-frame detector. Generic checkboxes alone do not wake the full engine; authentication/legal signals do. Large or truncated subtrees are deep-scanned only in low-priority time slices.
- worker.js: event-driven MV3 service worker that injects engine.js only into the triggering document/frame.
- engine.js: bounded incremental semantic engine with single-pass candidate snapshots, WeakRef candidate indexing for preflight, accessibility-name resolution, time-budgeted queues, open/closed Shadow DOM support, precise hit-target geometry fallback, state-verified clicking, and locally verified selector acceleration.

Privacy / networking
- No fetch/XHR/WebSocket/telemetry/analytics.
- No page content is uploaded anywhere.
- chrome.storage.local stores only a local per-origin selector after a successfully verified agreement click. Cached selectors are acceleration hints only and always go through the full semantic/risk decision again before clicking.

Install
1. Remove or disable older Auto Agree versions so two versions cannot toggle the same control.
2. Open chrome://extensions
3. Enable Developer mode.
4. Load unpacked and choose this folder.
5. Allow site access on all sites.

Minimum Chrome: 120
Version: 3.0.0
