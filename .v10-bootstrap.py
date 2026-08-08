from pathlib import Path


def load(path):
    return Path(path).read_text(encoding='utf-8')


def save(path, text):
    Path(path).write_text(text, encoding='utf-8')


version_files = [
    'extension/manifest.json', 'extension/bootstrap.js', 'extension/handover-guard.js',
    'extension/semantic-core.js', 'extension/risk-core.js', 'extension/gate.js',
    'extension/engine.js', 'extension/worker.js', 'package.json', 'tests/static-contract.mjs',
    'tests/worker-contract.mjs', 'tests/worker-restart.mjs', 'tests/e2e-extension.mjs'
]
for path in version_files:
    text = load(path)
    if '9.0.0' not in text:
        raise SystemExit(f'{path}: no v9 version anchor')
    save(path, text.replace('9.0.0', '10.0.0'))

path = 'tests/e2e-update.mjs'
text = load(path)
if '9.0.0' not in text or '8.0.0' not in text:
    raise SystemExit('e2e-update version anchors missing')
text = text.replace('9.0.0', '10.0.0').replace('8.0.0', '9.0.0')
text = text.replace('v8→v9', 'v9→v10').replace('v8 -> v9', 'v9 -> v10')
text = text.replace('v8 Engine', 'v9 Engine').replace('v8 Probe', 'v9 Probe').replace('stale-v8', 'stale-v9')
save(path, text)

path = 'tests/fixtures/regressions/dynamic.html'
text = load(path)
anchor = "window.clearRoutineLogin=()=>{document.querySelector('#mount').replaceChildren();window.dynamicClicks=0;};"
if text.count(anchor) != 1:
    raise SystemExit('dynamic clear anchor missing')
additions = r'''window.insertExternalIdrefUnknown=()=>{
  document.querySelector('#mount').innerHTML='<form><input type="email" value="user@example.com"><div id="external-unknown" role="checkbox" aria-labelledby="far-terms-label" data-clicks="0"></div><button type="button">Login</button></form>';
  document.querySelector('#external-filler')?.remove();
  document.querySelector('#far-terms-label')?.remove();
  const filler=document.createElement('div');filler.id='external-filler';
  for(let i=0;i<72;i++){const span=document.createElement('span');span.textContent='neutral '+i;filler.append(span);}
  document.body.append(filler);
  const label=document.createElement('div');label.id='far-terms-label';label.textContent='I agree to the Terms of Service';document.body.append(label);
  window.dynamicClicks=0;
  document.querySelector('#external-unknown').addEventListener('click',event=>{
    window.dynamicClicks++;
    event.currentTarget.dataset.clicks=String(Number(event.currentTarget.dataset.clicks||0)+1);
  });
};
window.insertWideCausalTrap=()=>{
  const spans=Array.from({length:72},(_,i)=>'<span>neutral '+i+'</span>').join('');
  document.querySelector('#mount').innerHTML='<div id="wide-causal"><button id="wide-action" type="button">Continue</button>'+spans+'<div id="wide-terms" role="checkbox" aria-checked="mixed" aria-label="Terms of Service" data-clicks="0"></div></div>';
  window.dynamicClicks=0;
  const terms=document.querySelector('#wide-terms');
  terms.addEventListener('click',event=>{window.dynamicClicks++;event.currentTarget.dataset.clicks=String(Number(event.currentTarget.dataset.clicks||0)+1);});
  document.querySelector('#wide-action').addEventListener('click',()=>terms.click());
};
'''
replacement = additions + "window.clearRoutineLogin=()=>{document.querySelector('#mount').replaceChildren();document.querySelector('#external-filler')?.remove();document.querySelector('#far-terms-label')?.remove();window.dynamicClicks=0;};"
save(path, text.replace(anchor, replacement, 1))

path = 'tests/e2e-update.mjs'
text = load(path)
anchor = "    assert.deepEqual(delegatedResult,{checked:true,windowClicks:1},'trusted local wrapper delegation must remain functional under the update firewall');\n\n    ext=(await browser.extensions()).get(initialId);"
if text.count(anchor) != 1:
    raise SystemExit('e2e update delegation anchor missing')
block = r'''    assert.deepEqual(delegatedResult,{checked:true,windowClicks:1},'trusted local wrapper delegation must remain functional under the update firewall');

    // Both Engines resolve this external IDREF. The current guard does not, so the stale generation
    // should leak one extra click until the production fix is applied.
    await activePage.evaluate(()=>{window.clearRoutineLogin();window.insertExternalIdrefUnknown();});
    await new Promise(resolve=>setTimeout(resolve,900));
    const externalIdrefClicks=await activePage.$eval('#external-unknown',el=>Number(el.dataset.clicks||0));
    assert.equal(externalIdrefClicks,1,'external aria-labelledby Terms control must have only the current-generation authorized click');

    // A trusted Continue/Login action must not grant a causal lease to a distant sibling Terms
    // control merely because both happen to live under one large generic DIV.
    await activePage.evaluate(()=>{window.clearRoutineLogin();window.insertWideCausalTrap();});
    await activePage.click('#wide-action');
    await new Promise(resolve=>setTimeout(resolve,350));
    const wideCausalClicks=await activePage.$eval('#wide-terms',el=>Number(el.dataset.clicks||0));
    assert.equal(wideCausalClicks,0,'unrelated trusted action must not authorize a distant sibling Terms synthetic click');

    ext=(await browser.extensions()).get(initialId);'''
save(path, text.replace(anchor, block, 1))

path = 'tests/e2e-update.mjs'
text = load(path)
anchor = "      trustedDelegatedClicks:1\n    }));"
if text.count(anchor) != 1:
    raise SystemExit('e2e output anchor missing')
save(path, text.replace(anchor, "      trustedDelegatedClicks:1,\n      externalIdrefClicks:1,\n      wideCausalClicks:0\n    }));", 1))

print('v10 adversarial red-test candidate built')
