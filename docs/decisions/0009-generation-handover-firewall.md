# ADR 0009 — Extension updates require a generation handover firewall

**Status:** Accepted

**Date:** 2026-08-08

## Context

Real unpacked Chrome testing of the v8→v9 transition disproved a critical assumption: replacing an unpacked Manifest V3 extension does not guarantee that an already-running old isolated-world Engine becomes inert before a new Engine world appears in the same, non-reloaded page.

The first expanded update test observed both v8 and v9 Engine sentinels. A behavior discriminator then inserted `aria-checked="mixed"`, which v8 interpreted as explicit false while v9 refuses as tri-state ambiguity. The old v8 world produced two clicks after update—its first click plus verifier retry—proving that the old world was still executable and still held click authority.

A version sentinel is therefore not a lease, and the existence of a new Worker/Engine does not by itself revoke an older content-script world's authority.

## Decision

Every surviving frame rehydrated after an extension update receives `handover-guard.js` before `bootstrap.js`, at elevated injection-scheduler priority.

The handover guard installs a capture-phase click firewall in the new isolated world:

- trusted user clicks always pass;
- synthetic clicks that are not agreement-like are outside the firewall;
- agreement-like synthetic clicks are canceled unless the current Engine synchronously grants a one-shot authorization for the clicked DOM target/ancestor chain;
- authorization state is a new-generation `WeakSet`, so an older isolated world cannot forge or reuse it;
- current Engine authorizes immediately before both its first `.click()` and its bounded verifier retry.

The guard's semantic inspection is local and bounded. It does not scan the whole page, use a network service, or add permissions.

## Why this mechanism

### Rejected: assume Chrome destroys the old isolated world

Real Chrome falsified this assumption. Both generations remained observable, and the v8 world still executed two mixed-state clicks.

### Rejected: use version sentinels as authority

Sentinels only describe globals in an execution context. They do not prove that another execution context is dead, paused, or unable to click.

### Rejected: force-reload every existing tab on extension update

A reload would establish a clean generation boundary, but it can destroy user form state, navigation state, media state and other unrelated work across every open tab. That cost is disproportionate when a narrower action firewall can revoke the relevant stale authority.

### Rejected: synthesize `freeze`, `pagehide`, or similar lifecycle events

Old Auto Agree tiers listen to lifecycle events, so fake lifecycle events could pause them. However those events are shared with the web application and could trigger application cleanup, persistence, analytics or navigation behavior. Faking browser lifecycle is not an acceptable isolation primitive.

### Rejected: let both Engines run and rely on idempotence

Checkbox/toggle actions are not generally idempotent. The failed mixed-state discriminator produced two clicks and directly demonstrated the hazard.

## Verification requirement

The release gate must use a real unpacked extension and keep the original page loaded across the v8→v9 replacement.

For an already-active old Engine page, the gate must prove all of the following:

1. v8 Engine was active before update;
2. v9 handover guard is physically present after update;
3. a routine mandatory agreement receives exactly one click;
4. a mixed-state agreement that v8 would click receives exactly zero clicks;
5. page main-world state survives, proving the page was not reloaded;
6. isolated-world diagnostics are recorded so coexistence cannot be hidden by a single sentinel.

## Boundaries

The v8→v9 transition is not atomic. v8 did not contain a resident generation lease that a future version could revoke synchronously, so there is a finite interval between extension replacement and successful v9 guard injection into each surviving frame. Eliminating that historical transition window entirely would require either cooperation implemented in the prior generation or a page navigation/reload.

The firewall revokes Auto Agree's consequential stale authority—untrusted agreement-like clicks. It is not presented as a generic sandbox for arbitrary historical code side effects.