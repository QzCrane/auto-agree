import fs from 'node:fs';
import assert from 'node:assert/strict';

const file='CHANGELOG.md';
const source=fs.readFileSync(file,'utf8');
assert.ok(source.startsWith('# Changelog\n\n## 11.0.0 — 2026-08-12\n'),'unexpected changelog head; refuse to prepend against a moved release history');
assert.equal(source.includes('## 12.0.0 —'),false,'v12 changelog entry already exists');

const entry=[
  '## 12.0.0 — 2026-08-13',
  '',
  '- Converged shared runtime/lifecycle/bounded-work mechanics into **RuntimeKernel** while preserving tier-specific Probe/Gate/Engine budgets and all hard queue/object caps. Connected work remains recoverable through FIFO/weak final-state semantics rather than being silently discarded by pressure or age.',
  '- Made **DecisionKernel** the sole severity lattice and click-policy owner, including the classless policy path. Removed the dead Semantic Core severity duplicate and machine-forbid another competing policy lattice.',
  '- Extracted **SchedulerCore** and **ProfileCore** as pure policy/governance authorities. Worker scheduling now has one source for caps/aging/stale/fairness/preemption; persisted acceleration has one bounded schema/identity/merge/compatibility owner while cache remains non-authoritative.',
  '- Added topology-only **DomCore** and removed duplicate composed-parent/root-IDREF implementations from Engine and Handover Guard. DomCore is statically forbidden from growing into a full text/tree scanner.',
  '- Added 31-line **ActionAuthority** as the single Engine automated-click protocol: current Generation Lease → Handover Guard authorization → exactly one click attempt. Generation Lease and Guard remain independent defense layers; Engine\'s live verifier remains the sole DOM-success observer.',
  '- Promoted one executable **23-language safety contract**. Deliberate red testing exposed Chinese automatic-renewal semantics as weaker than the multilingual consequential baseline; `自动续费/自動續費/连续包月/连续包年` now fail closed at consequential severity, including fragmented/compact paths.',
  '- Replaced the fragile manual deterministic-test command with **auto-discovery**. Audit proved `tests/classless-decision.mjs` existed but was not previously executed by `npm test`; v12 now auto-registers 27 deterministic gates and recovers that 6,000-case classless DecisionKernel property proof.',
  '- Strengthened real-Chrome action discrimination into three independent proofs: rejected ActionAuthority dispatches no synthetic primitive; a separately forced current-generation isolated synthetic click reaches the primitive but is still blocked by Handover Guard; trusted browser input remains usable.',
  '- Upgraded performance evidence from single hosted-runner snapshots to a separate **7-run statistical real-unpacked job** preserving the same 5,000-checkbox tail-login benchmark. The ledger now stores raw runs plus median/p90/max. Same-code runs showed meaningful hosted-runner regime variance, so v12 explicitly rejects speculative runtime optimization based on one CI wall-clock sample.',
  '- Hardened release-generation governance: manifest/package/package-lock top+root/RuntimeKernel coherence is machine-enforced; Worker/current-generation tests derive the manifest. The first v12 cut correctly failed because `tests/runtime-kernel.mjs` still hardcoded `11.0.0`; that historical v11 overclaim was corrected upstream before the pure four-file cut was retried.',
  '- Physically proved a non-reloaded **v11.0.0 → v12.0.0** update with complete old/new isolated contexts simultaneously observable. Current routine behavior remained exactly once; mixed, external-IDREF, non-English, wide/ambiguous wrapper and action-inside-label negative paths remained zero-click.',
  '- Physically proved **v12.0.0 → v13.0.0** cooperative stale-generation revocation without page reload: stale automated clicks = 0, direct stale isolated-world `.click()` = 0, trusted click = 1.',
  '- Canonical physical candidate package: `AutoAgree-v12.0.0.zip`, sha256 `1cee531a26272160df70909815089a80d1d45814ce3d138d7dd2c2efbc00e859`. Permissions remain `scripting`, `storage`, `<all_urls>`; no debugger, telemetry/network client, remote code or new permission was added.',
  '- Canonical seven-run release-candidate performance on Chrome 149.0.7827.22 / Puppeteer 25.1.0 / Node 24: latency median/p90/max **259.1/288.2/288.5 ms**; TaskDuration **0.2524/0.2803/0.2812 s**; all raw runs remained below the existing <1000 ms / <0.8 s broad ceilings.',
  '',
  ''
].join('\n');

fs.writeFileSync(file,source.replace('# Changelog\n\n','# Changelog\n\n'+entry));
console.log('v12-changelog-prepend: PASS');
