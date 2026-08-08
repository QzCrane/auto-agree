import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import {extensionWorldSentinels,evaluateInExecutionContext} from './e2e-isolated-worlds.mjs';

const ROOT=path.resolve('.');
const CURRENT=path.join(ROOT,'extension');
const DYNAMIC=fs.readFileSync(path.join(ROOT,'tests','fixtures','regressions','dynamic.html'),'utf8');
const PREVIOUS_REF=process.env.AUTO_AGREE_PREVIOUS_REF || '';
const HEADED=process.env.AUTO_AGREE_HEADED==='1';

function stagePrevious(ref,dest){
  fs.mkdirSync(dest,{recursive:true});
  const names=execFileSync('git',['ls-tree','-r','--name-only',ref,'extension'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
  assert.ok(names.length>=5,`no previous extension files at ${ref}`);
  for(const file of names){
    const rel=file.replace(/^extension\//,'');
    const out=path.join(dest,rel);
    fs.mkdirSync(path.dirname(out),{recursive:true});
    fs.writeFileSync(out,execFileSync('git',['show',`${ref}:${file}`]));
  }
}

function replaceDir(src,dest){
  for(const name of fs.readdirSync(dest)) fs.rmSync(path.join(dest,name),{recursive:true,force:true});
  for(const name of fs.readdirSync(src)) fs.cpSync(path.join(src,name),path.join(dest,name),{recursive:true});
}

async function bounded(promise,timeout,label){
  let timer;
  try{
    return await Promise.race([
      promise,
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} timed out after ${timeout}ms`)),timeout);})
    ]);
  } finally { if(timer) clearTimeout(timer); }
}

async function poll(fn,timeout=7000,interval=80){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    const value=await fn();
    if(value) return value;
    await new Promise(resolve=>setTimeout(resolve,interval));
  }
  throw new Error(`poll timeout after ${timeout}ms`);
}

async function launch(){
  return puppeteer.launch({
    headless:!HEADED,
    pipe:true,
    dumpio:true,
    enableExtensions:true,
    args:['--no-first-run','--no-default-browser-check','--disable-dev-shm-usage','--no-sandbox']
  });
}

async function withServer(fn){
  const server=http.createServer((req,res)=>{
    res.setHeader('content-type','text/html; charset=utf-8');
    if((req.url||'').startsWith('/dynamic.html')) res.end(DYNAMIC);
    else {res.statusCode=404;res.end('not found');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const {port}=server.address();
  try{return await fn(`http://127.0.0.1:${port}`);}finally{await new Promise(resolve=>server.close(resolve));}
}

async function gotoActive(page,url){
  await page.bringToFront();
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.bringToFront();
  await page.waitForFunction(()=>document.visibilityState==='visible',{timeout:2000});
}

async function waitChecked(page,selector,timeout=5000){
  await page.waitForFunction(sel=>document.querySelector(sel)?.checked===true,{timeout},selector);
}

if(!PREVIOUS_REF) throw new Error('AUTO_AGREE_PREVIOUS_REF is required');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'auto-agree-update-api-'));
const active=path.join(tmp,'extension');
stagePrevious(PREVIOUS_REF,active);
assert.equal(JSON.parse(fs.readFileSync(path.join(active,'manifest.json'),'utf8')).version,'9.0.0');

await withServer(async base=>{
  const browser=await launch();
  try{
    const initialId=await bounded(browser.installExtension(active),5000,'install v9 unpacked');
    let ext=(await browser.extensions()).get(initialId);
    assert.ok(ext,'v9 extension missing after Browser.installExtension');
    assert.equal(ext.version,'9.0.0');

    const dormantPage=await browser.newPage();
    await gotoActive(dormantPage,`${base}/dynamic.html?update=dormant`);
    await dormantPage.evaluate(()=>{window.__autoAgreeUpdateMarker='dormant-v9';});

    const activePage=await browser.newPage();
    await gotoActive(activePage,`${base}/dynamic.html?update=active`);
    await activePage.evaluate(()=>{window.__autoAgreeUpdateMarker='active-v9';window.insertRoutineLogin();});
    await waitChecked(activePage,'#dynamic-agree');
    assert.equal(await activePage.evaluate(()=>window.dynamicClicks),1,'v9 active-page setup must click exactly once');
    const activeBefore=await extensionWorldSentinels(activePage);
    assert.ok(activeBefore.some(world=>world.engine==='9.0.0'),'active page must have v9 Engine before update');
    await activePage.evaluate(()=>window.clearRoutineLogin());

    replaceDir(CURRENT,active);
    assert.equal(JSON.parse(fs.readFileSync(path.join(active,'manifest.json'),'utf8')).version,'10.0.0');

    const reloadedId=await bounded(browser.installExtension(active),5000,'reload same unpacked path as v10');
    assert.equal(reloadedId,initialId,'same unpacked path must retain extension identity across update');

    let observed=[];
    const worker=await poll(async()=>{
      observed=[];
      for(const target of browser.targets().filter(t=>t.type()==='service_worker'&&t.url().startsWith(`chrome-extension://${initialId}/`))){
        let handle=null,version='unreadable';
        try{
          handle=await bounded(target.worker(),600,'updated target.worker');
          version=handle?await bounded(handle.evaluate(()=>chrome.runtime.getManifest().version),600,'updated manifest read'):'no-worker';
        }catch(error){version=String(error?.message||error);}
        observed.push({url:target.url(),version});
        if(handle&&version==='10.0.0') return handle;
      }
      return null;
    },7000,80).catch(async error=>{
      const installed=[...(await browser.extensions()).values()].map(item=>({id:item.id,name:item.name,version:item.version,path:item.path}));
      console.error('update-api-diagnostic:',JSON.stringify({installed,observed,targets:browser.targets().filter(t=>t.type()==='service_worker').map(t=>t.url())}));
      throw error;
    });

    assert.equal(await bounded(worker.evaluate(()=>chrome.runtime.getManifest().version),800,'final v10 manifest read'),'10.0.0');

    const dormantHandover=await poll(async()=>{
      const worlds=await extensionWorldSentinels(dormantPage);
      return worlds.some(world=>world.handover==='10.0.0')?worlds:null;
    },5000,60);
    const activeHandover=await poll(async()=>{
      const worlds=await extensionWorldSentinels(activePage);
      return worlds.some(world=>world.handover==='10.0.0')?worlds:null;
    },5000,60);
    assert.ok(dormantHandover.some(world=>world.handover==='10.0.0'));
    assert.ok(activeHandover.some(world=>world.handover==='10.0.0'));

    await dormantPage.bringToFront();
    assert.equal(await dormantPage.evaluate(()=>window.__autoAgreeUpdateMarker),'dormant-v9','dormant page reloaded during update');
    await dormantPage.evaluate(()=>window.insertRoutineLogin());
    await waitChecked(dormantPage,'#dynamic-agree');
    assert.equal(await dormantPage.evaluate(()=>window.dynamicClicks),1,'dormant old page must get exactly one click after v10 activation');
    const dormantAfter=await extensionWorldSentinels(dormantPage);
    assert.ok(dormantAfter.some(world=>world.engine==='10.0.0'),'dormant v9 Probe must hand off into v10 Engine');
    assert.equal(dormantAfter.some(world=>world.engine==='9.0.0'),false,'dormant page must not gain a v9 Engine after update');

    await activePage.bringToFront();
    assert.equal(await activePage.evaluate(()=>window.__autoAgreeUpdateMarker),'active-v9','active page reloaded during update');
    await activePage.evaluate(()=>window.insertRoutineLogin());
    await waitChecked(activePage,'#dynamic-agree');
    assert.equal(await activePage.evaluate(()=>window.dynamicClicks),1,'updated active page must receive exactly one routine-agreement click');
    const activeAfterRoutine=await extensionWorldSentinels(activePage);
    assert.ok(activeAfterRoutine.some(world=>world.engine==='10.0.0'),'updated active page must expose the current v10 Engine world');

    await activePage.evaluate(()=>{window.clearRoutineLogin();window.insertMixedLogin();});
    await new Promise(resolve=>setTimeout(resolve,900));
    const mixedResult=await activePage.$eval('#dynamic-mixed',el=>({
      state:el.getAttribute('aria-checked'),
      elementClicks:Number(el.dataset.clicks||0),
      windowClicks:Number(window.dynamicClicks||0)
    }));
    assert.deepEqual(mixedResult,{state:'mixed',elementClicks:0,windowClicks:0},'legacy v9 mixed-state behavior must not remain an active click authority after update');
    const activeAfterMixed=await extensionWorldSentinels(activePage);
    const oldWorld=activeAfterMixed.find(world=>world.engine==='9.0.0');
    const oldSentinelVisible=!!oldWorld;
    const currentSentinelVisible=activeAfterMixed.some(world=>world.engine==='10.0.0');
    assert.ok(oldWorld,'stale v9 Engine execution context must remain available for direct authority discrimination');
    assert.equal(currentSentinelVisible,true,'v10 Engine sentinel missing after mixed-state discriminator');

    await activePage.evaluate(()=>{window.clearRoutineLogin();window.insertUserDelegatedTerms();});
    await activePage.click('#delegated-wrapper');
    await waitChecked(activePage,'#delegated-input',2000);
    const delegatedResult=await activePage.$eval('#delegated-input',el=>({checked:el.checked,windowClicks:Number(window.dynamicClicks||0)}));
    assert.deepEqual(delegatedResult,{checked:true,windowClicks:1},'trusted local wrapper delegation must remain functional under the update firewall');

    await activePage.evaluate(()=>{window.clearRoutineLogin();window.insertExternalIdrefUnknown();});
    await evaluateInExecutionContext(activePage,oldWorld.id,"document.querySelector('#external-unknown')?.click(); true");
    await new Promise(resolve=>setTimeout(resolve,250));
    const externalIdrefClicks=await activePage.$eval('#external-unknown',el=>Number(el.dataset.clicks||0));
    assert.equal(externalIdrefClicks,0,'external aria-labelledby Terms control must block a direct stale-world synthetic click');

    // Shared semantic-core recognizes Spanish terms/assent, but the v9/v10 guard's private regex
    // copy does not. Direct stale-world dispatch isolates that semantic-drift authority boundary.
    await activePage.evaluate(()=>{window.clearRoutineLogin();window.insertSpanishSemanticTrap();});
    await evaluateInExecutionContext(activePage,oldWorld.id,"document.querySelector('#spanish-terms')?.click(); true");
    await new Promise(resolve=>setTimeout(resolve,250));
    const spanishSemanticClicks=await activePage.$eval('#spanish-terms',el=>Number(el.dataset.clicks||0));
    assert.equal(spanishSemanticClicks,0,'Spanish agreement recognized by shared semantics must block a direct stale-world synthetic click');

    await activePage.evaluate(()=>{window.clearRoutineLogin();window.insertWideCausalTrap();});
    await activePage.click('#wide-action');
    await new Promise(resolve=>setTimeout(resolve,350));
    const wideCausalClicks=await activePage.$eval('#wide-terms',el=>Number(el.dataset.clicks||0));
    assert.equal(wideCausalClicks,0,'unrelated trusted action must not authorize a distant sibling Terms synthetic click');

    await activePage.evaluate(()=>{window.clearRoutineLogin();window.insertAmbiguousCausalTrap();});
    await activePage.click('#ambiguous-wrapper',{offset:{x:2,y:2}});
    await new Promise(resolve=>setTimeout(resolve,350));
    const ambiguousCausalClicks=await activePage.$eval('#ambiguous-terms',el=>Number(el.dataset.clicks||0));
    assert.equal(ambiguousCausalClicks,0,'multi-control generic wrapper must fail closed instead of leasing a region');

    await activePage.evaluate(()=>{window.clearRoutineLogin();window.insertActionInsideLabelTrap();});
    await activePage.click('#label-action');
    await new Promise(resolve=>setTimeout(resolve,350));
    const actionInsideLabelClicks=await activePage.$eval('#label-terms',el=>Number(el.dataset.clicks||0));
    assert.equal(actionInsideLabelClicks,0,'proceed action inside label must not authorize label/sibling Terms click');

    ext=(await browser.extensions()).get(initialId);
    console.log('e2e-update:',JSON.stringify({
      id:initialId,
      workerVersion:'10.0.0',
      reportedVersion:ext?.version||null,
      dormantPageReloaded:false,
      activePageReloaded:false,
      dormantEngine:'10.0.0',
      handoverGuard:'10.0.0',
      activeOldSentinelVisible:oldSentinelVisible,
      activeCurrentSentinelVisible:currentSentinelVisible,
      activeRoutineClicks:1,
      activeMixedClicks:0,
      trustedDelegatedClicks:1,
      externalIdrefClicks:0,
      spanishSemanticClicks:0,
      wideCausalClicks:0,
      ambiguousCausalClicks:0,
      actionInsideLabelClicks:0
    }));
    console.log('e2e-update-worlds:',JSON.stringify(activeAfterMixed));
    console.log('e2e-update: PASS');
    await dormantPage.close();
    await activePage.close();
  } finally {await browser.close();}
});

fs.rmSync(tmp,{recursive:true,force:true});