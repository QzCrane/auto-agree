import fs from 'node:fs';
import assert from 'node:assert/strict';

const ledger=JSON.parse(fs.readFileSync('docs/performance/ledger.json','utf8'));
assert.equal(ledger.schemaVersion,2,'performance ledger schema must be v2');
assert.ok(Array.isArray(ledger.records)&&ledger.records.length>0,'performance ledger must contain records');

const allowed=new Set([
  'synthetic-in-page',
  'synthetic-in-page-retrospective',
  'real-unpacked-extension',
  'real-unpacked-extension-release',
  'real-unpacked-extension-main',
  'real-unpacked-extension-release-statistical'
]);
const realClasses=new Set([
  'real-unpacked-extension',
  'real-unpacked-extension-release',
  'real-unpacked-extension-main',
  'real-unpacked-extension-release-statistical'
]);
const statisticalClass='real-unpacked-extension-release-statistical';

function finiteNonNegative(value,label){
  assert.equal(typeof value,'number',`${label} must be numeric`);
  assert.ok(Number.isFinite(value)&&value>=0,`${label} must be finite/non-negative`);
}
function quantile(values,p){
  const sorted=[...values].sort((a,b)=>a-b);
  const position=(sorted.length-1)*p;
  const low=Math.floor(position),high=Math.ceil(position);
  return low===high?sorted[low]:sorted[low]+(sorted[high]-sorted[low])*(position-low);
}
function close(actual,expected,label,tolerance=1e-9){
  assert.ok(Math.abs(actual-expected)<=tolerance,`${label}: expected ${expected}, got ${actual}`);
}

for(const [index,record] of ledger.records.entries()){
  const prefix=`record[${index}]`;
  assert.match(record.version,/^\d+\.\d+\.\d+$/,`${prefix}.version must be semver`);
  assert.equal(typeof record.benchmarkId,'string',`${prefix}.benchmarkId must be a string`);
  assert.ok(record.benchmarkId.trim(),`${prefix}.benchmarkId must be non-empty`);
  assert.ok(allowed.has(record.evidenceClass),`${prefix}.evidenceClass must be recognized`);
  assert.equal(typeof record.source,'string',`${prefix}.source must be a string`);
  assert.ok(record.source.trim(),`${prefix}.source must be non-empty`);
  if(record.commit!==undefined) assert.match(record.commit,/^[0-9a-f]{40}$/i,`${prefix}.commit must be a full Git SHA`);
  if(record.repetitions!==undefined){
    assert.ok(Number.isInteger(record.repetitions)&&record.repetitions>0,`${prefix}.repetitions must be a positive integer`);
  }
  assert.ok(record.metrics&&typeof record.metrics==='object'&&!Array.isArray(record.metrics),`${prefix}.metrics must be an object`);
  const metricEntries=Object.entries(record.metrics);
  assert.ok(metricEntries.length>0,`${prefix}.metrics must not be empty`);
  for(const [name,value] of metricEntries) finiteNonNegative(value,`${prefix}.metrics.${name}`);

  if(realClasses.has(record.evidenceClass)){
    assert.ok(record.environment&&typeof record.environment==='object',`${prefix} real evidence must declare environment`);
    assert.equal(typeof record.environment.chrome,'string',`${prefix}.environment.chrome must be a string`);
    assert.ok(record.environment.chrome.trim(),`${prefix}.environment.chrome must be non-empty`);
    finiteNonNegative(record.environment.nodeMajor,`${prefix}.environment.nodeMajor`);
    assert.equal(typeof record.harnessRevision,'string',`${prefix} real evidence must declare harnessRevision`);
    assert.ok(record.harnessRevision.trim(),`${prefix}.harnessRevision must be non-empty`);
  }

  if(record.evidenceClass===statisticalClass){
    assert.ok(Number.isInteger(record.repetitions)&&record.repetitions>=5,`${prefix} statistical evidence requires >=5 repetitions`);
    assert.ok(Array.isArray(record.runs),`${prefix}.runs must be an array`);
    assert.equal(record.runs.length,record.repetitions,`${prefix}.runs length must equal repetitions`);
    assert.equal(typeof record.environment.puppeteer,'string',`${prefix}.environment.puppeteer must be recorded`);
    const latency=[],task=[],samples=[];
    for(const [runIndex,run] of record.runs.entries()){
      finiteNonNegative(run.latencyMs,`${prefix}.runs[${runIndex}].latencyMs`);
      finiteNonNegative(run.taskDurationS,`${prefix}.runs[${runIndex}].taskDurationS`);
      finiteNonNegative(run.cpuSamples,`${prefix}.runs[${runIndex}].cpuSamples`);
      latency.push(run.latencyMs);task.push(run.taskDurationS);samples.push(run.cpuSamples);
    }
    const requiredMetrics=[
      'latencyMedianMs','latencyP90Ms','latencyMaxMs',
      'taskDurationMedianS','taskDurationP90S','taskDurationMaxS',
      'cpuSamplesMedian','cpuSamplesP90','cpuSamplesMax'
    ];
    for(const name of requiredMetrics) finiteNonNegative(record.metrics[name],`${prefix}.metrics.${name}`);
    close(record.metrics.latencyMedianMs,quantile(latency,0.5),`${prefix} latency median`);
    close(record.metrics.latencyP90Ms,Number(quantile(latency,0.9).toFixed(1)),`${prefix} latency p90`);
    close(record.metrics.latencyMaxMs,Math.max(...latency),`${prefix} latency max`);
    close(record.metrics.taskDurationMedianS,quantile(task,0.5),`${prefix} task median`);
    close(record.metrics.taskDurationP90S,Number(quantile(task,0.9).toFixed(4)),`${prefix} task p90`);
    close(record.metrics.taskDurationMaxS,Math.max(...task),`${prefix} task max`);
    close(record.metrics.cpuSamplesMedian,quantile(samples,0.5),`${prefix} CPU median`);
    close(record.metrics.cpuSamplesP90,Number(quantile(samples,0.9).toFixed(1)),`${prefix} CPU p90`);
    close(record.metrics.cpuSamplesMax,Math.max(...samples),`${prefix} CPU max`);
  }
}

assert.ok(ledger.records.some(record=>record.evidenceClass==='real-unpacked-extension-main'),'ledger must retain at least one post-merge main real-extension record');
const v12=ledger.records.filter(record=>record.version==='12.0.0'&&record.evidenceClass===statisticalClass);
assert.equal(v12.length,1,'v12 must carry exactly one canonical release statistical record');
assert.equal(v12[0].benchmarkId,'real-unpacked-tail-login-5000-v1','v12 statistical evidence must preserve the comparable benchmark identity');
assert.equal(v12[0].harnessRevision,'v12-statistical-existing-harness','v12 statistical evidence must identify the v12 wrapper revision');
assert.match(v12[0].source,/docs\/verification\/v12\.md/,'v12 statistical evidence must point to the v12 verification report');

console.log(`performance-ledger: PASS (${ledger.records.length} records, v12 statistical release evidence validated)`);
