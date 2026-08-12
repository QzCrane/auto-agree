import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const source = fs.readFileSync('extension/profile-core.js', 'utf8');
assert.equal(/\bchrome\b|\bdocument\b|\bElement\b|\bNode\b|\bimportScripts\b/.test(source), false, 'ProfileCore must remain browser/Chrome independent');
const context = vm.createContext({ console, Date, Number, Math, Map, Set, Object, String, Array, JSON, RegExp });
vm.runInContext(source, context);
const core = context.__AUTO_AGREE_PROFILE_CORE__;
assert.ok(core, 'ProfileCore must initialize');
{
  const reinject = vm.createContext({ console, Date, Number, Math, Map, Set, Object, String, Array, JSON, RegExp });
  vm.runInContext(source, reinject);
  const first = reinject.__AUTO_AGREE_PROFILE_CORE__;
  vm.runInContext(source, reinject);
  assert.notEqual(reinject.__AUTO_AGREE_PROFILE_CORE__, first, 'stateless ProfileCore must reinstall so a new Engine world cannot inherit a stale singleton');
}
assert.deepEqual(JSON.parse(JSON.stringify(core.CONFIG)), {
  hotCacheMax: 32,
  maxOrigins: 256,
  maxFlows: 8,
  ttlMs: 180 * 24 * 60 * 60 * 1000,
  maxFingerprintLength: 520,
  maxSelectorLength: 420,
  maxHosts: 8,
  maxHostLength: 360,
  maxSuccesses: 100000,
  maxFailures: 1000,
  maxSeverity: 4,
  maxLinkBucket: 2
});

const NOW = 2_000_000_000_000;
const VERSION = '11.0.0';
const OPTIONAL = 2;
const locatorArb = fc.record({
  hosts: fc.array(fc.string({minLength:1,maxLength:24}).filter(s => !/[\u0000-\u001f]/.test(s.trim()) && !!s.trim()), {maxLength:4}),
  selector: fc.string({minLength:1,maxLength:50}).filter(s => !/[\u0000-\u001f]/.test(s.trim()) && !!s.trim())
});
const descriptorArb = fc.record({
  kind: fc.constantFrom('native','aria','data','class','custom','unknown'),
  severity: fc.integer({min:0,max:4}),
  legal: fc.boolean(),
  assent: fc.boolean(),
  required: fc.boolean(),
  auth: fc.boolean(),
  linkBucket: fc.integer({min:0,max:2})
});
const flowArb = fc.record({
  fingerprint: fc.string({minLength:1,maxLength:70}),
  locator: locatorArb,
  descriptor: descriptorArb,
  successes: fc.integer({min:0,max:100000}),
  failures: fc.integer({min:0,max:1000}),
  ts: fc.integer({min:NOW-core.CONFIG.ttlMs,max:NOW})
});

function legacyLocator(locator) {
  if (!locator || typeof locator !== 'object') return null;
  const selector = typeof locator.selector === 'string' ? locator.selector.trim() : '';
  if (!selector || selector.length > 420 || /[\u0000-\u001f]/.test(selector)) return null;
  if (!Array.isArray(locator.hosts) || locator.hosts.length > 8) return null;
  const hosts = [];
  for (const raw of locator.hosts) {
    if (typeof raw !== 'string') return null;
    const value = raw.trim();
    if (!value || value.length > 360 || /[\u0000-\u001f]/.test(value)) return null;
    hosts.push(value);
  }
  return {hosts, selector};
}
function legacyKey(locator) { try { return JSON.stringify(locator || null); } catch { return ''; } }
function legacyDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== 'object') return null;
  const kind = ['native','aria','data','class','custom','unknown'].includes(descriptor.kind) ? descriptor.kind : 'unknown';
  return {kind,severity:Math.max(0,Math.min(4,Number(descriptor.severity||0))),legal:!!descriptor.legal,assent:!!descriptor.assent,required:!!descriptor.required,auth:!!descriptor.auth,linkBucket:Math.max(0,Math.min(2,Number(descriptor.linkBucket||0)))};
}
function legacySanitize(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const map = new Map();
  for (const flow of Array.isArray(profile.flows) ? profile.flows : []) {
    if (!flow?.locator || !flow?.fingerprint) continue;
    const locator = legacyLocator(flow.locator);
    if (!locator) continue;
    const ts = Number(flow.ts || 0);
    if (!Number.isFinite(ts) || NOW-ts > core.CONFIG.ttlMs) continue;
    const fingerprint = String(flow.fingerprint).slice(0,520);
    const key = `${fingerprint}|${legacyKey(locator)}`;
    const clean = {fingerprint,locator,descriptor:legacyDescriptor(flow.descriptor),successes:Math.max(0,Math.min(100000,Number(flow.successes||0))),failures:Math.max(0,Math.min(1000,Number(flow.failures||0))),ts};
    const prev = map.get(key);
    if (!prev || clean.ts > prev.ts) map.set(key,clean);
  }
  const flows=[...map.values()].sort((a,b)=>b.ts-a.ts).slice(0,8);
  return flows.length ? {version:VERSION,flows} : null;
}
function legacyMerge(current,incoming) {
  const all=[...(current?.flows||[]),...(incoming?.flows||[])];
  const map=new Map();
  for(const flow of all){
    const locator=legacyLocator(flow?.locator);
    if(!locator||!flow?.fingerprint)continue;
    const fingerprint=String(flow.fingerprint).slice(0,520);
    const key=`${fingerprint}|${legacyKey(locator)}`;
    const next={fingerprint,locator,descriptor:legacyDescriptor(flow.descriptor),successes:Math.max(0,Math.min(100000,Number(flow.successes||0))),failures:Math.max(0,Math.min(1000,Number(flow.failures||0))),ts:Number(flow.ts||0)};
    const prev=map.get(key);
    if(!prev||next.ts>prev.ts)map.set(key,next);
    else if(next.ts===prev.ts){prev.successes=Math.max(prev.successes,next.successes);prev.failures=Math.max(prev.failures,next.failures);}
    else prev.successes=Math.max(prev.successes,next.successes);
  }
  return legacySanitize({flows:[...map.values()]});
}
function legacyCompatible(stored, live) {
  if (!stored || typeof stored !== 'object') return true;
  if (Number(stored.severity || 0) >= OPTIONAL) return false;
  if (stored.kind && stored.kind !== 'unknown' && live.kind !== stored.kind) return false;
  if (stored.legal && !live.legal) return false;
  if (stored.required && !live.required && !live.assent) return false;
  if (Number(stored.linkBucket || 0) > Number(live.linkBucket || 0) + 1) return false;
  return true;
}
function legacyCompact(index, origin) {
  const next = {...index};
  if (origin) next[origin] = NOW;
  const entries = Object.entries(next).filter(([,ts]) => Number.isFinite(Number(ts))).sort((a,b) => Number(b[1]) - Number(a[1]));
  return {index:Object.fromEntries(entries.slice(0,256)),drop:entries.slice(256).map(([key])=>key)};
}

// On the valid historical domain, extraction is behavior-preserving.
fc.assert(fc.property(fc.array(flowArb,{maxLength:20}), flows => {
  const input={version:VERSION,flows};
  assert.deepEqual(JSON.parse(JSON.stringify(core.sanitizeProfile(input,{version:VERSION,now:NOW}))), legacySanitize(input));
}), {seed:0xA60F1101,numRuns:2500,verbose:2});

fc.assert(fc.property(fc.array(flowArb,{maxLength:16}),fc.array(flowArb,{maxLength:16}),(a,b)=>{
  const current=legacySanitize({flows:a});
  const incoming=legacySanitize({flows:b});
  const expected=legacyMerge(current,incoming);
  const actual=core.mergeProfiles(current,incoming,{version:VERSION,now:NOW});
  assert.deepEqual(JSON.parse(JSON.stringify(actual)),expected);
}), {seed:0xA60F1102,numRuns:2500,verbose:2});

// Sanitization is idempotent, bounded, finite and identity-unique.
fc.assert(fc.property(fc.array(flowArb,{maxLength:30}),flows=>{
  const once=core.sanitizeProfile({flows},{version:VERSION,now:NOW});
  const twice=core.sanitizeProfile(once,{version:VERSION,now:NOW});
  assert.deepEqual(JSON.parse(JSON.stringify(twice)),JSON.parse(JSON.stringify(once)));
  if(!once)return;
  assert.ok(once.flows.length<=core.CONFIG.maxFlows);
  const ids=new Set();
  for(const flow of once.flows){
    assert.ok(Number.isFinite(flow.ts)&&flow.ts<=NOW&&NOW-flow.ts<=core.CONFIG.ttlMs);
    assert.ok(Number.isFinite(flow.successes)&&flow.successes>=0&&flow.successes<=core.CONFIG.maxSuccesses);
    assert.ok(Number.isFinite(flow.failures)&&flow.failures>=0&&flow.failures<=core.CONFIG.maxFailures);
    assert.ok(Number.isFinite(flow.descriptor.severity));
    assert.ok(Number.isFinite(flow.descriptor.linkBucket));
    const id=core.flowIdentity(flow);assert.ok(id&&!ids.has(id));ids.add(id);
  }
}),{seed:0xA60F1103,numRuns:1500,verbose:2});

// Cached acceleration compatibility has one pure authority and remains equivalent on valid descriptors.
fc.assert(fc.property(fc.option(descriptorArb,{nil:null}),descriptorArb,(stored,live)=>{
  assert.equal(core.descriptorCompatible(stored,live,OPTIONAL),legacyCompatible(stored,live));
}),{seed:0xA60F1104,numRuns:2500,verbose:2});
assert.equal(core.descriptorCompatible({kind:'native',severity:2},{kind:'native',severity:0},OPTIONAL),false,'optional-or-higher historical evidence never accelerates a click');
assert.equal(core.descriptorCompatible({kind:'native',severity:0},null,OPTIONAL),false,'missing live evidence fails closed');
assert.equal(core.descriptorCompatible({kind:'native',severity:0},{kind:'native',severity:0},NaN),false,'missing policy threshold fails closed');

// The persistent origin index remains behavior-equivalent on valid historical timestamps and hard-bounded.
const originIndexArb=fc.array(fc.record({key:fc.string({minLength:1,maxLength:36}).filter(key=>!['__proto__','prototype','constructor'].includes(key)),ts:fc.integer({min:NOW-1_000_000,max:NOW})}),{maxLength:300});
fc.assert(fc.property(originIndexArb,fc.string({minLength:1,maxLength:36}).filter(key=>key!=='null'&&!['__proto__','prototype','constructor'].includes(key)),(rows,origin)=>{
  const index=Object.fromEntries(rows.map(({key,ts})=>[key,ts]));
  assert.deepEqual(JSON.parse(JSON.stringify(core.compactOriginIndex(index,origin,NOW))),legacyCompact(index,origin));
}),{seed:0xA60F1105,numRuns:1500,verbose:2});

// Persisted acceleration evidence fails closed after a wall-clock rollback: future timestamps never survive.
for(const delta of [1,1000,60_000,core.CONFIG.ttlMs]){
  const bad=core.sanitizeProfile({flows:[{fingerprint:'future',locator:{hosts:[],selector:'#x'},descriptor:{kind:'native'},successes:1,failures:0,ts:NOW+delta}]},{version:VERSION,now:NOW});
  assert.equal(bad,null,`future profile timestamp +${delta}ms must fail closed`);
}

const malformed=core.sanitizeProfile({flows:[
  {fingerprint:'nan',locator:{hosts:[],selector:'#a'},descriptor:{kind:'native',severity:NaN,linkBucket:Infinity},successes:NaN,failures:Infinity,ts:NOW},
  {fingerprint:'inf',locator:{hosts:[],selector:'#b'},descriptor:{kind:'native',severity:-Infinity,linkBucket:NaN},successes:-Infinity,failures:NaN,ts:NOW-1}
]},{version:VERSION,now:NOW});
assert.ok(malformed&&malformed.flows.length===2);
for(const flow of malformed.flows){
  assert.ok(Number.isFinite(flow.successes));assert.ok(Number.isFinite(flow.failures));
  assert.ok(Number.isFinite(flow.descriptor.severity));assert.ok(Number.isFinite(flow.descriptor.linkBucket));
}

const hostileDescriptor=core.sanitizeDescriptor({kind:'native',severity:Symbol('x'),linkBucket:Symbol('y')});
assert.ok(hostileDescriptor);
assert.equal(hostileDescriptor.severity,0,'numeric coercion must be total even for hostile non-structured-clone inputs');
assert.equal(hostileDescriptor.linkBucket,0);

const bigIndex=Object.fromEntries(Array.from({length:300},(_,i)=>[`https://site-${String(i).padStart(3,'0')}.example`,NOW-i]));
const compact=core.compactOriginIndex(bigIndex,'https://new.example',NOW);
assert.equal(Object.keys(compact.index).length,256);
assert.equal(compact.drop.length,45);
assert.equal(compact.index['https://new.example'],NOW);
assert.equal(core.compactOriginIndex({'https://future.example':NOW+1},'',NOW).index['https://future.example'],undefined);

console.log('profile-core: PASS (10500 differential/property cases + fail-closed schema invariants)');
