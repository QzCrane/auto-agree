import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const EXTENSION = path.resolve('extension');
const manifest = JSON.parse(fs.readFileSync(path.join(EXTENSION, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const version = String(manifest.version || '');

assert.match(version, /^\d+\.\d+\.\d+$/, 'manifest must expose one semantic runtime generation');
assert.equal(pkg.version, version, 'package and extension manifest must describe the same release generation');
assert.equal(lock.version, version, 'package-lock top-level generation must match the manifest release');
assert.equal(lock.packages?.['']?.version, version, 'package-lock root package generation must match the manifest release');

const kernel = fs.readFileSync(path.join(EXTENSION, 'runtime-kernel.js'), 'utf8');
const kernelVersions = [...kernel.matchAll(/const\s+VERSION\s*=\s*['"]([^'"]+)['"]/g)];
assert.equal(kernelVersions.length, 1, 'runtime-kernel must expose exactly one isolated-world birth generation');
assert.equal(kernelVersions[0][1], version, 'runtime-kernel birth generation must equal the manifest release');

const isolatedModules = ['action-authority.js','bootstrap.js','decision-core.js','dom-core.js','engine.js','gate.js','generation-lease.js','handover-guard.js','risk-core.js','semantic-core.js'];
for (const file of isolatedModules) {
  const source = fs.readFileSync(path.join(EXTENSION, file), 'utf8');
  assert.match(source, /__AUTO_AGREE_RUNTIME_KERNEL__/, `${file} must derive its birth generation from runtime-kernel`);
  assert.match(source, /const\s+VERSION\s*=\s*KERNEL\?\.version/, `${file} must snapshot the kernel birth generation`);
}

const worker = fs.readFileSync(path.join(EXTENSION, 'worker.js'), 'utf8');
assert.match(worker, /const\s+VERSION\s*=\s*chrome\.runtime\.getManifest\(\)\.version/, 'Worker must derive current generation from Chrome manifest');

const productionJs = fs.readdirSync(EXTENSION).filter(name => name.endsWith('.js')).sort();
assert.deepEqual(
  productionJs,
  ['action-authority.js','bootstrap.js','decision-core.js','dom-core.js','engine.js','gate.js','generation-lease.js','handover-guard.js','profile-core.js','risk-core.js','runtime-kernel.js','scheduler-core.js','semantic-core.js','worker.js'],
  'version contract must cover the complete production JavaScript closure'
);
for (const file of productionJs) {
  const source = fs.readFileSync(path.join(EXTENSION, file), 'utf8');
  const literals = [...source.matchAll(/\b\d+\.\d+\.\d+\b/g)].map(match => match[0]);
  if (file === 'runtime-kernel.js') assert.deepEqual(literals, [version], 'runtime-kernel must be the only production JS birth-generation literal');
  else assert.deepEqual(literals, [], `${file} must not carry an independent release generation literal`);
}

const runtimeKernelTest = fs.readFileSync(path.resolve('tests/runtime-kernel.mjs'), 'utf8');
assert.match(runtimeKernelTest, /const\s+CURRENT_VERSION\s*=\s*JSON\.parse\(fs\.readFileSync\('extension\/manifest\.json',\s*'utf8'\)\)\.version/, 'RuntimeKernel unit model must derive the candidate generation from the manifest');
assert.equal(/assert\.equal\(kernel\.version,\s*['"]\d+\.\d+\.\d+['"]\)/.test(runtimeKernelTest), false, 'RuntimeKernel unit model must not hardcode the current release generation');

console.log(`version-contract: PASS (${version}, manifest/package/lock + one isolated birth generation + manifest-derived Worker/test)`);
