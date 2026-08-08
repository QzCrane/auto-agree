# Testing

## Release gates

Two different test layers are mandatory.

### 1. Dependency-free deterministic core gate

`npm test` verifies:

- syntax of all production JavaScript, including generation/handover modules;
- Manifest V3/permission/isolated-world/frame invariants;
- absence of forbidden network/eval/polling/debugger/wildcard-scan paths;
- production semantic severity properties;
- generation-lease contract: current generation passes, version mismatch and invalidated Runtime fail closed, no global event listener is added;
- worker exact-document injection and `documentLifecycle` rejection;
- every dynamically injected Gate/Engine/update-protection world carries the required generation lease dependency;
- scheduler global/per-tab bounds, priority admission, aging/fairness and stale eviction;
- service-worker restart with persistent profile state and pending update rehydration;
- sender-bound profile identity;
- profile-governance invariants: 256-origin cap, 8 flows/origin, 180-day TTL, `storage.session` hot layer, fingerprint+locator identity, precise invalidation and persistence-error propagation;
- update rehydration ordering (`generation-lease.js` + `semantic-core.js` + `handover-guard.js` before `bootstrap.js`);
- shared-semantic handover classification including explicit ARIA IDREFs and native external labels;
- direct current-Engine handover authorization;
- microtask expiry of unused direct authorization;
- event-propagation scoping of local causal delegation, bounded/unique delegated-control discovery, action-root exclusion and no timer-based authorization lease;
- release-transition CI lifecycle: the version-specific previous→current browser test is PR-scoped and stages the PR base, never arbitrary `push` history.

`python tools/package_extension.py --check` verifies the deterministic extension artifact. The packager derives its executable set from the complete production `extension/*.js` closure; a new runtime module therefore cannot be silently omitted merely because a second static package list was not updated.

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

`tests/e2e-generation-lease.mjs` is a reusable future-generation probe. It:

1. activates the current Engine and confirms that world carries the current generation lease;
2. replaces the same unpacked extension path with a manifest-only next-major generation without reloading the page;
3. evaluates the pre-existing old Engine execution context again;
4. requires the old lease to report non-current authority;
5. inserts a fresh routine agreement and requires zero automated clicks;
6. calls `element.click()` directly inside the stale old isolated world and again requires zero clicks;
7. performs real trusted browser input and requires exactly one click.

This distinguishes a JavaScript execution context remaining observable from that context retaining extension action authority.

`tests/e2e-update.mjs` separately keeps real pages alive across the release's previous → current unpacked-extension replacement and proves:

- no page reload occurred;
- a dormant old Probe can hand into current tiers;
- an already-active old Engine world can remain simultaneously observable with a current Engine world;
- the current lease/semantic/guard protection closure is physically present before post-update behavior is exercised;
- a current routine agreement receives exactly one authorized click;
- a mixed-state agreement that historical semantics would toggle receives zero stale-generation clicks;
- a genuine trusted browser click on a small custom Terms wrapper may still synchronously delegate one page-owned synthetic descendant click;
- agreement semantics supplied only through external `aria-labelledby` remain protected from stale clicks;
- non-English shared-core semantics remain protected without a private guard vocabulary;
- a trusted action in a broad wrapper cannot authorize a distant sibling Terms control;
- ambiguous multi-control wrappers and proceed actions inside labels fail closed as causal authority sources.

These assertions are deliberately behavioral. Engine version sentinels alone are not accepted as proof that one generation owns the action surface.

The version-transition step runs only for `pull_request`, using `github.event.pull_request.base.sha` as `AUTO_AGREE_PREVIOUS_REF`. Main pushes still run deterministic core plus current-version real Chrome E2E/profile and cooperative generation probe, but do **not** replay an arbitrary historical version-specific transition. Each future release PR deliberately advances its transition from the actual PR base.

With `--profile`, the real-extension E2E records a DevTools CPU profile summary and page metrics to `artifacts/e2e-profile.json`. The latency assertion is deliberately broad; the profile is the authority for deciding future micro-optimizations, not a fragile single-machine microbenchmark.

## Regression corpus

`tests/fixtures/regressions/` is the canonical privacy-safe structural corpus. A real-world miss or false positive must be reduced to a minimal fixture before the fix is considered closed. Do not copy credentials, session identifiers, private URLs, or unnecessary proprietary page markup into fixtures.

## Service-worker termination policy

MV3 workers are expected to disappear. Tests must assume all worker globals can vanish between events. Persistent correctness state belongs in `chrome.storage`; transient queues may disappear only if content-side handoff/retry makes the operation safe to replay.

The profile-governance test intentionally treats cache/storage policy as a long-term invariant. A handover change is not allowed to silently change origin caps, flow identity, TTL, hot-layer semantics or persistence error behavior merely because handover-focused tests still pass.

## Update-transition policy

An extension update can replace the Worker while already-open pages still exist. v8 introduced update rehydration; v9 proved non-cooperative old/new Engine coexistence; v10 adds prior-generation cooperation for future transitions.

The update gate therefore applies four independent tests:

1. **Presence:** the current lease, shared semantics, handover guard and Engine exist where expected.
2. **Historical revocation:** behaviors that distinguish stale prior semantics must not produce a click after the current firewall is established.
3. **Cooperative revocation:** a current generation that later becomes stale must lose its own isolated-world `.click()` authority when its Runtime is invalidated or version-mismatched.
4. **Compatibility:** real trusted user interaction and legitimate one-event local wrapper delegation must still work exactly once.

A trusted/local causal exception is confined to one DOM event propagation. Capture phase grants the narrow wrapper lease; bubble phase revokes it. Broad page/form containers and proceed actions are excluded, ambiguous wrappers fail closed, and no `setTimeout` lease is allowed.

## Packaging policy

`extension/` is the canonical load-unpacked production root. The release ZIP must contain every production JavaScript module present there plus the manifest and runtime README. Package verification that checks only ZIP CRC/shape but can omit a newly referenced runtime module is considered a false gate.

The v10 audit discovered exactly that failure mode in the older static package-file list. The derived production-JS closure is now part of release correctness, not optional packaging convenience.
