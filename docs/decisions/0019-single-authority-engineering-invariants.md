# ADR 0019 — Single-authority engineering invariants

Status: accepted for v12 convergence

## Context

v8–v11 real-browser adversarial testing repeatedly showed that local green behavior can coexist with repository-wide regressions. The same invariant family also appeared in multiple implementations: bounded queue pressure, live-work TTL, lifecycle ownership, generation authority, semantic/risk language parity and release-version coherence.

A sequence of isolated fixes is appropriate while the actual failure class is unknown. Once repeated evidence proves one cross-cutting invariant, continuing to let every tier reinterpret that invariant independently increases defect and verification cost.

## Decision

Cross-cutting correctness/resource principles have **one canonical authority**. Domain-specific code may adapt the authority to its own DOM or Worker operation, but it may not redefine the invariant.

### 1. Safety dominates convenience

Auto Agree minimizes routine access friction subject to the stricter condition that meaningful optional, financial, factual, medical, biometric, rights-affecting or other consequential decisions remain user-owned.

False-positive authority is more expensive than a false negative. Unknown/ambiguous evidence fails closed.

### 2. Evidence creates decisions; cache never creates authority

Live bounded evidence is the source of consent decisions. Cached profile/locator data may accelerate discovery but cannot manufacture legal, assent, risk, state or click authority.

### 3. Risk can only remove authority

Risk/optional/consequential/attestation evidence may raise severity or suppress automation. It cannot create legal/assent evidence or grant an action.

### 4. One semantic/policy source

The same concept must not be maintained as divergent private vocabularies in Gate, Engine, guard or tests. Shared semantics/policy should have one canonical source or a generated derivative whose provenance is machine-checkable.

### 5. Bounded representation is not permission to forget live work

Queue/object/memory caps are hard. Correctness-relevant final live state must remain recoverable under those caps.

A work representation may retire only for an explicit reason:

- complete;
- dead/disconnected;
- lifecycle/generation obsolete;
- explicitly superseded by another authoritative bounded representation;
- policy-invalid.

Age by itself is not an obsolescence proof for connected live work.

### 6. Old live FIFO outranks new overflow unless the domain proves otherwise

Where a queue represents unique incremental cursors, already-admitted live work is authoritative. New excess final state is compressed/recovered instead of silently evicting the oldest cursor.

### 7. State transitions must encode reality

A state flag may only advance after the action it claims actually happened. A zero-budget slice cannot become “started” if no node was processed. Prefer explicit tagged states over unrelated booleans that can represent impossible combinations.

### 8. Lifecycle owns asynchronous work

Observers, listeners, timers, scheduled callbacks, cursors and recovery state belong to a lifecycle generation. Stale callbacks may self-abort but cannot mutate or clear the current generation’s scheduler state.

### 9. DOM ownership across yields is weak by default

Long-lived/scheduled representations must not strongly retain detached subtrees unless an explicit bounded lifetime and memory proof requires it. TreeWalker/MutationRecord/NodeList objects are not retained across yields when a weak resumable representation is sufficient.

### 10. Browser adapters do not decide policy

DOM/ARIA/Shadow/layout code extracts bounded facts. The consent decision is a pure policy operation over evidence, not an emergent side effect of browser traversal.

### 11. Action authority is explicit and separate from presence

A module/sentinel/version string proves presence only. Current-generation authorization, historical-generation protection, cooperative lease and exact source-event delegation are explicit action authorities and remain behaviorally tested.

### 12. Exact event dispatch is the causal lifetime

Page-owned delegated synthetic control activation is valid only when bound to the exact live source Event dispatch and consumed once. Timer/microtask duration is not a substitute for event authority.

### 13. A generation remembers the generation it was born with

Each execution world needs a compiled/birth generation that can be compared with current extension Runtime/manifest state. Reading only the newest manifest value is not enough to revoke a stale surviving world.

Release version has one source of truth; runtime birth-generation constants are generated or contract-checked derivatives, not independent manual policy.

### 14. Worker memory is ephemeral

MV3 Worker globals are caches/queues only. Durable correctness state belongs in Chrome storage or in replayable content-side protocol. Worker termination is a normal lifecycle event, not an exceptional edge case.

### 15. Persistence errors are errors

A failed durable write cannot be reported as success. Serialization, caps, identity and invalidation rules are part of product correctness and survive unrelated Worker refactors.

### 16. Dependencies replace generic complexity, not proven domain authority

Use mature libraries when they reduce total owned mechanism: property generation/shrinking, compiler/type checking, browser automation, generic schema tooling when justified.

Do not outsource project-specific Chrome authority, consent policy or bounded DOM semantics to a generic abstraction that cannot express the proven invariants without a second shadow state machine.

### 17. No build step without net value

The canonical extension should remain directly inspectable/loadable when possible. TypeScript may type-check JavaScript with no emit. Introducing transpilation/bundling requires a measured or architectural benefit that exceeds source/output duality, sourcemap, package-closure and debugging costs.

### 18. Performance claims require a benchmark identity

Every performance number belongs to a named workload/harness/environment. Historical synthetic and real-unpacked-extension numbers are distinct evidence classes. A single GitHub runner sample cannot establish a universal percentage speedup/regression.

### 19. Profile before replacing algorithms

Replace native regex, DOM relation resolution, scheduler mechanisms or other algorithms only when current profiling or correctness evidence identifies them as controlling cost/risk. More sophisticated data structures are not automatically better architecture.

### 20. Real Chrome is the authority for browser behavior

Pure/model tests own pure invariants. Real unpacked Chrome owns claims about MV3 Worker death, extension replacement, isolated worlds, closed Shadow extension APIs, event propagation, browser scheduling/layout and trusted input.

Mocks/shims may accelerate development but cannot overrule an observed browser failure.

### 21. Red evidence precedes risky product changes

For ambiguous browser behavior or a suspected defect whose semantics are not already established, build a discriminator first. A code shape that resembles a previous bug is not by itself permission for a product rewrite.

Once a cross-cutting invariant has already been established, refactors may rely on that invariant without reproducing the same red bug independently in every duplicate implementation.

### 22. Preserve invariants across large refactors

A focused test suite being green does not prove unrelated contracts survived. Architecture refactors require repository-wide invariant gates, especially Worker persistence, lifecycle, authority and performance boundaries.

### 23. Temporary migration mechanisms never become product state

Write-enabled migration/artifact workflows, transport files and diagnostic instrumentation are disposable execution infrastructure. Final product diffs must return to permanent least-privilege CI unless the workflow itself is the intended product change.

### 24. Scheduling-sensitive fixes need variance evidence

For failures already demonstrated to depend on scheduling, the exact final SHA must pass its real-browser discriminator and should receive a same-SHA rerun before merge. One favorable interleaving is not proof.

### 25. Release must be atomic

All generation surfaces move together. Tests derive “current” from the release authority rather than hardcoding the previous version. No partially migrated generation is accepted.

### 26. Repository history is the archive

Do not keep obsolete executable source or research branches merely as memory. Durable meaning belongs in ADR/verification records; old bytes belong in Git history. Final `main` should remain continuously releasable and operationally clean.

## Enforcement

These principles are not satisfied by this document alone. v12 work must map each cross-cutting rule to at least one of:

- a type/state model;
- deterministic contract/property/model test;
- real-browser regression gate;
- package/version/performance ledger check;
- repository/CI policy.

If a principle cannot be machine-enforced, its remaining evidence boundary must be explicit.
