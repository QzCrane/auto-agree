# Testing

## Release philosophy

A green narrow test is not permission to waive a historical invariant. v11 uses layered evidence so semantic safety, bounded progress, lifecycle behavior, cross-generation authority, packaging, and performance are checked independently.

Two layers are mandatory on every release candidate:

1. dependency-free deterministic/core verification;
2. real headed Chrome with the unpacked extension.

Scheduling-sensitive fixes additionally require the **exact final SHA** to pass canonical CI and then rerun the entire unpacked-E2E job on that same SHA before merge.

## 1. Deterministic/core gate

`npm test` currently runs:

- syntax checks for every production JavaScript module;
- Manifest V3, permission, isolated-world and frame contracts;
- `version-contract`: manifest/package + eight runtime JavaScript sentinels must be one generation, and the production JS closure cannot contain a second runtime semver generation;
- forbidden-path checks: no network client, eval/dynamic Function, polling interval, debugger API/permission, or wildcard whole-page scan;
- shared semantic/risk properties;
- multilingual risk parity;
- multilingual fragmentation invariance;
- Probe/Gate/Engine bounded-work static contracts;
- Engine RootBatch/sibling-batch lifetime contracts;
- Engine Shadow FIFO/weak-recovery contracts;
- generation-lease behavior derived from the current manifest generation;
- Worker injection/document-lifecycle contracts;
- Worker scheduler global/per-tab bounds, priority, aging/fairness and stale eviction;
- Worker restart/update rehydration with current generation derived from the manifest;
- sender-bound profile identity and profile-governance limits;
- shared-semantic handover behavior, ARIA IDREF/external-label handling and exact source-event causal authority;
- PR-base/current release-transition topology and execution-context identity.

The deterministic consent/risk model currently exercises **10,188 assertions**. `tests/property-semantic-fragmentation.mjs` contributes **644** representative routine/risk fragmentation assertions.

`python tools/package_extension.py --check` separately verifies the deterministic release artifact. The executable set is derived from the complete production `extension/*.js` closure so a new runtime module cannot be omitted because a second manual package list was forgotten.

## 2. Real unpacked-extension Chrome gate

CI installs pinned Puppeteer and Chrome for Testing, then launches `extension/` as a real unpacked MV3 extension under a virtual display. The release evidence for v11 used **Chrome for Testing 149.0.7827.22**.

### Main behavior/profile suite

`tests/e2e-extension.mjs` covers:

- ordinary routine login agreement;
- marketing and fragmented consequential negatives;
- TRAE-derived classless visual control;
- native validity causality;
- native/ARIA/data mixed or indeterminate refusal;
- classless UNKNOWN one-shot behavior beyond normal cooldown;
- iframe/all-frame injection;
- real closed ShadowRoot discovery;
- repeated forced MV3 Worker termination before dynamic evidence;
- stopped-propagation causal delegation:
  - synchronous descendant delegation during the exact source event → one click;
  - later-task reuse after dispatch → zero clicks;
- deterministic fixed-seed structural fuzz over **300 dynamic contexts**;
- a 5,000-unrelated-checkbox tail-login profile scenario.

Structural fuzz spans native/external labels, ARIA IDREFs, custom controls, wrapper depth, text fragmentation, multilingual routine semantics, blocked consent, already-checked, disabled and mixed states. Aggregate acceptance is strict:

```text
false positives   = 0
false negatives   = 0
duplicate toggles = 0
```

### Probe/Gate bounded-work saturation

`tests/e2e-tier-overflow.mjs` independently requires exactly-one eventual activation for:

- Probe deep at `MAX_DEEP = 4`;
- Gate deep at `MAX_DEEP_JOBS = 10`;
- Gate large batch at `MAX_BATCH_JOBS = 6`.

The Gate-deep case runs on **five independent pages** in every canonical invocation so one favorable scheduler interleaving cannot hide the historical zero-budget/FIFO race.

`tests/e2e-gate-live-ttl.mjs` creates a Gate-only world, queues live deep work, and blocks the renderer for about **2.7 seconds**, crossing `JOB_TTL_MS = 2400`. The connected cursor must continue and activate exactly once.

### Engine walk saturation

`tests/e2e-engine-overflow.mjs` activates Engine, then appends **20 roots × 900 nodes**. The unique fresh routine target is positioned so enough later roots exceed `MAX_WALK_JOBS = 12`. Exactly-one progress is required within a fixed 9-second deadline.

### Engine RootBatch lifetime

`tests/e2e-engine-rootbatch-ttl.mjs` creates **60 roots × 420 descendants**, puts the unique target in root 42, and blocks the renderer for about **3.4 seconds**. This crosses `ROOT_BATCH_TTL_MS = 3000`; the live batch must continue from its existing index and activate exactly once.

### Engine sibling/mutation-batch lifetime

`tests/e2e-engine-batch-ttl.mjs` appends one MutationRecord containing **140 siblings**, forcing the `addedNodes.length > 96` / `enqueueSiblingRange` path. The only routine target is sibling **70**, outside the first-three/last-five edge path. A ~3.4-second stall crosses `BATCH_JOB_TTL_MS = 3000`; the connected range must continue exactly once.

### Engine broad closed-Shadow saturation

`tests/e2e-engine-shadow-overflow.mjs` creates **14 roots × 900 nodes**, materially exceeding `MAX_SHADOW_JOBS = 8`. The unique target lives near the tail of root 0 inside a **closed ShadowRoot on a plain `DIV` host**.

That structure matters: ordinary `probeShadow(host, false)` cannot access the closed root, so a pass cannot be explained by ordinary DOM traversal accidentally rescuing the target. Broad Shadow discovery must preserve eventual progress through the bounded FIFO + weak-recovery mechanism.

### Rejected authorization boundary

`tests/e2e-authorize-rejection.mjs` replaces only the public handover API object in the real Engine isolated world with `authorize() => false`, while leaving the original guard closure/capture listeners installed.

The gate requires:

- Engine actually reaches the rejected authorization path;
- initial + bounded retry synthetic attempts produce **zero DOM click effect**;
- a subsequent trusted browser click still succeeds once.

The v11 candidate observed two authorization attempts, `{checked:false, clicks:0}` after automation, then `{checked:true, clicks:1}` after trusted input.

### Cooperative future-generation revocation

`tests/e2e-generation-lease.mjs` is current-generation-relative:

1. activate current Engine and verify current lease;
2. replace the same unpacked path with manifest-only **next major** without page reload;
3. evaluate the pre-existing old execution context;
4. require old lease non-current;
5. insert routine evidence and require zero stale automated clicks;
6. call `.click()` directly in the stale old isolated world and require zero click;
7. perform trusted browser input and require exactly one click.

For the v11 release this physically became **v11.0.0 → v12.0.0**. Run `31586515516` recorded stale automated = 0, direct stale = 0, trusted = 1.

### Real release update transition

`tests/e2e-update.mjs` stages the exact PR base and keeps dormant and active pages alive while the unpacked extension path is replaced by the candidate.

It proves:

- previous/current versions come from their manifests;
- no page reload;
- a dormant old Probe can hand into current tiers;
- an already-active old Engine context can remain simultaneously observable with a current context;
- execution-context ID, not version text, is the primary world identity;
- current generation protection is installed before post-update behavior;
- routine current-generation agreement → exactly one click;
- mixed-state stale behavior → zero click;
- trusted one-event local delegation → exactly one delegated click;
- external ARIA-IDREF stale semantics → zero;
- non-English stale semantics → zero;
- wide causal wrapper → zero;
- ambiguous wrapper → zero;
- proceed action inside label → zero.

For PR #26 this is a real **v10.0.0 → v11.0.0** transition. Run `31586515516` observed both full v10 and full v11 isolated worlds at the same time without reloading either active or dormant page.

## Bounded-work policy

Every correctness-relevant queue has two simultaneous obligations:

1. hard representation bounds protect CPU/memory and avoid strong retention of detached DOM;
2. connected semantic final state cannot disappear merely because a queue is full or old.

Evidence-backed current policies are:

- Probe excess deep roots → weak final-state recovery;
- Gate deep → old FIFO cursor before new excess recovery;
- Gate batch → weak live-owner recovery;
- connected Gate work → age refresh, not TTL deletion;
- Engine RootBatch overflow → bounded final-state convergence;
- connected RootBatch → age refresh, not TTL deletion;
- Engine walk → old FIFO + `walkRecoveryRef` for new excess roots;
- connected sibling batch → preserve current range/subjob across age;
- broad Shadow → old FIFO + `shadowRecoveryRef` for new excess roots.

A drop is valid only when work is complete, dead/disconnected, generation-obsolete/superseded, or another bounded representation is already authoritative. Increasing a cap, shortening an adversarial fixture, increasing a progress timeout to mask loss, or replacing recovery with an unbounded synchronous document scan is not an equivalent repair.

## Worker and profile lifecycle policy

MV3 Worker globals are transient. Tests assume the Worker can disappear between events.

Persistent correctness state belongs in `chrome.storage`; transient injection queues are safe to lose only because content-side handoff is replayable. Update rehydration persists a session marker and requires protection before bootstrap.

Profile governance remains independently gated:

- 256 origins;
- 8 flows/origin;
- 180-day TTL;
- 32-entry hot LRU;
- session + local storage;
- fingerprint + exact locator identity;
- precise invalidation;
- serialized writes;
- persistence failures propagate.

## Update/authority policy

An update has four independent obligations:

1. **presence** — current lease/shared semantics/guard/Engine are where expected;
2. **historical protection** — old non-cooperative behavior cannot act through current controls;
3. **cooperative revocation** — a generation that later becomes stale loses its own isolated-world click primitive;
4. **compatibility without authority leakage** — trusted input and legitimate one-event local delegation still work.

Local causal authority is tied to one exact source `Event` and one exact delegated control. `sourceEvent.eventPhase != Event.NONE` is the dispatch-liveness boundary; bubble cleanup is not the security boundary. No timer lease is allowed.

## Packaging policy

`extension/` is the canonical load-unpacked production root. A release ZIP must include the manifest/runtime README and every production JavaScript module present there.

Package integrity that can remain green while omitting a new runtime dependency is a false gate; v10 discovered that exact failure mode, and v11 retains derived runtime-closure verification.

## Performance evidence

`--profile` writes `artifacts/e2e-profile.json`. Performance numbers are used for regression prioritization, not treated as cross-machine microbenchmarks.

The first fully clean v11 release candidate on Chrome for Testing 149.0.7827.22 recorded:

```text
latencyMs:    200.9
taskDuration: 0.1945 s
samples:      168
```

The broad release ceilings remain `<1000 ms` latency and `<0.8 s` TaskDuration.

## Release closure

A formal release PR is mergeable only after:

1. coherent version/package contracts pass;
2. the exact documentation-complete head passes both canonical jobs;
3. the entire unpacked-E2E job is rerun on that **same exact SHA** and passes again;
4. diff hygiene confirms no temporary write-enabled migration workflow, trigger, or research artifact remains;
5. the PR uses expected-head merge protection so a moved head cannot be merged on stale evidence.
