import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import puppeteer from 'puppeteer';

const ROOT=path.resolve('.');
const POLICY_PATH=path.join(ROOT,'release','closeout-policy.json');
const PACKAGE_PATH=path.join(ROOT,'release','package-manifest.json');
const ARTIFACT_DIR=path.join(ROOT,'artifacts');
const policy=JSON.parse(fs.readFileSync(POLICY_PATH,'utf8'));
const argv=process.argv.slice(2);
const mode=argv[0];

function valueAfter(name){
  const index=argv.indexOf(name);
  return index>=0?argv[index+1]:undefined;
}

function run(command,args,{env=process.env,inherit=false,allowFailure=false}={}){
  const windowsNpm=process.platform==='win32'&&command==='npm';
  const executable=windowsNpm?(process.env.ComSpec||'cmd.exe'):command;
  const executableArgs=windowsNpm?['/d','/s','/c','npm',...args]:args;
  const result=spawnSync(executable,executableArgs,{cwd:ROOT,env,encoding:'utf8',stdio:inherit?'inherit':'pipe',maxBuffer:128*1024*1024});
  if(result.error) throw result.error;
  if(!allowFailure&&result.status!==0) throw new Error(result.stderr||result.stdout||`${command} ${args.join(' ')} failed`);
  return result;
}

function git(args){return run('git',args).stdout.trim();}
function sha256File(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function interpolate(value,bindings){return value.replace(/\$\{(BASE|HEAD)\}/gu,(_match,key)=>bindings[key]);}
function exactCommit(value,label){
  assert.match(String(value||''),/^[a-f0-9]{7,40}$/iu,`${label} must be an exact Git commit`);
  return git(['rev-parse',`${value}^{commit}`]);
}
function trackedClean(){return git(['status','--porcelain','--untracked-files=no'])==='';}
function evidencePath(attempt){return path.join(ARTIFACT_DIR,`closeout-evidence.attempt-${attempt}.json`);}
function tail(textValue,lines=40){return String(textValue||'').split(/\r?\n/u).slice(-lines).join('\n');}

async function environmentIdentity(){
  const chromePath=await puppeteer.executablePath();
  const chromeVersion=chromePath.match(/(\d+\.\d+\.\d+\.\d+)/u)?.[1];
  assert.match(String(chromeVersion||''),/^\d+\.\d+\.\d+\.\d+$/u,'Chrome for Testing path must expose its installed version');
  const python=run('python',['--version']);
  const packageJson=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
  return {
    os:`${process.platform}-${process.arch}`,
    node:process.version,
    python:(python.stdout||python.stderr).trim(),
    chromePath,
    chrome:`Chrome for Testing ${chromeVersion}`,
    chromeExecutableSha256:sha256File(chromePath),
    puppeteer:packageJson.devDependencies.puppeteer,
    browserMode:process.env.AUTO_AGREE_HEADED==='1'?'headed':'headless'
  };
}

function validatePolicy(){
  assert.equal(policy.schemaVersion,1);
  assert.ok(Number.isInteger(policy.requiredAttempts)&&policy.requiredAttempts>=2);
  assert.ok(Array.isArray(policy.hostedStates)&&policy.hostedStates.length>=4);
  assert.ok(Array.isArray(policy.lanes)&&policy.lanes.length>0);
  assert.equal(new Set(policy.lanes.map(lane=>lane.id)).size,policy.lanes.length,'closeout lane IDs must be unique');
}

async function record(){
  validatePolicy();
  const attempt=Number(valueAfter('--attempt'));
  assert.ok(Number.isInteger(attempt)&&attempt>=1&&attempt<=policy.requiredAttempts,`--attempt must be in [1,${policy.requiredAttempts}]`);
  const base=exactCommit(valueAfter('--base'),'--base');
  const head=git(['rev-parse','HEAD']);
  assert.equal(head,exactCommit(head,'HEAD'));
  assert.notEqual(base,head,'closeout base and candidate must be distinct');
  assert.equal(trackedClean(),true,'recording requires a clean tracked exact-head worktree');
  const hostedStatus=valueAfter('--hosted-status');
  assert.ok(policy.hostedStates.includes(hostedStatus),'--hosted-status must use the policy enum');
  const hostedNote=valueAfter('--hosted-note')||'';
  if(hostedStatus==='INFRA_UNAVAILABLE') assert.ok(hostedNote.length>=8,'INFRA_UNAVAILABLE requires a concrete --hosted-note');
  const bindings={BASE:base,HEAD:head};
  const receipt={
    schemaVersion:1,
    repository:'auto-agree',
    attempt,
    base,
    baseTree:git(['show','-s','--format=%T',base]),
    head,
    tree:git(['show','-s','--format=%T',head]),
    cleanTracked:true,
    policySha256:sha256File(POLICY_PATH),
    packageManifestSha256:sha256File(PACKAGE_PATH),
    environment:await environmentIdentity(),
    hosted:{status:hostedStatus,source:'operator-declared',note:hostedNote},
    startedAt:new Date().toISOString(),
    lanes:[]
  };
  fs.mkdirSync(ARTIFACT_DIR,{recursive:true});
  let failed=false;
  for(const lane of policy.lanes){
    const args=lane.args.map(value=>interpolate(value,bindings));
    const laneEnv={...process.env};
    for(const [key,value] of Object.entries(lane.env||{})) laneEnv[key]=interpolate(value,bindings);
    console.log(`closeout ${attempt}/${policy.requiredAttempts} ${lane.id}: ${lane.command} ${args.join(' ')}`);
    const started=Date.now();
    const result=run(lane.command,args,{env:laneEnv,allowFailure:true});
    const entry={
      id:lane.id,
      command:[lane.command,...args],
      status:result.status===0?'PASS':'FAIL',
      exitCode:result.status,
      durationMs:Date.now()-started,
      stdoutSha256:crypto.createHash('sha256').update(result.stdout||'').digest('hex'),
      stderrSha256:crypto.createHash('sha256').update(result.stderr||'').digest('hex'),
      outputTail:tail(`${result.stdout||''}\n${result.stderr||''}`)
    };
    if(lane.id==='paired-performance'&&result.status===0){
      const artifact=path.join(ARTIFACT_DIR,'e2e-performance-paired.json');
      entry.artifact={path:'artifacts/e2e-performance-paired.json',sha256:sha256File(artifact)};
    }
    receipt.lanes.push(entry);
    console.log(entry.outputTail);
    if(result.status!==0){failed=true;break;}
  }
  receipt.finishedAt=new Date().toISOString();
  receipt.status=failed?'FAIL':'PASS';
  fs.writeFileSync(evidencePath(attempt),`${JSON.stringify(receipt,null,2)}\n`);
  console.log(`closeout-evidence: ${receipt.status} ${path.relative(ROOT,evidencePath(attempt))}`);
  if(failed) process.exitCode=1;
}

function verify(){
  validatePolicy();
  const expectedHead=valueAfter('--head')?exactCommit(valueAfter('--head'),'--head'):git(['rev-parse','HEAD']);
  const currentHead=git(['rev-parse','HEAD']);
  assert.equal(currentHead,expectedHead,'current checkout is not the verified head');
  assert.equal(trackedClean(),true,'verification requires a clean tracked worktree');
  const expectedTree=git(['show','-s','--format=%T',expectedHead]);
  const expectedPolicyHash=sha256File(POLICY_PATH);
  const expectedPackageHash=sha256File(PACKAGE_PATH);
  let expectedBase=null;
  const expectedLaneIds=policy.lanes.map(lane=>lane.id);
  for(let attempt=1;attempt<=policy.requiredAttempts;attempt++){
    const file=evidencePath(attempt);
    assert.ok(fs.existsSync(file),`missing closeout attempt ${attempt}`);
    const receipt=JSON.parse(fs.readFileSync(file,'utf8'));
    assert.equal(receipt.schemaVersion,1);
    assert.equal(receipt.repository,'auto-agree');
    assert.equal(receipt.attempt,attempt);
    assert.equal(receipt.head,expectedHead);
    assert.equal(receipt.tree,expectedTree);
    assert.equal(receipt.cleanTracked,true);
    assert.equal(receipt.policySha256,expectedPolicyHash);
    assert.equal(receipt.packageManifestSha256,expectedPackageHash);
    assert.equal(receipt.status,'PASS');
    assert.ok(policy.hostedStates.includes(receipt.hosted?.status));
    assert.deepEqual(receipt.lanes.map(lane=>lane.id),expectedLaneIds);
    assert.ok(receipt.lanes.every(lane=>lane.status==='PASS'&&lane.exitCode===0));
    if(expectedBase===null) expectedBase=receipt.base;
    assert.equal(receipt.base,expectedBase,'same-head attempts must use one exact base');
  }
  console.log(`closeout-verify: PASS head=${expectedHead} tree=${expectedTree} base=${expectedBase} attempts=${policy.requiredAttempts}`);
  return {head:expectedHead,tree:expectedTree,base:expectedBase};
}

function merge(){
  const verified=verify();
  const pr=valueAfter('--pr');
  assert.match(String(pr||''),/^\d+$/u,'--pr must be a pull request number');
  const metadata=JSON.parse(run('gh',['pr','view',pr,'--json','headRefOid,baseRefName,state,isDraft']).stdout);
  assert.equal(metadata.state,'OPEN','pull request must be open');
  assert.equal(metadata.isDraft,false,'pull request must be ready');
  assert.equal(metadata.baseRefName,'main','pull request must target main');
  assert.equal(metadata.headRefOid,verified.head,'pull request head moved after evidence was recorded');
  run('gh',['pr','merge',pr,'--squash','--delete-branch','--match-head-commit',verified.head],{inherit:true});
}

if(mode==='record') await record();
else if(mode==='verify') verify();
else if(mode==='merge') merge();
else throw new Error('usage: closeout-evidence.mjs <record|verify|merge> [options]');
