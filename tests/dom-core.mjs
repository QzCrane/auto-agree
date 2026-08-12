import fs from 'node:fs';
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
