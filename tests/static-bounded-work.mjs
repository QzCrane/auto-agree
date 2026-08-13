import fs from 'node:fs';
import assert from 'node:assert/strict';

const engine = fs.readFileSync('extension/engine.js', 'utf8');
const kernel = fs.readFileSync('extension/runtime-kernel.js', 'utf8');
const probe = fs.readFileSync('extension/bootstrap.js', 'utf8');
const gate = fs.readFileSync('extension/gate.js', 'utf8');
const tierE2e = fs.readFileSync('tests/e2e-tier-overflow.mjs', 'utf8');
const probeTtlE2e = fs.readFileSync('tests/e2e-probe-live-ttl.mjs', 'utf8');
const gateTtlE2e = fs.readFileSync('tests/e2e-gate-live-ttl.mjs', 'utf8');
const engineWalkE2e = fs.readFileSync('tests/e2e-engine-overflow.mjs', 'utf8');
const engineVisibilityE2e = fs.readFileSync('tests/e2e-engine-visibility-overflow.mjs', 'utf8');

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
  /while\s*\(walkJobs\.length\s*>=\s*MAX_WALK_JOBS\)\s*releaseWalkJob\(walkJobs\.shift\(\)\)/.test(engine),
  false,
  'Engine walk pressure must not evict an older unfinished FIFO cursor'
);
assert.match(engine, /MAX_WALK_JOBS\s*=\s*12/, 'Engine walk recovery must preserve the hard walk-job cap');
assert.match(engine, /const\s+walkWork\s*=\s*KERNEL\.createBoundedFifo/, 'Engine walk must use the shared bounded-work authority');
assert.match(engine, /capacity:\s*MAX_WALK_JOBS/, 'Engine walk kernel capacity must remain the proven 12-job cap');
assert.match(engine, /commonWalkRecoveryRoot\(current, next\)/, 'Engine retains domain-specific final-state coalescing');
assert.match(engine, /meta:\s*!!currentUrgent\s*\|\|\s*!!nextUrgent/, 'walk recovery must preserve urgent intent monotonically');
assert.match(engine, /walkWork\.admit\(job, root, !!job\.urgent\)/, 'Engine walk admission must route through the shared kernel');
assert.match(engine, /walkWork\.promote\(/, 'Engine walk recovery must re-enter ordinary traversal through the kernel');
assert.match(engine, /walkWork\.hasRecovery/, 'background liveness must include kernel-owned walk recovery');
assert.match(engine, /walkWork\.clear\(\)/, 'lifecycle retirement must clear kernel-owned walk work');
assert.match(kernel, /if \(queue\.length >= capacity\) return \{ admitted: false, recovered: remember\(scope, meta\) \};/, 'kernel overflow must compress only the new scope');
assert.match(kernel, /recoveryRef = new WeakRef\(mergedScope\)/, 'shared recovery must remain weak');
assert.match(engine, /admitWalkJob\(root,\s*job\)/, 'Engine processSubtree must use bounded lossless walk admission');
assert.match(engineWalkE2e, /const\s+ROOTS\s*=\s*20/, 'Engine walk saturation fixture must exceed the 12-job cap materially');
assert.match(engineWalkE2e, /const\s+NODES\s*=\s*900/, 'Engine walk saturation roots must require background continuation');
assert.match(engineWalkE2e, /timeout:\s*9000/, 'Engine walk saturation keeps a fixed eventual-progress deadline');

assert.match(engine, /MAX_PENDING_VISIBILITY\s*=\s*192/, 'visibility waiting must retain a hard representation cap');
assert.match(engine, /pendingVisibilityRecoveryRef\s*=\s*new WeakRef\(root\)/, 'visibility overflow must retain weak final-state recovery');
assert.match(engine, /pendingVisibility\.size\s*\|\|\s*pendingVisibilityRecoveryRef/, 'visual transitions must include overflow recovery work');
assert.match(engine, /attributeFilter:[^\n]+['"]class['"][^\n]+['"]style['"]/, 'visibility recovery must observe class/style transitions');
assert.match(engine, /MAX_INDEXED_CANDIDATES\s*=\s*96/, 'per-context candidate indexing must retain a hard cap');
assert.match(engine, /const\s+contextIndexRecovery\s*=\s*new WeakMap\(\)/, 'candidate index recovery must weakly own per-context convergence state');
assert.match(engine, /contextIndexRecovery\.set\(key,\s*-1\)/, 'first candidate-index overflow must create an unrecovered epoch');
assert.match(engine, /recoveredEpoch\s*!==\s*undefined\s*&&\s*recoveredEpoch\s*!==\s*currentEpoch/, 'indexed preflight must schedule only one recovery per context epoch');
assert.match(engine, /contextIndexRecovery\.set\(context,\s*currentEpoch\)/, 'recovery must converge before queueing so its own walk cannot re-arm forever');
assert.match(engine, /const\s+inputContextState\s*=\s*new WeakMap\(\)/, 'input/focus events must weakly retain their last semantic state');
assert.match(engine, /const\s+preflightContextEpoch\s*=\s*new WeakMap\(\)/, 'proceed preflight must converge once per context epoch');
assert.match(engine, /if\s*\(!proceed\)\s*return/, 'unrelated pointer events must not scan the candidate index');
assert.match(engine, /if\s*\(preflightContextEpoch\.get\(key\)\s*===\s*epoch\)\s*return/, 'repeated proceed events in one unchanged context must be coalesced');
assert.match(engine, /if\s*\(refreshed\.changed\s*&&\s*!intent\.activated\)\s*processIndexedContext/, 'input re-evaluation must require a real semantic fingerprint change');
assert.match(engineVisibilityE2e, /index\s*<\s*220/, 'visibility saturation fixture must exceed the 192-entry cap');
assert.match(engineVisibilityE2e, /hidden-219/, 'visibility saturation must recover the tail candidate');

assert.equal(
  /while\s*\(deep\.length\s*>=\s*MAX_DEEP\)/.test(probe),
  false,
  'Probe deep pressure must not evict existing FIFO cursors to admit newer work'
);
assert.match(probe, /MAX_DEEP\s*=\s*4/, 'Probe recovery must preserve the hard deep-job cap');
assert.match(probe, /DEEP_JOB_TTL_MS\s*=\s*2400/, 'Probe live-work TTL boundary must remain explicit');
assert.match(probe, /const\s+deepWork\s*=\s*KERNEL\.createBoundedFifo/, 'Probe deep work must use shared bounded FIFO authority');
assert.match(probe, /capacity:\s*MAX_DEEP/, 'Probe shared FIFO capacity must remain four');
assert.match(probe, /commonDeepRecoveryRoot\(current, next\)/, 'Probe retains domain-specific final-state coalescing');
assert.match(probe, /deepWork\.admit\(job, root, null\)/, 'new Probe deep work must route through shared admission');
assert.match(probe, /deepWork\.promote\(/, 'Probe recovery must re-enter ordinary deep traversal through the kernel');
assert.match(probe, /deepWork\.hasRecovery/, 'Probe must expose pending weak recovery to promotion');
assert.match(probe, /deepWork\.clear\(\)/, 'Probe lifecycle cleanup must clear kernel-owned queue and recovery');
assert.equal(/performance\.now\(\)\s*-\s*job\.createdAt\s*>\s*2400/.test(probe), false, 'Probe must not keep a private age-only deletion predicate');
assert.match(probe, /KERNEL\.refreshLiveAge\(job,\s*DEEP_JOB_TTL_MS,\s*root,\s*rootConnected\)/, 'Probe live root age must use shared lifetime authority');
assert.equal(
  /let\s+n\s*=\s*job\.started[^;]+;\s*job\.started\s*=\s*true;/.test(probe),
  false,
  'Probe must not mark a zero-budget deep slice started before processing its first node'
);
assert.match(
  probe,
  /while\s*\(steps\+\+\s*<\s*96\s*&&\s*performance\.now\(\)\s*-\s*start\s*<\s*1\.8\s*&&\s*n\)\s*\{\s*job\.started\s*=\s*true;/,
  'Probe deep jobs become started only inside a slice that actually processes a node'
);
assert.match(probeTtlE2e, /performance\.now\(\)\s*\+\s*2700/, 'Probe live-TTL E2E must cross the 2400 ms production boundary');
assert.match(probeTtlE2e, /live Probe deep work must survive age beyond its 2400 ms boundary exactly once/, 'Probe live-TTL E2E must require exactly-once eventual progress');

assert.equal(
  /while\s*\(batchJobs\.length\s*>=\s*MAX_BATCH_JOBS\)\s*batchJobs\.shift\(\)/.test(gate),
  false,
  'Gate large-batch pressure must not silently discard the oldest unfinished batch'
);
assert.match(gate, /MAX_BATCH_JOBS\s*=\s*6/, 'Gate batch recovery must preserve the hard job cap');
assert.match(gate, /const\s+droppedOwner\s*=\s*dropped\?\.ownerRef\?\.deref\?\.\(\)/, 'Gate must resolve the evicted batch owner weakly');
assert.match(gate, /queueDeep\(droppedOwner,\s*true\)/, 'Gate evicted batch owner must re-enter the existing bounded deep path');

assert.equal(
  /while\s*\(deepJobs\.length\s*>=\s*MAX_DEEP_JOBS\)/.test(gate),
  false,
  'Gate deep pressure must not evict existing FIFO cursors to admit newer work'
);
assert.match(gate, /MAX_DEEP_JOBS\s*=\s*10/, 'Gate deep recovery must preserve the hard deep-job cap');
assert.match(gate, /const\s+deepWork\s*=\s*KERNEL\.createBoundedFifo/, 'Gate deep work must use the shared bounded FIFO authority');
assert.match(gate, /capacity:\s*MAX_DEEP_JOBS/, 'Gate shared deep FIFO capacity must remain ten');
assert.match(gate, /const\s+merged\s*=\s*commonDeepRecoveryRoot\(current, next\)/, 'Gate retains domain-specific final-state coalescing');
assert.match(gate, /const\s+sameScope\s*=\s*merged\s*===\s*current\s*&&\s*merged\s*===\s*next/, 'Gate must distinguish exact-scope recovery from broader coalescing');
assert.match(
  gate,
  /meta:\s*sameScope\s*\?\s*\(!!currentComposite\s*&&\s*!!nextComposite\)\s*:\s*false/,
  'coalescing distinct Gate scopes must fail closed on composite authority'
);
assert.match(gate, /deepWork\.admit\(job, root, !!allowComposite\)/, 'new Gate deep work must route through shared admission');
assert.match(gate, /deepWork\.promote\(/, 'Gate deep recovery must re-enter bounded background traversal through the kernel');
assert.match(gate, /deepWork\.hasRecovery/, 'Gate must expose pending weak recovery to promotion');
assert.match(gate, /deepWork\.clear\(\)/, 'Gate activation/lifecycle retirement must clear kernel-owned deep work');
assert.equal(/deepRecoveryRef|deepRecoveryComposite|rememberDeepRecovery/.test(gate), false, 'Gate must not retain a second private deep recovery authority');
assert.match(gate, /if\s*\(!batchJobs\.length\s*&&\s*!deepJobs\.length\)\s*promoteDeepRecovery\(\)/, 'Gate recovery must be promoted only after ordinary bounded work drains');

// A deep slice that enters with no remaining background budget has not started. Marking the job
// started before the loop leaves cursorRef null; the next slice then mistakes that for completion.
assert.equal(
  /let\s+node\s*=\s*job\.started\s*\?[^;]+:\s*root\.firstChild;\s*job\.started\s*=\s*true;/.test(gate),
  false,
  'Gate must not mark a zero-budget deep slice started before processing its first node'
);
assert.match(
  gate,
  /while\s*\(performance\.now\(\)\s*-\s*start\s*<\s*BACKGROUND_BUDGET_MS\s*&&\s*node\)\s*\{[\s\S]{0,420}job\.started\s*=\s*true;/,
  'Gate deep jobs become started only inside a slice that actually processes a node'
);

assert.equal(
  /performance\.now\(\)\s*-\s*job\.createdAt\s*>\s*JOB_TTL_MS/.test(gate),
  false,
  'Gate must not retain private age-expiration semantics once lifetime authority is shared'
);
assert.match(
  gate,
  /KERNEL\.refreshLiveAge\(job,\s*JOB_TTL_MS,\s*owner,\s*candidate\s*=>\s*candidate\s+instanceof\s+Element\s*&&\s*candidate\.isConnected\)/,
  'Gate owner-backed batch lifetime must use the shared kernel'
);
assert.match(
  gate,
  /KERNEL\.touchExpiredAge\(job,\s*JOB_TTL_MS\)/,
  'Gate ownerless batch work must use shared age metadata semantics'
);
assert.match(
  gate,
  /KERNEL\.refreshLiveAge\(job,\s*JOB_TTL_MS,\s*root,\s*rootConnected\)/,
  'Gate deep root liveness and age refresh must use the shared kernel'
);
assert.match(kernel, /Age is liveness metadata, not obsolescence authority/, 'kernel must retain the canonical age/obsolescence invariant');

assert.match(
  tierE2e,
  /name:\s*'e2e-gate-deep-overflow'[\s\S]{0,220}repeat:\s*5/,
  'Gate deep saturation variance gate must remain five independent attempts'
);
assert.match(gateTtlE2e, /performance\.now\(\)\s*\+\s*2700/, 'Gate live-TTL E2E must cross the 2400 ms production TTL');
assert.match(gateTtlE2e, /live Gate deep work must survive age beyond JOB_TTL_MS exactly once/, 'Gate live-TTL E2E must assert exactly-once recovery');

console.log('static-bounded-work: PASS');
