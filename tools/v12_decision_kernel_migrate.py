from pathlib import Path


def replace_exact(path, old, new, count=1):
    p = Path(path)
    text = p.read_text()
    actual = text.count(old)
    if actual != count:
        raise SystemExit(f'{path}: expected {count} occurrence(s), got {actual}: {old[:160]!r}')
    p.write_text(text.replace(old, new))


# Risk no longer owns a duplicate severity lattice; it consumes the pure policy authority.
replace_exact(
    'extension/risk-core.js',
    """  const BASE = globalThis.__AUTO_AGREE_SEMANTIC__;
  if (!BASE || BASE.version !== VERSION) return;
  const SEVERITY = Object.freeze({ ROUTINE: 0, PRIVACY: 1, OPTIONAL: 2, CONSEQUENTIAL: 3, ATTESTATION: 4 });
""",
    """  const BASE = globalThis.__AUTO_AGREE_SEMANTIC__;
  const POLICY = globalThis.__AUTO_AGREE_DECISION__;
  if (!BASE || BASE.version !== VERSION || !POLICY || POLICY.version !== VERSION) return;
  const { SEVERITY } = POLICY;
""",
)

# Engine explicitly depends on the pure policy and maps DOM-derived snapshots into EvidenceIR.
replace_exact(
    'extension/engine.js',
    """  const CORE = globalThis.__AUTO_AGREE_SEMANTIC__;
  const RISK = globalThis.__AUTO_AGREE_RISK__;
  if (!CORE || CORE.version !== VERSION || !RISK || RISK.version !== VERSION) return;
""",
    """  const CORE = globalThis.__AUTO_AGREE_SEMANTIC__;
  const POLICY = globalThis.__AUTO_AGREE_DECISION__;
  const RISK = globalThis.__AUTO_AGREE_RISK__;
  if (!CORE || CORE.version !== VERSION || !POLICY || POLICY.version !== VERSION || !RISK || RISK.version !== VERSION) return;
""",
)
replace_exact(
    'extension/engine.js',
    """  const { containsNegative, containsAttestation, severityFor, SEVERITY } = RISK;
""",
    """  const { containsNegative, containsAttestation, severityFor, SEVERITY } = RISK;
  const { decideEvidence } = POLICY;
""",
)

engine = Path('extension/engine.js')
text = engine.read_text()
old = """  function buildSemanticGraph(s) {
    const a = s.assessment;
    const facts = Object.freeze({
      legal: !!a.legal,
      assent: !!a.assent,
      required: !!(a.required || a.validation || s.required),
      auth: !!s.context.auth,
      transaction: !!s.context.transaction,
      actionGated: s.context.gatingScore > 0,
      legalLinks: s.links,
      controlConfidence: s.confidence,
      severity: s.severity.level
    });
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
    return Object.freeze({ facts, nodes, edges });
  }

  function decisionFor(s) {
    const graph = buildSemanticGraph(s);
    const f = graph.facts;
    if (s.disabled || s.state.kind === 'mixed' || f.severity >= SEVERITY.OPTIONAL || s.assessment.blocked) return { accept: false, score: -100, severity: s.severity, graph };
    const a = s.assessment;
    let score = a.score + f.legalLinks + s.context.gatingScore + (f.auth ? 2 : 0) + Math.min(f.controlConfidence, 5);
    if (f.required) score += 4;

    const explicitLegalAssent = f.legal && f.assent;
    const explicitMandatoryLegal = f.legal && f.required;
    const terseAuthLegal = f.legal && f.auth && f.controlConfidence >= 4 && (f.legalLinks >= 2 || f.required || f.actionGated);
    const assentWithLegalLinks = f.assent && f.legalLinks >= 2 && f.controlConfidence >= 3;
    const relationalGate = f.legal && (f.assent || f.required) && (f.auth || f.actionGated) && f.controlConfidence >= 3;
    const accept = explicitLegalAssent || explicitMandatoryLegal || terseAuthLegal || assentWithLegalLinks || relationalGate || (a.eligible && score >= 12);
    return { accept, score, severity: s.severity, graph };
  }
"""
new = """  function evidenceForCandidate(s) {
    const a = s.assessment;
    return {
      disabled: !!s.disabled,
      stateKind: s.state.kind,
      blocked: !!a.blocked,
      severity: s.severity,
      baseScore: Number(a.score || 0),
      legal: !!a.legal,
      assent: !!a.assent,
      required: !!(a.required || a.validation || s.required),
      auth: !!s.context.auth,
      transaction: !!s.context.transaction,
      actionGated: Number(s.context.gatingScore || 0) > 0,
      legalLinks: Number(s.links || 0),
      controlConfidence: Number(s.confidence || 0),
      eligible: !!a.eligible,
      gatingScore: Number(s.context.gatingScore || 0)
    };
  }

  function decisionFor(s) {
    return decideEvidence(evidenceForCandidate(s));
  }
"""
if text.count(old) != 1:
    raise SystemExit('Engine decision formula block changed')
engine.write_text(text.replace(old, new))

# Engine injection must load the pure policy before risk and Engine.
replace_exact(
    'extension/worker.js',
    "['runtime-kernel.js', 'generation-lease.js', 'semantic-core.js', 'handover-guard.js', 'risk-core.js', 'engine.js']",
    "['runtime-kernel.js', 'generation-lease.js', 'semantic-core.js', 'handover-guard.js', 'decision-core.js', 'risk-core.js', 'engine.js']",
)

# Risk property harnesses follow the real dependency order.
for path in ['tests/property-consent-model.mjs', 'tests/property-consent-fast-check.mjs']:
    p = Path(path)
    text = p.read_text()
    old = "vm.runInContext(fs.readFileSync('extension/semantic-core.js', 'utf8'), context);\nvm.runInContext(fs.readFileSync('extension/risk-core.js', 'utf8'), context);"
    new = "vm.runInContext(fs.readFileSync('extension/semantic-core.js', 'utf8'), context);\nvm.runInContext(fs.readFileSync('extension/decision-core.js', 'utf8'), context);\nvm.runInContext(fs.readFileSync('extension/risk-core.js', 'utf8'), context);"
    if text.count(old) != 1:
        raise SystemExit(f'{path}: risk dependency harness anchor changed')
    p.write_text(text.replace(old, new))

# Worker contract must prove the physical dependency closure.
replace_exact(
    'tests/worker-contract.mjs',
    "['runtime-kernel.js','generation-lease.js','semantic-core.js','handover-guard.js','risk-core.js','engine.js']",
    "['runtime-kernel.js','generation-lease.js','semantic-core.js','handover-guard.js','decision-core.js','risk-core.js','engine.js']",
)

# Version contract covers DecisionKernel as a birth-generation module and production JS file.
vc = Path('tests/version-contract.mjs')
text = vc.read_text()
old = "['bootstrap.js','engine.js','gate.js','generation-lease.js','handover-guard.js','risk-core.js','semantic-core.js']"
new = "['bootstrap.js','decision-core.js','engine.js','gate.js','generation-lease.js','handover-guard.js','risk-core.js','semantic-core.js']"
if text.count(old) != 1:
    raise SystemExit('version-contract isolated module list changed')
text = text.replace(old, new)
old = "['bootstrap.js','engine.js','gate.js','generation-lease.js','handover-guard.js','risk-core.js','runtime-kernel.js','semantic-core.js','worker.js']"
new = "['bootstrap.js','decision-core.js','engine.js','gate.js','generation-lease.js','handover-guard.js','risk-core.js','runtime-kernel.js','semantic-core.js','worker.js']"
if text.count(old) != 1:
    raise SystemExit('version-contract production JS list changed')
vc.write_text(text.replace(old, new))

# Static contract makes the policy purity/dependency boundary durable.
sc = Path('tests/static-contract.mjs')
text = sc.read_text()
old = "const files=['runtime-kernel.js','generation-lease.js','bootstrap.js','handover-guard.js','semantic-core.js','risk-core.js','gate.js','engine.js','worker.js'];"
new = "const files=['runtime-kernel.js','generation-lease.js','bootstrap.js','handover-guard.js','semantic-core.js','decision-core.js','risk-core.js','gate.js','engine.js','worker.js'];"
if text.count(old) != 1:
    raise SystemExit('static-contract production list changed')
text = text.replace(old, new)
old = "/\\['runtime-kernel\\.js', 'generation-lease\\.js', 'semantic-core\\.js', 'handover-guard\\.js', 'risk-core\\.js', 'engine\\.js'\\]/"
new = "/\\['runtime-kernel\\.js', 'generation-lease\\.js', 'semantic-core\\.js', 'handover-guard\\.js', 'decision-core\\.js', 'risk-core\\.js', 'engine\\.js'\\]/"
if text.count(old) != 1:
    raise SystemExit('static-contract Engine closure regex changed')
text = text.replace(old, new)
marker = "const semantic=fs.readFileSync(path.join(root,'semantic-core.js'),'utf8');"
insert = """const decision=fs.readFileSync(path.join(root,'decision-core.js'),'utf8');
assert.match(decision,/__AUTO_AGREE_DECISION__/,'pure DecisionKernel must publish one versioned policy authority');
assert.match(decision,/const SEVERITY = Object\.freeze/,'severity lattice must have one policy owner');
assert.match(decision,/decideEvidence/,'DecisionKernel must own EvidenceIR to Decision policy');
assert.equal(/\\bdocument\\b|\\bElement\\b|\\bNode\\b|\\bchrome\\s*\\./.test(decision),false,'DecisionKernel must remain browser/DOM independent');
const risk=fs.readFileSync(path.join(root,'risk-core.js'),'utf8');
assert.match(risk,/__AUTO_AGREE_DECISION__/,'risk classification must consume the shared severity authority');
assert.equal(/const\\s+SEVERITY\\s*=\\s*Object\\.freeze/.test(risk),false,'risk core must not own a duplicate severity lattice');
""" + marker
if text.count(marker) != 1:
    raise SystemExit('static-contract semantic anchor changed')
text = text.replace(marker, insert)
old = "assert.match(engine,/authorizeHandoverClick/);"
new = "assert.match(engine,/authorizeHandoverClick/);assert.match(engine,/__AUTO_AGREE_DECISION__/,'Engine must consume the pure decision authority');assert.match(engine,/evidenceForCandidate/,'Engine must map browser snapshots into EvidenceIR before policy');assert.equal(/function\\s+buildSemanticGraph\\s*\\(/.test(engine),false,'Engine must not retain a private policy graph implementation');"
if text.count(old) != 1:
    raise SystemExit('static-contract Engine anchor changed')
sc.write_text(text.replace(old, new))

# Run the differential DecisionKernel proof as a permanent deterministic gate.
pkg = Path('package.json')
text = pkg.read_text()
old = 'node tests/runtime-kernel.mjs && node tests/version-contract.mjs'
new = 'node tests/runtime-kernel.mjs && node tests/decision-core.mjs && node tests/version-contract.mjs'
if text.count(old) != 1:
    raise SystemExit('package check insertion anchor changed')
pkg.write_text(text.replace(old, new))

print('v12 DecisionKernel migration prepared successfully')
