# Testing

## Release gates

Two different test layers are mandatory.

### 1. Dependency-free deterministic core gate

`npm test` verifies:

- syntax of all production JavaScript;
- Manifest V3/permission/isolated-world/frame invariants;
- absence of forbidden network/eval/polling/debugger/wildcard-scan paths;
- production semantic severity properties;
- worker exact-document injection and `documentLifecycle` rejection;
- scheduler global/per-tab bounds, priority admission, aging/fairness and stale eviction;
- service-worker restart with persistent profile state and pending update rehydration;
- sender-bound profile identity;
- update rehydration ordering (`handover-guard.js` before `bootstrap.js`);
- direct current-Engine handover authorization;
- microtask expiry of unused direct authorization;
- event-propagation scoping of local causal delegation, with no timer-based authorization lease;
- release-transition CI lifecycle: the version-specific previous→current browser test is PR-scoped and stages the PR base, never arbitrary `push` history.

`python tools/package_extension.py --check` verifies the deterministic extension artifact.

### 2. Real unpacked-extension E2E

CI installs a pinned Puppeteer test tool and launches the runner's real Chrome with `extension/` as an unpacked extension. This is intentionally different from older in-page Chrome-API shim tests.

`tests/e2e-extension.mjs` covers:

- ordinary routine login agreement;
- marketing and fragmented consequential negatives;
- TRAE-derived classless visual control;
- native validity causality (invalid email must not make a disabled Login action look agreement-gated);
- ARIA/data/native mixed-or-indeterminate controls remain untouched;
- classless UNKNOWN-state controls remain one-shot beyond the normal click cooldown;
- real iframe/all-frame injection;
- real closed ShadowRoot discovery through the extension API path;
- repeated forced MV3 service-worker termination before dynamic evidence appears;
- a 5,000-unrelated-checkbox tail-login profile scenario.

`tests/e2e-update.mjs` separately keeps real pages alive across the release's previous → current unpacked-extension replacement and proves:

- no page reload occurred;
- a dormant old Probe can hand into current tiers;
- an already-active old Engine world can remain simultaneously observable with a current Engine world;
- the current handover guard is physically present before post-update behavior is exercised;
- a current routine agreement receives exactly one authorized click;
- a mixed-state agreement that v8 would click twice receives exactly zero stale-generation clicks in the v8→v9 release gate;
- a genuine trusted browser click on a small custom Terms wrapper may still synchronously delegate one page-owned synthetic descendant click.

The last three assertions are deliberately behavioral. Engine version sentinels alone are not accepted as proof that one generation owns the action surface.

The version-transition step runs only for `pull_request`, using `github.event.pull_request.base.sha` as `AUTO_AGREE_PREVIOUS_REF`. Main pushes still run deterministic core plus current-version real Chrome E2E/profile, but do **not** replay a historical version-specific transition. This prevents the v8→v9 fixture from becoming a false failure on later v9 main commits. Each future release PR must deliberately advance its transition fixture (for example v9→v10).

With `--profile`, the real-extension E2E records a DevTools CPU profile summary and page metrics to `artifacts/e2e-profile.json`. The latency assertion is deliberately broad; the profile is the authority for deciding future micro-optimizations, not a fragile single-machine microbenchmark.

## Regression corpus

`tests/fixtures/regressions/` is the canonical privacy-safe structural corpus. A real-world miss or false positive must be reduced to a minimal fixture before the fix is considered closed. Do not copy credentials, session identifiers, private URLs, or unnecessary proprietary page markup into fixtures.

## Service-worker termination policy

MV3 workers are expected to disappear. Tests must assume all worker globals can vanish between events. Persistent correctness state belongs in `chrome.storage`; transient queues may disappear only if content-side handoff/retry makes the operation safe to replay.

## Update-transition policy

An extension update can replace the Worker while already-open pages still exist. v8 introduced update rehydration. Real v8→v9 testing proved that Chrome can retain an executable old Engine isolated world while creating the new generation.

The update gate therefore applies three independent tests:

1. **Presence:** the current handover guard and Engine exist where expected.
2. **Revocation:** a behavior that uniquely distinguishes stale v8 semantics (`aria-checked="mixed"`) must not produce a click after the guard is established.
3. **Compatibility:** a real user-caused local wrapper delegation must still work exactly once.

A trusted/local causal exception is confined to one DOM event propagation. Capture phase grants the narrow wrapper lease; bubble phase revokes it. Broad page/form containers are excluded, and no `setTimeout` lease is allowed. This rule exists because real Chrome disproved the simpler assumption that one isolated-world microtask lifetime necessarily spans the corresponding MAIN-world page handler.