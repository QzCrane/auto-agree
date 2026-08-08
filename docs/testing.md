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
- service-worker restart with persistent profile state and pending update rehydration.

`python tools/package_extension.py --check` verifies the deterministic extension artifact.

### 2. Real unpacked-extension E2E

CI installs a pinned Puppeteer test tool and launches the runner's real Chrome with `extension/` as an unpacked extension. This is intentionally different from the older in-page Chrome-API shim tests.

`tests/e2e-extension.mjs` covers:

- ordinary routine login agreement;
- marketing and fragmented consequential negatives;
- TRAE-derived classless visual control;
- native validity causality (invalid email must not make a disabled Login action look agreement-gated);
- real iframe/all-frame injection;
- real closed ShadowRoot discovery through the extension API path;
- repeated forced MV3 service-worker termination before dynamic evidence appears;
- v7 → v8 unpacked reload/update transition without reloading the existing test page;
- a 5,000-unrelated-checkbox tail-login profile scenario.

With `--profile`, the E2E test records a DevTools CPU profile summary and page metrics to `artifacts/e2e-profile.json`. The latency assertion is deliberately broad; the profile is the authority for deciding future micro-optimizations, not a fragile single-machine microbenchmark.

## Regression corpus

`tests/fixtures/regressions/` is the canonical privacy-safe structural corpus. A real-world miss or false positive must be reduced to a minimal fixture before the fix is considered closed. Do not copy credentials, session identifiers, private URLs, or unnecessary proprietary page markup into fixtures.

## Service-worker termination policy

MV3 workers are expected to disappear. Tests must assume all worker globals can vanish between events. Persistent correctness state belongs in `chrome.storage`; transient queues may disappear only if content-side handoff/retry makes the operation safe to replay.

## Update-transition policy

An extension update can replace the Worker while already-open pages still exist. v8 therefore tests update rehydration explicitly. Existing old-generation page code may either finish safely or hand off to the new Worker; new code must not create a second blind toggler.
