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
const ROOTS = 14;
const NODES = 900;

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

    // Let the tiny initial document/seed shadow sweeps fully drain before introducing the
    // adversarial roots; otherwise an old document-wide sweep could legitimately discover a
    // host that did not exist when this saturation scenario began.
    await new Promise(resolve => setTimeout(resolve, 700));

    await page.evaluate(({roots, nodes}) => {
      const mount = document.querySelector('#mount');
      const fragment = document.createDocumentFragment();
      document.documentElement.dataset.shadowOverflowClicks = '0';
      document.documentElement.dataset.shadowOverflowChecked = 'false';

      for (let i = 0; i < roots; i++) {
        const root = document.createElement('section');
        root.id = `shadow-overflow-root-${i}`;
        for (let n = 0; n < nodes; n++) {
          if (i === 0 && n === nodes - 24) {
            // A plain DIV with a *closed* root is intentionally invisible to Engine's ordinary
            // probeShadow(host, false): host.shadowRoot is null, the tag has no hyphen, and the
            // host is not checkbox-like. Only broad queueShadowSweep -> probeShadow(..., true)
            // can obtain this root via chrome.dom.openOrClosedShadowRoot.
            const host = document.createElement('div');
            host.id = 'shadow-overflow-closed-host';
            host.dataset.shadowReady = 'true';
            const shadow = host.attachShadow({mode: 'closed'});
            const label = document.createElement('label');
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.required = true;
            input.addEventListener('click', () => {
              document.documentElement.dataset.shadowOverflowClicks = String(Number(document.documentElement.dataset.shadowOverflowClicks || 0) + 1);
              document.documentElement.dataset.shadowOverflowChecked = String(input.checked);
            });
            label.append(input, document.createTextNode('I have read and agree to the Terms of Service'));
            shadow.append(label);
            root.append(host);
          } else {
            const span = document.createElement('span');
            span.textContent = `neutral shadow overflow ${i}-${n}`;
            root.append(span);
          }
        }
        fragment.append(root);
      }
      mount.append(fragment);
    }, {roots: ROOTS, nodes: NODES});

    try {
      await page.waitForFunction(() => document.documentElement.dataset.shadowOverflowChecked === 'true', {timeout: 9000});
    } catch (error) {
      const diag = await page.evaluate(() => ({
        rootCount: document.querySelectorAll('[id^="shadow-overflow-root-"]').length,
        hostExists: !!document.querySelector('#shadow-overflow-closed-host'),
        shadowReady: document.querySelector('#shadow-overflow-closed-host')?.dataset.shadowReady === 'true',
        checked: document.documentElement.dataset.shadowOverflowChecked,
        clicks: Number(document.documentElement.dataset.shadowOverflowClicks || 0),
        visibility: document.visibilityState
      }));
      const worlds = await extensionWorldSentinels(page);
      console.error('e2e-engine-shadow-overflow-diagnostic:', JSON.stringify({diag, worlds}));
      throw error;
    }

    const result = await page.evaluate(() => ({
      checked: document.documentElement.dataset.shadowOverflowChecked,
      clicks: Number(document.documentElement.dataset.shadowOverflowClicks || 0)
    }));
    assert.deepEqual(result, {checked: 'true', clicks: 1}, 'broad closed-shadow discovery must survive MAX_SHADOW_JOBS pressure exactly once');
    console.log('e2e-engine-shadow-overflow: PASS');
  } finally {
    await browser.close();
  }
});
