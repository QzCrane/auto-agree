import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync('extension/generation-lease.js','utf8');
let runtimeVersion='10.0.0';
let invalidated=false;
let clicks=0;

class HTMLElement {
  click(){ clicks++; return 'clicked'; }
}

const chrome={runtime:{getManifest(){
  if(invalidated) throw new Error('Extension context invalidated.');
  return {version:runtimeVersion};
}}};
const context=vm.createContext({chrome,HTMLElement,Object,Reflect,Error});
vm.runInContext(source,context);
assert.equal(context.__AUTO_AGREE_GENERATION_LEASE__?.version,'10.0.0');

const el=new HTMLElement();
assert.equal(el.click(),'clicked');
assert.equal(clicks,1,'current generation must retain normal click behavior');

runtimeVersion='11.0.0';
assert.equal(el.click(),undefined);
assert.equal(clicks,1,'manifest generation mismatch must revoke stale realm click authority');

runtimeVersion='10.0.0';
invalidated=true;
assert.equal(el.click(),undefined);
assert.equal(clicks,1,'invalidated extension context must revoke stale realm click authority');

// Page-owned code lives in another JS realm. The original native method remains independently
// callable there; the lease is deliberately scoped to Auto Agree's isolated world prototype.
const pageOwnedClick=Object.getOwnPropertyDescriptor(class PageHTMLElement { click(){ clicks++; return 'page'; } }.prototype,'click').value;
assert.equal(pageOwnedClick.call({}),'page');
assert.equal(clicks,2,'cooperative revocation must not imply a page-global click patch');
console.log('generation-lease: PASS');