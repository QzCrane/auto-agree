# ADR 0011 — Local delegated authority follows a live source Event, not bubble cleanup

**Status:** Accepted

**Date:** 2026-08-09

## Context

ADR 0009 introduced a narrowly scoped exception for real custom controls whose trusted/current-authorized wrapper handler synchronously delegates to a descendant with `input.click()`. v10 tightened that exception to a small, unique local control wrapper and documented the lease as lasting only for the same DOM event propagation.

The implementation, however, still represented the delegated target in a `WeakSet` and relied primarily on a window **bubble-phase** listener to remove the token. That was not equivalent to the stated invariant.

A page is allowed to call:

```js
wrapper.addEventListener('click', event => {
  event.stopPropagation();
  setTimeout(() => input.click(), 40);
});
```

The trusted source event reaches Auto Agree's capture listener, so the old guard minted the local token. `stopPropagation()` then prevents the window bubble cleanup from running. The later task could consume the leaked token and its synthetic agreement click was incorrectly treated as if it were still part of the original user action.

A real unpacked-Chrome red test reproduced the defect exactly:

```text
expected async delegated control: checked=false, clicks=0
v10 before fix:                  checked=true,  clicks=1
```

The synchronous control in the same fixture still behaved correctly, proving the failure was authorization lifetime rather than generic wrapper detection.

## Decision

Local causal authority is represented as:

```text
WeakMap<delegated control, exact source Event>
```

A nested synthetic click is authorized only if the mapped source event is **still being dispatched by the browser**:

```text
source.eventPhase != Event.NONE
```

When dispatch is complete, `eventPhase` returns `NONE`; a later task therefore cannot reuse the earlier trusted event even if normal propagation was stopped and bubble cleanup never ran.

The delegated authorization remains one-shot: the first valid synchronous descendant use consumes it.

The existing bubble listener remains as an eager cleanup path for the ordinary case, but correctness no longer depends on bubble propagation reaching it.

## Why this is stronger than timing

The boundary is not a millisecond window, task age or arbitrary timeout. It is the browser's own dispatch state for the exact authorizing Event object.

This preserves legitimate synchronous page behavior:

```text
trusted wrapper click
  -> page handler calls stopPropagation()
  -> page handler synchronously calls input.click()
  -> source Event is still in dispatch
  -> exactly one delegated click is allowed
```

while rejecting:

```text
trusted wrapper click
  -> stopPropagation()
  -> dispatch ends
  -> later task/microtask attempts input.click()
  -> source Event is no longer active
  -> no causal authority
```

The real regression fixture specifically proves a later-task attempt; authority is no longer defined by whether a cleanup callback happened to execute.

## Rejected alternatives

### Bubble cleanup as correctness authority

Rejected because propagation is page-controlled. `stopPropagation()` and `stopImmediatePropagation()` can prevent the cleanup listener from being reached.

### Timer-based lease expiry

Rejected because a time interval is not the causal relation being modeled. It either grants authority too long or risks revoking legitimate synchronous work based on scheduler timing.

### Microtask expiry as the sole boundary

Rejected because extension/page worlds may cross microtask checkpoints during one browser event dispatch. Earlier handover testing already showed that a microtask is not a reliable synonym for "all page handlers for this event have finished".

### Permanent trusted-control cache

Rejected because historical user interaction must not become future click authority.

## Verification requirement

Real Chrome E2E must contain both variants on agreement-like controls that Auto Agree itself will not auto-confirm:

1. trusted wrapper + `stopPropagation()` + **synchronous** descendant `click()` -> exactly one click;
2. trusted wrapper + `stopPropagation()` + **later-task** descendant `click()` -> zero clicks.

The static contract must require an exact source-Event mapping and an `Event.eventPhase` liveness check.

## Boundary

This ADR governs the narrow handover compatibility exception for page-owned synchronous delegation. It does not authorize arbitrary page scripts, broad form regions, multiple descendant controls, proceed actions, or future asynchronous work merely because the user interacted with the page earlier.
