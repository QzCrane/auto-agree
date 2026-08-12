import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const extension = path.resolve('extension');
const files = fs.readdirSync(extension)
  .filter(name => name.endsWith('.js'))
  .sort()
  .map(name => path.join('extension', name));
assert.ok(files.length > 0, 'production JavaScript closure must not be empty');
for (const file of files) {
  const r = spawnSync(process.execPath, ['--check', file], {encoding:'utf8'});
  assert.equal(r.status, 0, `${file}: ${r.stderr}`);
}
console.log(`syntax: PASS (${files.length} production JS files)`);
