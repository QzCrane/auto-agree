# Auto Agree v10.0.0 — Causal Authority Hardening Addendum

Generated: 2026-08-09

## Why this addendum exists

The initial v10 merge correctly established cooperative generation self-revocation, shared-semantic handover protection, bounded local control discovery, restored profile governance, and complete package/runtime closure. Immediately after merge, a new adversarial audit attacked one sentence in the v10 trust model rather than assuming it was already proved:

> local delegated authority exists only for the same DOM event propagation.

The production implementation still relied on a window bubble listener to remove a `WeakSet` token. Because page code can stop propagation, the stated mechanism and the actual mechanism were not equivalent.

This addendum records the post-merge red test, root cause, fix, and a separate release-harness generalization discovered during closure.

## Red test: stopped propagation leaked authority — reproduced

A new sanitized fixture, `tests/fixtures/regressions/causal-propagation.html`, deliberately uses an agreement-like **marketing** row so current Engine risk rules do not auto-confirm it. That isolates the handover causal exception.

Two wrappers are tested with real trusted Puppeteer clicks:

### Synchronous delegation

```text
trusted click on local wrapper
-> page handler stopPropagation()
-> page handler immediately input.click()
```

Expected: **one** click. This is genuine same-dispatch page-owned delegation.

### Delayed delegation

```text
trusted click on local wrapper
-> page handler stopPropagation()
-> setTimeout(... input.click(), 40)
```

Expected: **zero** clicks. The descendant action occurs in a later task and must not inherit the earlier user event.

Initial real-Chrome run **31272375351** failed exactly on the delayed branch:

```text
expected: { checked: false, clicks: 0 }
actual:   { checked: true,  clicks: 1 }
```

The synchronous branch had already passed before this assertion, ruling out a generic wrapper/semantic failure.

## Root cause

The v10 guard used:

```text
WeakSet<delegated control>
```

and normally removed the control from a window bubble listener. The capture listener minted the token before page handlers ran. A page handler then called `stopPropagation()`, so the window bubble listener was never reached. The token survived until the delayed synthetic click and was consumed as if it were still causally linked to the original trusted event.

The defect therefore existed at the **mechanism** level even though the documentation already described the desired shorter lifetime.

## Fix: exact source Event + browser dispatch liveness

The guard now stores:

```text
WeakMap<delegated control, exact source Event>
```

A nested synthetic click is accepted only while:

```text
sourceEvent.eventPhase != Event.NONE
```

`Event.eventPhase` is the browser's dispatch state. After dispatch finishes it returns `NONE`, regardless of whether bubble propagation reached Auto Agree's cleanup listener.

The first valid nested use consumes the mapping. Normal bubble cleanup remains an eager cleanup optimization, but it is no longer the correctness authority.

## Green real-Chrome verification — PASS

Run **31272558854** executed the fixed fixture in Chrome for Testing **149.0.7827.22**.

`e2e-basic`: **PASS**, including both new causal cases:

```text
stopped propagation + synchronous descendant click -> checked=true,  clicks=1
stopped propagation + later-task descendant click  -> checked=false, clicks=0
```

The same run also passed:

```text
four forced MV3 Worker termination rounds: PASS
cooperative 10→11 generation lease probe:   PASS
core/package gate:                          PASS
```

5,000 unrelated checkbox + tail-login profile in that run:

```text
latencyMs:    274.1
taskDuration: 0.2674 s
CPU samples:  235
```

Both remain comfortably under permanent ceilings (`<1000 ms`, `<0.8 s`). The causal lifetime fix does not appear as a controlling sampled hotspot.

## Release-transition harness debt discovered during closure

The first post-fix run exposed a separate test-engineering defect rather than a production failure: `tests/e2e-update.mjs` still hardcoded the historical `9.0.0 → 10.0.0` pair even though CI already passed the actual PR base SHA through `AUTO_AGREE_PREVIOUS_REF`.

That meant the test architecture claimed to be PR-base driven while one internal assertion still required one historical release pair.

The harness was generalized to derive:

```text
previousVersion = staged PR-base extension/manifest.json
currentVersion  = current extension/manifest.json
```

and to distinguish old/current isolated worlds by **execution-context ID**, not by version string alone.

This matters for both future releases and same-version development/hotfix reloads, where two contexts may legitimately report the same manifest version.

## Generic same-version transition — PASS

After generalization, run **31272558854** successfully tested the current PR base and head, both reporting `10.0.0`, while still distinguishing separate old/new execution contexts:

```text
previousVersion:       10.0.0
currentVersion:        10.0.0
dormantPageReloaded:   false
activePageReloaded:    false
oldContextVisible:     true
currentContextVisible: true
activeRoutineClicks:   1
activeMixedClicks:     0
trustedDelegatedClicks:1
externalIdrefClicks:   0
spanishSemanticClicks: 0
wideCausalClicks:      0
ambiguousCausalClicks: 0
actionInsideLabelClicks: 0
```

The world diagnostic contained two separate isolated execution contexts, both carrying the v10 runtime sentinels, which is exactly why execution-context identity is now the transition authority.

## Deterministic contracts added

`tests/static-contract.mjs` now requires:

- `causalLocal` to be a `WeakMap`, not a timeless token set;
- an exact `control → source Event` association;
- an `Event.eventPhase === Event.NONE` stale-authority rejection path;
- explicit `consumeLiveCausal(...)` verification;
- current/previous transition versions derived from manifests;
- old-world identity retained by execution-context ID;
- no hardcoded historical release pair in the transition harness.

## Updated invariant

The canonical rule is now:

```text
local delegated control authority
=
exact source trusted/current-authorized Event
AND source Event is still in browser dispatch
AND delegated control is unique, local and bounded
AND authority has not already been consumed
```

It is **not**:

```text
bubble cleanup happened successfully
```

and it is not a timer, historical interaction bit, or generic wrapper permission.

## Evidence boundary

The real regression proves a later-task escape is blocked and synchronous same-dispatch delegation remains functional. Event-dispatch liveness is now the mechanism being relied on; future changes to causal delegation must preserve the real-browser two-branch fixture rather than replacing it with timer-based or bubble-only reasoning.
