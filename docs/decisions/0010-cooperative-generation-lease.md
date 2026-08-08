# ADR 0010 — Future generations carry a cooperative click-revocation lease

**Status:** Accepted

**Date:** 2026-08-09

## Context

ADR 0009 established a new-generation handover firewall because real v8→v9 Chrome testing proved that an already-running old isolated-world Engine can remain executable after extension replacement. That firewall is necessary for historical generations that shipped without a revocation mechanism, but it cannot make the replacement instant: the new Worker must first wake and inject the guard into each surviving frame.

v10 tested a stronger question in real Chrome for Testing: what does the **already-existing old isolated world itself** observe immediately after the same unpacked extension path advances to a new manifest generation without reloading the page?

The pre-update v10 Engine world remained CDP-executable, but its extension Runtime became invalid. In the old world:

```text
before update: chrome.runtime.getManifest().version = 10.0.0
after update:  Extension context invalidated.
```

A separate real-browser gate then proved that a v10 world can use this fact to revoke its own programmatic click authority while trusted browser input in the page remains functional.

## Decision

Every v10 Auto Agree execution world that can eventually reach Engine work carries `generation-lease.js`.

The lease is installed:

- as the first static content script before `bootstrap.js`;
- in the update-protection dependency closure before `handover-guard.js`;
- in dynamically injected Gate worlds;
- in dynamically injected Engine worlds.

Inside Auto Agree's isolated JavaScript realm, the lease wraps that realm's `HTMLElement.prototype.click`. Immediately before dispatch it calls `chrome.runtime.getManifest()` and permits the call only when the installed manifest version equals the generation compiled into the lease. A version mismatch or an invalidated extension context returns without dispatching the DOM click.

The wrapper is realm-local. It does not patch the page MAIN world and does not convert trusted browser input into script authorization.

## Why both the lease and the handover firewall remain

They solve different boundaries.

### Cooperative generation lease

A generation that already shipped the lease can revoke **its own future Auto Agree `.click()` calls** as soon as its Runtime becomes stale. This removes the Worker/rehydration delay from the v10→future cooperative path for the ordinary activation primitive.

### Handover firewall

Older generations such as v9 did not ship the lease. They cannot be retroactively taught to self-revoke. The new generation therefore still installs `handover-guard.js` before rehydrated Probe work to constrain non-cooperative stale agreement-like synthetic clicks.

The guard also remains a defense for a future activation path that does not go through the leased `HTMLElement.prototype.click` primitive. A stale guard becomes passive toward later generations when its own Runtime is invalidated, so an old firewall cannot turn into a blocker for a new legitimate Engine.

## Rejected alternatives

### Rejected: replace the firewall with the lease immediately

That would leave the v9→v10 transition unprotected because v9 never contained `generation-lease.js`.

### Rejected: poll the Worker for current version before every click

A runtime message adds asynchronous scheduling and Worker-lifecycle dependence to the final action boundary. `runtime.getManifest()` is synchronous inside the extension realm and, in the tested update path, fails closed when the old context is invalidated.

### Rejected: patch the page MAIN-world `HTMLElement.prototype.click`

That would alter application behavior outside Auto Agree's own execution realm and create a much larger compatibility and trust surface. The lease must remain isolated-world local.

### Rejected: infer current authority from a version sentinel

A sentinel is an ordinary JavaScript value left in an execution context. Real update tests have repeatedly shown that old sentinel-bearing worlds can remain executable. Authority is derived from the current extension Runtime, not the presence of a global variable.

## Verification requirement

The deterministic gate must prove current-version calls pass, version mismatch calls fail closed, Runtime invalidation fails closed, and no global event listener is added by the lease.

The real unpacked-Chrome gate must:

1. activate an Engine carrying the current lease;
2. replace the same extension path with a manifest-only next generation without reloading the page;
3. show that the old Engine execution context still exists;
4. show that its lease reports non-current authority;
5. show that both ordinary stale automation and a direct stale-world `element.click()` produce zero clicks;
6. show that a real trusted browser click still succeeds exactly once.

## Boundary

The result is evidence for the tested Chrome extension lifecycle, not a web-platform theorem for every browser forever. The behavioral E2E remains a release gate so a future Chrome lifecycle change cannot silently invalidate the assumption.
