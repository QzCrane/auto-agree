import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import {extensionWorldSentinels,evaluateInExecutionContext} from './e2e-isolated-worlds.mjs';

const ROOT=path.resolve('.');
const CURRENT=path.join(ROOT,'extension');
const DYNAMIC=fs.readFileSync(path.join(ROOT,'tests','fixtures','regressions','dynamic.html'),'utf8');
const HEADED=process.env.AUTO_AGREE_HEADED==='1';

function copyDir(src,dest){
  fs.mkdirSync(dest,{recursive:true});
  for(const name of fs.readdirSync(src)) fs.cpSync(path.join(src,name),path.join(dest,name),{recursive:true});
}

function nextMajor(version){
  const major=Number(String(version).split('.')[0]);
  assert.ok(Number.isInteger(major)&&major>=0,`invalid extension version ${version}`);
  return `${major+1}.0.0`;
}

function rewriteManifestVersion(dir,version){
  const file=path.join(dir,'manifest.json');
  const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
  manifest.version=version;
  fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');
}

async function bounded(promise,timeout,label){
  let timer;
  try{
    return await Promise.race([
      promise,
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} timed out after ${timeout}ms`)),timeout);})
    ]);
  } finally {if(timer)clearTimeout(timer);}
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
    if((req.url||'').startsWith('/dynamic.html'))res.end(DYNAMIC);
    else{res.statusCode=404;res.end('not found');}
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

const fromVersion=JSON.parse(fs.readFileSync(path.join(CURRENT,'manifest.json'),'utf8')).version;
const probeVersion=nextMajor(fromVersion);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'auto-agree-generation-lease-'));
const active=path.join(tmp,'extension');
copyDir(CURRENT,active);

await withServer(async base=>{
  const browser=await launch();
  try{
    const extensionId=await bounded(browser.installExtension(active),5000,'install current unpacked extension');
    const page=await browser.newPage();
    await gotoActive(page,`${base}/dynamic.html?generation-lease=1`);
    await page.evaluate(()=>{window.__autoAgreeGenerationLeaseMarker='alive';window.insertRoutineLogin();});
    await waitChecked(page,'#dynamic-agree');

    const beforeWorlds=await extensionWorldSentinels(page);
    const oldWorld=beforeWorlds.find(world=>world.engine===fromVersion&&world.lease===fromVersion);
    assert.ok(oldWorld,`active ${fromVersion} Engine world must carry its generation lease before update`);
    await page.evaluate(()=>window.clearRoutineLogin());

    rewriteManifestVersion(active,probeVersion);
    const reloadedId=await bounded(browser.installExtension(active),5000,'install manifest-only future generation');
    assert.equal(reloadedId,extensionId,'same unpacked path must retain extension identity');
    await new Promise(resolve=>setTimeout(resolve,500));
    assert.equal(await page.evaluate(()=>window.__autoAgreeGenerationLeaseMarker),'alive','page reloaded during generation lease probe');

    const staleLeaseCurrent=await evaluateInExecutionContext(page,oldWorld.id,'globalThis.__AUTO_AGREE_GENERATION_LEASE__?.current?.()');
    assert.equal(staleLeaseCurrent,false,'old Engine realm must synchronously observe loss of current-generation authority');

    await page.evaluate(()=>window.insertRoutineLogin());
    await new Promise(resolve=>setTimeout(resolve,900));
    let result=await page.$eval('#dynamic-agree',el=>({checked:el.checked,clicks:Number(window.dynamicClicks||0)}));
    assert.deepEqual(result,{checked:false,clicks:0},'all stale/probe-version AutoAgree realms must lose synthetic click authority after generation mismatch');

    await evaluateInExecutionContext(page,oldWorld.id,"document.querySelector('#dynamic-agree')?.click(); true");
    await new Promise(resolve=>setTimeout(resolve,100));
    result=await page.$eval('#dynamic-agree',el=>({checked:el.checked,clicks:Number(window.dynamicClicks||0)}));
    assert.deepEqual(result,{checked:false,clicks:0},'direct stale isolated-world HTMLElement.click() must be a no-op before DOM dispatch');

    await page.click('#dynamic-agree');
    await waitChecked(page,'#dynamic-agree',2000);
    result=await page.$eval('#dynamic-agree',el=>({checked:el.checked,clicks:Number(window.dynamicClicks||0)}));
    assert.deepEqual(result,{checked:true,clicks:1},'trusted browser input must remain outside isolated-world generation revocation');

    console.log('e2e-generation-lease:',JSON.stringify({
      fromVersion,probeVersion,pageReloaded:false,oldEngine:oldWorld.engine,oldLease:oldWorld.lease,
      staleLeaseCurrent,staleAutomatedClicks:0,directStaleClicks:0,trustedClicks:1
    }));
    console.log('e2e-generation-lease: PASS');
    await page.close();
  } finally {await browser.close();}
});

fs.rmSync(tmp,{recursive:true,force:true});