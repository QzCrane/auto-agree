import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import {extensionWorldSentinels} from './e2e-isolated-worlds.mjs';

const ROOT=path.resolve('.');
const EXTENSION=path.join(ROOT,'extension');
const FIXTURES=path.join(ROOT,'tests','fixtures','regressions');
const PROFILE=process.argv.includes('--profile');
const HEADED=process.env.AUTO_AGREE_HEADED==='1';

function fixture(name){return fs.readFileSync(path.join(FIXTURES,name),'utf8');}
function perfTail(){
  let boxes=''; for(let i=0;i<5000;i++) boxes+=`<label><input type="checkbox">setting ${i}</label>`;
  return `<!doctype html><meta charset="utf-8"><title>5000 settings then login</title>${boxes}<form id="login"><input type="email" value="user@example.com"><label><input id="tail-agree" type="checkbox" required>I agree to the Terms of Service and Privacy Policy</label><button>Login</button></form>`;
}

async function withServer(fn){
  const server=http.createServer((req,res)=>{
    const route=(req.url||'/').split('?')[0];
    let body='';
    const table={
      '/positive-login.html':'positive-login.html','/terse-validity.html':'terse-validity.html','/marketing-negative.html':'marketing-negative.html','/fragmented-risk.html':'fragmented-risk.html','/footer-noise.html':'footer-noise.html','/trae-classless.html':'trae-classless.html','/mixed-control.html':'mixed-control.html','/classless-unknown-one-shot.html':'classless-unknown-one-shot.html','/dynamic.html':'dynamic.html','/iframe-parent.html':'iframe-parent.html','/iframe-child.html':'iframe-child.html','/closed-shadow.html':'closed-shadow.html'
    };
    if(route==='/performance-tail.html') body=perfTail(); else if(table[route]) body=fixture(table[route]); else {res.statusCode=404; body='not found';}
    res.setHeader('content-type','text/html; charset=utf-8'); res.end(body);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const {port}=server.address();
  try{return await fn(`http://127.0.0.1:${port}`);}finally{await new Promise(resolve=>server.close(resolve));}
}

async function launch(extensionPath){
  const options={
    headless:!HEADED,
    pipe:true,
    dumpio:true,
    enableExtensions:[extensionPath],
    args:['--no-first-run','--no-default-browser-check','--disable-dev-shm-usage','--no-sandbox']
  };
  if(process.env.CHROME_PATH){
    assert.ok(fs.existsSync(process.env.CHROME_PATH),`CHROME_PATH does not exist: ${process.env.CHROME_PATH}`);
    options.executablePath=process.env.CHROME_PATH;
  }
  return puppeteer.launch(options);
}

async function autoAgreeExtension(browser,timeout=5000){
  const deadline=Date.now()+timeout;
  let extensions=new Map();
  while(Date.now()<deadline){
    extensions=await browser.extensions();
    for(const ext of extensions.values()) if(ext.name==='Auto Agree Login Terms') return ext;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  const installed=[...extensions.values()].map(ext=>({id:ext.id,name:ext.name,version:ext.version}));
  const workers=browser.targets().filter(t=>t.type()==='service_worker').map(t=>t.url());
  console.error('extension-diagnostic:',JSON.stringify({installed,workers,headed:HEADED,timeout}));
  throw new Error('Auto Agree extension not installed after bounded registration wait');
}

async function gotoActive(page,url){
  await page.bringToFront();
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.bringToFront();
  await page.waitForFunction(()=>document.visibilityState==='visible',{timeout:2000});
}

async function waitChecked(page,selector,timeout=3000){await page.waitForFunction(sel=>document.querySelector(sel)?.checked===true,{timeout},selector);}
async function waitUnchecked(page,selector,delay=350){await new Promise(r=>setTimeout(r,delay)); assert.equal(await page.$eval(selector,el=>el.checked),false,`${selector} unexpectedly checked`);}

async function stopWorker(browser, extensionId){
  const target=await browser.waitForTarget(t=>t.type()==='service_worker'&&t.url().startsWith(`chrome-extension://${extensionId}/`),{timeout:3000});
  const worker=await target.worker(); assert.ok(worker); await worker.close();
}

async function poll(fn,timeout=3000,interval=50){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    const value=await fn();
    if(value) return value;
    await new Promise(resolve=>setTimeout(resolve,interval));
  }
  throw new Error(`poll timeout after ${timeout}ms`);
}

async function basicMatrix(base,browser){
  const page=await browser.newPage();
  await gotoActive(page,`${base}/positive-login.html`);
  try {
    await waitChecked(page,'#agree');
  } catch (error) {
    const diag=await page.evaluate(()=>({visibility:document.visibilityState,readyState:document.readyState,checked:document.querySelector('#agree')?.checked,buttonDisabled:document.querySelector('#continue')?.disabled}));
    const worlds=await extensionWorldSentinels(page);
    console.error('positive-diagnostic:',JSON.stringify({diag,worlds}));
    throw error;
  }
  await gotoActive(page,`${base}/marketing-negative.html`); await waitUnchecked(page,'#marketing');
  await gotoActive(page,`${base}/fragmented-risk.html`); await waitUnchecked(page,'#risk');
  await gotoActive(page,`${base}/trae-classless.html`);
  try {
    await page.waitForFunction(()=>document.querySelector('#box')?.dataset.checked==='true',{timeout:3000});
  } catch (error) {
    const diag=await page.evaluate(()=>{
      const box=document.querySelector('#box'); const row=document.querySelector('#row');
      const r=box?.getBoundingClientRect();
      const stack=r?document.elementsFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2).map(el=>({tag:el.tagName,id:el.id,class:el.className})).slice(0,8):[];
      return {readyState:document.readyState,checked:box?.dataset.checked,clicks:box?.dataset.clicks,rowClicks:row?.dataset.clicks,rowLastTarget:row?.dataset.lastTarget,boxRect:r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null,rowText:row?.innerText,stack};
    });
    const manual=await page.$eval('#box',el=>{el.click();return {checked:el.dataset.checked,clicks:el.dataset.clicks};});
    const worlds=await extensionWorldSentinels(page);
    console.error('classless-diagnostic:',JSON.stringify({diag,worlds,manual}));
    throw error;
  }

  await gotoActive(page,`${base}/mixed-control.html`);
  await new Promise(resolve=>setTimeout(resolve,450));
  assert.deepEqual(await page.$eval('#agree',el=>({state:el.getAttribute('aria-checked'),clicks:Number(el.dataset.clicks||0)})),{state:'mixed',clicks:0});

  await gotoActive(page,`${base}/classless-unknown-one-shot.html`);
  await page.waitForFunction(()=>Number(document.querySelector('#box')?.dataset.clicks||0)===1,{timeout:3000});
  await new Promise(resolve=>setTimeout(resolve,2350));
  await page.$eval('#legal',el=>{el.textContent='I have read and agree to the Terms of Service';});
  await new Promise(resolve=>setTimeout(resolve,450));
  assert.equal(await page.$eval('#box',el=>Number(el.dataset.clicks||0)),1,'unknown-state classless control must remain one-shot after cooldown');

  await gotoActive(page,`${base}/terse-validity.html`); await waitUnchecked(page,'#agree',300);
  await page.$eval('#email',el=>{el.value='valid@example.com';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await waitChecked(page,'#agree');

  await gotoActive(page,`${base}/iframe-parent.html`);
  const child=await poll(async()=>page.frames().find(f=>f.url().endsWith('/iframe-child.html'))||null,3000,40);
  await child.waitForFunction(()=>document.querySelector('#frame-agree')?.checked===true,{timeout:3000});

  await gotoActive(page,`${base}/closed-shadow.html`);
  await page.$eval('#host',host=>host.focusInside()); await page.waitForFunction(()=>document.querySelector('#host')?.isChecked()===true,{timeout:3000});
  await page.close();
}

async function workerTerminationMatrix(base,browser,extensionId){
  for(let i=0;i<4;i++){
    const page=await browser.newPage(); await gotoActive(page,`${base}/dynamic.html?round=${i}`);
    await stopWorker(browser,extensionId);
    await page.evaluate(()=>window.insertRoutineLogin());
    await waitChecked(page,'#dynamic-agree',4000); await page.close();
  }
}

async function profileMatrix(base,browser){
  const page=await browser.newPage(); const session=await page.createCDPSession();
  await session.send('Profiler.enable'); await session.send('Profiler.start'); const t0=performance.now();
  await gotoActive(page,`${base}/performance-tail.html`); await waitChecked(page,'#tail-agree',4000); const latency=performance.now()-t0;
  const {profile}=await session.send('Profiler.stop'); const metrics=await page.metrics();
  const byId=new Map(profile.nodes.map(n=>[n.id,n])); const counts=new Map();
  for(const id of profile.samples||[]) counts.set(id,(counts.get(id)||0)+1);
  const top=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,15).map(([id,samples])=>{const n=byId.get(id);return {samples,functionName:n?.callFrame?.functionName||'(anonymous)',url:n?.callFrame?.url||'',line:n?.callFrame?.lineNumber??-1};});
  const result={latencyMs:Number(latency.toFixed(1)),taskDuration:Number((metrics.TaskDuration||0).toFixed(4)),samples:(profile.samples||[]).length,top};
  fs.mkdirSync(path.join(ROOT,'artifacts'),{recursive:true}); fs.writeFileSync(path.join(ROOT,'artifacts','e2e-profile.json'),JSON.stringify(result,null,2)+'\n');
  assert.ok(latency<1000,`5000-checkbox E2E latency ${latency.toFixed(1)}ms exceeded 1000ms regression ceiling`);
  assert.ok(result.taskDuration<0.8,`5000-checkbox TaskDuration ${result.taskDuration}s exceeded 0.8s regression ceiling`);
  console.log('profile:',JSON.stringify(result)); await page.close();
}

await withServer(async base=>{
  const browser=await launch(EXTENSION);
  try{
    const ext=await autoAgreeExtension(browser); assert.equal(ext.version,'9.0.0');
    await basicMatrix(base,browser); console.log('e2e-basic: PASS');
    await workerTerminationMatrix(base,browser,ext.id); console.log('e2e-worker-termination: PASS');
    if(PROFILE) await profileMatrix(base,browser);
  } finally {await browser.close();}
});
console.log('e2e-extension: PASS');
