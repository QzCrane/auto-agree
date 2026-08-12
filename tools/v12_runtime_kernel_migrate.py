from pathlib import Path
import json


def replace_exact(path, old, new, count=1):
    p = Path(path)
    text = p.read_text()
    actual = text.count(old)
    if actual != count:
        raise SystemExit(f'{path}: expected {count} occurrence(s), got {actual}: {old[:120]!r}')
    p.write_text(text.replace(old, new))


# One isolated-world birth generation. Worker derives the installed generation from Chrome.
replace_exact(
    'extension/bootstrap.js',
    "  if (globalThis.__AUTO_AGREE_PROBE__) return;\n  globalThis.__AUTO_AGREE_PROBE__ = '11.0.0';",
    "  const KERNEL = globalThis.__AUTO_AGREE_RUNTIME_KERNEL__;\n  const VERSION = KERNEL?.version;\n  if (!KERNEL || !VERSION || globalThis.__AUTO_AGREE_PROBE__) return;\n  globalThis.__AUTO_AGREE_PROBE__ = VERSION;",
)

for path in [
    'extension/semantic-core.js',
    'extension/risk-core.js',
    'extension/gate.js',
    'extension/generation-lease.js',
    'extension/handover-guard.js',
    'extension/engine.js',
]:
    replace_exact(
        path,
        "  const VERSION = '11.0.0';",
        "  const KERNEL = globalThis.__AUTO_AGREE_RUNTIME_KERNEL__;\n  const VERSION = KERNEL?.version;\n  if (!KERNEL || !VERSION) return;",
    )

replace_exact('extension/worker.js', "const VERSION = '11.0.0';", "const VERSION = chrome.runtime.getManifest().version;")

# Fresh worlds receive kernel before lease/probe.
manifest = Path('extension/manifest.json')
data = json.loads(manifest.read_text())
js = data['content_scripts'][0]['js']
if js != ['generation-lease.js', 'bootstrap.js']:
    raise SystemExit(f'unexpected static content script order: {js}')
data['content_scripts'][0]['js'] = ['runtime-kernel.js', 'generation-lease.js', 'bootstrap.js']
manifest.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')

# Dynamic/update worlds receive kernel first as the birth-generation authority.
replace_exact(
    'extension/worker.js',
    "['generation-lease.js', 'semantic-core.js', 'handover-guard.js']",
    "['runtime-kernel.js', 'generation-lease.js', 'semantic-core.js', 'handover-guard.js']",
)
replace_exact(
    'extension/worker.js',
    "['generation-lease.js', 'semantic-core.js', 'gate.js']",
    "['runtime-kernel.js', 'generation-lease.js', 'semantic-core.js', 'gate.js']",
)
replace_exact(
    'extension/worker.js',
    "['generation-lease.js', 'semantic-core.js', 'handover-guard.js', 'risk-core.js', 'engine.js']",
    "['runtime-kernel.js', 'generation-lease.js', 'semantic-core.js', 'handover-guard.js', 'risk-core.js', 'engine.js']",
)

# Engine walk and broad-Shadow now share the same FIFO/recovery authority.
replace_exact(
    'extension/engine.js',
    """  const rootBatches = [];
  const walkJobs = [];
  let walkRecoveryRef = null;
  let walkRecoveryUrgent = false;
  const shadowJobs = [];
  let shadowRecoveryRef = null;
  const batchJobs = [];
""",
    """  const rootBatches = [];
  const walkWork = KERNEL.createBoundedFifo({
    capacity: MAX_WALK_JOBS,
    isLive: rootConnected,
    coalesce: (current, next, currentUrgent, nextUrgent) => ({
      scope: commonWalkRecoveryRoot(current, next),
      meta: !!currentUrgent || !!nextUrgent
    })
  });
  const walkJobs = walkWork.queue;
  const shadowWork = KERNEL.createBoundedFifo({
    capacity: MAX_SHADOW_JOBS,
    isLive: rootConnected,
    coalesce: (current, next) => ({ scope: commonWalkRecoveryRoot(current, next) })
  });
  const shadowJobs = shadowWork.queue;
  const batchJobs = [];
""",
)

engine = Path('extension/engine.js')
text = engine.read_text()
old = """  function rememberWalkRecovery(root, urgent) {
    if (!root || !rootConnected(root)) return;
    const current = walkRecoveryRef?.deref?.();
    const merged = current && rootConnected(current) ? commonWalkRecoveryRoot(current, root) : root;
    if (!merged || !rootConnected(merged)) return;
    walkRecoveryRef = new WeakRef(merged);
    walkRecoveryUrgent = walkRecoveryUrgent || !!urgent;
  }

  function promoteWalkRecovery() {
    if (walkJobs.length || !walkRecoveryRef) return false;
    const root = walkRecoveryRef.deref?.();
    const urgent = walkRecoveryUrgent;
    walkRecoveryRef = null;
    walkRecoveryUrgent = false;
    if (!root || !rootConnected(root) || queuedWalkRoots.has(root)) return false;
    if (!currentWalkGeneration(root)) walkGeneration.set(root, 1);
    const job = makeWalkJob(root, urgent);
    if (!job) return false;
    queuedWalkRoots.add(root);
    walkJobs.push(job);
    return true;
  }

  function admitWalkJob(root, job) {
    if (!root || !job || queuedWalkRoots.has(root)) return;
    if (walkJobs.length >= MAX_WALK_JOBS) {
      // Keep existing FIFO cursors authoritative; compress only the new excess final state.
      rememberWalkRecovery(root, job.urgent);
      return;
    }
    queuedWalkRoots.add(root);
    walkJobs.push(job);
  }
"""
new = """  function promoteWalkRecovery() {
    if (walkJobs.length || !walkWork.hasRecovery) return false;
    return walkWork.promote((root, urgent) => {
      if (!root || !rootConnected(root) || queuedWalkRoots.has(root)) return null;
      if (!currentWalkGeneration(root)) walkGeneration.set(root, 1);
      const job = makeWalkJob(root, !!urgent);
      if (!job) return null;
      queuedWalkRoots.add(root);
      return job;
    });
  }

  function admitWalkJob(root, job) {
    if (!root || !job || queuedWalkRoots.has(root)) return;
    const result = walkWork.admit(job, root, !!job.urgent);
    if (!result.admitted) return;
    queuedWalkRoots.add(root);
  }
"""
if text.count(old) != 1:
    raise SystemExit('Engine walk recovery block changed')
text = text.replace(old, new)

old = """  function rememberShadowRecovery(root) {
    if (!root || !rootConnected(root)) return;
    const current = shadowRecoveryRef?.deref?.();
    const merged = current && rootConnected(current) ? commonWalkRecoveryRoot(current, root) : root;
    if (!merged || !rootConnected(merged)) return;
    shadowRecoveryRef = new WeakRef(merged);
  }

  function promoteShadowRecovery() {
    if (shadowJobs.length || !shadowRecoveryRef) return false;
    const root = shadowRecoveryRef.deref?.();
    shadowRecoveryRef = null;
    if (!root || !rootConnected(root) || queuedShadowRoots.has(root)) return false;
    shadowGeneration.set(root, currentShadowGeneration(root) + 1);
    queuedShadowRoots.add(root);
    shadowJobs.push(makeShadowJob(root));
    return true;
  }

  function queueShadowSweep(root) {
    if (!broadShadowEnabled || !root || !rootConnected(root)) return;
    shadowGeneration.set(root, currentShadowGeneration(root) + 1);
    if (queuedShadowRoots.has(root)) return;
    if (shadowJobs.length >= MAX_SHADOW_JOBS) {
      // Existing FIFO cursors remain authoritative; compress only new excess final state.
      rememberShadowRecovery(root);
      scheduleBackground();
      return;
    }
    queuedShadowRoots.add(root);
    shadowJobs.push(makeShadowJob(root));
    scheduleBackground();
  }
"""
new = """  function promoteShadowRecovery() {
    if (shadowJobs.length || !shadowWork.hasRecovery) return false;
    return shadowWork.promote(root => {
      if (!root || !rootConnected(root) || queuedShadowRoots.has(root)) return null;
      shadowGeneration.set(root, currentShadowGeneration(root) + 1);
      queuedShadowRoots.add(root);
      return makeShadowJob(root);
    });
  }

  function queueShadowSweep(root) {
    if (!broadShadowEnabled || !root || !rootConnected(root)) return;
    shadowGeneration.set(root, currentShadowGeneration(root) + 1);
    if (queuedShadowRoots.has(root)) return;
    const result = shadowWork.admit(makeShadowJob(root), root, null);
    if (!result.admitted) {
      scheduleBackground();
      return;
    }
    queuedShadowRoots.add(root);
    scheduleBackground();
  }
"""
if text.count(old) != 1:
    raise SystemExit('Engine shadow recovery block changed')
text = text.replace(old, new)

old = 'return !!(rootBatches.length || walkJobs.length || walkRecoveryRef || batchJobs.length || shadowJobs.length || shadowRecoveryRef);'
new = 'return !!(rootBatches.length || walkJobs.length || walkWork.hasRecovery || batchJobs.length || shadowJobs.length || shadowWork.hasRecovery);'
if text.count(old) != 1:
    raise SystemExit('Engine background liveness expression changed')
text = text.replace(old, new)

old = """    rootBatches.length = 0;
    walkJobs.length = 0;
    walkRecoveryRef = null;
    walkRecoveryUrgent = false;
    shadowJobs.length = 0;
    shadowRecoveryRef = null;
    batchJobs.length = 0;
"""
new = """    rootBatches.length = 0;
    walkWork.clear();
    shadowWork.clear();
    batchJobs.length = 0;
"""
if text.count(old) != 1:
    raise SystemExit('Engine clearQueuedWork block changed')
text = text.replace(old, new)
engine.write_text(text)

# Unit model must be a permanent gate.
pkg = Path('package.json')
text = pkg.read_text()
old = 'node tests/static-contract.mjs && node tests/version-contract.mjs'
new = 'node tests/static-contract.mjs && node tests/runtime-kernel.mjs && node tests/version-contract.mjs'
if text.count(old) != 1:
    raise SystemExit('package check anchor changed')
pkg.write_text(text.replace(old, new))

# Generation lease VM loads the same birth-generation kernel first.
lease_test = Path('tests/generation-lease.mjs')
text = lease_test.read_text()
replace_from = "const source=fs.readFileSync('extension/generation-lease.js','utf8');"
replace_to = "const kernelSource=fs.readFileSync('extension/runtime-kernel.js','utf8');\nconst source=fs.readFileSync('extension/generation-lease.js','utf8');"
if text.count(replace_from) != 1:
    raise SystemExit('generation lease source anchor changed')
text = text.replace(replace_from, replace_to)
old = "const context=vm.createContext({chrome,HTMLElement,Object,Reflect,Error});\nvm.runInContext(source,context);"
new = "const context=vm.createContext({chrome,HTMLElement,Object,Reflect,Error,WeakRef,performance});\nvm.runInContext(kernelSource,context);\nvm.runInContext(source,context);"
if text.count(old) != 1:
    raise SystemExit('generation lease VM anchor changed')
lease_test.write_text(text.replace(old, new))

# Worker VM harnesses now expose the installed manifest generation.
for path in ['tests/worker-profile-governance.mjs', 'tests/worker-restart.mjs']:
    p = Path(path)
    text = p.read_text()
    old = 'runtime:{onMessage:{addListener(fn){listener=fn;}},onInstalled:{addListener'
    if text.count(old) != 1:
        raise SystemExit(f'{path}: runtime mock anchor changed')
    p.write_text(text.replace(old, 'runtime:{getManifest(){return {version:CURRENT_VERSION};},onMessage:{addListener(fn){listener=fn;}},onInstalled:{addListener', 1))

wc = Path('tests/worker-contract.mjs')
text = wc.read_text()
old = """runtime:{
    onMessage:{addListener(fn){listener=fn;}},
    onInstalled:{addListener(fn){installedListener=fn;}}
  },"""
new = """runtime:{
    getManifest(){return {version:CURRENT_VERSION};},
    onMessage:{addListener(fn){listener=fn;}},
    onInstalled:{addListener(fn){installedListener=fn;}}
  },"""
if text.count(old) != 1:
    raise SystemExit('worker-contract runtime mock anchor changed')
text = text.replace(old, new)
text = text.replace("['generation-lease.js','semantic-core.js','gate.js']", "['runtime-kernel.js','generation-lease.js','semantic-core.js','gate.js']")
text = text.replace("['generation-lease.js','semantic-core.js','handover-guard.js','risk-core.js','engine.js']", "['runtime-kernel.js','generation-lease.js','semantic-core.js','handover-guard.js','risk-core.js','engine.js']")
wc.write_text(text)

wr = Path('tests/worker-restart.mjs')
text = wr.read_text()
old = "const PROTECTION_FILES=['generation-lease.js','semantic-core.js','handover-guard.js'];"
new = "const PROTECTION_FILES=['runtime-kernel.js','generation-lease.js','semantic-core.js','handover-guard.js'];"
if text.count(old) != 1:
    raise SystemExit('worker-restart protection anchor changed')
wr.write_text(text.replace(old, new))

scheduler = Path('tests/worker-scheduler.mjs')
text = scheduler.read_text()
if 'const CURRENT_VERSION=' not in text:
    text = text.replace(
        "const source=fs.readFileSync('extension/worker.js','utf8');",
        "const source=fs.readFileSync('extension/worker.js','utf8');\nconst CURRENT_VERSION=JSON.parse(fs.readFileSync('extension/manifest.json','utf8')).version;",
    )
old = "const chrome={runtime:{onMessage:{addListener(fn){listener=fn;}},onInstalled:{addListener(){}}},storage:"
new = "const chrome={runtime:{getManifest(){return {version:CURRENT_VERSION};},onMessage:{addListener(fn){listener=fn;}},onInstalled:{addListener(){}}},storage:"
if text.count(old) != 1:
    raise SystemExit('worker-scheduler runtime mock anchor changed')
scheduler.write_text(text.replace(old, new))

# Generation coherence now has one isolated birth literal + manifest-derived Worker.
Path('tests/version-contract.mjs').write_text("""import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const EXTENSION = path.resolve('extension');
const manifest = JSON.parse(fs.readFileSync(path.join(EXTENSION, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = String(manifest.version || '');

assert.match(version, /^\\d+\\.\\d+\\.\\d+$/, 'manifest must expose one semantic runtime generation');
assert.equal(pkg.version, version, 'package and extension manifest must describe the same release generation');

const kernel = fs.readFileSync(path.join(EXTENSION, 'runtime-kernel.js'), 'utf8');
const kernelVersions = [...kernel.matchAll(/const\\s+VERSION\\s*=\\s*['\"]([^'\"]+)['\"]/g)];
assert.equal(kernelVersions.length, 1, 'runtime-kernel must expose exactly one isolated-world birth generation');
assert.equal(kernelVersions[0][1], version, 'runtime-kernel birth generation must equal the manifest release');

const isolatedModules = ['bootstrap.js','engine.js','gate.js','generation-lease.js','handover-guard.js','risk-core.js','semantic-core.js'];
for (const file of isolatedModules) {
  const source = fs.readFileSync(path.join(EXTENSION, file), 'utf8');
  assert.match(source, /__AUTO_AGREE_RUNTIME_KERNEL__/, `${file} must derive its birth generation from runtime-kernel`);
  assert.match(source, /const\\s+VERSION\\s*=\\s*KERNEL\\?\\.version/, `${file} must snapshot the kernel birth generation`);
}

const worker = fs.readFileSync(path.join(EXTENSION, 'worker.js'), 'utf8');
assert.match(worker, /const\\s+VERSION\\s*=\\s*chrome\\.runtime\\.getManifest\\(\\)\\.version/, 'Worker must derive current generation from Chrome manifest');

const productionJs = fs.readdirSync(EXTENSION).filter(name => name.endsWith('.js')).sort();
assert.deepEqual(
  productionJs,
  ['bootstrap.js','engine.js','gate.js','generation-lease.js','handover-guard.js','risk-core.js','runtime-kernel.js','semantic-core.js','worker.js'],
  'version contract must cover the complete production JavaScript closure'
);
for (const file of productionJs) {
  const source = fs.readFileSync(path.join(EXTENSION, file), 'utf8');
  const literals = [...source.matchAll(/\\b\\d+\\.\\d+\\.\\d+\\b/g)].map(match => match[0]);
  if (file === 'runtime-kernel.js') assert.deepEqual(literals, [version], 'runtime-kernel must be the only production JS birth-generation literal');
  else assert.deepEqual(literals, [], `${file} must not carry an independent release generation literal`);
}

console.log(`version-contract: PASS (${version}, one isolated birth generation + manifest-derived Worker)`);
""")

# Static contract: kernel is a required dependency and shared authority.
sc = Path('tests/static-contract.mjs')
text = sc.read_text()
text = text.replace(
    "assert.deepEqual(manifest.content_scripts[0].js,['generation-lease.js','bootstrap.js']);",
    "assert.deepEqual(manifest.content_scripts[0].js,['runtime-kernel.js','generation-lease.js','bootstrap.js']);",
)
text = text.replace(
    "const files=['generation-lease.js','bootstrap.js','handover-guard.js','semantic-core.js','risk-core.js','gate.js','engine.js','worker.js'];",
    "const files=['runtime-kernel.js','generation-lease.js','bootstrap.js','handover-guard.js','semantic-core.js','risk-core.js','gate.js','engine.js','worker.js'];",
)
marker = "const source=files.map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\\n');"
insert = marker + "\nconst runtimeKernel=fs.readFileSync(path.join(root,'runtime-kernel.js'),'utf8');\nassert.match(runtimeKernel,/createBoundedFifo/,'runtime kernel must own bounded FIFO admission');\nassert.match(runtimeKernel,/refreshLiveAge/,'runtime kernel must own live-age semantics');\nassert.match(runtimeKernel,/new WeakRef\\(mergedScope\\)/,'bounded recovery must remain weak');\nassert.equal(/queue\\.shift\\(\\)/.test(runtimeKernel),false,'kernel admission must never evict an old FIFO job');"
if text.count(marker) != 1:
    raise SystemExit('static-contract source marker changed')
text = text.replace(marker, insert)
text = text.replace(
    "/\\['generation-lease\\.js', 'semantic-core\\.js', 'handover-guard\\.js'\\]/",
    "/\\['runtime-kernel\\.js', 'generation-lease\\.js', 'semantic-core\\.js', 'handover-guard\\.js'\\]/",
)
text = text.replace(
    "/\\['generation-lease\\.js', 'semantic-core\\.js', 'gate\\.js'\\]/",
    "/\\['runtime-kernel\\.js', 'generation-lease\\.js', 'semantic-core\\.js', 'gate\\.js'\\]/",
)
text = text.replace(
    "/\\['generation-lease\\.js', 'semantic-core\\.js', 'handover-guard\\.js', 'risk-core\\.js', 'engine\\.js'\\]/",
    "/\\['runtime-kernel\\.js', 'generation-lease\\.js', 'semantic-core\\.js', 'handover-guard\\.js', 'risk-core\\.js', 'engine\\.js'\\]/",
)
text = text.replace(
    "assert.match(worker,/semantic-core\\.js/);",
    "assert.match(worker,/semantic-core\\.js/);assert.match(worker,/chrome\\.runtime\\.getManifest\\(\\)\\.version/,'Worker generation authority must come from Chrome manifest');",
)
sc.write_text(text)

# Walk static contract now targets the shared kernel rather than private recovery fields.
sb = Path('tests/static-bounded-work.mjs')
text = sb.read_text()
text = text.replace(
    "const engine = fs.readFileSync('extension/engine.js', 'utf8');",
    "const engine = fs.readFileSync('extension/engine.js', 'utf8');\nconst kernel = fs.readFileSync('extension/runtime-kernel.js', 'utf8');",
)
start = text.index("assert.equal(\n  /while\\s*\\(walkJobs")
end = text.index("\nassert.equal(\n  /while\\s*\\(deep", start)
new_walk = r"""assert.equal(
  /while\s*\(walkJobs\.length\s*>=\s*MAX_WALK_JOBS\)\s*releaseWalkJob\(walkJobs\.shift\(\)\)/.test(engine),
  false,
  'Engine walk pressure must not evict an older unfinished FIFO cursor'
);
assert.match(engine, /MAX_WALK_JOBS\s*=\s*12/, 'Engine walk recovery must preserve the hard walk-job cap');
assert.match(engine, /const\s+walkWork\s*=\s*KERNEL\.createBoundedFifo/, 'Engine walk must use the shared bounded-work authority');
assert.match(engine, /capacity:\s*MAX_WALK_JOBS/, 'Engine walk kernel capacity must remain the proven 12-job cap');
assert.match(engine, /commonWalkRecoveryRoot\(current, next\)/, 'Engine retains domain-specific final-state coalescing');
assert.match(engine, /meta:\s*!!currentUrgent\s*\|\|\s*!!nextUrgent/, 'walk recovery must preserve urgent intent monotonically');
assert.match(engine, /walkWork\.admit\(job, root, !!job\.urgent\)/, 'Engine walk admission must route through the shared kernel');
assert.match(engine, /walkWork\.promote\(/, 'Engine walk recovery must re-enter ordinary traversal through the kernel');
assert.match(engine, /walkWork\.hasRecovery/, 'background liveness must include kernel-owned walk recovery');
assert.match(engine, /walkWork\.clear\(\)/, 'lifecycle retirement must clear kernel-owned walk work');
assert.match(kernel, /if \(queue\.length >= capacity\) return \{ admitted: false, recovered: remember\(scope, meta\) \};/, 'kernel overflow must compress only the new scope');
assert.match(kernel, /recoveryRef = new WeakRef\(mergedScope\)/, 'shared recovery must remain weak');
assert.match(engine, /admitWalkJob\(root,\s*job\)/, 'Engine processSubtree must use bounded lossless walk admission');
assert.match(engineWalkE2e, /const\s+ROOTS\s*=\s*20/, 'Engine walk saturation fixture must exceed the 12-job cap materially');
assert.match(engineWalkE2e, /const\s+NODES\s*=\s*900/, 'Engine walk saturation roots must require background continuation');
assert.match(engineWalkE2e, /timeout:\s*9000/, 'Engine walk saturation keeps a fixed eventual-progress deadline');
"""
text = text[:start] + new_walk + text[end:]
sb.write_text(text)

# Shadow contract similarly follows the shared bounded-work authority.
Path('tests/static-engine-shadow.mjs').write_text(r"""import fs from 'node:fs';
import assert from 'node:assert/strict';

const engine = fs.readFileSync('extension/engine.js', 'utf8');
const kernel = fs.readFileSync('extension/runtime-kernel.js', 'utf8');
const shadowE2e = fs.readFileSync('tests/e2e-engine-shadow-overflow.mjs', 'utf8');

assert.match(engine, /MAX_SHADOW_JOBS\s*=\s*8/, 'Engine shadow recovery must preserve the hard 8-job cap');
assert.equal(/while\s*\(shadowJobs\.length\s*>=\s*MAX_SHADOW_JOBS\)[\s\S]{0,260}shadowJobs\.shift\(\)/.test(engine), false, 'Engine broad-shadow pressure must not evict an older unfinished FIFO cursor');
assert.match(engine, /const\s+shadowWork\s*=\s*KERNEL\.createBoundedFifo/, 'Engine broad Shadow must use shared bounded-work authority');
assert.match(engine, /capacity:\s*MAX_SHADOW_JOBS/, 'shared Shadow capacity must remain the proven 8-job cap');
assert.match(engine, /coalesce:\s*\(current, next\)[\s\S]{0,100}commonWalkRecoveryRoot\(current, next\)/, 'Shadow retains domain-specific common-root coalescing');
assert.match(engine, /shadowWork\.admit\(makeShadowJob\(root\), root, null\)/, 'new Shadow work must route through bounded FIFO admission');
assert.match(engine, /shadowWork\.promote\(/, 'Shadow recovery must re-enter ordinary traversal through the kernel');
assert.match(engine, /shadowWork\.hasRecovery/, 'background liveness must include pending kernel-owned Shadow recovery');
assert.match(engine, /shadowWork\.clear\(\)/, 'lifecycle retirement must clear kernel-owned Shadow work');
assert.match(kernel, /recoveryRef = new WeakRef\(mergedScope\)/, 'shared recovery must never strongly own the DOM scope');
assert.match(engine, /if\s*\(!rootBatches\.length\s*&&\s*!walkJobs\.length\s*&&\s*!batchJobs\.length\s*&&\s*!shadowJobs\.length\)\s*promoteShadowRecovery\(\)/, 'broad-shadow recovery must not overtake RootBatch, walk, batch, or ordinary shadow work');

assert.match(shadowE2e, /const\s+ROOTS\s*=\s*14/, 'closed-shadow saturation must materially exceed the 8-job cap');
assert.match(shadowE2e, /const\s+NODES\s*=\s*900/, 'closed-shadow roots must require background continuation');
assert.match(shadowE2e, /attachShadow\(\{mode:\s*'closed'\}\)/, 'the unique target must remain hidden in a closed ShadowRoot');
assert.match(shadowE2e, /document\.createElement\('div'\)/, 'the closed ShadowRoot host must remain a plain DIV invisible to ordinary probing');
assert.match(shadowE2e, /timeout:\s*9000/, 'closed-shadow saturation keeps a fixed eventual-progress deadline');
assert.match(shadowE2e, /broad closed-shadow discovery must survive MAX_SHADOW_JOBS pressure exactly once/, 'closed-shadow saturation must require exactly-once recovery');

console.log('static-engine-shadow: PASS');
""")

print('v12 runtime-kernel migration prepared successfully')
