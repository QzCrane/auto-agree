# Extension runtime

This directory is the only load-unpacked production root.

Load it from `chrome://extensions` → Developer mode → Load unpacked.

Runtime order:

1. `bootstrap.js` is declared by the manifest in all matching frames.
2. `worker.js` injects `semantic-core.js` + `gate.js` after probe evidence.
3. If Gate accepts, Worker injects `risk-core.js` + `engine.js`.

Do not add historical implementations to this directory. Historical evidence belongs in `docs/verification/`; obsolete source remains available through Git history.
