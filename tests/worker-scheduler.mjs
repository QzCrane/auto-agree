import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

let listener;
let active = 0, maxGlobal = 0;
const activeByTab = new Map();
let maxPerTab = 0;
const local = new Map(), session = new Map();
const area = map => ({
  async get(keys){ const o={}; for(const k of Array.isArray(keys)?keys:[keys]) if(map.has(k))o[k]=map.get(k); return o; },
  async set(obj){ for(const [k,v] of Object.entries(obj))map.set(k,v); },
  async remove(keys){ for(const k of Array.isArray(keys)?keys:[keys])map.delete(k); }
});
const chrome={
  runtime:{onMessage:{addListener(fn){listener=fn;}}},
  storage:{local:area(local),session:area(session)},
  scripting:{executeScript(spec){
    active++; maxGlobal=Math.max(maxGlobal,active);
    const tab=spec.target.tabId, n=(activeByTab.get(tab)||0)+1; activeByTab.set(tab,n); maxPerTab=Math.max(maxPerTab,n);
    return new Promise(resolve=>setTimeout(()=>{active--; const m=(activeByTab.get(tab)||1)-1; if(m)activeByTab.set(tab,m); else activeByTab.delete(tab); resolve([]);},12));
  }}
};
vm.runInNewContext(fs.readFileSync('extension/worker.js','utf8'),{chrome,console,Promise,Map,Date,Error,Number,String,Array,Object,JSON,Math,setTimeout,clearTimeout});
const send=(type,tab,doc)=>new Promise((resolve,reject)=>{const keep=listener({type},{tab:{id:tab},frameId:0,documentId:doc},r=>resolve(r)); if(keep!==true)reject(new Error('channel'));});
const jobs=[];
for(let i=0;i<18;i++) jobs.push(send(i%3===0?'AUTO_AGREE_ACTIVATE':'AUTO_AGREE_GATE', i%3, `d${i}`));
const results=await Promise.all(jobs);
assert.ok(results.every(x=>x?.ok));
assert.ok(maxGlobal<=4, `max global ${maxGlobal}`);
assert.ok(maxPerTab<=2, `max per tab ${maxPerTab}`);
console.log(`worker-scheduler: PASS (maxGlobal=${maxGlobal}, maxPerTab=${maxPerTab})`);
