import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const EXTENSION = path.resolve('extension');
const manifest = JSON.parse(fs.readFileSync(path.join(EXTENSION, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = String(manifest.version || '');

assert.match(version, /^\d+\.\d+\.\d+$/, 'manifest must expose one semantic runtime generation');
assert.equal(pkg.version, version, 'package and extension manifest must describe the same release generation');

const sentinels = [
  ['bootstrap.js', /__AUTO_AGREE_PROBE__\s*=\s*['"]([^'"]+)['"]/g],
  ['engine.js', /const\s+VERSION\s*=\s*['"]([^'"]+)['"]/g],
  ['gate.js', /const\s+VERSION\s*=\s*['"]([^'"]+)['"]/g],
  ['generation-lease.js', /const\s+VERSION\s*=\s*['"]([^'"]+)['"]/g],
  ['handover-guard.js', /const\s+VERSION\s*=\s*['"]([^'"]+)['"]/g],
  ['risk-core.js', /const\s+VERSION\s*=\s*['"]([^'"]+)['"]/g],
  ['semantic-core.js', /const\s+VERSION\s*=\s*['"]([^'"]+)['"]/g],
  ['worker.js', /const\s+VERSION\s*=\s*['"]([^'"]+)['"]/g]
];

for (const [file, pattern] of sentinels) {
  const source = fs.readFileSync(path.join(EXTENSION, file), 'utf8');
  const matches = [...source.matchAll(pattern)];
  assert.equal(matches.length, 1, `${file} must expose exactly one runtime generation sentinel`);
  assert.equal(matches[0][1], version, `${file} runtime generation must equal manifest ${version}`);
}

// The production JS closure may not carry a second semantic-version generation literal. This
// catches a stale old generation without hard-coding the prior release number, so the contract
// remains valid for future major cuts as long as every runtime surface moves coherently.
const productionJs = fs.readdirSync(EXTENSION).filter(name => name.endsWith('.js')).sort();
assert.deepEqual(
  productionJs,
  ['bootstrap.js','engine.js','gate.js','generation-lease.js','handover-guard.js','risk-core.js','semantic-core.js','worker.js'],
  'version contract must cover the complete production JavaScript closure'
);
for (const file of productionJs) {
  const source = fs.readFileSync(path.join(EXTENSION, file), 'utf8');
  const literals = [...source.matchAll(/\b\d+\.\d+\.\d+\b/g)].map(match => match[0]);
  for (const literal of literals) {
    assert.equal(literal, version, `${file} contains stale or foreign runtime generation ${literal}; expected ${version}`);
  }
}

console.log(`version-contract: PASS (${version}, ${sentinels.length} runtime sentinels)`);