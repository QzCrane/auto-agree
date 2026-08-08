# Decision model

## Severity lattice

| Level | Class | Default action |
|---|---|---|
| 0 | routine access agreement | eligible for auto-accept |
| 1 | routine privacy acknowledgement | eligible for auto-accept |
| 2 | optional preference/marketing/cookie/remember-me/renewal | never auto-accept |
| 3 | consequential financial/legal/medical/employment/biometric action | never auto-accept |
| 4 | factual or identity/age attestation | never auto-accept |

A higher-severity clause dominates lower-severity Terms language in the same control. “I agree to Terms **and authorize payment**” is therefore consequential, not routine.

## Evidence chain

A click requires all of the following:

1. a real or high-confidence consent control;
2. legal/assent or mandatory legal evidence;
3. a local context compatible with access/onboarding;
4. severity below `OPTIONAL`;
5. active/not-disabled/not-already-checked state, excluding native indeterminate and ARIA/data mixed states;
6. visibility proof when the control representation is ambiguous;
7. post-click state verification.

Unknown custom toggle state is one-shot for that unresolved DOM element and is never blindly toggled twice, even after the normal click cooldown expires. Native `indeterminate`, ARIA `mixed`, and data-state `indeterminate`/`mixed` are treated as tri-state ambiguity and are never auto-toggled.

## Cache rule

Historical success can answer only “where should I look first?”. It cannot answer “may I click this now?”. Every cache hit is reclassified from current DOM, current context and current risk semantics.

## Disabled-action causality

A disabled Login/Continue action is only weak evidence that an agreement is the blocker. v8 explicitly checks native credential validity (`willValidate` / `ValidityState.valid`) as well as emptiness. A syntactically invalid but non-empty email, pattern mismatch, too-short value, or other native validity failure suppresses the action-gating bonus.

This prevents the inference:

```text
Login disabled + Terms checkbox => Terms caused disabled
```

when the actual blocker is invalid credential state. No `checkValidity()` call is used, so the extension does not fire validation UI/events merely to inspect causality.
