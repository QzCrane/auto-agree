# Security and trust model

## Security objective

Auto Agree automates only **routine mandatory access consent**. The core safety property is not “find a checkbox”; it is:

> An automated DOM action may occur only when current browser evidence, current-generation policy and current action authority all agree that the control represents routine low-discretion access consent.

Optional, consequential and attestation semantics fail closed. False-positive cost is treated as materially higher than false-negative cost.

## Permission budget

Production permissions are deliberately limited to:

- `scripting`;
- `storage`;
- host access on `<all_urls>`.

No network client, telemetry, remote configuration, remote code, cookies/history inspection, `webRequest`, debugger attachment, downloads, proxy control, clipboard, native messaging or remote model is used.

`<all_urls>` supplies host access for arbitrary-site operation; it is not permission to run the full Engine everywhere. Probe is the default tier and richer code is lazy-injected only after evidence gating.

## Activation-boundary safety

v12.2 makes an important distinction explicit:

```text
permission to inspect more deeply
!=
permission to consent
```

Probe decides only whether Gate/Engine are worth loading. Its activation recall may therefore be broader than final click authority, but it still stays bounded so hostile/irrelevant pages cannot force unbounded work.

The v12.2 repair permits deeper activation only when there is an explicit semantic relation or bounded user intent:

- a native `<label>` relation, bounded to eight ancestors;
- an ARIA relationship such as `aria-labelledby` / `aria-describedby`;
- a trusted proceed-like interaction followed by a bounded six-ancestor local search;
- long text processed through fixed head/center/tail sampling rather than unbounded normalization.

Generic text/control geometry keeps its previous shallow three-ancestor bound. Real Chrome permanently checks the negative case: remote Terms text plus a semantically neutral required checkbox, with no label/ARIA relation and no proceed interaction, stays unchecked.

The Probe repair does not modify Gate, DecisionKernel, Risk Core, Handover Guard or ActionAuthority. More Probe recall can therefore load richer analysis, but it cannot by itself mint automated-action authority. v12.2 separately fixes Engine observation of already-indexed controls whose live checked/required/disabled/ARIA/data state changes; that repair only makes the existing snapshot/policy path run again and does not add a new acceptance or click-authority rule.

## Consequential-consent boundary

Automation is blocked for independent or combined clauses involving marketing, payment/debit authorization, loans/credit, investment/trading authorization, insurance purchase/application, medical informed consent, employment contracts, e-signatures, arbitration/waivers/class actions, biometric/facial-recognition consent, guarantees/powers of attorney, automatic renewal and factual/age/identity attestations.

The boundary is **action-semantic**, not industry-semantic. A bank's ordinary login Terms may still be routine; authorization to debit an account is not.

DecisionKernel is the sole severity lattice/policy owner. Risk Core consumes that lattice and cannot mint a second threshold. Routine language support is paired with same-language suppressor evidence; v12's executable 23-family contract caught and repaired Chinese automatic-renewal semantics that were previously weaker than the multilingual consequential baseline.

## Authority chain

The architecture separates policy, automated-action permission and observable success:

```text
current DOM/accessibility evidence
→ Risk Core severity
→ DecisionKernel acceptance
→ ActionAuthority protocol
→ browser dispatch
→ Engine live verifier
```

A DecisionKernel `accept` result authorizes an **attempt path**, not successful consent. ActionAuthority returning `true` means one authorized click primitive was invoked; it does not mean the control actually changed state. Engine's verifier is the only success observer.

## ActionAuthority boundary

`action-authority.js` is the only Engine automated-click protocol. It accepts only an `HTMLElement` and performs, in order:

1. resolve the current isolated-world Generation Lease;
2. require matching version and `lease.current() === true`;
3. resolve the current Handover Guard;
4. require matching version and `guard.authorize(target) === true`;
5. invoke exactly one `target.click()`.

Missing/mismatched dependency, explicit rejection or exception fails closed.

Dependencies are resolved at attempt time rather than captured once. That matters during extension replacement and is also exercised by the browser rejection discriminator. Static contracts forbid Engine from retaining a private `authorizeHandoverClick()` or direct `target.click()` action protocol.

## Cooperative generation lease

Every current Auto Agree isolated world capable of reaching Gate/Engine work carries `generation-lease.js`. The lease wraps that realm's `HTMLElement.prototype.click` and synchronously checks `chrome.runtime.getManifest().version` against the RuntimeKernel generation immediately before DOM dispatch.

The physical action path therefore checks generation twice:

- ActionAuthority checks `lease.current()` before Guard authorization;
- the patched `.click()` checks again at the primitive, covering an update that occurs after authorization but before dispatch.

If the extension Runtime is invalidated or the manifest generation changed, the old Auto Agree `.click()` becomes a no-op. The page MAIN world is not patched; trusted browser input remains outside this wrapper.

The v12 release gate physically proved **v12.0.0 → v13.0.0** without page reload: old v12 execution remained inspectable, `staleLeaseCurrent=false`, stale automated clicks=0, direct stale isolated `.click()`=0, trusted click=1. v12.2 advances the real production generation rather than shipping different Probe behavior under the old 12.1 identity, so a surviving 12.1 world is also expected to become stale during the release transition.

## Historical-generation handover firewall

Generation Lease cannot retroactively protect historical versions that never shipped it. Handover Guard therefore remains a separate compatibility/security mechanism.

On update rehydration, Worker installs current:

```text
RuntimeKernel → Generation Lease → Semantic Core → DomCore → Handover Guard
```

before it injects Probe into already-open tabs.

The Guard enforces:

- trusted browser clicks pass;
- current Engine automation requires a one-shot consumed authorization;
- unused direct authorization expires at the next microtask checkpoint;
- unauthorized agreement-like historical/current synthetic clicks are canceled;
- trusted-event synchronous delegation is permitted only for one exact delegated control while the exact source `Event` is still in browser dispatch;
- `sourceEvent.eventPhase === Event.NONE` ends causal authority even if page code prevented extension bubble cleanup;
- the first valid nested delegation consumes the mapping;
- broad page/form/section containers and proceed actions cannot mint sibling-control authority;
- ambiguous wrappers containing multiple delegated controls fail closed;
- no timer lease extends authority into later tasks;
- a Guard whose own extension Runtime becomes stale turns passive toward later legitimate generations.

The Guard consumes Semantic Core and DomCore for bounded accessibility/topology handling rather than maintaining a private Terms/assent vocabulary or private composed-tree implementation.

## Three-layer real-browser discriminator

The permanent ActionAuthority test explicitly separates the layers:

1. replace the public Guard API with `authorize() => false`; Engine reaches ActionAuthority exactly once and the isolated click primitive is **not called**;
2. bypass Engine/ActionAuthority and call current-generation isolated `.click()` directly; the primitive is reached, but the original Guard capture listener still blocks the agreement-like synthetic DOM effect;
3. perform trusted browser input; it succeeds once.

Canonical historical v12 result:

```text
attempts=1
engineBlocked={checked:false,clicks:0}
direct synthetic primitive reached once
guardBlocked={checked:false,clicks:0}
trusted={checked:true,clicks:1}
```

This is defense in depth, not three names for one mechanism.

## Decision and cache boundaries

DecisionKernel is browser-independent and owns the sole severity/acceptance policy. Engine maps browser snapshots into EvidenceIR; neither DOM extraction nor ProfileCore may redefine acceptance.

ProfileCore governs acceleration only:

- 256 persistent origins;
- 8 flows per origin;
- 180-day TTL;
- 32-entry Worker hot LRU plus `storage.session` and `storage.local`;
- exact flow identity by fingerprint + validated DOM/Shadow locator;
- bounded/finite locator/descriptor/counter/timestamp sanitization;
- future-dated acceleration evidence fails closed;
- serialized mutations; storage failures remain failures.

A cached locator must be resolved against current DOM, current descriptor compatibility, current Risk Core severity and DecisionKernel policy. Historical success cannot bypass ActionAuthority.

Profile namespaces come from Chrome `MessageSender.origin` / URL, never from a content-provided arbitrary origin field.

## Worker/document lifecycle boundary

Explicit `MessageSender.documentLifecycle` states other than `active` are non-authoritative. `prerender`, `cached` and `pending_deletion` senders cannot schedule dynamic injection or mutate site-learning state.

Worker globals are transient and are never correctness authority. SchedulerCore owns pure queue policy; Worker owns Chrome execution. Persistent update-rehydration and profile state live in Chrome storage. Probe/Gate/Engine also retain independent lifecycle epochs so a transient Worker or hidden/frozen document cannot keep stale scheduled DOM work authoritative.

## DOM topology and evidence boundary

DomCore deliberately owns only composed-parent and root-scoped IDREF lookup. Gate, Guard and Engine retain different bounded text scanners because their latency/security budgets differ. A universal DOM/text utility would blur those obligations and potentially move expensive/full semantics into earlier tiers.

No tier is permitted an unbounded wildcard whole-page scan or arbitrary subtree stringification. Pathological strings are sampled before normalization. v12.2 applies that same sampling rule to Probe text nodes that previously exceeded the direct 900-character path.

## Bounded-work correctness boundary

Hard caps protect CPU/memory but do not authorize loss of connected semantic final state. A work item may disappear only when complete, dead/disconnected, generation-obsolete/superseded, or represented by another bounded authoritative recovery object.

Permanent real-Chrome tests attack:

- Probe→Gate activation recall positive and negative paths;
- Probe/Gate queue saturation;
- Gate connected work beyond `JOB_TTL_MS`;
- Engine candidate-index saturation;
- Engine walk saturation;
- Engine RootBatch and sibling-range connected work beyond their TTL ages;
- closed-Shadow work beyond `MAX_SHADOW_JOBS`.

Raising caps, increasing timeouts to hide loss, or switching to unbounded synchronous scans is not an equivalent repair.

## Release-transition identity boundary

An open page may contain multiple Auto Agree isolated contexts after extension replacement. Version text proves a generation label, not unique execution identity; execution-context ID is the primary old/new world identity.

`e2e-update.mjs` stages the exact PR base and derives previous/current versions from their manifests. The physical v12 candidate proved a real **11.0.0 → 12.0.0** same-path update without page reload while one full v11 isolated context and one full v12 context remained simultaneously observable.

For v12.2, the same candidate-relative harness must prove **12.1.0 → 12.2.0** on the exact PR base/head: no page reload, old/current contexts simultaneously observable, current routine action exactly once, and stale/mixed/external-IDREF/non-English/wide/ambiguous/action-inside-label negative paths still zero-click.

## Release-generation integrity

Current release identity is machine-enforced across:

- `extension/manifest.json`;
- `package.json`;
- `package-lock.json` top-level version;
- `package-lock.json` root package version;
- RuntimeKernel's single isolated birth-generation literal.

All other isolated production modules derive RuntimeKernel generation; Worker and current-generation tests derive the manifest. The first v12 cut was deliberately rejected when it exposed a hardcoded `11.0.0` RuntimeKernel unit assertion. The defect was repaired before the four-file cut was retried.

## Artifact boundary

A release ZIP is part of the correctness/security boundary. The packager derives the executable JavaScript closure from `extension/*.js`; a checksum alone is insufficient if source and packaged runtime closures diverge.

The current package identity is machine-owned by `release/package-manifest.json` and uses stored ZIP entries so compressor implementations cannot alter the bytes:

```text
AutoAgree-v12.2.0.zip
sha256=fe4fe1221509c09a1d4071686e689a679603e829e702056325d327a743199c7b
compression=stored
textEncoding=utf-8
textLineEndings=lf
entryCreatorSystem=unix
```

The packager canonicalizes Git materializations before hashing: every declared text member is decoded as UTF-8 and written with LF. This prevents a Windows CRLF checkout and a Linux LF checkout from minting different release identities. Earlier package hashes remain historical evidence in their version reports; they are not presented as the current closure.

## Threats considered

- misleading CSS/classes and visually classless controls;
- Probe activation false negatives that prevent the richer policy stack from ever starting;
- overbroad activation geometry that could accidentally turn distant legal text into action-relevant context;
- split legal/risk words across DOM fragments;
- multilingual risk asymmetry;
- stale learned selectors and profile namespace/identity collisions;
- future-dated/malformed persisted acceleration evidence;
- hidden templates and duplicated inactive modals;
- cross-frame injection storms and Worker queue starvation;
- closed/nested Shadow DOM and slot/composed-tree boundaries;
- BFCache/frozen/prerender/pending-deletion races;
- detached-DOM retention through queues/observers;
- pathological multi-megabyte text/attributes;
- mutation storms and zero-budget slices;
- MV3 service-worker termination during tier/profile handoff;
- extension update while old pages/Engine contexts remain live;
- stale-generation automated/direct isolated-world click attempts;
- page-owned synchronous trusted-event delegation;
- `stopPropagation()` / `stopImmediatePropagation()` preventing cleanup;
- authorization token reuse, overly broad wrappers and ambiguous controls;
- release tests confusing equal version strings with one execution context;
- deterministic tests silently omitted from a manual package script;
- package verification omitting a newly added runtime module;
- single hosted-runner performance samples being misread as stable code regressions.

## Hard boundaries

These mechanisms are scoped to Auto Agree's consent-action threat model. They are not a generic sandbox for arbitrary historical JavaScript side effects, and the tested Chrome behavior is not claimed as a universal browser theorem.

Ordinary content-script extensions also cannot guarantee control over Chrome-owned UI, trusted-physical-input-only interfaces, opaque Canvas/WebGL UI without usable DOM/accessibility evidence, or semantics intentionally placed outside every finite bounded sample of an unbounded string.
