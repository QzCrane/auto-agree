Auto Agree Login Terms v2.0.0

Runtime architecture
- Manifest V3 static isolated content script.
- No background/service worker.
- No network requests. No telemetry. No storage.
- No extra API permissions; only all-site content-script matching required for cross-site automation.

Coverage
- Native checkbox and agreement radio controls.
- ARIA checkbox/radio/switch controls.
- Common checkbox Web Components and framework wrappers.
- Dynamic SPA insertion and re-rendering.
- Hidden controls that later appear.
- Text split across spans and legal links.
- Classless visual checkbox fallback using geometry only after strong legal semantics.
- Open and closed Shadow DOM (closed roots via chrome.dom.openOrClosedShadowRoot).
- All matching frames plus about/data/blob/filesystem related-frame fallback.
- Multi-language legal/assent vocabulary across major Chinese, European, Asian and RTL languages.

Precision exclusions
- Marketing/promotions/newsletters.
- Cookie consent.
- Remember-me / keep-signed-in.
- Auto-renew/subscription consent.
- CAPTCHA/human verification.
- Age/identity factual attestations.
- Optional third-party sharing / personalized advertising.

Performance
- One MutationObserver shared across document and ShadowRoots.
- Incremental subtree walking; no repeated full-document scan fallback.
- Mutation batches deduplicated by ancestor.
- Bounded synchronous work, remainder scheduled with requestIdleCallback.
- No global class/style mutation observation.
- Reliable checkbox paths avoid geometry/layout reads.
- Geometry is reserved for classless visual-control fallback.
- Unknown-state custom controls are never blindly double-clicked.
