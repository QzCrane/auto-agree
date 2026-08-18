import fs from 'node:fs';
import assert from 'node:assert/strict';

const engine = fs.readFileSync('extension/engine.js', 'utf8');
const start = engine.indexOf('function observeRoot(root)');
const end = engine.indexOf('function recheckPending()', start);
assert.ok(start >= 0 && end > start, 'observeRoot section must exist');
const observeRoot = engine.slice(start, end);

for (const attribute of ['checked','required','disabled','aria-checked','aria-required','aria-disabled','data-state','data-checked']) {
  assert.match(observeRoot, new RegExp(`['"]${attribute}['"]`), `document/Shadow discovery observer must watch ${attribute}`);
}
assert.match(engine, /if \(relevantControls\.has\(target\)\) return true;/, 'previously indexed controls must make state-attribute mutations relevant');
assert.ok(engine.indexOf('indexCandidate(s);') < engine.indexOf('const decision = decisionFor(s);', engine.indexOf('function processCandidate')), 'candidate indexing must precede acceptance so disabled candidates remain observable for later state transitions');

console.log('engine-state-transition-contract: PASS');
