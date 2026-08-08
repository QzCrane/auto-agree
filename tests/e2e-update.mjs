import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

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
assert.equal(JSON.parse(fs.readFileSync(path.join(active,'manifest.json'),'utf8')).version,'7.0.0');

await withServer(async base=>{
  const browser=await launch();
  try{
    const initialId=await bounded(browser.installExtension(active),5000,'install v7 unpacked');
    let ext=(await browser.extensions()).get(initialId);
    assert.ok(ext,'v7 extension missing after Browser.installExtension');
    assert.equal(ext.version,'7.0.0');

    const page=await browser.newPage();
    await gotoActive(page,`${base}/dynamic.html?update=1`);

    replaceDir(CURRENT,active);
    assert.equal(JSON.parse(fs.readFileSync(path.join(active,'manifest.json'),'utf8')).version,'8.0.0');

    const reloadedId=await bounded(browser.installExtension(active),5000,'reload same unpacked path as v8');
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
        if(handle&&version==='8.0.0') return handle;
      }
      return null;
    },7000,80).catch(async error=>{
      const installed=[...(await browser.extensions()).values()].map(item=>({id:item.id,name:item.name,version:item.version,path:item.path}));
      console.error('update-api-diagnostic:',JSON.stringify({installed,observed,targets:browser.targets().filter(t=>t.type()==='service_worker').map(t=>t.url())}));
      throw error;
    });

    assert.equal(await bounded(worker.evaluate(()=>chrome.runtime.getManifest().version),800,'final v8 manifest read'),'8.0.0');
    await page.bringToFront();
    await page.evaluate(()=>window.insertRoutineLogin());
    await waitChecked(page,'#dynamic-agree');

    ext=(await browser.extensions()).get(initialId);
    console.log('e2e-update:',JSON.stringify({id:initialId,workerVersion:'8.0.0',reportedVersion:ext?.version||null,pageReloaded:false}));
    console.log('e2e-update: PASS');
    await page.close();
  } finally {await browser.close();}
});

fs.rmSync(tmp,{recursive:true,force:true});
