# Verification archive

This directory is the canonical version-by-version engineering record for Auto Agree.

## Evidence classes

Two evidence classes are intentionally distinguished.

### Reconstructed historical records

The earliest versions predated the standalone verification-report discipline. Their records are reconstructed from the original immutable Git commits and explicitly avoid inventing missing benchmark data.

| Version | Record | Historical commit | Evidence note |
|---|---|---|---|
| v1.0.0 | [v1.md](v1.md) | `37377373507d5fd8a4eb8712a47ce06e15927d4f` | reconstructed from original implementation |
| v1.1.0 | [v1.1.md](v1.1.md) | `56c695443cc9099ed35de9c9f1be2cfe0d492c6f` | reconstructed from diff + recorded TRAE real-world result |
| v2.0.0 | [v2.md](v2.md) | `83056273c98566321606dc706f4d8ec733312e84` | reconstructed from commit; commit already contained architecture/coverage/performance notes |

### Contemporaneous verification reports

From v3 onward, detailed version reports were produced during the corresponding development cycle and are preserved as historical evidence.

| Version | Record | Historical commit(s) / milestone |
|---|---|---|
| v3.0.0 | [v3.md](v3.md) | `1fb437a`, `afe288c` |
| v4.0.0 | [v4.md](v4.md) | `b2054e9` |
| v5.0.0 | [v5.md](v5.md) | `6fe3fe3` |
| v6.0.0 | [v6.md](v6.md) | `1b65137` |
| v7.0.0 | [v7.md](v7.md) | `baa7452` main milestone |
| v8.0.0 | [v8.md](v8.md) | first release with real unpacked-extension Chrome E2E as a merge gate |
| v9.0.0 | [v9.md](v9.md) | recovered invariants plus real-browser proof and repair of simultaneous old/new Engine click authority during MV3 update |
| v10.0.0 | [v10.md](v10.md) | cooperative stale-generation self-revocation, bounded shared-semantic handover convergence, profile-governance re-audit and package/runtime closure repair |
| v10.0.0 causal-authority hardening | [v10-causal-authority-addendum.md](v10-causal-authority-addendum.md) | real Chrome red/green proof that causal delegation must follow live source-event dispatch; release-transition harness generalized to PR-base/current manifests and execution-context identity |
| v10.0.0 structural-fuzz / RootBatch hardening | [v10-structural-fuzz-addendum.md](v10-structural-fuzz-addendum.md) | deterministic 300-case real-Chrome structural corpus plus lossless Engine RootBatch pressure handling |
| pre-v11 multilingual risk hardening | [v11-multilingual-risk-parity.md](v11-multilingual-risk-parity.md) | fail-closed native-language risk parity for routine-supported language families; runtime version remains 10.0.0 |
| pre-v11 Probe/Gate bounded-work hardening | [v11-tier-overflow.md](v11-tier-overflow.md) | real-Chrome red/green saturation evidence for Probe deep, Gate deep and Gate large-batch work |
| pre-v11 Gate stability hardening | [v11-gate-deep-stability-addendum.md](v11-gate-deep-stability-addendum.md) | FIFO/live-TTL hardening plus zero-budget deep-slice state-machine root cause and variance reduction |
| pre-v11 Engine walk hardening | [v11-engine-walk-overflow.md](v11-engine-walk-overflow.md) | real-Chrome proof and repair of `MAX_WALK_JOBS=12` oldest-cursor loss under saturation |

These hardening records do not claim a separate v11 release. They record correctness defects found while the production runtime still reports `10.0.0`, their real-browser falsification/repair evidence, and the stronger invariants required before the formal v11 version cut.

## Interpretation rules

1. Historical records are not current guarantees. They explain what each version changed and what was known at that time.
2. Later-discovered limitations are labeled as retrospective rather than backdated into the original evidence.
3. Numerical results appear only where an actual preserved measurement/test produced them.
4. Git history remains the authoritative archive for obsolete executable implementations; this directory records engineering meaning and verification evidence, not duplicate old runtime source.
5. Current production behavior is defined by `extension/`, the current tests, and the current architecture/security documentation—not by an older version report.
6. A release report is not considered final until its release-gating CI evidence has been incorporated and the corresponding candidate has passed the repository's current verification policy.
7. Real-browser E2E results describe the committed sanitized regression corpus and the tested browser environment; they do not imply universal correctness across arbitrary websites.
8. Narrow green tests do not waive historical invariants outside their scope. New releases must preserve previously established safety, resource and persistence contracts or explicitly re-open them with new evidence.
9. A post-merge addendum may supersede a mechanism claim in the original release report without rewriting history. The original report remains evidence of what was believed/tested at release time; the addendum records the later falsification and stronger replacement invariant.
10. Scheduling-sensitive queue fixes require the exact final head to pass the permanent real-browser discriminator; when prior evidence showed variance, the same SHA should be rerun before merge rather than treating one green interleaving as proof.

For the high-level evolution map, see [`../history.md`](../history.md). For current architecture, see [`../architecture.md`](../architecture.md).