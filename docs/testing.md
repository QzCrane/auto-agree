# Testing

## CI gate

`npm test` is dependency-free and verifies:

- syntax of all production JavaScript;
- Manifest V3/permission/isolated-world/frame invariants;
- absence of forbidden network/eval/polling/debugger/wildcard-scan paths;
- production semantic severity properties;
- bounded pathological-string normalization;
- worker exact-document injection contract;
- worker bounded global/per-tab scheduler behavior.

## Browser verification

Development additionally runs Chromium DOM/event integration against production source with extension-only APIs shimmed where the managed environment prevents unpacked-extension installation.

This is explicitly different from a real arbitrary-site unpacked-extension E2E run.

## Regression policy

A real-world miss or false positive must become a generalized regression case. Site-specific selectors are not accepted as the primary fix unless the behavior is provably site-specific and cannot be represented by a reusable mechanism.
