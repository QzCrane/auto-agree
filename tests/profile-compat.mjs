import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const context=vm.createContext({console,Date,Number,Math,Map,Set,Object,String,Array,JSON,RegExp});
vm.runInContext(fs.readFileSync('extension/profile-core.js','utf8'),context);
const core=context.__AUTO_AGREE_PROFILE_CORE__;
assert.ok(core&&typeof core.descriptorCompatible==='function');
const OPTIONAL=2;
const descriptorArb=fc.record({
  kind:fc.constantFrom('native','aria','data','class','custom','unknown'),
  severity:fc.integer({min:0,max:4}),
  legal:fc.boolean(),assent:fc.boolean(),required:fc.boolean(),auth:fc.boolean(),
  linkBucket:fc.integer({min:0,max:2})
});
function legacyCompatible(stored,live){
  if(!stored||typeof stored!=='object')return true;
  if(Number(stored.severity||0)>=OPTIONAL)return false;
  if(stored.kind&&stored.kind!=='unknown'&&live.kind!==stored.kind)return false;
  if(stored.legal&&!live.legal)return false;
  if(stored.required&&!live.required&&!live.assent)return false;
  if(Number(stored.linkBucket||0)>Number(live.linkBucket||0)+1)return false;
  return true;
}
fc.assert(fc.property(fc.option(descriptorArb,{nil:null}),descriptorArb,(stored,live)=>{
  assert.equal(core.descriptorCompatible(stored,live,OPTIONAL),legacyCompatible(stored,live));
}),{seed:0xA60F1104,numRuns:2500,verbose:2});

assert.equal(core.descriptorCompatible({kind:'native',severity:2},{kind:'native',severity:0},OPTIONAL),false,'optional-or-higher history never accelerates a click');
assert.equal(core.descriptorCompatible({kind:'native',severity:0},null,OPTIONAL),false,'missing live descriptor fails closed');
assert.equal(core.descriptorCompatible({kind:'native',severity:0},{kind:'native',severity:0},NaN),false,'missing policy threshold fails closed');
assert.equal(core.descriptorCompatible({kind:'native',severity:0,legal:true},{kind:'native',severity:0,legal:false},OPTIONAL),false,'legal evidence may not disappear under cache acceleration');
assert.equal(core.descriptorCompatible({kind:'native',severity:0,required:true},{kind:'native',severity:0,required:false,assent:false},OPTIONAL),false,'mandatory evidence may not disappear under cache acceleration');

console.log('profile-compat: PASS (2500 differential cases + fail-closed cache invariants)');
