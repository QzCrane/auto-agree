# Auto Agree v12 architecture convergence master plan

Status: active execution plan

Base: v11.0.0 `main@355f865a68a54e0de416feddcc454fa21d9939e8`

## Goal

v12 is a behavior-preserving architecture and engineering-system convergence release. It is not a reason to widen automation authority. The target is to reduce duplicated state machines, duplicated semantic authority, test harness reinvention, release friction, and performance ambiguity while preserving or strengthening every v11 browser-level invariant.

The end state is:

```text
Chrome platform adapters
        ↓
bounded work / lifecycle kernel
        ↓
evidence extraction → Evidence IR
        ↓
pure decision kernel
        ↓
action authority
        ↓
verified DOM effect

Worker adapters
        ↓
injection scheduler + persistence/profile kernel
```

Production remains auditable JavaScript unless a later isolated change proves that emitted TypeScript build artifacts deliver more value than the direct-source runtime. TypeScript 7 is initially adopted as a **no-emit checker for JavaScript**.

## Non-negotiable release constraints

1. v11 behavior is the safety baseline; no v12 refactor may weaken an existing permanent gate.
2. No queue/resource cap may be raised to make correctness tests pass.
3. No timeout/fixture/repetition may be weakened to make a scheduling test pass.
4. No unbounded synchronous full-document scan may replace bounded recovery.
5. No detached DOM may become strongly owned across scheduling boundaries without an explicit bounded lifetime proof.
6. Cache/profile data is acceleration only, never click authority.
7. Risk evidence may suppress authority; it may never create authority.
8. Current-generation action authority and historical-generation compatibility remain separate mechanisms.
9. Real Chrome remains authoritative for extension lifecycle, isolated-world, scheduler, Shadow DOM, event-dispatch and update-transition behavior.
10. Performance claims require a named benchmark and comparable environment; single-run cross-version numbers are not universal speed claims.

## Workstream A — zero-build typed JavaScript

### A1. TypeScript 7 checker

- add pinned TypeScript 7 development dependency;
- add `tsconfig.json` with `allowJs`, `checkJs`, `noEmit`, DOM/WebWorker libs and strictness staged by file set;
- keep `extension/*.js` as the exact load-unpacked production root;
- no `dist/`, transpilation, source-map or bundling requirement for the extension;
- run the native TypeScript 7 checker in deterministic CI.

### A2. Type the authority boundaries first

Add JSDoc typedefs/discriminated unions for:

- lifecycle generation state;
- bounded-work state;
- worker injection job and result;
- Evidence IR;
- consent severity/decision;
- control-state observation;
- handover/action authorization;
- profile schema and locator identity.

Do not add annotation noise to trivial locals when inference is sufficient.

### A3. Invalid states become unrepresentable

Replace implicit boolean combinations such as `started + cursorRef + recoveryRef` with explicit tagged state models where practical. In particular, a state equivalent to `started=true` with no processed cursor must not be representable by the shared work abstraction.

## Workstream B — dependency and tool leverage

### B1. Reproducible development dependencies

Move CI-only ad-hoc tool installation into pinned devDependencies + lockfile:

- TypeScript 7;
- Puppeteer (the existing pinned browser harness version until a separately verified upgrade);
- `@types/chrome` for extension API checking;
- `fast-check` for property/model-based testing.

Use `npm ci` in CI and cache npm plus Puppeteer's browser cache by lockfile/browser version.

### B2. Property-based testing

Migrate hand-written random generation where it improves diagnosis to `fast-check`:

- semantic/risk compositional properties;
- fragmentation properties;
- Evidence IR invariants;
- bounded-work state-machine/model tests;
- scheduler model tests where pure simulation is authoritative.

Require recorded seed/path for failures and use shrinking to produce minimal counterexamples.

Keep fixed regression fixtures after a discovered bug; property testing supplements rather than replaces them.

### B3. Do not outsource proven product authority blindly

Evaluate a dependency only when it replaces a generic mechanism with lower total complexity. Do **not** replace project-specific scheduling, Chrome authority, bounded DOM traversal or consent policy merely because a generic library exists. A dependency must have a documented owner, version policy, bundle/runtime cost and removal boundary.

## Workstream C — Bounded Work Kernel

### C1. One formal vocabulary

Define one shared model for:

- capacity;
- admission;
- FIFO ordering;
- weak owner/root/cursor;
- overflow recovery;
- liveness age;
- lifecycle generation;
- supersession;
- completion/death reason;
- background-work visibility.

### C2. Evidence-preserving recovery

The kernel must encode the v11 invariant:

```text
bounded representation != permission to forget live semantic final state
```

Retirement is valid only for explicit reasons: complete, dead/disconnected, lifecycle/generation obsolete, superseded by an authoritative bounded representation, or policy-invalid.

### C3. Migrate proven queue families

Move behavior-preservingly, one independently verified family at a time:

- Probe deep;
- Gate batch;
- Gate deep;
- Engine RootBatch;
- Engine walk;
- Engine mutation/sibling batch;
- Engine broad Shadow.

The shared kernel must not force all queues to have identical mechanics where their ownership or authority differs. It centralizes invariants and state transitions, not domain-specific DOM traversal.

### C4. Eliminate duplicated lifetime code

Centralize liveness/TTL semantics so `age` is metadata, not implicit obsolescence authority. Preserve existing TTL constants unless profiling justifies a separate change.

## Workstream D — Evidence IR and pure Decision Kernel

### D1. Separate extraction from policy

Introduce an explicit `EvidenceIR` containing bounded facts only, for example:

- control kind/state/confidence;
- legal/assent/required facts;
- auth/proceed/gating facts;
- link/IDREF/native-label relationships;
- optional/consequential/attestation/risk facts;
- transaction context;
- provenance and bounded-strength metadata.

DOM nodes and browser objects must not enter the pure decision kernel.

### D2. One policy authority

The pure decision kernel maps `EvidenceIR → Decision` and owns the severity lattice/automation eligibility. Gate remains an activation gate, not a second final policy engine.

### D3. Declarative semantic/risk data

Where profiling shows no regression, separate language/pattern data from control flow so:

- routine-language support and risk-language parity can be statically paired;
- duplicate/missing language families are machine-detectable;
- one pattern source cannot drift between Gate/Engine/guard.

Do not replace native regex with a custom trie/Aho-Corasick unless a current profile demonstrates regex/pattern matching is controlling cost.

## Workstream E — Chrome platform adapters and action authority

### E1. DOM/ARIA/Shadow adapters

Isolate browser-specific extraction primitives:

- bounded text/name resolution;
- native/external labels;
- ARIA IDREF;
- open/closed Shadow access;
- composed/slot relationships;
- visibility/hit-target fallback.

The adapter returns bounded facts; it does not decide consent.

### E2. Action Authority module

Give one explicit layer responsibility for:

- current-generation direct authorization;
- historical-generation firewall;
- exact source-event causal delegation;
- cooperative generation lease;
- final click verification/result semantics.

Presence/version sentinels are diagnostics, never authority.

### E3. Generation authority

Replace manual release-string editing as much as possible with a single release-generation source plus generated/checked runtime constants while preserving the key stale-world property: each execution world must retain the generation it was born with and compare that against the current manifest/runtime.

## Workstream F — lifecycle and scheduler convergence

### F1. Lifecycle ownership

Centralize lifecycle generation semantics shared by Probe/Gate/Engine:

- active/hidden/frozen/BFCache transitions;
- observer/listener ownership;
- stale callback invalidation;
- recovery clearing/reacquisition.

### F2. Worker scheduler

Keep the project-specific semantics but model them explicitly:

- max 4 global;
- max 2/tab;
- queue 64;
- Engine/Gate/update priorities;
- bounded aging;
- tab fairness;
- stale eviction;
- safe priority preemption.

Create a pure scheduling model and compare runtime scheduler decisions against it under generated workloads.

## Workstream G — profile/persistence boundary

### G1. Schema

Type and validate profile/locator/descriptor shape at the worker boundary without weakening existing explicit hard limits.

### G2. Single identity rule

Flow identity remains fingerprint + exact locator. Origin is derived from Chrome MessageSender, not content input.

### G3. Storage governance

Keep and machine-lock:

- 256 origins;
- 8 flows/origin;
- 180-day TTL;
- 32 hot entries;
- session + local storage;
- serialized writes;
- persistence errors propagate.

## Workstream H — performance engineering

### H1. Canonical machine-readable performance ledger

Add a committed schema/data file whose rows contain at least:

- benchmark ID/version;
- product version/commit;
- harness revision/hash;
- Chrome/Node/runner identity;
- fixture dimensions/hash;
- repetitions;
- median/p95/min/max where available;
- wall latency;
- TaskDuration;
- CPU sample count/hot functions;
- DOM/memory observations where relevant;
- evidence class (`historical`, `same-harness replay`, `release`, `main`).

Do not silently mix v3–v7 synthetic in-page numbers with v8+ real-unpacked-extension numbers.

### H2. Canonical benchmark suite

Maintain stable benchmark IDs for:

- cold unrelated page startup;
- 5,000-checkbox tail login;
- large mutation storm;
- semantic attribute storm visible vs hidden;
- closed Shadow pressure;
- scheduler/injection burst;
- lifecycle freeze/resume;
- memory/detached-DOM churn;
- pathological large strings.

### H3. Profile-guided optimization only

Optimize controlling costs visible in current profiles. Candidate areas to re-measure after architecture convergence:

- Shadow probing;
- fragmented agreement recovery;
- bounded traversal/cursor movement;
- Gate text flags;
- risk severity evaluation;
- mutation scheduling.

No speculative custom parser/trie/router without evidence.

### H4. Regression statistics

Use repeated samples and noise-aware thresholds for performance. Keep broad hard safety ceilings, but record medians/p95 so a sustained 15–20% regression can be detected without making CI flaky.

## Workstream I — CI/developer-loop optimization

- commit a lockfile;
- use `npm ci`;
- cache npm and Puppeteer Chrome download;
- split fast deterministic checks from browser gates while keeping both required;
- run typecheck/property/static/package checks in parallel where safe;
- retain exact-head PR gate;
- retain same-SHA rerun policy for scheduling-sensitive refactors;
- keep PR-base update transition PR-scoped;
- prevent temporary write-enabled migration/artifact workflows from surviving final diff;
- add a repository hygiene check for temporary artifacts/branches/files that are representable in-tree.

## Workstream J — repository and code organization

- one canonical production root;
- no duplicate historical executable source;
- no duplicate semantic/policy tables without a declared generated source;
- no magic release constants in tests;
- ADR for every cross-cutting authority/resource invariant;
- verification reports contain evidence, not executable policy;
- delete research branches after durable evidence is merged;
- keep `main` continuously releasable.

## Execution order

1. **Foundation:** typed-JS/no-emit TS7, pinned devDependencies/lockfile, `npm ci`, performance ledger schema, property-test framework.
2. **Model extraction:** tagged bounded-work/lifecycle/decision types and pure reference models without changing runtime behavior.
3. **BoundedWorkKernel:** migrate queue families one by one behind the existing real-browser saturation/TTL gates.
4. **EvidenceIR + DecisionKernel:** extract pure policy and migrate semantic/risk property tests.
5. **Lifecycle/Authority/Scheduler/Persistence convergence:** centralize cross-cutting state ownership while retaining browser-specific adapters.
6. **Performance pass:** replay canonical benchmarks, profile, optimize only measured hotspots.
7. **Release cut:** version coherence, v11→v12 real update, v12→v13 generation probe, exact-head full CI + same-SHA browser rerun, repository cleanup.

## Completion definition

v12 architecture convergence is complete only when:

- every item above is either implemented and gated or explicitly rejected with current measurement/evidence;
- all v11 permanent browser gates remain green;
- new abstraction/model tests prove shared invariants;
- production runtime remains permission-neutral unless a separately approved product change exists;
- performance ledger shows no unexplained controlling regression;
- final repository has no temporary transport/migration code and no open research branches.
