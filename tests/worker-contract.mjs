import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const CURRENT_VERSION=JSON.parse(fs.readFileSync('extension/manifest.json','utf8')).version;

let listener;
let installedListener;
const calls=[];
const local=new Map(),session=new Map();
const storageArea=map=>({
  async get(keys){const out={};for(const k of Array.isArray(keys)?keys:[keys])if(map.has(k))out[k]=map.get(k);return out;},
  async set(obj){for(const [k,v] of Object.entries(obj))map.set(k,v);},
  async remove(keys){for(const k of Array.isArray(keys)?keys:[keys])map.delete(k);}
});
const chrome={
  runtime:{
    onMessage:{addListener(fn){listener=fn;}},
    onInstalled:{addListener(fn){installedListener=fn;}}
  },
  tabs:{async query(){return[];}},
  scripting:{async executeScript(spec){calls.push(spec);return[];}},
  storage:{local:storageArea(local),session:storageArea(session)}
};
vm.runInNewContext(fs.readFileSync('extension/worker.js','utf8'),{chrome,console,Promise,Map,Set,Date,Error,Number,String,Array,Object,JSON,Math,URL,setTimeout,clearTimeout});
assert.equal(typeof listener,'function');
assert.equal(typeof installedListener,'function');

function message(msg,sender){
  return new Promise((resolve,reject)=>{
    const keep=listener(msg,sender,response=>resolve(response));
    if(keep!==true&&responsePending(msg)) reject(new Error(`listener did not keep channel for ${msg.type}`));
  });
}
function responsePending(msg){return ['AUTO_AGREE_GATE','AUTO_AGREE_ACTIVATE','AUTO_AGREE_PROFILE_GET','AUTO_AGREE_PROFILE_PUT','AUTO_AGREE_PROFILE_INVALIDATE'].includes(msg.type);}

const sender={tab:{id:7},frameId:3,documentId:'doc-1',documentLifecycle:'active',origin:'https://trusted.example',url:'https://trusted.example/login'};
await message({type:'AUTO_AGREE_GATE'},sender);
await message({type:'AUTO_AGREE_ACTIVATE'},sender);
assert.equal(JSON.stringify(calls[0].files),JSON.stringify(['generation-lease.js','semantic-core.js','gate.js']));
assert.equal(JSON.stringify(calls[1].files),JSON.stringify(['generation-lease.js','semantic-core.js','handover-guard.js','risk-core.js','engine.js']));
assert.equal(JSON.stringify(calls[0].target),JSON.stringify({tabId:7,documentIds:['doc-1']}));
assert.equal(calls[0].world,'ISOLATED');
assert.equal(calls[0].injectImmediately,true);

const before=calls.length;
for(const state of ['prerender','cached','pending_deletion']){
  let response;
  const keep=listener({type:'AUTO_AGREE_GATE'},{...sender,documentId:`doc-${state}`,documentLifecycle:state},r=>{response=r;});
  assert.equal(keep,false);
  assert.equal(response?.ok,false);
  assert.match(response?.error||'',/inactive-document/);
}
assert.equal(calls.length,before,'inactive documents must never be injected');

const profile={version:CURRENT_VERSION,flows:[{fingerprint:'/login|form',locator:{hosts:[],selector:'#agree'},descriptor:{kind:'native',severity:0,legal:true,assent:true,required:true,auth:true,linkBucket:1},successes:1,failures:0,ts:Date.now()}]};
await message({type:'AUTO_AGREE_PROFILE_PUT',origin:'https://spoofed.example',profile},sender);
assert.equal(local.has('site:https://trusted.example'),true,'sender origin must own the stored profile');
assert.equal(local.has('site:https://spoofed.example'),false,'message.origin must not select a storage namespace');
const profileResponse=await message({type:'AUTO_AGREE_PROFILE_GET',origin:'https://spoofed.example'},sender);
assert.equal(profileResponse?.profile?.flows?.[0]?.fingerprint,'/login|form');
let missingOriginResponse;
const keepMissing=listener({type:'AUTO_AGREE_PROFILE_GET'},{...sender,origin:undefined,url:'about:blank'},response=>{missingOriginResponse=response;});
assert.equal(keepMissing,false);
assert.equal(missingOriginResponse?.ok,false);
assert.equal(missingOriginResponse?.error,'missing-profile-origin');
console.log('worker-contract: PASS');