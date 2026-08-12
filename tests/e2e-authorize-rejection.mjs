import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import {extensionWorldSentinels, evaluateInExecutionContext} from './e2e-isolated-worlds.mjs';

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

    const engineWorld = await poll(async () => {
      const worlds = await extensionWorldSentinels(page);
      const seeded = await page.$eval('#seed-agree', el => ({checked: el.checked, clicks: Number(el.dataset.clicks || 0)}));
      if (!(seeded.checked && seeded.clicks === 1)) return null;
      return worlds.find(w => w.engine === VERSION && w.handover === VERSION && w.action === VERSION) || null;
    });

    // Replace only the public Guard API resolved by ActionAuthority. The original guard capture
    // listener remains installed, but the facade must now honor authorize=false before dispatching
    // any click. This proves the explicit protocol while the listener remains defense in depth.
    await evaluateInExecutionContext(page, engineWorld.id, `(() => {
      globalThis.__AUTO_AGREE_TEST_AUTH_CALLS__ = 0;
      globalThis.__AUTO_AGREE_HANDOVER_GUARD__ = Object.freeze({
        version: ${JSON.stringify(VERSION)},
        authorize() { globalThis.__AUTO_AGREE_TEST_AUTH_CALLS__++; return false; },
        runtimeCurrent() { return true; }
      });
      return true;
    })()`);

    await page.evaluate(() => {
      const mount = document.querySelector('#mount');
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.id = 'authorize-reject-agree';
      input.type = 'checkbox';
      input.required = true;
      input.dataset.clicks = '0';
      input.addEventListener('click', event => {
        event.currentTarget.dataset.clicks = String(Number(event.currentTarget.dataset.clicks || 0) + 1);
      });
      label.append(input, document.createTextNode('I have read and agree to the Terms of Service'));
      mount.append(label);
    });

    const attempts = await poll(async () => {
      const count = await evaluateInExecutionContext(page, engineWorld.id, 'globalThis.__AUTO_AGREE_TEST_AUTH_CALLS__ || 0');
      return count > 0 ? count : 0;
    });
    assert.ok(attempts >= 1, 'Engine must actually reach the rejected authorization path');

    // Allow the old verifier/retry window to elapse. A rejected ActionAuthority attempt must
    // not create DOM effect; any later rediscovery must remain equally fail-closed.
    await new Promise(resolve => setTimeout(resolve, 450));
    const blocked = await page.$eval('#authorize-reject-agree', el => ({checked: el.checked, clicks: Number(el.dataset.clicks || 0)}));
    const finalAttempts = await evaluateInExecutionContext(page, engineWorld.id, 'globalThis.__AUTO_AGREE_TEST_AUTH_CALLS__ || 0');
    assert.deepEqual(blocked, {checked: false, clicks: 0}, 'rejected Engine authorization must result in zero DOM click effect');
    assert.ok(finalAttempts >= 1, 'authorization rejection must have been exercised');

    // The control itself remains valid and trusted browser input must not be disabled by the
    // negative test. This distinguishes guard rejection from a broken/hidden fixture.
    await page.click('#authorize-reject-agree');
    const trusted = await page.$eval('#authorize-reject-agree', el => ({checked: el.checked, clicks: Number(el.dataset.clicks || 0)}));
    assert.deepEqual(trusted, {checked: true, clicks: 1}, 'trusted browser input must remain usable after rejected automation');

    console.log('e2e-authorize-rejection:', JSON.stringify({attempts: finalAttempts, blocked, trusted}));
    console.log('e2e-authorize-rejection: PASS');
  } finally {
    await browser.close();
  }
});
