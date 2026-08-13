import http from 'node:http';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import {extensionWorldSentinels} from './e2e-isolated-worlds.mjs';

const ROOT = path.resolve('.');
const EXTENSION = path.join(ROOT, 'extension');
const VERSION = JSON.parse(fs.readFileSync(path.join(EXTENSION, 'manifest.json'), 'utf8')).version;
const HEADED = process.env.AUTO_AGREE_HEADED === '1';
const FIXTURE = `<!doctype html><meta charset="utf-8">
<label id="seed-row"><input id="seed" type="checkbox" required>I agree to the Terms of Service</label>
<form id="login">
  <input id="email" type="email" name="email" autocomplete="email" required>
  <button id="continue" type="submit" disabled>Continue</button>
  <main id="controls"></main>
</form>`;

async function withServer(fn) {
  const server = http.createServer((_req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(FIXTURE);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const {port} = server.address();
  try { return await fn(`http://127.0.0.1:${port}/login`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

async function launch() {
  const options = {
    headless: !HEADED,
    pipe: true,
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
    await poll(async () => {
      const worlds = await extensionWorldSentinels(page);
      return worlds.some(world => world.engine === VERSION)
        && await page.$eval('#seed', input => input.checked === true);
    });
    await page.$eval('#seed-row', row => row.remove());

    await page.evaluate(() => {
      const fragment = document.createDocumentFragment();
      for (let index = 0; index < 110; index++) {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = `agreement-${index}`;
        input.disabled = index < 109;
        input.addEventListener('click', () => {
          input.dataset.clicks = String(Number(input.dataset.clicks || 0) + 1);
        });
        // Terse legal text intentionally needs the form's native-validity/proceed
        // transition before DecisionKernel can authorize it. This lets the test
        // prove that a tail candidate omitted from the capped index is recovered
        // when the surrounding context epoch changes.
        label.append(input, ` Terms of Service ${index}`);
        fragment.append(label);
      }
      document.querySelector('#controls').append(fragment);
    });

    await new Promise(resolve => setTimeout(resolve, 350));
    assert.equal(await page.$eval('#agreement-109', input => input.checked), false,
      'invalid credential context must not grant the tail candidate authority');

    const client = await page.createCDPSession();
    await client.send('Performance.enable');
    const before = await client.send('Performance.getMetrics');
    await page.$eval('#email', input => {
      input.value = 'person@example.com';
      input.dispatchEvent(new Event('input', {bubbles: true}));
    });
    await page.waitForFunction(() => document.querySelector('#agreement-109')?.checked === true, {timeout: 7000});

    // Same-epoch focus/proceed pressure must not keep the overflow marker as an
    // eternal whole-context rescan trigger.
    await page.evaluate(() => {
      const email = document.querySelector('#email');
      const button = document.querySelector('#continue');
      for (let index = 0; index < 30; index++) {
        email.dispatchEvent(new FocusEvent('focusin', {bubbles: true}));
        button.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
      }
    });
    await new Promise(resolve => setTimeout(resolve, 250));
    const after = await client.send('Performance.getMetrics');
    const metric = (snapshot, name) => snapshot.metrics.find(item => item.name === name)?.value || 0;
    const taskDuration = metric(after, 'TaskDuration') - metric(before, 'TaskDuration');
    const result = await page.$eval('#agreement-109', input => ({
      checked: input.checked,
      clicks: Number(input.dataset.clicks || 0)
    }));
    assert.deepEqual(result, {checked: true, clicks: 1});
    assert.ok(taskDuration < 0.8, `context-index recovery pressure exceeded TaskDuration ceiling: ${taskDuration}`);
    console.log(`e2e-engine-context-index-overflow: PASS taskDuration=${taskDuration.toFixed(4)}`);
  } finally {
    await browser.close();
  }
});
