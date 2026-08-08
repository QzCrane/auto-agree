import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync('extension/worker.js','utf8');

function makeHarness(){
  let listener; let now=0; const pending=[]; const started=[]; const local=new Map(),session=new Map();
  const area=map=>({async get(keys){const o={};for(const k of Array.isArray(keys)?keys:[keys])if(map.has(k))o[k]=map.get(k);return o;},async set(o){for(const[k,v]of Object.entries(o))map.set(k,v);},async remove(keys){for(const k of Array.isArray(keys)?keys:[keys])map.delete(k);}});
  let active=0,maxGlobal=0;const activeByTab=new Map();let maxPerTab=0;
  const chrome={runtime:{onMessage:{addListener(fn){listener=fn;}},onInstalled:{addListener(){}}},storage:{local:area(local),session:area(session)},tabs:{async query(){return[];}},scripting:{executeScript(spec){started.push(spec);active++;maxGlobal=Math.max(maxGlobal,active);const tab=spec.target.tabId,n=(activeByTab.get(tab)||0)+1;activeByTab.set(tab,n);maxPerTab=Math.max(maxPerTab,n);return new Promise(resolve=>pending.push(()=>{active--;const m=(activeByTab.get(tab)||1)-1;if(m)activeByTab.set(tab,m);else activeByTab.delete(tab);resolve([]);}));}}};
  const FakeDate={now:()=>now};
  vm.runInNewContext(source,{chrome,console,Promise,Map,Set,Date:FakeDate,Error,Number,String,Array,Object,JSON,Math,setTimeout,clearTimeout});
  const send=(type,tab,doc)=>new Promise(resolve=>listener({type},{tab:{id:tab},frameId:0,documentId:doc,documentLifecycle:'active'},resolve));
  const release=async()=>{const fn=pending.shift();assert.ok(fn);fn();await new Promise(r=>setTimeout(r,0));};
  const releaseAll=async()=>{let guard=0;while((pending.length||active)&&guard++<500){if(pending.length)await release();else await new Promise(r=>setTimeout(r,0));}};
  return{send,started,pending,release,releaseAll,setNow:v=>now=v,stats:()=>({maxGlobal,maxPerTab})};
}

// Bounded concurrency and Engine priority under load.
{
  const h=makeHarness();const jobs=[];
  for(let i=0;i<18;i++)jobs.push(h.send(i%3===0?'AUTO_AGREE_ACTIVATE':'AUTO_AGREE_GATE',i%3,`d${i}`));
  await h.releaseAll();const results=await Promise.all(jobs);assert.ok(results.every(x=>x?.ok));
  const {maxGlobal,maxPerTab}=h.stats();assert.ok(maxGlobal<=4);assert.ok(maxPerTab<=2);
}

// Queue-full admission: a new Engine job preempts a younger Gate job rather than being rejected.
{
  const h=makeHarness();const jobs=[];
  for(let i=0;i<4;i++)jobs.push(h.send('AUTO_AGREE_GATE',i,`active-${i}`));
  for(let i=0;i<64;i++)jobs.push(h.send('AUTO_AGREE_GATE',10+(i%8),`queued-${i}`));
  const engine=h.send('AUTO_AGREE_ACTIVATE',99,'engine-priority');jobs.push(engine);
  await h.release();
  assert.ok(h.started.some(x=>x.files?.includes('engine.js')),'Engine should enter before draining all Gate backlog');
  await h.releaseAll();const results=await Promise.all(jobs);assert.equal((await engine).ok,true);assert.ok(results.some(r=>r?.error==='injection-preempted'));
}

// Aging: a Gate waiting for several aging quanta outranks newly queued Engine work.
{
  const h=makeHarness();const active=[];for(let i=0;i<4;i++)active.push(h.send('AUTO_AGREE_ACTIVATE',i,`a${i}`));
  const oldGate=h.send('AUTO_AGREE_GATE',50,'old-gate');h.setNow(5000);
  const engines=[];for(let i=0;i<6;i++)engines.push(h.send('AUTO_AGREE_ACTIVATE',60+i,`new-e${i}`));
  await h.release();
  const justStarted=h.started.at(-1);assert.ok(justStarted.files?.includes('gate.js'),'aged Gate should not starve behind new Engine jobs');
  await h.releaseAll();await Promise.all([...active,oldGate,...engines]);
}

// Stale queued work is evicted rather than consuming a later execution slot.
{
  const h=makeHarness();const active=[];for(let i=0;i<4;i++)active.push(h.send('AUTO_AGREE_ACTIVATE',i,`s-a${i}`));
  const stale=h.send('AUTO_AGREE_GATE',80,'stale');h.setNow(20000);
  const fresh=h.send('AUTO_AGREE_ACTIVATE',81,'fresh');
  const staleResult=await stale;assert.equal(staleResult.ok,false);assert.equal(staleResult.error,'injection-stale');
  await h.releaseAll();await Promise.all([...active,fresh]);
}
console.log('worker-scheduler: PASS');
