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
- current Engine authorizes immediately before both its first `.click()` and its bounded verifier retry;
- a direct Engine authorization that produces no click event is revoked at the next microtask checkpoint;
- when either a trusted user event or a current-authorized Engine click enters a small local checkbox wrapper, the guard may grant **one descendant synthetic click only for that same DOM event propagation**. A bubble-phase listener revokes the local lease before later MutationObserver work. Broad form/dialog/page containers are never local lease roots.

The last rule preserves common custom-control behavior where a real wrapper click or current Engine click enters page code that synchronously delegates to a hidden/native descendant with `.click()`. It does not turn a Login-button interaction into authority for a sibling Terms row.

The guard's semantic inspection is local and bounded. It does not scan the whole page, use a network service, or add permissions.

## Why event-propagation leases instead of timers

An attempted microtask-only local lease failed in real Chrome. Extension capture listeners and MAIN-world page handlers can cross an isolated-world microtask checkpoint during the same DOM event, so the lease disappeared before the page's wrapper handler could synchronously call its delegated `input.click()`.

Extending that lease with a timer would fix compatibility but create an unnecessarily large authorization window that could survive into later stale-generation work. The accepted design instead scopes the causal exception to event propagation itself: capture grants, nested page delegation may consume once, bubble revokes. No `setTimeout` authorization window exists.

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
3. a routine mandatory agreement receives exactly one current-authorized click;
4. a mixed-state agreement that v8 would click receives exactly zero clicks;
5. a genuine trusted click on a small local custom wrapper may still synchronously delegate exactly one page-owned synthetic descendant click;
6. page main-world state survives, proving the page was not reloaded;
7. isolated-world diagnostics are recorded so coexistence cannot be hidden by a single sentinel.

## Boundaries

The v8→v9 transition is not atomic. v8 did not contain a resident generation lease that a future version could revoke synchronously, so there is a finite interval between extension replacement and successful v9 guard injection into each surviving frame. Eliminating that historical transition window entirely would require either cooperation implemented in the prior generation or a page navigation/reload.

The firewall revokes Auto Agree's consequential stale authority—untrusted agreement-like clicks. It is not presented as a generic sandbox for arbitrary historical code side effects.