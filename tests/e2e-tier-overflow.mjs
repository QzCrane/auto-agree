import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import {extensionWorldSentinels, evaluateInExecutionContext} from './e2e-isolated-worlds.mjs';

const ROOT = path.resolve('.');
const EXTENSION = path.join(ROOT, 'extension');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures', 'regressions');
const HEADED = process.env.AUTO_AGREE_HEADED === '1';
const VERSION = JSON.parse(fs.readFileSync(path.join(EXTENSION, 'manifest.json'), 'utf8')).version;

function fixture(name) { return fs.readFileSync(path.join(FIXTURES, name), 'utf8'); }

async function withServer(fn) {
  const table = new Map([
    ['/probe-deep-overflow.html', 'probe-deep-overflow.html'],
    ['/gate-deep-overflow.html', 'gate-deep-overflow.html'],
    ['/gate-batch-overflow.html', 'gate-batch-overflow.html']
  ]);
  const server = http.createServer((req, res) => {
    const route = (req.url || '/').split('?')[0];
    const file = table.get(route);
    res.statusCode = file ? 200 : 404;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(file ? fixture(file) : 'not found');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const {port} = server.address();
  try { return await fn(`http://127.0.0.1:${port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

async function launch() {
  const options = {
    headless: !HEADED,
    pipe: true,
    dumpio: true,
    enableExtensions: [EXTENSION],
    args: ['--no-first-run', '--no-default-browser-check', '--disable-dev-shm-usage', '--no-sandbox']
  };
  if (process.env.CHROME_PATH) options.executablePath = process.env.CHROME_PATH;
  return puppeteer.launch(options);
}

async function extensionInstalled(browser, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const extensions = await browser.extensions();
    for (const ext of extensions.values()) {
      if (ext.name === 'Auto Agree Login Terms') {
        assert.equal(ext.version, VERSION);
        return ext;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Auto Agree extension registration timeout');
}

async function gotoActive(page, url) {
  await page.bringToFront();
  await page.goto(url, {waitUntil: 'domcontentloaded'});
  await page.bringToFront();
  await page.waitForFunction(() => document.visibilityState === 'visible', {timeout: 2000});
}

async function poll(fn, timeout = 4000, interval = 50) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await fn();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error(`poll timeout after ${timeout}ms`);
}

async function waitTier(page, tier, name) {
  try {
    return await poll(async () => {
      const worlds = await extensionWorldSentinels(page);
      if (tier === 'probe') return worlds.some(w => w.probe === VERSION && !w.gate && !w.engine) ? worlds : null;
      if (tier === 'gate') return worlds.some(w => w.gate === VERSION && !w.engine) ? worlds : null;
      return null;
    }, 5000, 60);
  } catch (error) {
    const worlds = await extensionWorldSentinels(page);
    console.error(`${name}-tier-diagnostic:`, JSON.stringify({expected:tier, worlds}));
    throw error;
  }
}

async function installGateDiagnostic(page, worlds) {
  const gateWorld = worlds.find(w => w.gate === VERSION && !w.engine);
  if (!gateWorld) return null;
  await evaluateInExecutionContext(page, gateWorld.id, `(() => {
    const state = globalThis.__AUTO_AGREE_GATE_SCHED_DIAG__ = {
      scheduled:0, started:0, finished:0, rejected:0,
      walkers:0, nodes:0, targetRootWalkers:0, targetVisits:0,
      roots:Object.create(null), treeWrapError:null
    };
    const sched = globalThis.scheduler;
    if (sched?.postTask && !sched.__autoAgreeWrapped) {
      const original = sched.postTask.bind(sched);
      const wrapped = (fn, options) => {
        state.scheduled++;
        let promise;
        try {
          promise = original(async (...args) => {
            state.started++;
            try { return await fn(...args); }
            finally { state.finished++; }
          }, options);
        } catch (error) { state.rejected++; throw error; }
        Promise.resolve(promise).catch(() => { state.rejected++; });
        return promise;
      };
      try { Object.defineProperty(wrapped, '__autoAgreeWrapped', {value:true}); } catch (_) {}
      sched.postTask = wrapped;
      try { Object.defineProperty(sched, '__autoAgreeWrapped', {value:true}); } catch (_) {}
    }
    try {
      const originalCreate = document.createTreeWalker.bind(document);
      document.createTreeWalker = (root, whatToShow, filter) => {
        state.walkers++;
        const rootKey = root?.id || root?.nodeName || root?.constructor?.name || 'unknown';
        state.roots[rootKey] = (state.roots[rootKey] || 0) + 1;
        if (root?.id === 'gate-deep-subtree-0' || root?.id === 'gate-gc-root') state.targetRootWalkers++;
        const walker = originalCreate(root, whatToShow, filter);
        const originalNext = walker.nextNode.bind(walker);
        return {
          nextNode() {
            const node = originalNext();
            if (node) {
              state.nodes++;
              if (node.id === 'gate-deep-agree' || node.id === 'gate-gc-agree') state.targetVisits++;
            }
            return node;
          }
        };
      };
    } catch (error) { state.treeWrapError = String(error?.message || error); }
    return state;
  })()`);
  return gateWorld.id;
}

async function forceRendererGc(page, rounds = 10) {
  const session = await page.createCDPSession();
  try {
    await session.send('HeapProfiler.enable');
    for (let i = 0; i < rounds; i++) {
      await session.send('HeapProfiler.collectGarbage');
      await new Promise(resolve => setTimeout(resolve, 4));
    }
  } finally {
    try { await session.detach(); } catch (_) {}
  }
}

async function startCase(page, spec) {
  if (spec.build === 'probe') {
    await page.evaluate(() => window.startProbeDeepOverflow());
    return;
  }
  if (spec.build === 'gate-deep') {
    await page.evaluate(() => {
      for (let i = 0; i < 11; i++) {
        const subtree = document.createElement('div');
        subtree.id = `gate-deep-subtree-${i}`;
        for (let n = 0; n < 150; n++) {
          const span = document.createElement('span');
          span.textContent = `neutral deep ${i}-${n}`;
          subtree.append(span);
        }
        if (i === 0) {
          const form = document.createElement('form');
          form.innerHTML = '<input type="email" value="user@example.com"><label><input id="gate-deep-agree" type="checkbox" required>I have read and agree to the Terms of Service</label><button>Login</button>';
          const input = form.querySelector('#gate-deep-agree');
          input.addEventListener('click', event => {
            event.currentTarget.dataset.clicks = String(Number(event.currentTarget.dataset.clicks || 0) + 1);
          });
          subtree.append(form);
        }
        document.querySelector(`#deep-owner-${i}`).append(subtree);
      }
    });
    return;
  }
  if (spec.build === 'gate-gc') {
    await page.evaluate(() => {
      const root = document.createElement('section');
      root.id = 'gate-gc-root';
      for (let n = 0; n < 4200; n++) {
        const span = document.createElement('span');
        span.textContent = `neutral gc ${n}`;
        root.append(span);
      }
      const form = document.createElement('form');
      form.innerHTML = '<input type="email" value="user@example.com"><label><input id="gate-gc-agree" type="checkbox" required>I have read and agree to the Terms of Service</label><button>Login</button>';
      form.querySelector('#gate-gc-agree').addEventListener('click', event => {
        event.currentTarget.dataset.clicks = String(Number(event.currentTarget.dataset.clicks || 0) + 1);
      });
      root.append(form);
      document.querySelector('#deep-owner-0').append(root);
    });
    return;
  }
  if (spec.build === 'gate-batch') {
    await page.evaluate(() => {
      for (let i = 0; i < 7; i++) {
        const fragment = document.createDocumentFragment();
        for (let n = 0; n < 120; n++) {
          let node;
          if (i === 0 && n === 60) {
            node = document.createElement('label');
            node.innerHTML = '<input id="gate-batch-agree" type="checkbox" required>I have read and agree to the Terms of Service';
            node.querySelector('input').addEventListener('click', event => {
              event.currentTarget.dataset.clicks = String(Number(event.currentTarget.dataset.clicks || 0) + 1);
            });
          } else {
            node = document.createElement('span');
            node.textContent = `neutral batch ${i}-${n}`;
          }
          fragment.append(node);
        }
        document.querySelector(`#batch-owner-${i}`).append(fragment);
      }
    });
    return;
  }
  throw new Error(`unknown builder: ${spec.build}`);
}

async function runCase(browser, base, spec, attempt = 1) {
  const page = await browser.newPage();
  const runName = spec.repeat > 1 ? `${spec.name}#${attempt}` : spec.name;
  let diagnosticContextId = null;
  try {
    await gotoActive(page, `${base}/${spec.file}?attempt=${attempt}`);
    const worldsBefore = await waitTier(page, spec.tier, runName);
    if (spec.build === 'gate-deep' || spec.build === 'gate-gc') diagnosticContextId = await installGateDiagnostic(page, worldsBefore);
    await startCase(page, spec);
    if (spec.forceGc) await forceRendererGc(page, 12);
    try {
      await page.waitForFunction(selector => document.querySelector(selector)?.checked === true, {timeout: 5000}, spec.selector);
    } catch (error) {
      const diag = await page.evaluate(selector => {
        const el = document.querySelector(selector);
        return {exists:!!el, checked:el?.checked ?? false, clicks:Number(el?.dataset?.clicks || 0), readyState:document.readyState, visibility:document.visibilityState};
      }, spec.selector);
      const worlds = await extensionWorldSentinels(page);
      let traversal = null;
      if (diagnosticContextId) {
        try { traversal = await evaluateInExecutionContext(page, diagnosticContextId, 'globalThis.__AUTO_AGREE_GATE_SCHED_DIAG__ || null'); } catch (_) {}
      }
      console.error(`${runName}-diagnostic:`, JSON.stringify({diag, worlds, traversal}));
      throw error;
    }
    const result = await page.$eval(spec.selector, el => ({checked: el.checked, clicks: Number(el.dataset.clicks || 0)}));
    assert.deepEqual(result, {checked:true, clicks:1}, `${runName} must activate exactly once`);
    console.log(`${runName}: PASS`);
  } finally {
    await page.close();
  }
}

const cases = [
  {name:'e2e-probe-deep-overflow', file:'probe-deep-overflow.html', tier:'probe', build:'probe', selector:'#probe-agree', repeat:1},
  {name:'e2e-gate-weak-cursor-gc', file:'gate-deep-overflow.html', tier:'gate', build:'gate-gc', selector:'#gate-gc-agree', repeat:3, forceGc:true},
  {name:'e2e-gate-deep-overflow', file:'gate-deep-overflow.html', tier:'gate', build:'gate-deep', selector:'#gate-deep-agree', repeat:12},
  {name:'e2e-gate-batch-overflow', file:'gate-batch-overflow.html', tier:'gate', build:'gate-batch', selector:'#gate-batch-agree', repeat:1}
];

await withServer(async base => {
  const browser = await launch();
  const failures = [];
  try {
    await extensionInstalled(browser);
    for (const spec of cases) {
      for (let attempt = 1; attempt <= spec.repeat; attempt++) {
        try { await runCase(browser, base, spec, attempt); }
        catch (error) { failures.push({name:spec.name, attempt, message:error?.message || String(error)}); }
      }
    }
  } finally {
    await browser.close();
  }
  assert.deepEqual(failures, [], `tier-overflow failures: ${JSON.stringify(failures)}`);
});

console.log('e2e-tier-overflow: PASS');
