# Contributing

1. Keep production code dependency-free unless a dependency has a measured, reviewed advantage.
2. Run `npm test` before every change.
3. Add a regression for every corrected false positive/false negative.
4. Do not broaden permissions without an ADR and an explicit threat/benefit analysis.
5. Cache or learned state may accelerate discovery but may never bypass live semantic/risk validation.
6. Prefer bounded local work over whole-page scans, polling, unbounded strings, or long-lived strong DOM references.
7. Record architecture-changing decisions in `docs/decisions/` and update `CHANGELOG.md`.
