# v11 multilingual risk parity

## Red evidence

The routine semantic core already recognizes a broad language set, but the historical high-consequence risk vocabulary was materially narrower. A deterministic parity matrix was added without changing production risk rules first.

Exact-head verify run **31458997085** failed immediately on the French optional-consent discriminator:

```text
fr optional: J’accepte de recevoir des publicités
```

The existing real-Chrome behavior matrix remained green, demonstrating that this was a previously untested risk-language asymmetry rather than a general runtime failure.

The matrix now covers native-language optional advertising, direct-debit authorization, age attestation, loan agreements, medical consent, facial recognition, arbitration and automatic renewal across 21 language families already represented by routine consent support. The second pass exposed a precise Danish medical-consent compact-form gap (`medicinsk samtykke`) rather than weakening the matrix.

The branch is being closed only when the full matrix and ordinary core/package/real-Chrome/update-generation gates are green. Localized compact risk patterns are fail-closed classifiers: they may suppress automation, but they never create click authority.
