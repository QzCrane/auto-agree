import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const context = vm.createContext({ console, WeakRef, performance });
vm.runInContext(fs.readFileSync('extension/runtime-kernel.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('extension/decision-core.js', 'utf8'), context);
const policy = context.__AUTO_AGREE_DECISION__;
assert.ok(policy);
const S = policy.SEVERITY;

function legacyDecision(e) {
  const facts = {
    legal: !!e.legal,
    assent: !!e.assent,
    required: !!e.required,
    auth: !!e.auth,
    transaction: !!e.transaction,
    actionGated: !!e.actionGated,
    legalLinks: e.legalLinks,
    controlConfidence: e.controlConfidence,
    severity: e.severity.level
  };
  const nodes = [
    { id: 'control', kind: 'control' },
    { id: 'row', kind: 'semantic-row' },
    { id: 'context', kind: 'context' },
    { id: 'action', kind: 'proceed-action' }
  ];
  const edges = [
    ['control', 'described-by', 'row'],
    ['row', 'contained-in', 'context']
  ];
  if (facts.actionGated || facts.required) edges.push(['control', 'gates', 'action']);
  if (facts.legalLinks) edges.push(['row', 'references-legal', 'context']);
  const graph = { facts, nodes, edges };

  if (e.disabled || e.stateKind === 'mixed' || facts.severity >= S.OPTIONAL || e.blocked) {
    return { accept: false, score: -100, severity: e.severity, graph };
  }
  let score = e.baseScore + facts.legalLinks + e.gatingScore + (facts.auth ? 2 : 0) + Math.min(facts.controlConfidence, 5);
  if (facts.required) score += 4;

  const explicitLegalAssent = facts.legal && facts.assent;
  const explicitMandatoryLegal = facts.legal && facts.required;
  const terseAuthLegal = facts.legal && facts.auth && facts.controlConfidence >= 4 && (facts.legalLinks >= 2 || facts.required || facts.actionGated);
  const assentWithLegalLinks = facts.assent && facts.legalLinks >= 2 && facts.controlConfidence >= 3;
  const relationalGate = facts.legal && (facts.assent || facts.required) && (facts.auth || facts.actionGated) && facts.controlConfidence >= 3;
  const accept = explicitLegalAssent || explicitMandatoryLegal || terseAuthLegal || assentWithLegalLinks || relationalGate || (e.eligible && score >= 12);
  return { accept, score, severity: e.severity, graph };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const severityArb = fc.integer({ min: S.ROUTINE, max: S.ATTESTATION }).map(level => ({ level, kind: `level-${level}` }));
const evidenceArb = fc.record({
  disabled: fc.boolean(),
  stateKind: fc.constantFrom('native', 'aria', 'data', 'unknown', 'mixed'),
  blocked: fc.boolean(),
  severity: severityArb,
  baseScore: fc.integer({ min: -8, max: 24 }),
  legal: fc.boolean(),
  assent: fc.boolean(),
  required: fc.boolean(),
  auth: fc.boolean(),
  transaction: fc.boolean(),
  actionGated: fc.boolean(),
  legalLinks: fc.integer({ min: 0, max: 8 }),
  controlConfidence: fc.integer({ min: 0, max: 8 }),
  eligible: fc.boolean(),
  gatingScore: fc.integer({ min: 0, max: 8 })
});

fc.assert(
  fc.property(evidenceArb, evidence => {
    assert.deepEqual(
      plain(policy.decideEvidence(evidence)),
      plain(legacyDecision(evidence)),
      'pure DecisionKernel must remain behaviorally identical to the v11 Engine formula during extraction'
    );
  }),
  { seed: 0xDEC1D3, numRuns: 5000, verbose: 2 }
);

fc.assert(
  fc.property(evidenceArb, evidence => {
    const blocked = {
      ...evidence,
      severity: { level: S.CONSEQUENTIAL, kind: 'consequential' }
    };
    assert.equal(policy.decideEvidence(blocked).accept, false, 'consequential evidence can never become click authority');
  }),
  { seed: 0xDEC1D4, numRuns: 1500, verbose: 2 }
);

fc.assert(
  fc.property(evidenceArb, evidence => {
    assert.equal(policy.decideEvidence({ ...evidence, disabled: true }).accept, false, 'disabled controls must fail closed');
    assert.equal(policy.decideEvidence({ ...evidence, stateKind: 'mixed' }).accept, false, 'mixed controls must fail closed');
    assert.equal(policy.decideEvidence({ ...evidence, blocked: true }).accept, false, 'blocked semantics must fail closed');
  }),
  { seed: 0xDEC1D5, numRuns: 1000, verbose: 2 }
);

const source = fs.readFileSync('extension/decision-core.js', 'utf8');
for (const [name, pattern] of [
  ['DOM document', /\bdocument\b/],
  ['DOM Element', /\bElement\b/],
  ['DOM Node', /\bNode\b/],
  ['Chrome API', /\bchrome\s*\./]
]) {
  assert.equal(pattern.test(source), false, `DecisionKernel must remain pure: ${name}`);
}

console.log('decision-core: PASS (7500 shrinkable differential/safety cases)');
