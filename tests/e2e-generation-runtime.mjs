import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const ROOT=path.resolve('.');
const CURRENT=path.join(ROOT,'extension');
const DYNAMIC=fs.readFileSync(path.join(ROOT,'tests','fixtures','regressions','dynamic.html'),'utf8');
const HEADED=process.env.AUTO_AGREE_HEADED==='1';
const FROM_VERSION='9.0.0';
const PROBE_VERSION='10.0.0';

function copyDir(src,dest){
  fs.mkdirSync(dest,{recursive:true});
  for(const name of fs.readdirSync(src)) fs.cpSync(path.join(src,name),path.join(dest,name),{recursive:true});
}

function rewriteManifestVersion(dir,version){
  const file=path.join(dir,'manifest.json');
  const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
  manifest.version=version;
  fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');
}

async function launch(extensionPath){
  return puppeteer.launch({
    headless:!HEADED,
    pipe:true,
    dumpio:true,
    enableExtensions:[extensionPath],
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

async function bounded(promise,timeout,label){
  let timer;
  try{
    return await Promise.race([
      promise,
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} timed out after ${timeout}ms`)),timeout);})
    ]);
  } finally { if(timer) clearTimeout(timer); }
}

function expression(){
  return `(() => {
    let manifestVersion=null, runtimeVersion=null, runtimeId=null, runtimeError=null;
    try {
      runtimeId=globalThis.chrome?.runtime?.id || null;
      manifestVersion=globalThis.chrome?.runtime?.getManifest?.()?.version || null;
      runtimeVersion=globalThis.chrome?.runtime?.getVersion?.() || null;
    } catch (error) {
      runtimeError=String(error?.message || error);
    }
    return {
      probe: globalThis.__AUTO_AGREE_PROBE__ || null,
      handover: globalThis.__AUTO_AGREE_HANDOVER_GUARD__?.version || null,
      semantic: globalThis.__AUTO_AGREE_SEMANTIC__?.version || globalThis.__AUTO_AGREE_SEMANTIC__ || null,
      gate: globalThis.__AUTO_AGREE_GATE__ || null,
      risk: globalThis.__AUTO_AGREE_RISK__?.version || globalThis.__AUTO_AGREE_RISK__ || null,
      engine: globalThis.__AUTO_AGREE_ENGINE__ || null,
      manifestVersion,
      runtimeVersion,
      runtimeId,
      runtimeError,
      href: location.href
    };
  })()`;
}

async function readContext(session,context){
  try{
    const {result,exceptionDetails}=await session.send('Runtime.evaluate',{
      contextId:context.id,
      returnByValue:true,
      expression:expression()
    });
    if(exceptionDetails) return {id:context.id,error:exceptionDetails.text||'exception'};
    return {id:context.id,name:context.name||'',origin:context.origin||'',auxData:context.auxData||null,...result?.value};
  }catch(error){
    return {id:context.id,name:context.name||'',origin:context.origin||'',error:String(error?.message||error)};
  }
}

await withServer(async base=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'auto-agree-generation-runtime-'));
  const active=path.join(tmp,'extension');
  copyDir(CURRENT,active);
  assert.equal(JSON.parse(fs.readFileSync(path.join(active,'manifest.json'),'utf8')).version,FROM_VERSION);

  const browser=await launch(active);
  try{
    const extensionId=await bounded(browser.installExtension(active),5000,'install v9 unpacked');
    const page=await browser.newPage();
    await gotoActive(page,`${base}/dynamic.html?generation-runtime=1`);
    await page.evaluate(()=>window.insertRoutineLogin());
    await waitChecked(page,'#dynamic-agree');

    const session=await page.createCDPSession();
    const contexts=[];
    const onContext=event=>contexts.push(event.context);
    session.on('Runtime.executionContextCreated',onContext);
    await session.send('Runtime.enable');
    await new Promise(resolve=>setTimeout(resolve,150));

    const before=[];
    for(const context of contexts){
      const value=await readContext(session,context);
      if(value?.engine===FROM_VERSION) before.push(value);
    }
    assert.ok(before.length>=1,'expected at least one live v9 Engine isolated world before update');

    rewriteManifestVersion(active,PROBE_VERSION);
    const reloadedId=await bounded(browser.installExtension(active),5000,'install probe update');
    assert.equal(reloadedId,extensionId,'same unpacked path must retain extension identity');
    await new Promise(resolve=>setTimeout(resolve,500));

    const after=[];
    for(const old of before){
      const context=contexts.find(item=>item.id===old.id) || {id:old.id,name:old.name,origin:old.origin};
      after.push(await readContext(session,context));
    }

    const evidence={fromVersion:FROM_VERSION,probeVersion:PROBE_VERSION,before,after,pageReloaded:false};
    console.log('generation-runtime-probe:',JSON.stringify(evidence));

    assert.equal(await page.evaluate(()=>document.querySelector('#main-world-marker')?.dataset?.generation || 'alive'),'alive');
    assert.ok(after.some(item=>item.engine===FROM_VERSION || item.error),'stale v9 execution context should remain observable or explicitly report invalidation');

    session.off('Runtime.executionContextCreated',onContext);
    await session.detach();
    await page.close();
  } finally {
    await browser.close();
    fs.rmSync(tmp,{recursive:true,force:true});
  }
});

console.log('e2e-generation-runtime: PASS');
