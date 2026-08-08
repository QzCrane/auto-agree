# Extension runtime

This directory is the only load-unpacked production root.

Load it from `chrome://extensions` → Developer mode → Load unpacked.

Runtime order:

1. `generation-lease.js` and then `bootstrap.js` are declared by the manifest in all matching frames. The lease is isolated-world local and removes that generation's programmatic `.click()` authority when its extension Runtime is invalidated or version-mismatched; Probe itself never clicks.
2. `worker.js` rejects explicitly inactive document lifecycles and schedules `generation-lease.js` + `semantic-core.js` + `gate.js` after Probe evidence.
3. If Gate accepts, Worker schedules `generation-lease.js` + `semantic-core.js` + `handover-guard.js` + `risk-core.js` + `engine.js` with bounded global/per-tab concurrency, queue aging, stale eviction and Engine admission priority.
4. Probe/Gate handoff is retryable across unexpected Worker termination; profile messages are idempotently retried and the Worker derives their storage origin from `MessageSender`, never from content-provided origin text.
5. On extension update/reload, Worker uses a persisted session marker and high-priority bounded `tabs.query()` + `scripting.executeScript()` rehydration. It first installs `generation-lease.js` + `semantic-core.js` + `handover-guard.js` into accessible frames, and only after that phase resolves does it inject `bootstrap.js`.
6. The cooperative generation lease protects v10→future stale Auto Agree `.click()` calls; the handover guard remains the compatibility firewall for older non-cooperative generations such as v9. Trusted browser input is not turned into general script authority.
7. Site-learning persistence remains bounded: 256 origins, 8 flows/origin, 180-day TTL, 32-entry Worker hot LRU, session/local storage layers and fingerprint+locator flow identity.

The deterministic package tool derives its JavaScript payload from the complete production `extension/*.js` set so a newly referenced runtime module cannot be absent from the ZIP while the load-unpacked tree still works.

Do not add historical implementations to this directory. Historical evidence belongs in `docs/verification/`; obsolete source remains available through Git history.