import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const runner=fs.readFileSync('tests/run-core.mjs','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));

assert.equal(pkg.scripts.check,'node tests/run-core.mjs && npm run typecheck','package check must delegate deterministic registration to one auto-discovery runner');
assert.match(runner,/fs\.readdirSync\(DIR,\{withFileTypes:true\}\)/,'runner must discover the live tests directory');
assert.match(runner,/!name\.startsWith\('e2e-'\)/,'browser tests must remain in the explicit real-Chrome pipeline');
assert.match(runner,/name!==SELF/,'runner must not recurse into itself');
assert.match(runner,/\.sort\(\)/,'test execution order must be deterministic');
assert.match(runner,/spawnSync\(process\.execPath,\[file\]/,'each discovered gate must execute in a fresh Node process');
assert.match(runner,/if\(result\.status!==0\)/,'runner must fail fast when any discovered gate fails');

const discovered=fs.readdirSync('tests',{withFileTypes:true})
  .filter(entry=>entry.isFile()&&entry.name.endsWith('.mjs')&&entry.name!=='run-core.mjs'&&!entry.name.startsWith('e2e-'))
  .map(entry=>entry.name)
  .sort();
assert.ok(discovered.includes('classless-decision.mjs'),'classless policy property gate must be automatically registered');
assert.ok(discovered.includes('action-authority.mjs'),'ActionAuthority protocol gate must be automatically registered');
assert.ok(discovered.includes('language-parity.mjs'),'multilingual parity must be automatically registered');
assert.ok(discovered.includes('decision-core.mjs'),'DecisionKernel differential/safety gate must be automatically registered');
assert.ok(discovered.includes('profile-core.mjs')&&discovered.includes('profile-compat.mjs'),'ProfileCore gates must be automatically registered');
assert.ok(discovered.includes('scheduler-core.mjs'),'SchedulerCore gate must be automatically registered');
assert.ok(discovered.includes('performance-ledger.mjs'),'performance evidence schema gate must be automatically registered');

for(const name of discovered){
  assert.equal(path.dirname(path.join('tests',name)),'tests');
}
console.log(`core-runner-contract: PASS (${discovered.length} deterministic gates auto-registered)`);
