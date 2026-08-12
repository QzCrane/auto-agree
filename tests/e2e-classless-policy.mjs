import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import {extensionWorldSentinels} from './e2e-isolated-worlds.mjs';

const ROOT=path.resolve('.');
const EXTENSION=path.join(ROOT,'extension');
const FIXTURE=fs.readFileSync(path.join(ROOT,'tests','fixtures','regressions','classless-policy.html'),'utf8');
const VERSION=JSON.parse(fs.readFileSync(path.join(EXTENSION,'manifest.json'),'utf8')).version;
const HEADED=process.env.AUTO_AGREE_HEADED==='1';

async function withServer(fn){
  const server=http.createServer((_req,res)=>{res.statusCode=200;res.setHeader('content-type','text/html; charset=utf-8');res.end(FIXTURE);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const {port}=server.address();
  try{return await fn(`http://127.0.0.1:${port}/`);}finally{await new Promise(resolve=>server.close(resolve));}
}
async function poll(fn,timeout=7000,interval=60){const deadline=Date.now()+timeout;while(Date.now()<deadline){const value=await fn();if(value)return value;await new Promise(resolve=>setTimeout(resolve,interval));}throw new Error(`poll timeout after ${timeout}ms`);}
async function launch(){
  const options={headless:!HEADED,pipe:true,dumpio:true,enableExtensions:[EXTENSION],args:['--no-first-run','--no-default-browser-check','--disable-dev-shm-usage','--no-sandbox']};
  if(process.env.CHROME_PATH)options.executablePath=process.env.CHROME_PATH;
  return puppeteer.launch(options);
}
async function extensionInstalled(browser){return poll(async()=>{const extensions=await browser.extensions();return [...extensions.values()].find(ext=>ext.name==='Auto Agree Login Terms'&&ext.version===VERSION)||null;});}

await withServer(async url=>{
  const browser=await launch();
  try{
    await extensionInstalled(browser);
    const page=await browser.newPage();
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.bringToFront();
    await poll(async()=>{
      const worlds=await extensionWorldSentinels(page);
      return worlds.some(world=>world.engine===VERSION&&world.risk===VERSION)?worlds:null;
    });

    await page.waitForFunction(()=>Number(document.querySelector('#routine-square')?.dataset?.clicks||0)===1,{timeout:7000});
    await new Promise(resolve=>setTimeout(resolve,700));
    const result=await page.evaluate(()=>({
      routine:Number(document.querySelector('#routine-square')?.dataset?.clicks||0),
      risk:Number(document.querySelector('#risk-square')?.dataset?.clicks||0),
      routineLooksStandard:!!document.querySelector('#routine-square')?.matches('input,[role="checkbox"],[role="radio"],[role="switch"],[aria-checked]'),
      riskLooksStandard:!!document.querySelector('#risk-square')?.matches('input,[role="checkbox"],[role="radio"],[role="switch"],[aria-checked]')
    }));
    assert.deepEqual(result,{routine:1,risk:0,routineLooksStandard:false,riskLooksStandard:false},'classless routine geometry must click once while consequential classless geometry remains untouched');
    console.log('e2e-classless-policy:',JSON.stringify(result));
    console.log('e2e-classless-policy: PASS');
  }finally{await browser.close();}
});
