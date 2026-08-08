import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve('extension');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, '7.0.0');
assert.deepEqual([...manifest.permissions].sort(), ['scripting', 'storage']);
assert.deepEqual(manifest.host_permissions, ['<all_urls>']);
assert.deepEqual(manifest.content_scripts[0].js, ['bootstrap.js']);
assert.equal(manifest.content_scripts[0].world, 'ISOLATED');
assert.equal(manifest.content_scripts[0].all_frames, true);
assert.equal(manifest.content_scripts[0].match_about_blank, true);
assert.equal(manifest.content_scripts[0].match_origin_as_fallback, true);

const files = ['bootstrap.js','semantic-core.js','risk-core.js','gate.js','engine.js','worker.js'];
const source = files.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
const forbidden = [
  ['network fetch', /\bfetch\s*\(/],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['WebSocket', /\bWebSocket\b/],
  ['eval', /\beval\s*\(/],
  ['dynamic Function', /\bnew\s+Function\b/],
  ['polling interval', /\bsetInterval\s*\(/],
  ['whole-page wildcard scan', /querySelectorAll\s*\(\s*['\"]\*['\"]\s*\)/],
  ['debugger permission/API', /chrome\.debugger|['\"]debugger['\"]/]
];
for (const [name, re] of forbidden) assert.equal(re.test(source), false, `forbidden ${name}`);

assert.match(fs.readFileSync(path.join(root, 'worker.js'), 'utf8'), /semantic-core\.js/);
assert.match(fs.readFileSync(path.join(root, 'gate.js'), 'utf8'), /__AUTO_AGREE_SEMANTIC__/);
assert.match(fs.readFileSync(path.join(root, 'engine.js'), 'utf8'), /__AUTO_AGREE_SEMANTIC__/);
console.log('static-contract: PASS');
