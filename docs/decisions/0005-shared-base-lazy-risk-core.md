# ADR 0005 — Shared semantic base, lazily loaded risk core

**Status:** accepted

Gate and Engine previously duplicated overlapping legal/assent rules, allowing silent drift. Loading every engine-only risk rule in Gate, however, would move cost earlier in the pipeline.

v7 therefore uses:

- `semantic-core.js`: shared bounded legal/assent/auth primitives loaded with Gate;
- `risk-core.js`: optional/consequential/attestation severity loaded only when Engine is activated.

This creates one source of truth for shared semantics without defeating lazy activation.
