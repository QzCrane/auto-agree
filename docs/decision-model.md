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
5. active/not-disabled/not-already-checked state;
6. visibility proof when the control representation is ambiguous;
7. post-click state verification.

Unknown custom toggle state is one-shot and is never blindly toggled twice.

## Cache rule

Historical success can answer only “where should I look first?”. It cannot answer “may I click this now?”. Every cache hit is reclassified from current DOM, current context and current risk semantics.
