import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import {extensionWorldSentinels} from './e2e-isolated-worlds.mjs';

const ROOT = path.resolve('.');
const EXTENSION = path.join(ROOT, 'extension');
const FIXTURE = fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'regressions', 'engine-walk-overflow.html'), 'utf8');
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

async function poll(fn, timeout = 7000, interval = 60) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await fn();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error(`poll timeout after ${timeout}ms`);
}

await withServer(async url => {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.bringToFront();
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.bringToFront();

    await poll(async () => {
      const worlds = await extensionWorldSentinels(page);
      const seeded = await page.$eval('#seed-agree', el => ({checked: el.checked, clicks: Number(el.dataset.clicks || 0)}));
      return worlds.some(w => w.engine === VERSION) && seeded.checked && seeded.clicks === 1;
    });

    const initialWorlds = await extensionWorldSentinels(page);
    assert.ok(initialWorlds.some(w => w.engine === VERSION), 'Engine must be active before saturation');

    await page.evaluate(() => {
      const mount = document.querySelector('#mount');
      const fragment = document.createDocumentFragment();
      const ROOTS = 20;
      const POSITIVE = 5;
      const NODES = 900;
      for (let i = 0; i < ROOTS; i++) {
        const root = document.createElement('section');
        root.id = `walk-root-${i}`;
        for (let n = 0; n < NODES; n++) {
          if (i === POSITIVE && n === NODES - 40) {
            const label = document.createElement('label');
            label.innerHTML = '<input id="walk-overflow-agree" type="checkbox" required>I have read and agree to the Terms of Service';
            label.querySelector('input').addEventListener('click', event => {
              event.currentTarget.dataset.clicks = String(Number(event.currentTarget.dataset.clicks || 0) + 1);
            });
            root.append(label);
          } else {
            const span = document.createElement('span');
            span.textContent = `neutral walk ${i}-${n}`;
            root.append(span);
          }
        }
        fragment.append(root);
      }
      mount.append(fragment);
      window.engineWalkOverflowStarted = true;
    });

    try {
      await page.waitForFunction(() => document.querySelector('#walk-overflow-agree')?.checked === true, {timeout: 9000});
    } catch (error) {
      const diag = await page.evaluate(() => {
        const el = document.querySelector('#walk-overflow-agree');
        return {
          exists: !!el,
          checked: el?.checked ?? false,
          clicks: Number(el?.dataset?.clicks || 0),
          rootCount: document.querySelectorAll('[id^="walk-root-"]').length,
          started: window.engineWalkOverflowStarted === true,
          visibility: document.visibilityState
        };
      });
      const worlds = await extensionWorldSentinels(page);
      console.error('e2e-engine-walk-overflow-diagnostic:', JSON.stringify({diag, worlds}));
      throw error;
    }

    const out = await page.$eval('#walk-overflow-agree', el => ({checked: el.checked, clicks: Number(el.dataset.clicks || 0)}));
    assert.deepEqual(out, {checked: true, clicks: 1});
    console.log('e2e-engine-walk-overflow: PASS');
  } finally {
    await browser.close();
  }
});
