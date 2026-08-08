import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const ROOT=path.resolve('.');
const EXTENSION=path.join(ROOT,'extension');
const FIXTURES=path.join(ROOT,'tests','fixtures','regressions');
const PROFILE=process.argv.includes('--profile');
const PREVIOUS_REF=process.env.AUTO_AGREE_PREVIOUS_REF || '';
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
      '/positive-login.html':'positive-login.html','/terse-validity.html':'terse-validity.html','/marketing-negative.html':'marketing-negative.html','/fragmented-risk.html':'fragmented-risk.html','/footer-noise.html':'footer-noise.html','/trae-classless.html':'trae-classless.html','/dynamic.html':'dynamic.html','/iframe-parent.html':'iframe-parent.html','/iframe-child.html':'iframe-child.html','/closed-shadow.html':'closed-shadow.html'
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

async function autoAgreeExtension(browser){
  const extensions=await browser.extensions();
  for(const ext of extensions.values()) if(ext.name==='Auto Agree Login Terms') return ext;
  const installed=[...extensions.values()].map(ext=>({id:ext.id,name:ext.name,version:ext.version}));
  const workers=browser.targets().filter(t=>t.type()==='service_worker').map(t=>t.url());
  console.error('extension-diagnostic:',JSON.stringify({installed,workers,headed:HEADED}));
  throw new Error('Auto Agree extension not installed');
}

async function waitChecked(page,selector,timeout=3000){await page.waitForFunction(sel=>document.querySelector(sel)?.checked===true,{timeout},selector);}
async function waitUnchecked(page,selector,delay=350){await new Promise(r=>setTimeout(r,delay)); assert.equal(await page.$eval(selector,el=>el.checked),false,`${selector} unexpectedly checked`);}

async function stopWorker(browser, extensionId){
  const target=await browser.waitForTarget(t=>t.type()==='service_worker'&&t.url().startsWith(`chrome-extension://${extensionId}/`),{timeout:3000});
  const worker=await target.worker(); assert.ok(worker); await worker.close();
}

function stagePrevious(ref,dest){
  fs.mkdirSync(dest,{recursive:true});
  const names=execFileSync('git',['ls-tree','-r','--name-only',ref,'extension'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
  assert.ok(names.length>=5,`no previous extension files at ${ref}`);
  for(const file of names){
    const rel=file.replace(/^extension\//,''); const out=path.join(dest,rel); fs.mkdirSync(path.dirname(out),{recursive:true});
    fs.writeFileSync(out,execFileSync('git',['show',`${ref}:${file}`]));
  }
}
function replaceDir(src,dest){
  for(const name of fs.readdirSync(dest)) fs.rmSync(path.join(dest,name),{recursive:true,force:true});
  for(const name of fs.readdirSync(src)) fs.cpSync(path.join(src,name),path.join(dest,name),{recursive:true});
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
  await page.goto(`${base}/positive-login.html`,{waitUntil:'domcontentloaded'}); await waitChecked(page,'#agree');
  await page.goto(`${base}/marketing-negative.html`,{waitUntil:'domcontentloaded'}); await waitUnchecked(page,'#marketing');
  await page.goto(`${base}/fragmented-risk.html`,{waitUntil:'domcontentloaded'}); await waitUnchecked(page,'#risk');
  await page.goto(`${base}/trae-classless.html`,{waitUntil:'domcontentloaded'}); await page.waitForFunction(()=>document.querySelector('#box')?.dataset.checked==='true',{timeout:3000});

  await page.goto(`${base}/terse-validity.html`,{waitUntil:'domcontentloaded'}); await waitUnchecked(page,'#agree',300);
  await page.$eval('#email',el=>{el.value='valid@example.com';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await waitChecked(page,'#agree');

  await page.goto(`${base}/iframe-parent.html`,{waitUntil:'domcontentloaded'});
  const child=await poll(async()=>page.frames().find(f=>f.url().endsWith('/iframe-child.html'))||null,3000,40);
  await child.waitForFunction(()=>document.querySelector('#frame-agree')?.checked===true,{timeout:3000});

  await page.goto(`${base}/closed-shadow.html`,{waitUntil:'domcontentloaded'});
  await page.$eval('#host',host=>host.focusInside()); await page.waitForFunction(()=>document.querySelector('#host')?.isChecked()===true,{timeout:3000});
  await page.close();
}

async function workerTerminationMatrix(base,browser,extensionId){
  for(let i=0;i<4;i++){
    const page=await browser.newPage(); await page.goto(`${base}/dynamic.html?round=${i}`,{waitUntil:'domcontentloaded'});
    await stopWorker(browser,extensionId);
    await page.evaluate(()=>window.insertRoutineLogin());
    await waitChecked(page,'#dynamic-agree',4000); await page.close();
  }
}

async function profileMatrix(base,browser){
  const page=await browser.newPage(); const session=await page.createCDPSession();
  await session.send('Profiler.enable'); await session.send('Profiler.start'); const t0=performance.now();
  await page.goto(`${base}/performance-tail.html`,{waitUntil:'domcontentloaded'}); await waitChecked(page,'#tail-agree',4000); const latency=performance.now()-t0;
  const {profile}=await session.send('Profiler.stop'); const metrics=await page.metrics();
  const byId=new Map(profile.nodes.map(n=>[n.id,n])); const counts=new Map();
  for(const id of profile.samples||[]) counts.set(id,(counts.get(id)||0)+1);
  const top=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,15).map(([id,samples])=>{const n=byId.get(id);return {samples,functionName:n?.callFrame?.functionName||'(anonymous)',url:n?.callFrame?.url||'',line:n?.callFrame?.lineNumber??-1};});
  const result={latencyMs:Number(latency.toFixed(1)),taskDuration:Number((metrics.TaskDuration||0).toFixed(4)),samples:(profile.samples||[]).length,top};
  fs.mkdirSync(path.join(ROOT,'artifacts'),{recursive:true}); fs.writeFileSync(path.join(ROOT,'artifacts','e2e-profile.json'),JSON.stringify(result,null,2)+'\n');
  assert.ok(latency<4000,`5000-checkbox E2E latency ${latency.toFixed(1)}ms exceeded 4000ms regression ceiling`);
  console.log('profile:',JSON.stringify(result)); await page.close();
}

async function updateTransition(base){
  if(!PREVIOUS_REF){console.log('update-transition: SKIP (AUTO_AGREE_PREVIOUS_REF not set)');return;}
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'auto-agree-update-')); const active=path.join(tmp,'extension'); stagePrevious(PREVIOUS_REF,active);
  const browser=await launch(active);
  try{
    const ext=await autoAgreeExtension(browser); assert.equal(ext.version,'7.0.0',`previous ref is ${ext.version}, expected 7.0.0`);
    const page=await browser.newPage(); await page.goto(`${base}/dynamic.html?update=1`,{waitUntil:'domcontentloaded'});
    replaceDir(EXTENSION,active);
    const workers=await ext.workers(); assert.ok(workers.length,'previous service worker unavailable');
    try{await workers[0].evaluate(()=>chrome.runtime.reload());}catch(_){}
    await browser.waitForTarget(t=>t.type()==='service_worker'&&t.url().startsWith(`chrome-extension://${ext.id}/`),{timeout:5000});
    const current=await poll(async()=>{const candidate=(await browser.extensions()).get(ext.id);return candidate?.version==='8.0.0'?candidate:null;},5000,60);
    assert.equal(current.version,'8.0.0');
    await page.evaluate(()=>window.insertRoutineLogin()); await waitChecked(page,'#dynamic-agree',5000);
    console.log('update-transition: PASS (v7 page -> v8 worker/runtime rehydrate without page reload)');
    await page.close();
  } finally {await browser.close(); fs.rmSync(tmp,{recursive:true,force:true});}
}

await withServer(async base=>{
  const browser=await launch(EXTENSION);
  try{
    const ext=await autoAgreeExtension(browser); assert.equal(ext.version,'8.0.0');
    await basicMatrix(base,browser); console.log('e2e-basic: PASS');
    await workerTerminationMatrix(base,browser,ext.id); console.log('e2e-worker-termination: PASS');
    if(PROFILE) await profileMatrix(base,browser);
  } finally {await browser.close();}
  await updateTransition(base);
});
console.log('e2e-extension: PASS');
