import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

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
vm.runInNewContext(fs.readFileSync('extension/worker.js','utf8'),{chrome,console,Promise,Map,Set,Date,Error,Number,String,Array,Object,JSON,Math,setTimeout,clearTimeout});
assert.equal(typeof listener,'function');
assert.equal(typeof installedListener,'function');

function message(msg,sender){
  return new Promise((resolve,reject)=>{
    const keep=listener(msg,sender,response=>resolve(response));
    if(keep!==true&&responsePending(msg)) reject(new Error(`listener did not keep channel for ${msg.type}`));
  });
}
function responsePending(msg){return ['AUTO_AGREE_GATE','AUTO_AGREE_ACTIVATE','AUTO_AGREE_PROFILE_GET','AUTO_AGREE_PROFILE_PUT','AUTO_AGREE_PROFILE_INVALIDATE'].includes(msg.type);}

const sender={tab:{id:7},frameId:3,documentId:'doc-1',documentLifecycle:'active'};
await message({type:'AUTO_AGREE_GATE'},sender);
await message({type:'AUTO_AGREE_ACTIVATE'},sender);
assert.equal(JSON.stringify(calls[0].files),JSON.stringify(['semantic-core.js','gate.js']));
assert.equal(JSON.stringify(calls[1].files),JSON.stringify(['risk-core.js','engine.js']));
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
console.log('worker-contract: PASS');
