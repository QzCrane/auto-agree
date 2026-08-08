# ADR 0001 — Consent severity replaces binary risk

**Status:** accepted

Binary safe/risky classification hides materially different actions. v7 uses a monotonic severity lattice: routine → routine privacy → optional → consequential → attestation. Any higher-severity clause dominates routine Terms wording. Production property tests assert that adding consequential clauses cannot downgrade severity.
