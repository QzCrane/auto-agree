import fs from 'node:fs';
import assert from 'node:assert/strict';

const engine = fs.readFileSync('extension/engine.js', 'utf8');
const probe = fs.readFileSync('extension/bootstrap.js', 'utf8');
const gate = fs.readFileSync('extension/gate.js', 'utf8');

assert.equal(
  /while\s*\(rootBatches\.length\s*>=\s*MAX_ROOT_BATCHES\)\s*rootBatches\.shift\(\)/.test(engine),
  false,
  'RootBatch pressure must never silently discard unfinished discovery work'
);
assert.match(engine, /function\s+sharedRootBatchParent\s*\(/, 'same-parent overflow needs final-state coalescing');
assert.match(engine, /queueRoot\(parent, urgent\)/, 'same-parent overflow must re-enter the normal bounded root path');
assert.match(engine, /function\s+appendRootBatchRefs\s*\(/, 'mixed-root overflow must retain weak recoverable work');
assert.match(engine, /new WeakRef\(root\)/, 'overflow recovery must not strongly retain detached DOM');
assert.match(engine, /MAX_ROOT_BATCHES\s*=\s*8/, 'lossless recovery must preserve the hard RootBatch object cap');

assert.equal(
  /while\s*\(deep\.length\s*>=\s*MAX_DEEP\)\s*releaseDeep\(deep\.shift\(\)\)/.test(probe),
  false,
  'Probe deep pressure must not silently release the oldest unfinished root'
);
assert.match(probe, /MAX_DEEP\s*=\s*4/, 'Probe recovery must preserve the hard deep-job cap');
assert.match(probe, /let\s+deepRecoveryRef\s*=\s*null/, 'Probe needs a weak final-state recovery representation');
assert.match(probe, /function\s+rememberDeepRecovery\s*\(/, 'Probe overflow must retain recoverable final state');
assert.match(probe, /function\s+promoteDeepRecovery\s*\(/, 'Probe recovery must re-enter bounded background traversal');
assert.match(probe, /deepRecoveryRef\s*=\s*new WeakRef\(merged\)/, 'Probe recovery must remain weak');

assert.equal(
  /while\s*\(batchJobs\.length\s*>=\s*MAX_BATCH_JOBS\)\s*batchJobs\.shift\(\)/.test(gate),
  false,
  'Gate large-batch pressure must not silently discard the oldest unfinished batch'
);
assert.match(gate, /MAX_BATCH_JOBS\s*=\s*6/, 'Gate batch recovery must preserve the hard job cap');
assert.match(gate, /const\s+droppedOwner\s*=\s*dropped\?\.ownerRef\?\.deref\?\.\(\)/, 'Gate must resolve the evicted batch owner weakly');
assert.match(gate, /queueDeep\(droppedOwner,\s*true\)/, 'Gate evicted batch owner must re-enter the existing bounded deep path');

assert.equal(
  /while\s*\(deepJobs\.length\s*>=\s*MAX_DEEP_JOBS\)\s*releaseDeep\(deepJobs\.shift\(\)\)/.test(gate),
  false,
  'Gate deep pressure must not silently release the oldest unfinished root'
);
assert.match(gate, /MAX_DEEP_JOBS\s*=\s*10/, 'Gate deep recovery must preserve the hard deep-job cap');
assert.match(gate, /let\s+deepRecoveryRef\s*=\s*null/, 'Gate needs a weak deep final-state recovery representation');
assert.match(gate, /let\s+deepRecoveryComposite\s*=\s*false/, 'Gate must remember composite authority separately from recovery scope');
assert.match(gate, /function\s+rememberDeepRecovery\s*\(/, 'Gate deep overflow must retain recoverable final state');
assert.match(gate, /function\s+promoteDeepRecovery\s*\(/, 'Gate deep recovery must re-enter bounded background traversal');
assert.match(gate, /deepRecoveryRef\s*=\s*new WeakRef\(merged\)/, 'Gate deep recovery must remain weak');
assert.match(gate, /deepRecoveryComposite\s*=\s*sameScope\s*\?[^:]+:\s*false/, 'coalescing distinct Gate scopes must fail closed on composite authority');
assert.match(gate, /rememberDeepRecovery\(droppedRoot,\s*dropped\?\.allowComposite\)/, 'evicted Gate deep jobs must preserve their recovery authority mode');
assert.match(gate, /if\s*\(!batchJobs\.length\s*&&\s*!deepJobs\.length\)\s*promoteDeepRecovery\(\)/, 'Gate recovery must be promoted only after ordinary bounded work drains');

console.log('static-bounded-work: PASS');
