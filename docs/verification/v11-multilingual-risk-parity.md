# v11 multilingual risk parity

## Red evidence

The routine semantic core already recognized a broad language set, but the historical high-consequence risk vocabulary was materially narrower. A deterministic parity matrix was added without changing production risk rules first.

Exact-head verify run **31458997085** failed immediately on the French optional-consent discriminator:

```text
fr optional: J’accepte de recevoir des publicités
```

The existing real-Chrome behavior matrix remained green, demonstrating that this was a previously untested risk-language asymmetry rather than a general runtime failure.

A deeper pass then exposed a precise Danish medical-consent compact-form gap (`medicinsk samtykke`) rather than weakening the matrix.

## Production invariant

The deterministic matrix now covers native-language examples of optional advertising, direct-debit authorization, age attestation, loan agreements, medical consent, facial recognition, arbitration and automatic renewal across **21 language families** already represented by routine consent support.

Localized compact risk patterns are deliberately fail-closed classifiers: they may raise severity and suppress automation, but they never create routine-consent evidence or click authority. The same bounded compact normalization also makes the risk boundary robust to DOM text fragmentation.

ADR 0013 makes the governance rule explicit: adding routine support for a language requires paired native-language risk evidence in the same change.

## Green evidence

Exact-head verify run **31460264114** on commit `cf958ddb5a6612f05e59aff40ed9fca3f459e3be` passed both canonical jobs:

```text
syntax/static/bounded-work/generation lease: PASS
property-consent-model: 10,188 assertions PASS
property-semantic-fragmentation: 644 cases PASS
worker contracts/profile/scheduler/restart: PASS
deterministic package: PASS
real unpacked Chrome E2E + 300-case structural fuzz: PASS
cooperative generation revocation: PASS
PR-base → candidate update transition: PASS
```

The final PR diff contains only the risk runtime, deterministic property test, ADR and this evidence report; the temporary migration transport and temporary write-enabled workflow were removed before this canonical verification.
