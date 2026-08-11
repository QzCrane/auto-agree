import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import {extensionWorldSentinels} from './e2e-isolated-worlds.mjs';

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

async function runCase(browser, base, spec) {
  const page = await browser.newPage();
  try {
    await gotoActive(page, `${base}/${spec.file}`);
    await waitTier(page, spec.tier, spec.name);
    await page.evaluate(start => window[start](), spec.start);
    try {
      await page.waitForFunction(selector => document.querySelector(selector)?.checked === true, {timeout: 5000}, spec.selector);
    } catch (error) {
      const diag = await page.evaluate(selector => {
        const el = document.querySelector(selector);
        return {
          exists: !!el,
          checked: el?.checked ?? false,
          clicks: Number(el?.dataset?.clicks || 0),
          readyState: document.readyState,
          visibility: document.visibilityState
        };
      }, spec.selector);
      const worlds = await extensionWorldSentinels(page);
      console.error(`${spec.name}-diagnostic:`, JSON.stringify({diag, worlds}));
      throw error;
    }
    const result = await page.$eval(spec.selector, el => ({checked: el.checked, clicks: Number(el.dataset.clicks || 0)}));
    assert.deepEqual(result, {checked: true, clicks: 1}, `${spec.name} must activate exactly once`);
    console.log(`${spec.name}: PASS`);
  } finally {
    await page.close();
  }
}

const cases = [
  {name: 'e2e-probe-deep-overflow', file: 'probe-deep-overflow.html', tier: 'probe', start: 'startProbeDeepOverflow', selector: '#probe-agree'},
  {name: 'e2e-gate-deep-overflow', file: 'gate-deep-overflow.html', tier: 'gate', start: 'startGateDeepOverflow', selector: '#gate-deep-agree'},
  {name: 'e2e-gate-batch-overflow', file: 'gate-batch-overflow.html', tier: 'gate', start: 'startGateBatchOverflow', selector: '#gate-batch-agree'}
];

await withServer(async base => {
  const browser = await launch();
  const failures = [];
  try {
    await extensionInstalled(browser);
    for (const spec of cases) {
      try { await runCase(browser, base, spec); }
      catch (error) { failures.push({name: spec.name, message: error?.message || String(error)}); }
    }
  } finally {
    await browser.close();
  }
  assert.deepEqual(failures, [], `tier-overflow failures: ${JSON.stringify(failures)}`);
});

console.log('e2e-tier-overflow: PASS');
