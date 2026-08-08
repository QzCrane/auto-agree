# Real-world-derived regression fixtures

These fixtures are sanitized, local reproductions of structural failure classes observed during AutoAgree development. They contain no credentials, private URLs, or copied proprietary page markup.

- `trae-classless.html`: derived from the real TRAE failure that motivated text→control discovery and classless visual hit-target resolution.
- `terse-validity.html`: a terse Terms label where a disabled proceed action is caused first by invalid native form state, then by the unchecked agreement.
- `fragmented-risk.html`: consequential language split across DOM fragments.
- `closed-shadow.html`: auth/agreement UI inside a closed ShadowRoot discovered from ordinary user focus.
- `iframe-*`: real extension all-frame behavior rather than in-page API shims.
- `dynamic.html`: SPA-style late insertion used for worker-restart and update-transition tests.

Every new production miss/false-positive should be reduced to a similarly privacy-safe structural fixture before the fix is considered closed.
