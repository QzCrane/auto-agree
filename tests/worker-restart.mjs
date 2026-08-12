import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync('extension/scheduler-core.js','utf8')+'\n'+fs.readFileSync('extension/profile-core.js','utf8')+'\n'+fs.readFileSync('extension/worker.js','utf8');
const CURRENT_VERSION=JSON.parse(fs.readFileSync('extension/manifest.json','utf8')).version;
const local=new Map(),session=new Map();
const area=map=>({
  async get(keys){const out={};for(const k of Array.isArray(keys)?keys:[keys])if(map.has(k))out[k]=map.get(k);return out;},
  async set(obj){for(const [k,v] of Object.entries(obj))map.set(k,v);},
  async remove(keys){for(const k of Array.isArray(keys)?keys:[keys])map.delete(k);}
});
const PROTECTION_FILES=['runtime-kernel.js','generation-lease.js','semantic-core.js','dom-core.js','handover-guard.js'];
const BOOTSTRAP_FILES=['bootstrap.js'];
function sameFiles(actual,expected){return JSON.stringify(actual)===JSON.stringify(expected);}
function boot(tabIds=[1,2],failProtectionTabs=new Set()){
  let listener,installed; const calls=[];
  const chrome={
    runtime:{getManifest(){return {version:CURRENT_VERSION};},onMessage:{addListener(fn){listener=fn;}},onInstalled:{addListener(fn){installed=fn;}}},
    tabs:{async query(){return tabIds.map(id=>({id}));}},
    scripting:{async executeScript(spec){
      calls.push(spec);
      if(sameFiles(spec.files,PROTECTION_FILES)&&failProtectionTabs.has(spec.target?.tabId)) throw new Error('synthetic-protection-failure');
      return[];
    }},
    storage:{local:area(local),session:area(session)}
  };
  vm.runInNewContext(source,{chrome,console,Promise,Map,Set,Date,Error,Number,String,Array,Object,JSON,Math,URL,setTimeout,clearTimeout});
  const send=(msg,sender={tab:{id:1},frameId:0,documentId:'d',documentLifecycle:'active',origin:'https://example.test',url:'https://example.test/login'})=>new Promise(resolve=>listener(msg,sender,resolve));
  return{listener,installed,calls,send};
}
const origin='https://example.test';
const profile={version:CURRENT_VERSION,flows:[{fingerprint:'/login|auth',locator:{hosts:[],selector:'#agree'},descriptor:{kind:'native',severity:0,legal:true,assent:true,required:true,auth:true,linkBucket:1},successes:2,failures:0,ts:Date.now()}]};
let a=boot();
assert.equal((await a.send({type:'AUTO_AGREE_PROFILE_PUT',origin,profile})).ok,true);
a=null; // Simulated worker termination: all globals disappear, storage remains.
const b=boot();
const read=await b.send({type:'AUTO_AGREE_PROFILE_GET',origin});
assert.equal(read.ok,true);assert.equal(read.profile.flows.length,1);assert.equal(read.profile.flows[0].successes,2);

// Update rehydration is persisted in storage.session so a worker killed mid-sweep can resume.
session.set('__auto_agree_update_rehydrate__',{version:CURRENT_VERSION,ts:Date.now()});
const c=boot([11,12,13]);
await new Promise(r=>setTimeout(r,30));
for(const tabId of [11,12,13]){
  const calls=c.calls.filter(x=>x.target?.tabId===tabId);
  const protectIndex=calls.findIndex(x=>sameFiles(x.files,PROTECTION_FILES));
  const bootstrapIndex=calls.findIndex(x=>sameFiles(x.files,BOOTSTRAP_FILES));
  assert.ok(protectIndex>=0,`tab ${tabId} missing generation lease + semantic + handover protection`);
  assert.ok(bootstrapIndex>protectIndex,`tab ${tabId} bootstrap must occur only after protection`);
  assert.equal(calls[protectIndex].target?.allFrames,true);
  assert.equal(calls[bootstrapIndex].target?.allFrames,true);
}
assert.equal(session.has('__auto_agree_update_rehydrate__'),false);

// If protection rejects, retry it but never bootstrap that tab. This is the critical authority
// boundary: failure to establish current generation lease/semantics/firewall cannot start a Probe.
session.set('__auto_agree_update_rehydrate__',{version:CURRENT_VERSION,ts:Date.now()});
const d=boot([21],new Set([21]));
await new Promise(r=>setTimeout(r,240));
const failedCalls=d.calls.filter(x=>x.target?.tabId===21);
assert.ok(failedCalls.filter(x=>sameFiles(x.files,PROTECTION_FILES)).length>=2,'failed protection should be retried');
assert.equal(failedCalls.some(x=>sameFiles(x.files,BOOTSTRAP_FILES)),false,'bootstrap must not run when protection never succeeds');
assert.equal(session.has('__auto_agree_update_rehydrate__'),true,'unresolved protection must preserve durable restart work');
assert.equal(JSON.stringify(session.get('__auto_agree_update_rehydrate__').pending),JSON.stringify([21]));
console.log('worker-restart: PASS');
