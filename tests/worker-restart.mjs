import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync('extension/worker.js','utf8');
const local=new Map(),session=new Map();
const area=map=>({
  async get(keys){const out={};for(const k of Array.isArray(keys)?keys:[keys])if(map.has(k))out[k]=map.get(k);return out;},
  async set(obj){for(const [k,v] of Object.entries(obj))map.set(k,v);},
  async remove(keys){for(const k of Array.isArray(keys)?keys:[keys])map.delete(k);}
});
function boot(tabIds=[1,2]){
  let listener,installed; const calls=[];
  const chrome={
    runtime:{onMessage:{addListener(fn){listener=fn;}},onInstalled:{addListener(fn){installed=fn;}}},
    tabs:{async query(){return tabIds.map(id=>({id}));}},
    scripting:{async executeScript(spec){calls.push(spec);return[];}},
    storage:{local:area(local),session:area(session)}
  };
  vm.runInNewContext(source,{chrome,console,Promise,Map,Set,Date,Error,Number,String,Array,Object,JSON,Math,URL,setTimeout,clearTimeout});
  const send=(msg,sender={tab:{id:1},frameId:0,documentId:'d',documentLifecycle:'active',origin:'https://example.test',url:'https://example.test/login'})=>new Promise(resolve=>listener(msg,sender,resolve));
  return{listener,installed,calls,send};
}
const origin='https://example.test';
const profile={version:'9.0.0',flows:[{fingerprint:'/login|auth',locator:{hosts:[],selector:'#agree'},descriptor:{kind:'native',severity:0,legal:true,assent:true,required:true,auth:true,linkBucket:1},successes:2,failures:0,ts:Date.now()}]};
let a=boot();
assert.equal((await a.send({type:'AUTO_AGREE_PROFILE_PUT',origin,profile})).ok,true);
a=null; // Simulated worker termination: all globals disappear, storage remains.
const b=boot();
const read=await b.send({type:'AUTO_AGREE_PROFILE_GET',origin});
assert.equal(read.ok,true);assert.equal(read.profile.flows.length,1);assert.equal(read.profile.flows[0].successes,2);

// Update rehydration is persisted in storage.session so a worker killed mid-sweep can resume.
session.set('__auto_agree_update_rehydrate__',{version:'9.0.0',ts:Date.now()});
const c=boot([11,12,13]);
await new Promise(r=>setTimeout(r,20));
assert.ok(c.calls.some(x=>x.files?.[0]==='bootstrap.js'&&x.target?.allFrames===true));
assert.equal(session.has('__auto_agree_update_rehydrate__'),false);
console.log('worker-restart: PASS');
