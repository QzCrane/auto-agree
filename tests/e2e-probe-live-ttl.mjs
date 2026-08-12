import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import {extensionWorldSentinels} from './e2e-isolated-worlds.mjs';

const ROOT = path.resolve('.');
const EXTENSION = path.join(ROOT, 'extension');
const FIXTURE = fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'regressions', 'probe-live-ttl.html'), 'utf8');
const VERSION = JSON.parse(fs.readFileSync(path.join(EXTENSION, 'manifest.json'), 'utf8')).version;
const HEADED = process.env.AUTO_AGREE_HEADED === '1';

async function withServer(fn) {
  const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(FIXTURE);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const {port} = server.address();
  try { return await fn(`http://127.0.0.1:${port}/`); }
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

async function poll(fn, timeout = 6000, interval = 60) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await fn();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error(`poll timeout after ${timeout}ms`);
}

async function extensionInstalled(browser) {
  return poll(async () => {
    const extensions = await browser.extensions();
    const extension = [...extensions.values()].find(ext => ext.name === 'Auto Agree Login Terms');
    return extension?.version === VERSION ? extension : null;
  }, 6000, 50);
}

await withServer(async url => {
  const browser = await launch();
  try {
    await extensionInstalled(browser);
    const page = await browser.newPage();
    await page.bringToFront();
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.bringToFront();

    await poll(async () => {
      const worlds = await extensionWorldSentinels(page);
      return worlds.some(world => world.probe === VERSION && !world.gate && !world.engine) ? worlds : null;
    });

    await page.evaluate(async () => {
      const owner = document.querySelector('#ttl-owner');
      const root = document.createElement('section');
      root.id = 'probe-ttl-deep-root';
      for (let i = 0; i < 520; i++) {
        const span = document.createElement('span');
        span.textContent = `neutral probe ttl ${i}`;
        root.append(span);
      }
      const label = document.createElement('label');
      label.innerHTML = '<input id="probe-ttl-agree" type="checkbox" required>I have read and agree to the Terms of Service';
      label.querySelector('input').addEventListener('click', event => {
        event.currentTarget.dataset.clicks = String(Number(event.currentTarget.dataset.clicks || 0) + 1);
      });
      root.append(label);

      // Probe's MutationObserver queues a deep cursor at the microtask checkpoint. The queued page
      // timer then monopolizes the renderer long enough to cross Probe's historical 2400 ms age
      // boundary before background traversal can resume.
      const blocker = new Promise(resolve => setTimeout(() => {
        const until = performance.now() + 2700;
        while (performance.now() < until) {}
        resolve();
      }, 0));
      owner.append(root);
      await blocker;
      window.probeLiveTtlBlockComplete = true;
    });

    try {
      await page.waitForFunction(() => document.querySelector('#probe-ttl-agree')?.checked === true, {timeout: 5000});
    } catch (error) {
      const diag = await page.evaluate(() => {
        const el = document.querySelector('#probe-ttl-agree');
        return {
          exists: !!el,
          checked: el?.checked ?? false,
          clicks: Number(el?.dataset?.clicks || 0),
          blockerComplete: window.probeLiveTtlBlockComplete === true,
          visibility: document.visibilityState
        };
      });
      const worlds = await extensionWorldSentinels(page);
      console.error('e2e-probe-live-ttl-diagnostic:', JSON.stringify({diag, worlds}));
      throw error;
    }

    const result = await page.$eval('#probe-ttl-agree', el => ({checked: el.checked, clicks: Number(el.dataset.clicks || 0)}));
    assert.deepEqual(result, {checked: true, clicks: 1}, 'live Probe deep work must survive age beyond its 2400 ms boundary exactly once');
    console.log('e2e-probe-live-ttl: PASS');
  } finally {
    await browser.close();
  }
});
