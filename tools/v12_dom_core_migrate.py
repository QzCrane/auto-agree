from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one exact match, found {count}: {old[:100]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


def write(path: str, content: str) -> None:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding='utf-8')


DOM_CORE = r'''(() => {
  'use strict';
  const KERNEL = globalThis.__AUTO_AGREE_RUNTIME_KERNEL__;
  const VERSION = KERNEL?.version;
  if (!KERNEL || !VERSION) return;
  if (globalThis.__AUTO_AGREE_DOM_CORE__?.version === VERSION) return;

  function composedParent(el) {
    if (!(el instanceof Element)) return null;
    if (el.assignedSlot instanceof Element) return el.assignedSlot;
    if (el.parentElement) return el.parentElement;
    const root = el.getRootNode?.();
    return root instanceof ShadowRoot && root.host instanceof Element ? root.host : null;
  }

  function rootQueryById(el, id) {
    if (!(el instanceof Element) || !id) return null;
    const root = el.getRootNode();
    try {
      if (root instanceof Document) return root.getElementById(id);
      if (root instanceof DocumentFragment) return root.querySelector(`#${CSS.escape(id)}`);
      return null;
    } catch (_) { return null; }
  }

  globalThis.__AUTO_AGREE_DOM_CORE__ = Object.freeze({
    version: VERSION,
    composedParent,
    rootQueryById
  });
})();
'''

DOM_TEST = r'''import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

class DocumentFragment {
  constructor(entries = new Map()) { this.entries = entries; }
  querySelector(selector) { return this.entries.get(selector) || null; }
}
class Element {
  constructor() { this.assignedSlot = null; this.parentElement = null; this.root = null; }
  getRootNode() { return this.root; }
}
class ShadowRoot extends DocumentFragment {
  constructor(host, entries = new Map()) { super(entries); this.host = host; }
}
class Document {
  constructor(entries = new Map()) { this.entries = entries; }
  getElementById(id) { return this.entries.get(id) || null; }
}

const source = fs.readFileSync('extension/dom-core.js', 'utf8');
assert.equal(/createTreeWalker|querySelectorAll|textContent|innerText/.test(source), false, 'DomCore topology primitives must not grow into a scanning policy layer');
const context = vm.createContext({
  console,
  Element,
  Document,
  DocumentFragment,
  ShadowRoot,
  CSS: { escape(value) { return String(value).replace(/[^a-zA-Z0-9_-]/g, ch => `\\${ch}`); } },
  __AUTO_AGREE_RUNTIME_KERNEL__: Object.freeze({ version: '11.0.0' })
});
vm.runInContext(source, context);
const core = context.__AUTO_AGREE_DOM_CORE__;
assert.ok(core);
assert.equal(core.version, '11.0.0');

const target = new Element();
const slot = new Element();
const parent = new Element();
target.assignedSlot = slot;
target.parentElement = parent;
assert.equal(core.composedParent(target), slot, 'assigned slot owns composed ancestry before light-DOM parent');
target.assignedSlot = null;
assert.equal(core.composedParent(target), parent);
target.parentElement = null;
const host = new Element();
target.root = new ShadowRoot(host);
assert.equal(core.composedParent(target), host, 'ShadowRoot host closes composed ancestry');
assert.equal(core.composedParent(null), null);

const docTarget = new Element();
const docRef = new Element();
docTarget.root = new Document(new Map([['policy', docRef]]));
assert.equal(core.rootQueryById(docTarget, 'policy'), docRef);
const shadowTarget = new Element();
const shadowRef = new Element();
shadowTarget.root = new ShadowRoot(host, new Map([['#policy', shadowRef]]));
assert.equal(core.rootQueryById(shadowTarget, 'policy'), shadowRef, 'IDREF lookup must remain inside the current tree root');
assert.equal(core.rootQueryById(shadowTarget, ''), null);
assert.equal(core.rootQueryById(null, 'policy'), null);
const throwing = new Element();
throwing.root = new DocumentFragment();
throwing.root.querySelector = () => { throw new Error('synthetic selector failure'); };
assert.equal(core.rootQueryById(throwing, 'x'), null, 'topology lookup fails closed on malformed selectors/roots');

console.log('dom-core: PASS');
'''

write('extension/dom-core.js', DOM_CORE)
write('tests/dom-core.mjs', DOM_TEST)

# Engine consumes topology primitives but keeps its own evidence budgets/text/label policy.
replace_once(
    'extension/engine.js',
    "  const PROFILE = globalThis.__AUTO_AGREE_PROFILE_CORE__;\n  const RISK = globalThis.__AUTO_AGREE_RISK__;\n  if (!CORE || CORE.version !== VERSION || !POLICY || POLICY.version !== VERSION || !PROFILE || !RISK || RISK.version !== VERSION) return;",
    "  const PROFILE = globalThis.__AUTO_AGREE_PROFILE_CORE__;\n  const DOM = globalThis.__AUTO_AGREE_DOM_CORE__;\n  const RISK = globalThis.__AUTO_AGREE_RISK__;\n  if (!CORE || CORE.version !== VERSION || !POLICY || POLICY.version !== VERSION || !PROFILE || !DOM || DOM.version !== VERSION || !RISK || RISK.version !== VERSION) return;"
)
replace_once(
    'extension/engine.js',
    "  const { decideEvidence, decideClasslessEvidence } = POLICY;\n  const { ttlMs: CACHE_TTL_MS, maxFlows: PROFILE_MAX_FLOWS } = PROFILE.CONFIG;",
    "  const { decideEvidence, decideClasslessEvidence } = POLICY;\n  const { composedParent, rootQueryById } = DOM;\n  const { ttlMs: CACHE_TTL_MS, maxFlows: PROFILE_MAX_FLOWS } = PROFILE.CONFIG;"
)
replace_once(
    'extension/engine.js',
    '''  function rootQueryById(el, id) {\n    if (!id || !(el instanceof Element)) return null;\n    const root = el.getRootNode();\n    try {\n      if (root instanceof Document) return root.getElementById(id);\n      if (root instanceof DocumentFragment) return root.querySelector(`#${CSS.escape(id)}`);\n      return null;\n    } catch (_) { return null; }\n  }\n\n''',
    ''
)
replace_once(
    'extension/engine.js',
    '''  function composedParent(el) {\n    if (!(el instanceof Element)) return null;\n    if (el.assignedSlot instanceof Element) return el.assignedSlot;\n    if (el.parentElement) return el.parentElement;\n    const root = el.getRootNode?.();\n    return root instanceof ShadowRoot && root.host instanceof Element ? root.host : null;\n  }\n\n''',
    ''
)

# Handover firewall consumes the same topology primitives but retains its own safety text budget.
replace_once(
    'extension/handover-guard.js',
    "  const CORE = globalThis.__AUTO_AGREE_SEMANTIC__;\n  if (!CORE || CORE.version !== VERSION || typeof CORE.assessText !== 'function') {\n    throw new Error(`Auto Agree handover semantic dependency unavailable for ${VERSION}`);\n  }\n  const { normalize, joinNormalized, assessText } = CORE;",
    "  const CORE = globalThis.__AUTO_AGREE_SEMANTIC__;\n  const DOM = globalThis.__AUTO_AGREE_DOM_CORE__;\n  if (!CORE || CORE.version !== VERSION || typeof CORE.assessText !== 'function' || !DOM || DOM.version !== VERSION) {\n    throw new Error(`Auto Agree handover dependency unavailable for ${VERSION}`);\n  }\n  const { normalize, joinNormalized, assessText } = CORE;\n  const { composedParent, rootQueryById } = DOM;"
)
replace_once(
    'extension/handover-guard.js',
    '''  function composedParent(el) {\n    if (!(el instanceof Element)) return null;\n    if (el.assignedSlot instanceof Element) return el.assignedSlot;\n    if (el.parentElement) return el.parentElement;\n    const root = el.getRootNode?.();\n    return root instanceof ShadowRoot && root.host instanceof Element ? root.host : null;\n  }\n\n''',
    ''
)
replace_once(
    'extension/handover-guard.js',
    '''  function rootQueryById(el, id) {\n    if (!(el instanceof Element) || !id) return null;\n    const root = el.getRootNode();\n    try {\n      if (root instanceof Document) return root.getElementById(id);\n      if (root instanceof DocumentFragment) return root.querySelector(`#${CSS.escape(id)}`);\n      return null;\n    } catch (_) { return null; }\n  }\n\n''',
    ''
)

# Physical injection order: DomCore must exist before any Guard/Engine consumer.
replace_once(
    'extension/worker.js',
    "['runtime-kernel.js', 'generation-lease.js', 'semantic-core.js', 'handover-guard.js']",
    "['runtime-kernel.js', 'generation-lease.js', 'semantic-core.js', 'dom-core.js', 'handover-guard.js']"
)
replace_once(
    'extension/worker.js',
    "['runtime-kernel.js', 'generation-lease.js', 'semantic-core.js', 'handover-guard.js', 'decision-core.js', 'profile-core.js', 'risk-core.js', 'engine.js']",
    "['runtime-kernel.js', 'generation-lease.js', 'semantic-core.js', 'dom-core.js', 'handover-guard.js', 'decision-core.js', 'profile-core.js', 'risk-core.js', 'engine.js']"
)
replace_once(
    'tests/worker-contract.mjs',
    "['runtime-kernel.js','generation-lease.js','semantic-core.js','handover-guard.js','decision-core.js','profile-core.js','risk-core.js','engine.js']",
    "['runtime-kernel.js','generation-lease.js','semantic-core.js','dom-core.js','handover-guard.js','decision-core.js','profile-core.js','risk-core.js','engine.js']"
)
replace_once(
    'tests/worker-restart.mjs',
    "const PROTECTION_FILES=['runtime-kernel.js','generation-lease.js','semantic-core.js','handover-guard.js'];",
    "const PROTECTION_FILES=['runtime-kernel.js','generation-lease.js','semantic-core.js','dom-core.js','handover-guard.js'];"
)

# Version closure owns the new production module and no release literal is duplicated.
replace_once(
    'tests/version-contract.mjs',
    "const isolatedModules = ['bootstrap.js','decision-core.js','engine.js','gate.js','generation-lease.js','handover-guard.js','risk-core.js','semantic-core.js'];",
    "const isolatedModules = ['bootstrap.js','decision-core.js','dom-core.js','engine.js','gate.js','generation-lease.js','handover-guard.js','risk-core.js','semantic-core.js'];"
)
replace_once(
    'tests/version-contract.mjs',
    "['bootstrap.js','decision-core.js','engine.js','gate.js','generation-lease.js','handover-guard.js','profile-core.js','risk-core.js','runtime-kernel.js','scheduler-core.js','semantic-core.js','worker.js']",
    "['bootstrap.js','decision-core.js','dom-core.js','engine.js','gate.js','generation-lease.js','handover-guard.js','profile-core.js','risk-core.js','runtime-kernel.js','scheduler-core.js','semantic-core.js','worker.js']"
)

# Static contract locks authority ownership and injection closure, not duplicated implementation text.
replace_once(
    'tests/static-contract.mjs',
    r"assert.match(worker,/\['runtime-kernel\.js', 'generation-lease\.js', 'semantic-core\.js', 'handover-guard\.js'\]/,'protection phase must install the cooperative generation lease and shared semantics before handover guard');",
    r"assert.match(worker,/\['runtime-kernel\.js', 'generation-lease\.js', 'semantic-core\.js', 'dom-core\.js', 'handover-guard\.js'\]/,'protection phase must install lease, semantics and DomCore before handover guard');"
)
replace_once(
    'tests/static-contract.mjs',
    r"assert.match(worker,/\['runtime-kernel\.js', 'generation-lease\.js', 'semantic-core\.js', 'handover-guard\.js', 'decision-core\.js', 'profile-core\.js', 'risk-core\.js', 'engine\.js'\]/,'every Engine-capable world must carry lease, policy, fresh ProfileCore and handover guard');",
    r"assert.match(worker,/\['runtime-kernel\.js', 'generation-lease\.js', 'semantic-core\.js', 'dom-core\.js', 'handover-guard\.js', 'decision-core\.js', 'profile-core\.js', 'risk-core\.js', 'engine\.js'\]/,'every Engine-capable world must carry lease, DomCore, policy, fresh ProfileCore and handover guard');"
)
replace_once(
    'tests/static-contract.mjs',
    "const guard=fs.readFileSync(path.join(root,'handover-guard.js'),'utf8');",
    "const domCore=fs.readFileSync(path.join(root,'dom-core.js'),'utf8');\nassert.match(domCore,/function composedParent\\s*\\(/,'DomCore must own composed-tree ancestry');\nassert.match(domCore,/function rootQueryById\\s*\\(/,'DomCore must own root-scoped IDREF lookup');\nassert.equal(/createTreeWalker|querySelectorAll|textContent|innerText/.test(domCore),false,'DomCore must remain topology-only, not become a tier policy/scanner');\n\nconst guard=fs.readFileSync(path.join(root,'handover-guard.js'),'utf8');\nassert.match(guard,/const DOM = globalThis\\.__AUTO_AGREE_DOM_CORE__/,'handover guard must consume shared DOM topology');\nassert.equal(/function\\s+(?:composedParent|rootQueryById)\\s*\\(/.test(guard),false,'handover guard must not retain private topology copies');"
)
replace_once(
    'tests/static-contract.mjs',
    "const engine=fs.readFileSync(path.join(root,'engine.js'),'utf8');",
    "const engine=fs.readFileSync(path.join(root,'engine.js'),'utf8');\nassert.match(engine,/const DOM = globalThis\\.__AUTO_AGREE_DOM_CORE__/,'Engine must consume shared DOM topology');\nassert.equal(/function\\s+(?:composedParent|rootQueryById)\\s*\\(/.test(engine),false,'Engine must not retain private topology copies');"
)
replace_once(
    'tests/static-contract.mjs',
    "const engineDeps = 'if (!CORE || CORE.version !== VERSION || !POLICY || POLICY.version !== VERSION || !PROFILE || !RISK || RISK.version !== VERSION) return;';",
    "const engineDeps = 'if (!CORE || CORE.version !== VERSION || !POLICY || POLICY.version !== VERSION || !PROFILE || !DOM || DOM.version !== VERSION || !RISK || RISK.version !== VERSION) return;';"
)

# Permanent deterministic gate for the new authority.
replace_once(
    'package.json',
    'node tests/runtime-kernel.mjs && node tests/static-lifecycle.mjs',
    'node tests/runtime-kernel.mjs && node tests/dom-core.mjs && node tests/static-lifecycle.mjs'
)

print('v12-dom-core-migrate: PASS')
