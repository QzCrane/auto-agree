# Testing

## Release philosophy

A green narrow test proves only its own invariant. v12 keeps deterministic policy/resource proofs, real headed-browser behavior, release-transition authority, and statistical performance as separate evidence classes.

Every formal release candidate has three canonical evidence lanes:

1. **core** — auto-discovered deterministic gates + TypeScript + deterministic package verification;
2. **unpacked-e2e** — real Chrome with the actual unpacked MV3 extension;
3. **performance** — repeated real-unpacked performance statistics in independent Chrome processes.

The exact final release head must pass all three and then pass a same-SHA rerun. GitHub Actions normally replays these commands, but a hosted-runner billing or capacity outage is not a product failure: a recorded local run on a supported Chrome host is valid evidence when it includes the exact SHA and tool/browser identities. Ubuntu is an execution host, not an AutoAgree product platform. Merge authorization remains separate and must use an expected-head compare-and-swap; repository protection is preferred when the hosting plan supports it.

## 1. Deterministic/core gate

`npm test` delegates registration to `tests/run-core.mjs` rather than a hand-maintained `package.json` list. The runner:

- enumerates root `tests/*.mjs` files;
- excludes itself and `e2e-*` browser tests;
- sorts names deterministically;
- runs every gate in a fresh Node process;
- fails fast on the first non-zero exit.

`tests/core-runner-contract.mjs` tests the registration mechanism itself. This was added after audit proved `tests/classless-decision.mjs` existed but was omitted from the old manual test command; prior `npm test` green runs therefore did not execute its 6,000-case property gate.

The v12 candidate auto-discovered **27 deterministic gates**. Representative executable evidence includes:

- `action-authority.mjs` — ordering/fail-closed protocol for current lease → Guard authorization → one click attempt;
- `classless-decision.mjs` — **6,000** shrinkable classless policy differential/safety cases;
- `decision-core.mjs` — **7,500** shrinkable EvidenceIR/safety cases plus sole-severity-authority enforcement;
- `runtime-kernel.mjs` — deterministic checks + **5,500** generated lifecycle/queue/lifetime sequences;
- `scheduler-core.mjs` — **12,500** differential/property cases;
- `profile-core.mjs` — **8,000** differential/property/schema cases;
- `profile-compat.mjs` — **2,500** compatibility/fail-closed cases;
- `property-consent-model.mjs` — **10,020** focused assertions;
- `property-consent-fast-check.mjs` — **3,500** generated cases;
- `language-parity.mjs` — 23 language families, 253 safety assertions;
- `property-semantic-fragmentation.mjs` — 659 routine + 3,426 risk split-text fragments;
- static lifecycle/bounded-work/Engine-lifetime/Shadow contracts;
- Worker contract/profile-governance/scheduler/restart contracts;
- version/package/performance evidence contracts.

### Version contract

v12 release coherence is defined as:

- manifest version = package version = package-lock top-level version = package-lock root-package version;
- RuntimeKernel contains exactly one isolated-world birth-generation literal and it equals the release generation;
- every other isolated production module derives `KERNEL.version` and carries no independent production semver literal;
- Worker derives current generation from `chrome.runtime.getManifest().version`;
- current-generation RuntimeKernel tests derive the manifest version instead of hardcoding a release number.

The failed first v12 cut (#52) is permanent negative evidence: it changed RuntimeKernel to 12.0.0 and exposed a stale `assert.equal(kernel.version, '11.0.0')`. #54 repaired the test and strengthened the version contract before the release cut was retried.

### Deterministic packaging

`python tools/package_extension.py --check` derives the runtime JavaScript archive closure from current `extension/*.js` rather than a second manual package list. The canonical v12 physical candidate produced:

```text
AutoAgree-v12.0.0.zip
sha256=1cee531a26272160df70909815089a80d1d45814ce3d138d7dd2c2efbc00e859
```

## 2. Real unpacked-extension Chrome gate

CI uses pinned Puppeteer 25.1.0 and Chrome for Testing 149.0.7827.22, launches `extension/` as a real unpacked MV3 extension under Xvfb, and exercises the actual Worker / `chrome.scripting` / isolated-world / update paths.

### Main behavior/profile suite

`tests/e2e-extension.mjs` covers:

- routine login agreement;
- marketing and fragmented consequential negatives;
- TRAE-derived classless visual control;
- native validity causality;
- native/ARIA/data mixed or indeterminate refusal;
- classless UNKNOWN one-shot behavior after the ordinary click cooldown;
- iframe/all-frame injection;
- real closed ShadowRoot access;
- repeated forced MV3 Worker termination before dynamic evidence;
- stopped-propagation causal delegation;
- deterministic structural fuzz;
- the 5,000-unrelated-checkbox tail-login profile workload.

The structural corpus has 300 dynamically mounted cases:

```text
routine  120
blocked   60
already   40
disabled  40
mixed     40

false positives   = 0
false negatives   = 0
duplicate toggles = 0
```

### Probe/Gate bounded-work pressure

`tests/e2e-tier-overflow.mjs` requires eventual exactly-once progress while preserving hard caps for Probe deep work, Gate deep work and Gate large mutation batches. Gate-deep pressure is repeated across five independent pages so one favorable scheduler interleaving cannot stand in for correctness.

`e2e-probe-live-ttl.mjs` and `e2e-gate-live-ttl.mjs` deliberately stall the renderer beyond tier age thresholds and require connected work to continue rather than be deleted merely because time passed.

### Engine bounded-work pressure/lifetime

Permanent discriminators include:

- walk overflow: 20 roots × 900 nodes with `MAX_WALK_JOBS = 12`;
- RootBatch live TTL: 60 roots × 420 descendants, target at root 42, >3 s live stall;
- sibling-range live TTL: one >96-node mutation record, 140 siblings, target at sibling 70, >3 s live stall;
- broad closed-Shadow overflow: 14 roots × 900 nodes with `MAX_SHADOW_JOBS = 8`, unique target inside a closed ShadowRoot on a plain `DIV` host.

These tests reject “fixes” that merely raise caps, extend timeouts or replace recovery with an unbounded document scan.

### Lifecycle ownership

Probe, Gate and Engine each have real-browser hidden/resume tests. While hidden, newly introduced routine evidence must not be acted on. After visibility resumes, the current lifecycle epoch may rediscover and act exactly once. Multiple hide/resume cycles are exercised.

### Classless policy

`e2e-classless-policy.mjs` requires routine classless geometry to click once and risk-bearing classless geometry to remain zero-click. The path must cross DecisionKernel before layout targeting and revalidate observable state before action.

### Three-layer action authority discriminator

`e2e-authorize-rejection.mjs` proves three mechanisms independently in the real Engine isolated world:

1. **ActionAuthority pre-dispatch refusal.** The public Guard API is replaced with `authorize() => false` after the seed. Engine reaches authorization exactly once. The isolated click primitive remains uncalled during that failed ActionAuthority attempt, and DOM state/click count remain zero.
2. **Handover Guard defense in depth.** The test then bypasses Engine/ActionAuthority and directly invokes current-generation isolated-world `.click()`. The primitive is reached, but the original Guard capture listener still cancels the unauthorized agreement-like synthetic event; DOM state remains zero.
3. **Trusted input compatibility.** A subsequent Puppeteer/browser trusted click succeeds exactly once.

Canonical v12 literal:

```text
attempts=1
engineBlocked={checked:false,clicks:0}
syntheticCalls=1  # cumulative after the separate direct-synthetic probe
_guard-blocked DOM_={checked:false,clicks:0}
trusted={checked:true,clicks:1}
```

The test separately asserts the synthetic primitive count was **0 before** the direct probe.

### Cooperative future-generation revocation

`e2e-generation-lease.mjs` is candidate-relative:

1. activate the current Engine/lease;
2. replace the same unpacked path with a manifest-only next-major generation without page reload;
3. retain/evaluate the pre-existing old isolated execution context;
4. require the old lease to report non-current;
5. add new routine evidence and require zero stale automated clicks;
6. invoke `.click()` directly in the stale isolated world and require zero DOM effect;
7. perform trusted browser input and require one click.

For v12 this physically became:

```text
fromVersion=12.0.0
probeVersion=13.0.0
pageReloaded=false
staleLeaseCurrent=false
staleAutomatedClicks=0
directStaleClicks=0
trustedClicks=1
```

### Real release transition

`e2e-update.mjs` stages the exact PR base from Git and replaces the same unpacked extension path while dormant and active pages remain live. Previous/current versions come from their manifests; execution-context ID is the primary old/new identity.

For the physical v12 candidate the exact transition was **11.0.0 → 12.0.0**, with no active/dormant page reload. A full v11 isolated context and a full v12 context were simultaneously observable on the same live page.

Required v12 result:

```text
previousVersion=11.0.0
currentVersion=12.0.0
reportedVersion=12.0.0
dormantPageReloaded=false
activePageReloaded=false
oldContextVisible=true
currentContextVisible=true
activeRoutineClicks=1
activeMixedClicks=0
trustedDelegatedClicks=1
externalIdrefClicks=0
spanishSemanticClicks=0
wideCausalClicks=0
ambiguousCausalClicks=0
actionInsideLabelClicks=0
```

## 3. Statistical performance gate

The functional E2E profile remains a single broad regression sample. v12 additionally runs `tests/e2e-performance-statistics.mjs` in a separate `performance` job.

The wrapper does **not** replace the benchmark. It launches seven fresh Node/Chrome processes and runs the existing `tests/e2e-extension.mjs --profile` workload each time. Every underlying sample still enforces the existing broad ceilings:

```text
latency < 1000 ms
TaskDuration < 0.8 s
```

The wrapper retains all raw samples and reports median, p90 and max for latency, TaskDuration and CPU samples, together with Chrome/Puppeteer/Node metadata. `performance-statistics-contract.mjs` locks the repetition count (at least five; canonical CI uses seven), benchmark identity, fresh-process execution, raw evidence and summary fields.

Canonical v12 candidate first attempt:

| run | latency ms | TaskDuration s | CPU samples |
|---:|---:|---:|---:|
| 1 | 259.1 | 0.2524 | 219 |
| 2 | 215.6 | 0.2085 | 172 |
| 3 | 288.5 | 0.2797 | 251 |
| 4 | 281.1 | 0.2725 | 239 |
| 5 | 202.9 | 0.1957 | 170 |
| 6 | 192.0 | 0.1857 | 159 |
| 7 | 288.0 | 0.2812 | 249 |

Summary:

```text
latency median / p90 / max:       259.1 / 288.2 / 288.5 ms
TaskDuration median / p90 / max:  0.2524 / 0.2803 / 0.2812 s
CPU samples median / p90 / max:   219 / 249.8 / 251
```

Earlier same-code v11-main statistical runs showed materially different hosted-runner regimes (roughly 219 ms versus 277 ms medians), so performance data is used for regression prioritization and repeated-distribution evidence—not treated as a deterministic cross-machine microbenchmark. v12 found no stable hotspot evidence justifying speculative runtime optimization during the release cut.

## Worker/profile/update policy

MV3 Worker globals are transient. Persistent profile correctness state lives in Chrome storage; injection queues can disappear only because content-side handoff/retry and update rehydration are explicitly tested.

ProfileCore independently gates:

- 256 origins;
- 8 flows/origin;
- 180-day TTL;
- 32-entry hot LRU;
- `storage.session` + `storage.local`;
- validated fingerprint + exact locator identity;
- finite/bounded timestamps/counters/descriptors;
- serialized mutations and explicit storage failures.

## Packaging/release closure

A formal release PR is mergeable only after:

1. manifest/package/package-lock/RuntimeKernel coherence passes;
2. all auto-discovered deterministic gates and deterministic packaging pass;
3. the exact documentation-complete head passes core, full real Chrome/update transition and statistical performance;
4. those three evidence lanes pass again on the same exact SHA, locally or on a hosted runner;
5. no temporary write-enabled migration/research workflow survives in the release diff;
6. expected-head compare-and-swap confirms the reviewed head did not move;
7. post-merge main passes the applicable local lanes again; hosted replay is required when available but a documented provider outage is not rewritten as a code failure.

The version report may cite an earlier byte-identical physical candidate for detailed generated evidence; exact final-head run IDs remain authoritative in the final release PR/merge metadata when embedding them in documentation would itself create a new unverified SHA.
