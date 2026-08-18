# Testing

## Release philosophy

A green narrow test proves only its own invariant. The current 12.2 policy keeps deterministic policy/resource proofs, activation recall, downstream browser behavior, release-transition authority, paired performance and merge authorization as separate evidence classes.

Every formal release candidate has three canonical evidence lanes:

1. **core** — auto-discovered deterministic gates + TypeScript + deterministic package verification;
2. **unpacked-e2e** — real Chrome with the actual unpacked MV3 extension;
3. **performance** — interleaved exact-base/exact-head real-unpacked samples across five product workloads.

The exact final release head must pass all three and then pass a same-SHA rerun. GitHub Actions normally replays these commands, but a hosted-runner billing or capacity outage is not a product failure: a recorded local run on a supported Chrome host is valid evidence when it includes the exact SHA and tool/browser identities. Ubuntu is an execution host, not an AutoAgree product platform. Merge authorization remains separate and must use an expected-head compare-and-swap; repository protection is preferred when the hosting plan supports it.

A second rule is explicit in v12.2: **downstream Engine correctness does not prove Probe activation recall**. A browser corpus that creates Engine before mounting a candidate cannot establish that the normal always-present Probe would ever load that Engine on the same structure.

## 1. Deterministic/core gate

`npm test` delegates registration to `tests/run-core.mjs` rather than a hand-maintained `package.json` list. The runner:

- enumerates root `tests/*.mjs` files;
- excludes itself and `e2e-*` browser tests;
- sorts names deterministically;
- runs every gate in a fresh Node process;
- fails fast on the first non-zero exit.

`tests/core-runner-contract.mjs` tests the registration mechanism itself. This was added after audit proved `tests/classless-decision.mjs` existed but was omitted from the old manual test command; prior `npm test` green runs therefore did not execute its 6,000-case property gate.

The current deterministic suite auto-discovers **29 gates**. Representative executable evidence includes:

- `action-authority.mjs` — ordering/fail-closed protocol for current lease → Guard authorization → one click attempt;
- `classless-decision.mjs` — **6,000** shrinkable classless policy differential/safety cases;
- `closeout-governance.mjs` — executable release policy, including the 20-lane × 2-attempt requirement and permanent activation-recall lane;
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

Current release coherence is defined as:

- manifest version = package version = package-lock top-level version = package-lock root-package version;
- RuntimeKernel contains exactly one isolated-world birth-generation literal and it equals the release generation;
- every other isolated production module derives `KERNEL.version` and carries no independent production semver literal;
- Worker derives current generation from `chrome.runtime.getManifest().version`;
- current-generation RuntimeKernel tests derive the manifest version instead of hardcoding a release number.

The failed first v12 cut (#52) is permanent negative evidence: it changed RuntimeKernel to 12.0.0 and exposed a stale `assert.equal(kernel.version, '11.0.0')`. #54 repaired the test and strengthened the version contract before the release cut was retried. v12.2 advances the physical generation because its Probe behavior changes; keeping 12.1 would allow a surviving behaviorally different isolated world to look current.

### Deterministic packaging

`python tools/package_extension.py --check` derives the runtime JavaScript archive closure from current `extension/*.js` rather than a second manual package list, creates `ZIP_STORED` entries with canonical UTF-8/LF content and a fixed Unix creator-system field so neither zlib, checkout line endings nor the host OS can change release identity, and compares the result to the machine authority in `release/package-manifest.json`. The current physical closure is:

```text
AutoAgree-v12.2.0.zip
sha256=0f0d4b5e2991546e2c0217a04b692d9e1141f4c734afaa55390a82db7be264dd
compression=stored
textEncoding=utf-8
textLineEndings=lf
entryCreatorSystem=unix
```

The package boundary normalizes every declared text member to UTF-8/LF before hashing, so Git's Windows CRLF and Linux LF materializations cannot create different release bytes. `tests/package-reproducibility.mjs` repeats the build in two independent Python processes and requires byte equality plus the authority hash. Earlier package identities remain historical evidence only.

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

This corpus still matters, but its seed intentionally activates Engine before most structural cases are mounted. It therefore proves downstream classification/action behavior, not the normal Probe→Gate activation path.

### Probe → Gate activation recall

`tests/e2e-activation-recall.mjs` is the independent v12.2 activation discriminator. It runs the real unpacked extension from document start and requires **observable DOM results plus Gate/Engine reachability**.

Positive cases require `checked=true` for:

1. deeply nested legal text/control joined by an explicit native `<label>` relation;
2. a legal text node longer than the former 900-character direct cutoff, processed through bounded head/center/tail sampling;
3. a late SPA `aria-labelledby` relation whose legal text is otherwise geometrically remote;
4. a custom non-form/non-dialog access shell after a trusted proceed-like `Continue` interaction.

The negative case contains geometrically remote Terms text and a semantically neutral required `#generic-box` with no label/ARIA relation and no proceed interaction; it must remain `checked=false`.

The negative deliberately does **not** use `id="agree"`: an earlier draft did, and that was rejected because the ID itself is semantic evidence rather than a pure geometry test.

The Probe repair keeps fixed limits:

- explicit native-label ancestry: at most 8 ancestors;
- generic text/control geometry: existing shallow 3-ancestor bound;
- proceed-intent ancestry: at most 6 ancestors;
- existing fixed node/time scan budgets;
- bounded string sampling rather than whole pathological strings.

This restores recall without granting generic deep geometry a new path to consent authority. Gate, DecisionKernel, Risk Core, Engine, Handover Guard and ActionAuthority remain unchanged by v12.2.

### Probe/Gate bounded-work pressure

`tests/e2e-tier-overflow.mjs` requires eventual exactly-once progress while preserving hard caps for Probe deep work, Gate deep work and Gate large mutation batches. Gate-deep pressure is repeated across five independent pages so one favorable scheduler interleaving cannot stand in for correctness.

`e2e-probe-live-ttl.mjs` and `e2e-gate-live-ttl.mjs` deliberately stall the renderer beyond tier age thresholds and require connected work to continue rather than be deleted merely because time passed.

### Engine bounded-work pressure/lifetime

Permanent discriminators include:

- walk overflow: 20 roots × 900 nodes with `MAX_WALK_JOBS = 12`;
- candidate-index recovery beyond the 96-entry cap, converging once per context epoch;
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

Canonical historical v12 literal:

```text
attempts=1
engineBlocked={checked:false,clicks:0}
syntheticCalls=1
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

The test derives the current generation and therefore applies unchanged to 12.2 → future-generation revocation.

### Real release transition

`e2e-update.mjs` stages the exact PR base from Git and replaces the same unpacked extension path while dormant and active pages remain live. Previous/current versions come from their manifests; execution-context ID is the primary old/new identity.

For v12.2 the release gate must physically prove **12.1.0 → 12.2.0** without page reload, with historical/current execution contexts simultaneously observable. Current routine behavior remains exactly once; mixed-state, external-IDREF, non-English, wide/ambiguous wrapper and action-inside-label negative paths remain zero-click.

## 3. Paired performance gate

`tests/e2e-performance-paired.mjs` checks out the exact comparison base into a detached temporary worktree and alternates base/candidate order on the same host and Chrome installation. Each variant is sampled five times by the canonical policy. This removes the previous error of comparing a candidate distribution only to a broad fixed ceiling while silently accepting a material relative regression.

The harness first binds both commits' exact `extension/` tree IDs. When those trees are byte-identical, it emits a `NOT_APPLICABLE_IDENTICAL_RUNTIME_TREE` artifact instead of manufacturing a performance comparison between identical runtime bytes. Runtime-changing v12.2 therefore enters the real paired benchmark.

The real unpacked-extension scenario covers:

1. a positive 5,000-checkbox tail-login path;
2. an equivalent negative page after it becomes idle;
3. repeated benign mutation churn;
4. physical background-page quiescence;
5. an eight-tab scheduler burst.

Every workload retains raw samples and candidate absolute ceilings. Median and p90 are also compared with the interleaved base using noise floors, so neither low-denominator noise nor a generous absolute ceiling can independently decide the result. `tests/performance-statistics-contract.mjs` locks exact base/head binding, order alternation, workload coverage, distribution ratios, absolute ceilings and CI invocation.

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
3. the exact documentation-complete head passes core, full real Chrome/update transition and paired performance;
4. those three evidence lanes pass again on the same exact SHA, locally or on a hosted runner;
5. no temporary write-enabled migration/research workflow survives in the release diff;
6. expected-head compare-and-swap confirms the reviewed head did not move;
7. post-merge main passes the applicable gates again.

`release/closeout-policy.json` is the executable lane authority. v12.2 has **20 exact-head lanes × 2 required attempts**, including `activation-recall`. A formal local closeout records two receipts under ignored `artifacts/`, and each receipt binds the exact base, candidate commit/tree, policy hash, package-manifest hash, Node/Python/Chrome/Puppeteer identity, command/output digests and a separately sourced hosted state. `tools/closeout-evidence.mjs verify` rejects a moved head, dirty tracked tree, missing lane, changed policy/package authority or any failed attempt. Its merge mode additionally reads the live PR head, passes the verified SHA to GitHub's expected-head merge option, then confirms the remote PR is merged, remote main points to that merge commit, the merge tree equals the verified candidate tree and the unchanged head ref is absent.

The version report may cite stable product/package facts, while exact final-head hosted run IDs remain authoritative in the final PR metadata when embedding generated run IDs into tracked documentation would itself move the candidate SHA.
