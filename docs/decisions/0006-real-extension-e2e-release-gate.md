# ADR 0006 — Real unpacked-extension E2E is a release gate

**Decision:** use Puppeteer against a real unpacked Chrome extension in CI in addition to dependency-free core tests.

In-page DOM tests with `chrome.*` shims remain useful for fast adversarial exploration, but they cannot prove manifest loading, service-worker wake/termination, actual `chrome.scripting`, all-frame injection, or `chrome.dom` behavior. v8 therefore treats real-extension E2E as a separate release gate. Puppeteer is a test-only tool and is not shipped in the extension artifact.
