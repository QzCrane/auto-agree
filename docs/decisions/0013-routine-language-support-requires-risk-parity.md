# ADR 0013 — Routine language support requires risk parity

## Status

Accepted.

## Context

Auto Agree may recognize routine mandatory access agreements in many languages. That capability expands action authority: once a localized phrase is understood as ordinary assent, the Engine may otherwise consider it eligible for automatic confirmation.

A language therefore cannot be considered safely supported merely because its words for Terms, Privacy, Agree, or Accept are recognized. The same language family must also have a fail-closed boundary for representative optional, consequential, and attestation semantics. The v11 parity audit exposed this asymmetry directly: French advertising consent was initially classified below OPTIONAL even though French routine assent was already understood.

## Decision

For every language family advertised or regression-gated as routine consent support, deterministic safety tests must also cover native-language examples of:

- optional advertising/marketing consent;
- payment or direct-debit authorization;
- age/factual attestation;
- loan/credit agreements;
- medical consent;
- biometric/facial-recognition consent;
- arbitration or comparable rights-affecting terms;
- automatic renewal/subscription authority.

Localized compact risk patterns are **fail-closed only**. They may raise severity and suppress automation; they may never manufacture routine-consent evidence or click authority.

Fragmentation tolerance must apply to the risk boundary as well as to routine semantics. Compact matching therefore removes formatting separators only after the same bounded normalization used elsewhere.

## Consequences

- adding a new routine language requires a paired risk-parity test in the same change;
- a missing localized risk phrase is a safety defect even when existing English/Chinese tests remain green;
- conservative over-classification is preferable to automatically converting a financial, medical, biometric, factual, or rights-affecting decision into a routine click;
- expanding risk vocabulary does not justify new permissions, telemetry, remote classifiers, or network dependencies.
