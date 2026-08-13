import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const authority = JSON.parse(fs.readFileSync('release/package-manifest.json', 'utf8'));
const version = JSON.parse(fs.readFileSync('extension/manifest.json', 'utf8')).version;
assert.deepEqual(Object.keys(authority), ['schemaVersion', 'version', 'archive', 'compression', 'textEncoding', 'textLineEndings', 'entryTimestamp', 'entryMode', 'entryCreatorSystem', 'entries', 'sha256']);
assert.equal(authority.schemaVersion, 3);
assert.equal(authority.version, version);
assert.equal(authority.archive, `AutoAgree-v${version}.zip`);
assert.equal(authority.compression, 'stored');
assert.equal(authority.textEncoding, 'utf-8');
assert.equal(authority.textLineEndings, 'lf');
assert.equal(authority.entryTimestamp, '2026-08-08T00:00:00Z');
assert.equal(authority.entryMode, '100644');
assert.equal(authority.entryCreatorSystem, 'unix');
assert.deepEqual(authority.entries, ['manifest.json', ...fs.readdirSync('extension').filter(name => name.endsWith('.js')).sort(), 'README.md']);
assert.match(authority.sha256, /^[a-f0-9]{64}$/);

const packager = fs.readFileSync('tools/package_extension.py', 'utf8');
assert.match(packager, /replace\('\\r\\n','\\n'\)\.replace\('\\r','\\n'\)/, 'package members must canonicalize checkout line endings to LF');
assert.match(packager, /decode\('utf-8'\)/, 'package text encoding must be explicit');
assert.match(packager, /info\.create_system=3/, 'package creator system must not inherit the host OS');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-agree-package-'));
try {
  const outputs = ['first.zip', 'second.zip'].map(name => path.join(temp, name));
  for (const output of outputs) {
    const result = spawnSync('python', ['tools/package_extension.py', '--output', output], {
      cwd: process.cwd(), encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
  const bytes = outputs.map(output => fs.readFileSync(output));
  assert.deepEqual(bytes[0], bytes[1], 'two independent package processes must emit identical bytes');
  assert.equal(crypto.createHash('sha256').update(bytes[0]).digest('hex'), authority.sha256);
} finally {
  fs.rmSync(temp, {recursive: true, force: true});
}
console.log(`package-reproducibility: PASS (${authority.archive} ${authority.sha256})`);
