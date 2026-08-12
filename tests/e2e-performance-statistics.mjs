import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const ROOT=path.resolve('.');
const ARTIFACT=path.join(ROOT,'artifacts','e2e-profile.json');
const OUTPUT=path.join(ROOT,'artifacts','e2e-profile-statistics.json');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const repetitions=Number(process.env.AUTO_AGREE_PERF_REPETITIONS||7);
assert.ok(Number.isInteger(repetitions)&&repetitions>=5&&repetitions<=15,'performance repetitions must be an integer in [5,15]');

const round=(value,digits)=>Number(Number(value).toFixed(digits));
function quantile(values,p,digits){
  assert.ok(values.length>0);
  const sorted=[...values].sort((a,b)=>a-b);
  const position=(sorted.length-1)*p;
  const low=Math.floor(position),high=Math.ceil(position);
  const value=low===high?sorted[low]:sorted[low]+(sorted[high]-sorted[low])*(position-low);
  return round(value,digits);
}
function summarize(values,digits){
  return {
    median:quantile(values,0.5,digits),
    p90:quantile(values,0.9,digits),
    max:round(Math.max(...values),digits)
  };
}

const runs=[];
for(let i=0;i<repetitions;i++){
  fs.rmSync(ARTIFACT,{force:true});
  const result=spawnSync(process.execPath,['tests/e2e-extension.mjs','--profile'],{
    cwd:ROOT,
    env:process.env,
    encoding:'utf8',
    maxBuffer:64*1024*1024
  });
  if(result.error) throw result.error;
  if(result.status!==0){
    process.stdout.write(result.stdout||'');
    process.stderr.write(result.stderr||'');
    throw new Error(`performance repetition ${i+1} failed with exit ${result.status}`);
  }
  assert.ok(fs.existsSync(ARTIFACT),`performance repetition ${i+1} did not emit ${ARTIFACT}`);
  const sample=JSON.parse(fs.readFileSync(ARTIFACT,'utf8'));
  for(const key of ['latencyMs','taskDuration','samples']){
    assert.equal(typeof sample[key],'number',`performance repetition ${i+1}: ${key} must be numeric`);
    assert.ok(Number.isFinite(sample[key])&&sample[key]>=0,`performance repetition ${i+1}: ${key} must be finite/non-negative`);
  }
  runs.push({latencyMs:sample.latencyMs,taskDurationS:sample.taskDuration,cpuSamples:sample.samples});
  console.log(`performance-run ${i+1}/${repetitions}: ${JSON.stringify(runs.at(-1))}`);
}

const chromePath=await puppeteer.executablePath();
const chrome=spawnSync(chromePath,['--version'],{encoding:'utf8'});
assert.equal(chrome.status,0,'managed Chrome version probe must succeed');
const output={
  schemaVersion:1,
  benchmarkId:'real-unpacked-tail-login-5000-v1',
  harnessRevision:'v12-statistical-existing-harness',
  repetitions,
  environment:{
    chrome:(chrome.stdout||'').trim(),
    puppeteer:String(pkg.devDependencies?.puppeteer||''),
    nodeMajor:Number(process.versions.node.split('.')[0])
  },
  metrics:{
    latencyMs:summarize(runs.map(run=>run.latencyMs),1),
    taskDurationS:summarize(runs.map(run=>run.taskDurationS),4),
    cpuSamples:summarize(runs.map(run=>run.cpuSamples),1)
  },
  runs
};
fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});
fs.writeFileSync(OUTPUT,JSON.stringify(output,null,2)+'\n');
console.log(`performance-statistics: PASS ${JSON.stringify(output)}`);
