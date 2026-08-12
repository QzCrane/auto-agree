import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const kernelSource=fs.readFileSync('extension/runtime-kernel.js','utf8');
const source=fs.readFileSync('extension/generation-lease.js','utf8');
const currentVersion=JSON.parse(fs.readFileSync('extension/manifest.json','utf8')).version;
const [major]=currentVersion.split('.').map(Number);
assert.ok(Number.isInteger(major) && major >= 0,'manifest must expose a numeric major generation');
const nextVersion=`${major+1}.0.0`;
let runtimeVersion=currentVersion;
let invalidated=false;
let clicks=0;

class HTMLElement {
  click(){ clicks++; return 'clicked'; }
}

const chrome={runtime:{getManifest(){
  if(invalidated) throw new Error('Extension context invalidated.');
  return {version:runtimeVersion};
}}};
const context=vm.createContext({chrome,HTMLElement,Object,Reflect,Error,WeakRef,performance});
vm.runInContext(kernelSource,context);
vm.runInContext(source,context);
assert.equal(context.__AUTO_AGREE_GENERATION_LEASE__?.version,currentVersion,'compiled generation lease must match the candidate manifest');

const el=new HTMLElement();
assert.equal(el.click(),'clicked');
assert.equal(clicks,1,'current generation must retain normal click behavior');

runtimeVersion=nextVersion;
assert.equal(el.click(),undefined);
assert.equal(clicks,1,'manifest generation mismatch must revoke stale realm click authority');

runtimeVersion=currentVersion;
invalidated=true;
assert.equal(el.click(),undefined);
assert.equal(clicks,1,'invalidated extension context must revoke stale realm click authority');

// Page-owned code lives in another JS realm. The original native method remains independently
// callable there; the lease is deliberately scoped to Auto Agree's isolated world prototype.
const pageOwnedClick=Object.getOwnPropertyDescriptor(class PageHTMLElement { click(){ clicks++; return 'page'; } }.prototype,'click').value;
assert.equal(pageOwnedClick.call({}),'page');
assert.equal(clicks,2,'cooperative revocation must not imply a page-global click patch');
console.log('generation-lease: PASS');