import fs from 'node:fs';
import assert from 'node:assert/strict';

function replaceOnce(file, before, after) {
  const source = fs.readFileSync(file, 'utf8');
  const count = source.split(before).length - 1;
  assert.equal(count, 1, `${file}: expected exact source fragment once, found ${count}`);
  fs.writeFileSync(file, source.replace(before, after));
}

replaceOnce(
  'tests/runtime-kernel.mjs',
  "import fc from 'fast-check';\n\nconst context = vm.createContext({ console, WeakRef, performance });",
  "import fc from 'fast-check';\n\nconst CURRENT_VERSION = JSON.parse(fs.readFileSync('extension/manifest.json', 'utf8')).version;\nconst context = vm.createContext({ console, WeakRef, performance });"
);
replaceOnce(
  'tests/runtime-kernel.mjs',
  "assert.equal(kernel.version, '11.0.0');",
  "assert.equal(kernel.version, CURRENT_VERSION);"
);

replaceOnce(
  'tests/version-contract.mjs',
  "const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));\nconst version = String(manifest.version || '');",
  "const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));\nconst lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));\nconst version = String(manifest.version || '');"
);
replaceOnce(
  'tests/version-contract.mjs',
  "assert.match(version, /^\\d+\\.\\d+\\.\\d+$/, 'manifest must expose one semantic runtime generation');\nassert.equal(pkg.version, version, 'package and extension manifest must describe the same release generation');",
  "assert.match(version, /^\\d+\\.\\d+\\.\\d+$/, 'manifest must expose one semantic runtime generation');\nassert.equal(pkg.version, version, 'package and extension manifest must describe the same release generation');\nassert.equal(lock.version, version, 'package-lock top-level generation must match the manifest release');\nassert.equal(lock.packages?.['']?.version, version, 'package-lock root package generation must match the manifest release');"
);
replaceOnce(
  'tests/version-contract.mjs',
  "\nconsole.log(`version-contract: PASS (${version}, one isolated birth generation + manifest-derived Worker)`);",
  "\nconst runtimeKernelTest = fs.readFileSync(path.resolve('tests/runtime-kernel.mjs'), 'utf8');\nassert.match(runtimeKernelTest, /const\\s+CURRENT_VERSION\\s*=\\s*JSON\\.parse\\(fs\\.readFileSync\\('extension\\/manifest\\.json',\\s*'utf8'\\)\\)\\.version/, 'RuntimeKernel unit model must derive the candidate generation from the manifest');\nassert.equal(/assert\\.equal\\(kernel\\.version,\\s*['\"]\\d+\\.\\d+\\.\\d+['\"]\\)/.test(runtimeKernelTest), false, 'RuntimeKernel unit model must not hardcode the current release generation');\n\nconsole.log(`version-contract: PASS (${version}, manifest/package/lock + one isolated birth generation + manifest-derived Worker/test)`);"
);

console.log('generation-test-governance: PASS');
