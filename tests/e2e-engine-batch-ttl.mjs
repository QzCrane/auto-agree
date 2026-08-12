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

    await page.evaluate(async () => {
      const mount = document.querySelector('#mount');
      const fragment = document.createDocumentFragment();
      const SIBLINGS = 140;
      const POSITIVE = 70;
      for (let i = 0; i < SIBLINGS; i++) {
        const section = document.createElement('section');
        section.id = `batch-ttl-sibling-${i}`;
        if (i === POSITIVE) {
          section.innerHTML = '<label><input id="engine-batch-ttl-agree" type="checkbox" required>I have read and agree to the Terms of Service</label>';
          section.querySelector('input').addEventListener('click', event => {
            event.currentTarget.dataset.clicks = String(Number(event.currentTarget.dataset.clicks || 0) + 1);
          });
        } else {
          for (let n = 0; n < 36; n++) {
            const span = document.createElement('span');
            span.textContent = `neutral batch ttl ${i}-${n}`;
            section.append(span);
          }
        }
        fragment.append(section);
      }

      // `nodes.length > 96` forces Engine's large MutationRecord path and `enqueueSiblingRange`.
      // The blocker is queued before mutation; MutationObserver enqueues the batch at the microtask
      // checkpoint, then this renderer task prevents background continuation for > BATCH_JOB_TTL_MS.
      const blocker = new Promise(resolve => setTimeout(() => {
        const until = performance.now() + 3400;
        while (performance.now() < until) {}
        resolve();
      }, 0));
      mount.append(fragment);
      await blocker;
      window.engineBatchTtlBlockComplete = true;
    });

    try {
      await page.waitForFunction(() => document.querySelector('#engine-batch-ttl-agree')?.checked === true, {timeout: 9000});
    } catch (error) {
      const diag = await page.evaluate(() => {
        const el = document.querySelector('#engine-batch-ttl-agree');
        return {
          exists: !!el,
          checked: el?.checked ?? false,
          clicks: Number(el?.dataset?.clicks || 0),
          siblingCount: document.querySelectorAll('[id^="batch-ttl-sibling-"]').length,
          blockerComplete: window.engineBatchTtlBlockComplete === true,
          visibility: document.visibilityState
        };
      });
      const worlds = await extensionWorldSentinels(page);
      console.error('e2e-engine-batch-live-ttl-diagnostic:', JSON.stringify({diag, worlds}));
      throw error;
    }

    const result = await page.$eval('#engine-batch-ttl-agree', el => ({checked: el.checked, clicks: Number(el.dataset.clicks || 0)}));
    assert.deepEqual(result, {checked: true, clicks: 1}, 'live Engine sibling batch must survive age beyond BATCH_JOB_TTL_MS exactly once');
    console.log('e2e-engine-batch-live-ttl: PASS');
  } finally {
    await browser.close();
  }
});
