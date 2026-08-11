# Testing

## Release gates

Two different test layers are mandatory.

### 1. Dependency-free deterministic core gate

`npm test` verifies:

- syntax of all production JavaScript, including generation/handover modules;
- Manifest V3/permission/isolated-world/frame invariants;
- absence of forbidden network/eval/polling/debugger/wildcard-scan paths;
- production semantic severity properties;
- multilingual risk parity: every routine-supported language family must also recognize native-language optional, consequential and attestation evidence conservatively;
- multilingual fragmentation invariance: representative routine phrases remain legal+assent evidence when a DOM fragment boundary is inserted at every character position;
- bounded-work contracts: hard queue-object caps remain in place while known Probe/Gate/Engine saturation paths retain weak recoverable final-state work instead of naked oldest-item drops;
- Gate deep FIFO/TTL invariants: older connected cursors cannot be evicted to admit newer work, live age alone cannot delete batch/deep work, the Gate-deep saturation gate remains five attempts, and the live-TTL discriminator must cross the production TTL;
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
- local causal delegation stores the exact source `Event` and accepts a nested synthetic click only while `sourceEvent.eventPhase != Event.NONE`;
- bounded/unique delegated-control discovery, action-root exclusion and no timer-based authorization lease;
- release-transition CI lifecycle: the previous→current browser test is PR-scoped, stages the PR base, derives versions from manifests, and identifies old/current worlds by execution-context identity rather than one hardcoded release pair.

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
- stopped-propagation causal delegation with two required branches:
  - synchronous descendant `click()` during the exact trusted source event -> one click;
  - descendant `click()` in a later task after source dispatch ended -> zero clicks;
- deterministic fixed-seed structural fuzz over **300 dynamic contexts** crossing native/external labels, ARIA IDREFs, custom controls, wrapper depth, text fragmentation, multilingual routine semantics and blocked/already-checked/disabled/mixed states; the aggregate gate requires false positives = 0, false negatives = 0 and duplicate toggles = 0;
- a 5,000-unrelated-checkbox tail-login profile scenario.

`tests/e2e-tier-overflow.mjs` is the permanent bounded-work adversarial gate. Each case first proves the expected runtime tier and then saturates one bounded queue with the only valid agreement stored in correctness-sensitive work. It requires exactly one final activation for:

- Probe deep work at `MAX_DEEP = 4`;
- Gate deep work at `MAX_DEEP_JOBS = 10`, repeated on **five independent pages** in every canonical run;
- Gate large-batch work at `MAX_BATCH_JOBS = 6`.

A queue cap is therefore tested as both a resource bound and a correctness boundary. Increasing a cap, weakening the fixture/repetition count, or replacing recovery with an unbounded synchronous document scan is not an acceptable way to make this gate green.

`tests/e2e-gate-live-ttl.mjs` isolates lifetime semantics from overflow. It establishes a Gate-only world, queues a live deep root, then deliberately blocks the renderer for about **2.7 seconds** after the MutationObserver checkpoint. This crosses `JOB_TTL_MS = 2400` before background traversal can resume. The connected cursor must continue and produce exactly one activation; pure queue age is never sufficient evidence that correctness work is obsolete.

`tests/e2e-generation-lease.mjs` is a reusable future-generation probe. It:

1. activates the current Engine and confirms that world carries the current generation lease;
2. replaces the same unpacked extension path with a manifest-only next-major generation without reloading the page;
3. evaluates the pre-existing old Engine execution context again;
4. requires the old lease to report non-current authority;
5. inserts a fresh routine agreement and requires zero automated clicks;
6. calls `element.click()` directly inside the stale old isolated world and again requires zero clicks;
7. performs real trusted browser input and requires exactly one click.

This distinguishes a JavaScript execution context remaining observable from that context retaining extension action authority.

`tests/e2e-update.mjs` separately keeps real pages alive across the PR base → current unpacked-extension replacement and proves:

- `previousVersion` is read from the staged PR-base manifest and `currentVersion` from the candidate manifest;
- no page reload occurred;
- a dormant old Probe can hand into current tiers;
- an already-active old Engine world can remain simultaneously observable with a current Engine world;
- old/current worlds are distinguished by execution-context IDs even if both report the same manifest version;
- the current lease/semantic/guard protection closure is physically present before post-update behavior is exercised;
- a current routine agreement receives exactly one authorized click;
- a mixed-state agreement that historical semantics would toggle receives zero stale-generation clicks;
- a genuine trusted browser click on a small custom Terms wrapper may still synchronously delegate one page-owned synthetic descendant click;
- agreement semantics supplied only through external `aria-labelledby` remain protected from stale clicks;
- non-English shared-core semantics remain protected without a private guard vocabulary;
- a trusted action in a broad wrapper cannot authorize a distant sibling Terms control;
- ambiguous multi-control wrappers and proceed actions inside labels fail closed as causal authority sources.

These assertions are deliberately behavioral. Engine version sentinels alone are not accepted as proof that one generation owns the action surface.

The transition step runs only for `pull_request`, using `github.event.pull_request.base.sha` as `AUTO_AGREE_PREVIOUS_REF`. Main pushes still run deterministic core plus current-version real Chrome E2E/profile, tier saturation, the Gate live-TTL discriminator and cooperative generation probe, but do **not** replay arbitrary push history. The harness itself is version-agnostic: major releases, patch releases and same-version hotfix/reload candidates use the same state-transition machinery.

With `--profile`, the real-extension E2E records a DevTools CPU profile summary and page metrics to `artifacts/e2e-profile.json`. The latency assertion is deliberately broad; the profile is the authority for deciding future micro-optimizations, not a fragile single-machine microbenchmark.

## Regression corpus

`tests/fixtures/regressions/` is the canonical privacy-safe structural corpus. A real-world miss or false positive must be reduced to a minimal fixture before the fix is considered closed. Do not copy credentials, session identifiers, private URLs, or unnecessary proprietary page markup into fixtures.

`structural-fuzz.html` is a deterministic combinatorial corpus, not a replacement for minimal regressions. It searches interactions between structure, fragmentation, language, control representation and mutation timing that curated one-case fixtures cannot exhaustively enumerate.

`probe-deep-overflow.html`, `gate-deep-overflow.html`, and `gate-batch-overflow.html` isolate bounded-work saturation. Gate fixtures keep future agreement content out of the initial DOM so Gate-only state is physically established before the adversarial mutation burst. `gate-live-ttl.html` separately supplies the Gate-only seed for the renderer-delay TTL discriminator.

`causal-propagation.html` is a permanent authority-lifetime fixture, not merely a one-off reproduction. It ensures page-controlled propagation stopping cannot turn a same-event exception into future asynchronous authority.

## Bounded-work policy

Correctness-relevant work queues have two simultaneous obligations:

1. a hard representation bound protects CPU/memory and prevents detached-DOM retention;
2. live semantic final state cannot be silently forgotten merely because that representation is full or old.

Overflow recovery therefore prefers weak final-state roots/owners, generation supersession and bounded time-sliced rescans. For Gate deep work, ADR 0014 additionally requires **old live FIFO cursors to outrank new overflow**: the existing queue remains in order and only new excess final state is compressed. Age-only TTL expiration is valid for no connected live Gate cursor; the age is refreshed and traversal continues. A drop is valid only when work is complete, obsolete, disconnected, or another bounded recovery representation is already authoritative.

This policy is enforced by deterministic static contracts, five-attempt real-Chrome Gate saturation, and an independent >2.4-second live-TTL discriminator. Queue classes not yet red-proven retain their current implementation until an isolated browser test demonstrates a correctness failure.

## Service-worker termination policy

MV3 workers are expected to disappear. Tests must assume all worker globals can vanish between events. Persistent correctness state belongs in `chrome.storage`; transient queues may disappear only if content-side handoff/retry makes the operation safe to replay.

The profile-governance test intentionally treats cache/storage policy as a long-term invariant. A handover change is not allowed to silently change origin caps, flow identity, TTL, hot-layer semantics or persistence error behavior merely because handover-focused tests still pass.

## Update-transition policy

An extension update can replace the Worker while already-open pages still exist. v8 introduced update rehydration; v9 proved non-cooperative old/new Engine coexistence; v10 adds prior-generation cooperation for future transitions and post-merge hardening binds local delegated authority to a live source Event.

The update gate therefore applies four independent tests:

1. **Presence:** the current lease, shared semantics, handover guard and Engine exist where expected.
2. **Historical revocation:** behaviors that distinguish stale prior semantics must not produce a click after the current firewall is established.
3. **Cooperative revocation:** a current generation that later becomes stale must lose its own isolated-world `.click()` authority when its Runtime is invalidated or version-mismatched.
4. **Compatibility without authority leakage:** trusted user interaction and legitimate one-event local wrapper delegation work exactly once, while stopped propagation cannot preserve a causal token beyond source-event dispatch.

A trusted/local causal exception is confined to one **live source Event dispatch**. The delegated control maps to that exact source Event; nested use is allowed only while `eventPhase != NONE` and is one-shot. Bubble cleanup is an eager cleanup path, not the security boundary. Broad page/form containers and proceed actions are excluded, ambiguous wrappers fail closed, and no `setTimeout` lease is allowed.

The transition harness must not hardcode a release pair. It derives base/current versions from manifests and uses execution-context IDs as the primary old/current identity. This permits the same gate to test a v10→v11 release and a v10.0.0→v10.0.0 hotfix/reload without confusing equal version text for one generation.

## Packaging policy

`extension/` is the canonical load-unpacked production root. The release ZIP must contain every production JavaScript module present there plus the manifest and runtime README. Package verification that checks only ZIP CRC/shape but can omit a newly referenced runtime module is considered a false gate.

The v10 audit discovered exactly that failure mode in the older static package-file list. The derived production-JS closure is now part of release correctness, not optional packaging convenience.
