import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const manifest=JSON.parse(fs.readFileSync('extension/manifest.json','utf8'));
const context=vm.createContext({console,WeakRef,performance});
vm.runInContext(fs.readFileSync('extension/runtime-kernel.js','utf8'),context);
vm.runInContext(fs.readFileSync('extension/decision-core.js','utf8'),context);
const policy=context.__AUTO_AGREE_DECISION__;
assert.ok(policy&&policy.version===manifest.version);
assert.equal(typeof policy.decideClasslessEvidence,'function');

const evidenceArb=fc.record({
  disabled:fc.boolean(),
  stateKind:fc.constantFrom('unknown','native','aria','data','mixed'),
  blocked:fc.boolean(),
  severity:fc.record({level:fc.integer({min:0,max:4}),kind:fc.string({maxLength:12})}),
  baseScore:fc.integer({min:-20,max:30}),
  legal:fc.boolean(),assent:fc.boolean(),required:fc.boolean(),auth:fc.boolean(),transaction:fc.boolean(),actionGated:fc.boolean(),
  legalLinks:fc.integer({min:0,max:6}),controlConfidence:fc.integer({min:0,max:5}),eligible:fc.boolean(),gatingScore:fc.integer({min:0,max:8})
});

function frozenHistoricalClassless(e){
  // The old Engine path had these fail-closed conditions outside its local `enough` boolean:
  // risky/negative/attestation text was filtered before geometry, disabled/hidden rows failed
  // cheapActive/visual checks, and mixed observable controls resolve through normal candidate logic.
  if(e.disabled||e.stateKind==='mixed'||e.blocked||e.severity.level>=policy.SEVERITY.OPTIONAL)return false;
  return (e.legal&&e.assent)||
    (e.legal&&e.required)||
    (e.legal&&e.auth&&(e.legalLinks>=2||e.actionGated));
}

fc.assert(fc.property(evidenceArb,e=>{
  const out=policy.decideClasslessEvidence(e);
  assert.equal(out.accept,frozenHistoricalClassless(e));
  assert.equal(out.graph.facts.legal,e.legal);
  assert.equal(out.graph.facts.assent,e.assent);
  assert.equal(out.graph.facts.required,e.required);
  assert.equal(out.graph.facts.auth,e.auth);
}),{seed:0xC1A551E5,numRuns:5000,verbose:2});

fc.assert(fc.property(evidenceArb,e=>{
  const risky={...e,severity:{level:fc.sample(fc.integer({min:2,max:4}),1)[0],kind:'risk'}};
  assert.equal(policy.decideClasslessEvidence(risky).accept,false,'optional/consequential/attestation evidence must never authorize classless geometry');
}),{seed:0xC1A551E6,numRuns:1000,verbose:2});

const base={disabled:false,stateKind:'unknown',blocked:false,severity:{level:0,kind:'routine'},baseScore:100,legal:true,assent:false,required:false,auth:false,transaction:false,actionGated:false,legalLinks:0,controlConfidence:2,eligible:true,gatingScore:20};
assert.equal(policy.decideEvidence(base).accept,true,'generic score/eligible path is intentionally broader');
assert.equal(policy.decideClasslessEvidence(base).accept,false,'classless fallback must not inherit generic score/eligible escape authority');
assert.equal(policy.decideClasslessEvidence({...base,assent:true}).accept,true);
assert.equal(policy.decideClasslessEvidence({...base,required:true}).accept,true);
assert.equal(policy.decideClasslessEvidence({...base,auth:true,legalLinks:2}).accept,true);
assert.equal(policy.decideClasslessEvidence({...base,auth:true,actionGated:true}).accept,true);

console.log('classless-decision: PASS (6000 shrinkable differential/safety cases)');
