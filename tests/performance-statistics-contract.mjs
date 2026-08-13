import fs from 'node:fs';
import assert from 'node:assert/strict';

const paired=fs.readFileSync('tests/e2e-performance-paired.mjs','utf8');
const scenario=fs.readFileSync('tests/e2e-performance-scenario.mjs','utf8');
const ci=fs.readFileSync('.github/workflows/ci.yml','utf8').replace(/\r\n/gu,'\n');

assert.match(paired,/--base must be an exact Git commit/,'paired evidence must bind an exact base commit');
assert.match(paired,/exactCandidate/,'paired evidence must bind the candidate commit');
assert.match(paired,/baseRuntimeTree === candidateRuntimeTree/,'runtime-identical candidates must not execute a meaningless paired benchmark');
assert.match(paired,/NOT_APPLICABLE_IDENTICAL_RUNTIME_TREE/,'runtime-identical candidates must emit an explicit auditable disposition');
assert.match(paired,/repetitions >= 3 && repetitions <= 9/,'paired harness must reject non-statistical repetition counts');
assert.match(paired,/repetition % 2 === 0 \? \['base', 'candidate'\] : \['candidate', 'base'\]/,'base/candidate order must alternate to reduce host-order bias');
assert.match(paired,/benchmarkId: 'auto-agree-five-workload-paired-v1'/,'paired protocol identity must be explicit');
assert.match(paired,/median: quantile\(values, 0\.5\)/,'paired evidence must report median');
assert.match(paired,/p90: quantile\(values, 0\.9\)/,'paired evidence must report a tail quantile');
assert.match(paired,/medianRatio <= ratioLimits\.median/,'paired evidence must enforce a median regression ratio');
assert.match(paired,/p90Ratio <= ratioLimits\.p90/,'paired evidence must enforce a p90 regression ratio');
assert.match(paired,/candidateSummary\.max <= ceiling\[metricName\]/,'paired evidence must retain an absolute candidate ceiling');
assert.match(paired,/raw/,'raw per-run evidence must remain in the emitted artifact');
assert.match(paired,/chromeExecutableSha256: chrome\.sha256/,'paired evidence must bind the installed Chrome executable without launching a version-only browser');
assert.equal(/spawnSync\(chromePath, \['--version'\]/.test(paired),false,'Chrome identity collection must not launch a hanging Windows browser process');
assert.match(scenario,/await Promise\.allSettled\(pages\.map\(closePage\)\)/,'multi-tab teardown must not replace completed measurements with an already-closed transport error');

for(const workload of ['positiveTailLogin','negativeIdle','negativeMutationChurn','hiddenQuiescence','multiTabScheduler']){
  assert.match(scenario,new RegExp(`async function ${workload}\\(`),`${workload} must be an executable real-Chrome workload`);
  assert.match(paired,new RegExp(`${workload}: \\{wallMs:`),`${workload} must own an absolute safety ceiling`);
}

assert.match(ci,/\n  performance:\n/,'paired profiling must run as an independent parallel CI job');
assert.match(ci,/AUTO_AGREE_PERF_REPETITIONS:\s*'5'/,'canonical CI must collect five interleaved samples per variant');
assert.match(ci,/github\.event\.pull_request\.base\.sha \|\| github\.event\.before/,'CI must bind the comparison to the exact PR base or pre-push main');
assert.match(ci,/xvfb-run -a node tests\/e2e-performance-paired\.mjs --base \"\$AUTO_AGREE_PERF_BASE\" --candidate HEAD/,'CI must execute the paired harness in real headed Chrome');
assert.match(ci,/e2e-performance-paired\.json/,'CI must print the durable paired evidence payload');

console.log('performance-statistics-contract: PASS (exact-base/exact-head paired matrix)');
