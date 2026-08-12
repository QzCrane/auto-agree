import fs from 'node:fs';
import assert from 'node:assert/strict';

const kernel = fs.readFileSync('extension/runtime-kernel.js', 'utf8');
const probe = fs.readFileSync('extension/bootstrap.js', 'utf8');
const gate = fs.readFileSync('extension/gate.js', 'utf8');

assert.match(kernel, /function\s+createLifecycleState\s*\(/, 'runtime kernel must own lifecycle epoch state');
assert.match(kernel, /if\s*\(nextPaused\s*===\s*paused\)\s*return false/, 'idempotent lifecycle transitions must not invent generations');
assert.match(kernel, /epoch\+\+/, 'real lifecycle transitions must advance generation');
assert.match(kernel, /token\s*===\s*epoch\s*&&\s*\(!requireActive\s*\|\|\s*!paused\)/, 'lifecycle tokens must encode both generation and active authority');

assert.match(probe, /const\s+lifecycle\s*=\s*KERNEL\.createLifecycleState\(false\)/, 'Probe must use the shared lifecycle authority');
assert.equal(/let\s+paused\s*=|let\s+lifecycleEpoch\s*=/.test(probe), false, 'Probe must not retain a second private lifecycle authority');
assert.match(probe, /const\s+epoch\s*=\s*lifecycle\.capture\(\)/, 'Probe scheduled drains must capture lifecycle generation');
assert.match(probe, /!lifecycle\.isCurrent\(epoch\)/, 'Probe scheduled drains must reject stale/paused lifecycle tokens');
assert.match(probe, /if\s*\(epoch\s*===\s*lifecycle\.epoch\)\s*drainScheduled\s*=\s*false/, 'stale callbacks must not clear a newer generation scheduler flag');
assert.match(probe, /lifecycle\.transition\(shouldPause\)/, 'Probe worker-handoff recovery must advance lifecycle when browser paused state changes');
assert.match(probe, /lifecycle\.pause\(\)/, 'Probe pause must use shared lifecycle transition');
assert.match(probe, /lifecycle\.resume\(\)/, 'Probe resume must use shared lifecycle transition');

assert.match(gate, /const\s+lifecycle\s*=\s*KERNEL\.createLifecycleState\(false\)/, 'Gate must use the shared lifecycle authority');
assert.equal(/let\s+paused\s*=|let\s+lifecycleEpoch\s*=|backgroundEpoch/.test(gate), false, 'Gate must not retain a second private lifecycle authority');
assert.match(gate, /async function drainBackground\(token\s*=\s*lifecycle\.capture\(\)\)/, 'Gate background drain must be lifecycle-token scoped');
assert.match(gate, /while\s*\(!requested\s*&&\s*lifecycle\.isCurrent\(token\)/, 'Gate background loop must reject stale or paused generations');
assert.match(gate, /if\s*\(backgroundToken\s*===\s*token\)\s*backgroundRunning\s*=\s*false/, 'stale Gate callbacks must not clear a newer background generation');
assert.match(gate, /lifecycle\.transition\(shouldPause\)/, 'Gate worker-handoff recovery must transition the shared lifecycle');
assert.match(gate, /lifecycle\.pause\(\)/, 'Gate pause must use shared lifecycle transition');
assert.match(gate, /lifecycle\.resume\(\)/, 'Gate resume must use shared lifecycle transition');

console.log('static-lifecycle: PASS');
