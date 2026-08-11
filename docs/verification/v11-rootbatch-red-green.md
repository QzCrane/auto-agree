# v11 structural discovery hardening

## Red evidence

Clean test-only PR #8 ran the restored 300-case structural corpus against unmodified v10 main. Exact-head verify run **31458451119** kept deterministic core/package and the existing basic real-Chrome matrix green, and the Engine world was physically present, but structural fuzz timed out with large later portions of routine dynamic cases remaining unchecked (`clicks=0`). That isolated dynamic discovery/backpressure rather than extension installation or missing Engine dependencies.

## RootBatch repair

`Engine.enqueueRootBatch()` no longer evicts an unfinished batch with a naked `shift()` when `MAX_ROOT_BATCHES` is reached. Same-parent overflow is represented by a live parent final-state rescan through the existing bounded `queueRoot()` path; mixed-root overflow remains weakly represented in an existing bounded batch. Detached DOM is therefore not strongly retained and the hard batch-object cap remains.

The first real-Chrome run after this repair reduced the corpus failure from broad dynamic loss to nine routine cases: eight French and one Spanish. The remaining misses were all arbitrary text-fragmentation cases. This separated a second defect from RootBatch pressure: compact defragmentation fallback only had strong Latin coverage for English.

## Multilingual fragmentation repair

`semantic-core.js` now has compact legal/assent companions for the multilingual routine vocabulary already supported by its normal expressions. A deterministic property gate inserts an artificial fragment boundary at every character position of representative routine phrases across 22 language variants and requires both legal and assent evidence to survive.

## Green evidence

Exact-head verify run **31458901416** on commit `1f072f87b6ebde7d3f473849ce39a1bbd3f76044` passed both canonical jobs in Chrome for Testing **149.0.7827.22**:

```text
core/package: PASS
e2e-basic: PASS
e2e-structural-fuzz: 300 total
  routine: 120
  blocked: 60
  already checked: 40
  disabled: 40
  mixed: 40
  false positive: 0
  false negative: 0
  duplicate toggle: 0
worker termination: PASS
generation lease current→next probe: PASS
PR-base→candidate update transition: PASS
```

The same run measured the 5,000-checkbox tail-login profile at approximately **176.6 ms wall latency / 0.1727 s TaskDuration / 157 samples**, remaining comfortably below the existing `<1000 ms` and `<0.8 s` release ceilings.

The permanent invariant is now explicit: a hard queue-object cap controls resource representation; it is not authority to forget live semantic work. Future bounded queues must either prove the dropped representation is superseded or preserve a bounded recovery path to current DOM state.
