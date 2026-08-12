import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import {extensionWorldSentinels} from './e2e-isolated-worlds.mjs';

const ROOT = path.resolve('.');
const EXTENSION = path.join(ROOT, 'extension');
const FIXTURE = fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'regressions', 'engine-lifecycle.html'), 'utf8');
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

async function poll(fn, timeout = 7000, interval = 60) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await fn();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error(`poll timeout after ${timeout}ms`);
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
    const other = await browser.newPage();
    await page.goto(`${url}?primary`, {waitUntil: 'domcontentloaded'});
    await other.goto(`${url}?other`, {waitUntil: 'domcontentloaded'});

    await page.bringToFront();
    await poll(async () => await page.evaluate(() => document.visibilityState === 'visible'));
    await poll(async () => {
      const worlds = await extensionWorldSentinels(page);
      return worlds.some(world => world.engine === VERSION) ? worlds : null;
    });
    await page.waitForFunction(() => document.querySelector('#seed-agree')?.checked === true, {timeout: 7000});
    const seed = await page.$eval('#seed-agree', el => ({checked: el.checked, clicks: Number(el.dataset.clicks || 0)}));
    assert.deepEqual(seed, {checked: true, clicks: 1}, 'precondition: real Engine must be active and verified by one seed click');

    for (let i = 0; i < 4; i++) {
      await other.bringToFront();
      await poll(async () => await page.evaluate(() => document.visibilityState === 'hidden'));
      await page.bringToFront();
      await poll(async () => await page.evaluate(() => document.visibilityState === 'visible'));
      const worlds = await extensionWorldSentinels(page);
      assert.ok(worlds.some(world => world.engine === VERSION), 'Engine world must survive lifecycle precondition cycles');
    }

    await other.bringToFront();
    await poll(async () => await page.evaluate(() => document.visibilityState === 'hidden'));
    await page.evaluate(() => {
      const label = document.createElement('label');
      label.id = 'engine-lifecycle-row';
      label.innerHTML = '<input id="engine-lifecycle-agree" type="checkbox" required>I have read and agree to the Terms of Service';
      const input = label.querySelector('input');
      input.dataset.clicks = '0';
      input.addEventListener('click', event => {
        event.currentTarget.dataset.clicks = String(Number(event.currentTarget.dataset.clicks || 0) + 1);
      });
      document.querySelector('#mount').append(label);
    });

    await new Promise(resolve => setTimeout(resolve, 700));
    const hiddenState = await page.$eval('#engine-lifecycle-agree', el => ({
      checked: el.checked,
      clicks: Number(el.dataset.clicks || 0),
      visibility: document.visibilityState
    }));
    assert.deepEqual(hiddenState, {checked: false, clicks: 0, visibility: 'hidden'}, 'paused Engine must not discover or click hidden-page inserts');
    const hiddenWorlds = await extensionWorldSentinels(page);
    assert.ok(hiddenWorlds.some(world => world.engine === VERSION), 'Engine world must remain installed while paused');

    await page.bringToFront();
    await poll(async () => await page.evaluate(() => document.visibilityState === 'visible'));
    await page.waitForFunction(() => document.querySelector('#engine-lifecycle-agree')?.checked === true, {timeout: 7000});
    const resumed = await page.$eval('#engine-lifecycle-agree', el => ({checked: el.checked, clicks: Number(el.dataset.clicks || 0)}));
    assert.deepEqual(resumed, {checked: true, clicks: 1}, 'resumed Engine must recover final DOM state exactly once');

    console.log('e2e-engine-lifecycle:', JSON.stringify({seed, hiddenState, resumed, cycles: 5}));
    console.log('e2e-engine-lifecycle: PASS');
  } finally {
    await browser.close();
  }
});
