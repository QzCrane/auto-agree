import fs from 'node:fs';
import assert from 'node:assert/strict';

const statistics=fs.readFileSync('tests/e2e-performance-statistics.mjs','utf8');
const ci=fs.readFileSync('.github/workflows/ci.yml','utf8').replace(/\r\n/gu,'\n');

assert.match(statistics,/AUTO_AGREE_PERF_REPETITIONS\|\|7/,'statistical harness must default to seven independent repetitions');
assert.match(statistics,/repetitions>=5&&repetitions<=15/,'statistical harness must reject non-statistical repetition counts');
assert.match(statistics,/spawnSync\(process\.execPath,\['tests\/e2e-extension\.mjs','--profile'\]/,'each sample must execute the existing real-unpacked profile harness in a fresh Node process');
assert.match(statistics,/benchmarkId:'real-unpacked-tail-login-5000-v1'/,'statistical evidence must preserve the comparable real-unpacked benchmark identity');
assert.match(statistics,/harnessRevision:'v12-statistical-existing-harness'/,'statistical protocol revision must be explicit');
assert.match(statistics,/median:quantile\(values,0\.5/,'statistical evidence must report median');
assert.match(statistics,/p90:quantile\(values,0\.9/,'statistical evidence must report a tail quantile');
assert.match(statistics,/max:round\(Math\.max/,'statistical evidence must retain the observed worst sample');
assert.match(statistics,/runs\n};|runs\s*\n};/,'raw per-run evidence must remain in the emitted artifact');
assert.equal(/latencyMs\s*[<>]=?\s*\d+/.test(statistics),false,'statistics wrapper must not invent a second latency threshold; each underlying real run owns the existing ceiling');
assert.equal(/taskDurationS?\s*[<>]=?\s*\d+/.test(statistics),false,'statistics wrapper must not invent a second task-duration threshold');

assert.match(ci,/\n  performance:\n/,'statistical profiling must run as an independent parallel CI job');
assert.match(ci,/AUTO_AGREE_PERF_REPETITIONS:\s*'7'/,'canonical CI must collect seven real-unpacked samples');
assert.match(ci,/xvfb-run -a node tests\/e2e-performance-statistics\.mjs/,'canonical CI must execute the statistical harness in real headed Chrome');
assert.match(ci,/e2e-profile-statistics\.json/,'canonical CI must print the durable statistical evidence payload');

console.log('performance-statistics-contract: PASS');
