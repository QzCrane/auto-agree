# Extension runtime

This directory is the only load-unpacked production root.

Load it from `chrome://extensions` → Developer mode → Load unpacked.

Runtime order:

1. `bootstrap.js` is declared by the manifest in all matching frames.
2. `worker.js` rejects explicitly inactive document lifecycles and schedules `semantic-core.js` + `gate.js` after probe evidence.
3. If Gate accepts, Worker refreshes `semantic-core.js` and schedules `risk-core.js` + `engine.js` with bounded global/per-tab concurrency, queue aging, stale eviction and Engine admission priority.
4. Probe/Gate handoff is retryable across unexpected Worker termination; profile messages are idempotently retried and the Worker derives their storage origin from `MessageSender`, never from content-provided origin text.
5. On extension update/reload, Worker uses a persisted session marker and high-priority bounded `tabs.query()` + `scripting.executeScript()` rehydration to inject `handover-guard.js` before `bootstrap.js` in already-open tabs. Current Engine clicks receive one-shot authorization; stale-generation synthetic agreement clicks are vetoed. No `tabs` permission is requested because `<all_urls>` host access already covers the required tab interaction.

Do not add historical implementations to this directory. Historical evidence belongs in `docs/verification/`; obsolete source remains available through Git history.
