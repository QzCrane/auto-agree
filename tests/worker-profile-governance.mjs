import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync('extension/worker.js','utf8');
const CURRENT_VERSION=JSON.parse(fs.readFileSync('extension/manifest.json','utf8')).version;

function harness({failLocalSet=false}={}){
  const local=new Map(),session=new Map();
  let listener;
  const area=(map,{failSet=false}={})=>({
    async get(keys){const out={};for(const k of Array.isArray(keys)?keys:[keys])if(map.has(k))out[k]=map.get(k);return out;},
    async set(obj){if(failSet)throw new Error('synthetic-storage-failure');for(const[k,v]of Object.entries(obj))map.set(k,v);},
    async remove(keys){for(const k of Array.isArray(keys)?keys:[keys])map.delete(k);}
  });
  const chrome={
    runtime:{getManifest(){return {version:CURRENT_VERSION};},onMessage:{addListener(fn){listener=fn;}},onInstalled:{addListener(){}}},
    tabs:{async query(){return[];}},
    scripting:{async executeScript(){return[];}},
    storage:{local:area(local,{failSet:failLocalSet}),session:area(session)}
  };
  vm.runInNewContext(source,{chrome,console,Promise,Map,Set,Date,Error,Number,String,Array,Object,JSON,Math,URL,setTimeout,clearTimeout});
  const send=(message,origin='https://example.test')=>new Promise(resolve=>{
    listener(message,{tab:{id:1},frameId:0,documentId:'d',documentLifecycle:'active',origin,url:`${origin}/login`},resolve);
  });
  return{local,session,send};
}

function flow(i,{fingerprint=`/login|flow-${i}`,selector=`#agree-${i}`,ts=Date.now()+i}={}){
  return {
    fingerprint,
    locator:{hosts:[],selector},
    descriptor:{kind:'native',severity:0,legal:true,assent:true,required:true,auth:true,linkBucket:1},
    successes:1,failures:0,ts
  };
}
function profile(...flows){return{version:CURRENT_VERSION,flows};}
function json(value){return JSON.parse(JSON.stringify(value));}

// Serialized concurrent writes preserve the newest eight independent flows for one origin.
const a=harness();
const base=Date.now();
await Promise.all(Array.from({length:64},(_,i)=>a.send({type:'AUTO_AGREE_PROFILE_PUT',profile:profile(flow(i,{ts:base+i}))})));
const read=await a.send({type:'AUTO_AGREE_PROFILE_GET'});
assert.equal(read.ok,true);
assert.deepEqual(json(read.profile.flows.map(item=>item.fingerprint)),Array.from({length:8},(_,j)=>`/login|flow-${63-j}`));
assert.equal(a.session.has('site:https://example.test'),true,'verified profile should populate storage.session hot layer');

// Same flow fingerprint may legitimately have multiple current locators; identity is fingerprint+locator.
const sameFingerprint='/login|same-flow';
await a.send({type:'AUTO_AGREE_PROFILE_PUT',profile:profile(
  flow(100,{fingerprint:sameFingerprint,selector:'#a',ts:base+100}),
  flow(101,{fingerprint:sameFingerprint,selector:'#b',ts:base+101})
)});
let same=(await a.send({type:'AUTO_AGREE_PROFILE_GET'})).profile.flows.filter(item=>item.fingerprint===sameFingerprint);
assert.equal(same.length,2,'fingerprint-only dedupe would silently destroy a distinct verified locator');
await a.send({type:'AUTO_AGREE_PROFILE_INVALIDATE',profile:{fingerprint:sameFingerprint,locator:{hosts:[],selector:'#a'}}});
same=(await a.send({type:'AUTO_AGREE_PROFILE_GET'})).profile.flows.filter(item=>item.fingerprint===sameFingerprint);
assert.equal(same.length,1);
assert.equal(same[0].locator.selector,'#b','precise invalidation must not delete sibling locator evidence');

// Long-term persistent storage remains bounded to 256 origins.
const b=harness();
await Promise.all(Array.from({length:300},(_,i)=>{
  const origin=`https://site-${String(i).padStart(3,'0')}.example`;
  return b.send({type:'AUTO_AGREE_PROFILE_PUT',profile:profile(flow(i,{ts:base+i}))},origin);
}));
const index=b.local.get('__auto_agree_profile_index__');
assert.equal(Object.keys(index||{}).length,256,'persistent origin index must remain hard-bounded');
const storedOrigins=[...b.local.keys()].filter(key=>key.startsWith('site:'));
assert.ok(storedOrigins.length<=256,'evicted origins must have their persistent profile removed');

// Persistence failure is a real operation failure, never an apparent ok response.
const c=harness({failLocalSet:true});
const failed=await c.send({type:'AUTO_AGREE_PROFILE_PUT',profile:profile(flow(1))});
assert.equal(failed.ok,false);
assert.match(failed.error||'',/synthetic-storage-failure/);

console.log('worker-profile-governance: PASS');