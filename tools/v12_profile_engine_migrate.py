from pathlib import Path


def replace_exact(path, old, new, count=1):
    p = Path(path)
    text = p.read_text()
    actual = text.count(old)
    if actual != count:
        raise SystemExit(f'{path}: expected {count} occurrence(s), got {actual}: {old[:180]!r}')
    p.write_text(text.replace(old, new))


# Every Engine-capable isolated world receives a freshly installed, stateless ProfileCore.
replace_exact(
    'extension/worker.js',
    "['runtime-kernel.js', 'generation-lease.js', 'semantic-core.js', 'handover-guard.js', 'decision-core.js', 'risk-core.js', 'engine.js']",
    "['runtime-kernel.js', 'generation-lease.js', 'semantic-core.js', 'handover-guard.js', 'decision-core.js', 'profile-core.js', 'risk-core.js', 'engine.js']",
)

# Engine no longer owns profile TTL/flow-cap policy.
replace_exact('extension/engine.js', "  const CACHE_TTL_MS = 180 * 24 * 60 * 60 * 1000;\n", '')
replace_exact('extension/engine.js', "  const PROFILE_MAX_FLOWS = 8;\n", '')

replace_exact(
    'extension/engine.js',
    """  const CORE = globalThis.__AUTO_AGREE_SEMANTIC__;
  const POLICY = globalThis.__AUTO_AGREE_DECISION__;
  const RISK = globalThis.__AUTO_AGREE_RISK__;
  if (!CORE || CORE.version !== VERSION || !POLICY || POLICY.version !== VERSION || !RISK || RISK.version !== VERSION) return;
""",
    """  const CORE = globalThis.__AUTO_AGREE_SEMANTIC__;
  const POLICY = globalThis.__AUTO_AGREE_DECISION__;
  const PROFILE = globalThis.__AUTO_AGREE_PROFILE_CORE__;
  const RISK = globalThis.__AUTO_AGREE_RISK__;
  if (!CORE || CORE.version !== VERSION || !POLICY || POLICY.version !== VERSION || !PROFILE || !RISK || RISK.version !== VERSION) return;
""",
)
replace_exact(
    'extension/engine.js',
    """  const { decideEvidence } = POLICY;
  const { LEGAL, ASSENT, READ_WORD, REQUIRED, VALIDATION, AUTH, PROCEED, FAST_TEXT, CREDENTIAL, COMPACT_LEGAL, COMPACT_ASSENT } = CORE.patterns;
""",
    """  const { decideEvidence } = POLICY;
  const { ttlMs: CACHE_TTL_MS, maxFlows: PROFILE_MAX_FLOWS } = PROFILE.CONFIG;
  const { LEGAL, ASSENT, READ_WORD, REQUIRED, VALIDATION, AUTH, PROCEED, FAST_TEXT, CREDENTIAL, COMPACT_LEGAL, COMPACT_ASSENT } = CORE.patterns;
""",
)

replace_exact(
    'extension/engine.js',
    """  function behaviorDescriptor(s) {
    return {
      kind: s?.state?.kind || 'unknown',
      severity: Number(s?.severity?.level || 0),
      legal: !!s?.assessment?.legal,
      assent: !!s?.assessment?.assent,
      required: !!s?.required,
      auth: !!s?.context?.auth,
      linkBucket: Math.min(2, Math.floor(Number(s?.links || 0) / 2))
    };
  }

  function descriptorCompatible(stored, live) {
    if (!stored || typeof stored !== 'object') return true;
    if (Number(stored.severity || 0) >= SEVERITY.OPTIONAL) return false;
    if (stored.kind && stored.kind !== 'unknown' && live.kind !== stored.kind) return false;
    if (stored.legal && !live.legal) return false;
    if (stored.required && !live.required && !live.assent) return false;
    if (Number(stored.linkBucket || 0) > Number(live.linkBucket || 0) + 1) return false;
    return true;
  }
""",
    """  function behaviorDescriptor(s) {
    return PROFILE.sanitizeDescriptor({
      kind: s?.state?.kind || 'unknown',
      severity: Number(s?.severity?.level || 0),
      legal: !!s?.assessment?.legal,
      assent: !!s?.assessment?.assent,
      required: !!s?.required,
      auth: !!s?.context?.auth,
      linkBucket: Math.floor(Number(s?.links || 0) / 2)
    });
  }
""",
)
replace_exact(
    'extension/engine.js',
    "if (!descriptorCompatible(flow.descriptor, liveDescriptor)) { recordCacheFailure(flow); continue; }",
    "if (!PROFILE.descriptorCompatible(flow.descriptor, liveDescriptor, SEVERITY.OPTIONAL)) { recordCacheFailure(flow); continue; }",
)

# Static contract: ProfileCore must be reinstallable per isolated injection and Engine must consume it.
static = Path('tests/static-contract.mjs')
text = static.read_text()
old = "assert.equal(/\\bchrome\\b|\\bdocument\\b|\\bElement\\b|\\bNode\\b/.test(profileCore),false,'ProfileCore must remain browser-independent');"
new = old + "\nassert.equal(/if\\s*\\(globalThis\\.__AUTO_AGREE_PROFILE_CORE__\\)\\s*return/.test(profileCore),false,'stateless ProfileCore must reinstall for each isolated-world injection instead of reusing stale generation semantics');"
if text.count(old) != 1:
    raise SystemExit('static profile purity anchor changed')
text = text.replace(old, new)
old = "assert.match(worker,/\\['runtime-kernel\\.js', 'generation-lease\\.js', 'semantic-core\\.js', 'handover-guard\\.js', 'decision-core\\.js', 'risk-core\\.js', 'engine\\.js'\\]/,'every Engine-capable world must carry both cooperative lease and handover guard');"
new = "assert.match(worker,/\\['runtime-kernel\\.js', 'generation-lease\\.js', 'semantic-core\\.js', 'handover-guard\\.js', 'decision-core\\.js', 'profile-core\\.js', 'risk-core\\.js', 'engine\\.js'\\]/,'every Engine-capable world must carry lease, policy, fresh ProfileCore and handover guard');"
if text.count(old) != 1:
    raise SystemExit('static Engine injection anchor changed')
text = text.replace(old, new)
old = """assert.match(engine,/authorizeHandoverClick/);assert.match(engine,/__AUTO_AGREE_DECISION__/,'Engine must consume the pure decision authority');assert.match(engine,/evidenceForCandidate/,'Engine must map browser snapshots into EvidenceIR before policy');assert.equal(/function\\s+buildSemanticGraph\\s*\\(/.test(engine),false,'Engine must not retain a private policy graph implementation');
assert.ok(engine.indexOf('if (!CORE || CORE.version !== VERSION || !RISK || RISK.version !== VERSION) return;') < engine.indexOf('globalThis.__AUTO_AGREE_ENGINE__ = VERSION;'),'Engine sentinel must be assigned only after dependencies are valid');
"""
new = """assert.match(engine,/authorizeHandoverClick/);assert.match(engine,/__AUTO_AGREE_DECISION__/,'Engine must consume the pure decision authority');assert.match(engine,/evidenceForCandidate/,'Engine must map browser snapshots into EvidenceIR before policy');assert.equal(/function\\s+buildSemanticGraph\\s*\\(/.test(engine),false,'Engine must not retain a private policy graph implementation');
assert.match(engine,/const PROFILE = globalThis\\.__AUTO_AGREE_PROFILE_CORE__/,'Engine must consume the shared profile schema authority');
assert.match(engine,/PROFILE\\.sanitizeDescriptor\\(/,'Engine profile descriptors must cross the shared schema boundary');
assert.match(engine,/PROFILE\\.descriptorCompatible\\([^,]+,[^,]+,\\s*SEVERITY\\.OPTIONAL\\)/,'cached evidence compatibility must use ProfileCore with DecisionKernel severity authority');
assert.equal(/function\\s+descriptorCompatible\\s*\\(/.test(engine),false,'Engine must not retain a second cache-compatibility policy');
assert.equal(/const\\s+CACHE_TTL_MS\\s*=\\s*180|const\\s+PROFILE_MAX_FLOWS\\s*=\\s*8/.test(engine),false,'Engine must not retain duplicate persisted-profile bounds');
const engineDeps = 'if (!CORE || CORE.version !== VERSION || !POLICY || POLICY.version !== VERSION || !PROFILE || !RISK || RISK.version !== VERSION) return;';
assert.ok(engine.includes(engineDeps) && engine.indexOf(engineDeps) < engine.indexOf('globalThis.__AUTO_AGREE_ENGINE__ = VERSION;'),'Engine sentinel must be assigned only after semantic, decision, profile and risk dependencies are valid');
"""
if text.count(old) != 1:
    raise SystemExit('static Engine dependency block changed')
static.write_text(text.replace(old, new))

# Worker contract follows the exact physical Engine dependency closure.
replace_exact(
    'tests/worker-contract.mjs',
    "assert.equal(JSON.stringify(calls[1].files),JSON.stringify(['runtime-kernel.js','generation-lease.js','semantic-core.js','handover-guard.js','decision-core.js','risk-core.js','engine.js']));",
    "assert.equal(JSON.stringify(calls[1].files),JSON.stringify(['runtime-kernel.js','generation-lease.js','semantic-core.js','handover-guard.js','decision-core.js','profile-core.js','risk-core.js','engine.js']));",
)

# ProfileCore is deliberately reinstalled rather than short-circuiting a stale singleton.
p = Path('tests/profile-core.mjs')
text = p.read_text()
anchor = "assert.ok(core, 'ProfileCore must initialize');\n"
addition = """assert.ok(core, 'ProfileCore must initialize');
{
  const reinject = vm.createContext({ console, Date, Number, Math, Map, Set, Object, String, Array, JSON, RegExp });
  vm.runInContext(source, reinject);
  const first = reinject.__AUTO_AGREE_PROFILE_CORE__;
  vm.runInContext(source, reinject);
  assert.notEqual(reinject.__AUTO_AGREE_PROFILE_CORE__, first, 'stateless ProfileCore must reinstall so a new Engine world cannot inherit a stale singleton');
}
"""
if text.count(anchor) != 1:
    raise SystemExit('profile-core reinjection anchor changed')
p.write_text(text.replace(anchor, addition))

print('v12 Engine ProfileCore migration prepared successfully')
