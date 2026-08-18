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

const deepNativeLabel = `<!doctype html><meta charset="utf-8">
<label id="legal-row"><div><div><div><div><div><span id="legal">I agree to the Terms of Service</span></div></div></div></div></div><aside><input id="target-box" type="checkbox" required disabled></aside></label>`;

const longText = `<!doctype html><meta charset="utf-8">
<label><input id="target-box" type="checkbox" required disabled><span id="legal">I agree to the Terms of Service ${'ordinary filler '.repeat(90)}</span></label>`;

const dynamicAria = `<!doctype html><meta charset="utf-8">
<div><div><div><div><div><div><div><div><div><div><span id="legal-copy">I agree to the Terms of Service</span></div></div></div></div></div></div></div></div></div></div>
<div><input id="target-box" type="checkbox" required disabled></div>
<script>setTimeout(() => document.querySelector('#target-box').setAttribute('aria-labelledby', 'legal-copy'), 180);</script>`;

const customContainer = `<!doctype html><meta charset="utf-8">
<div id="auth-shell">
  <header><div><div><div><div><div><span>Sign in to your account</span></div></div></div></div></div></header>
  <section>
    <div><div><div><div><div><span>I agree to the Terms of Service</span></div></div></div></div></div>
    <aside><input id="target-box" type="checkbox" required disabled></aside>
  </section>
  <footer><div><button id="continue" type="button">Continue</button></div></footer>
</div>`;

const deepGenericNegative = `<!doctype html><meta charset="utf-8">
<div id="generic-shell">
  <div><div><div><div><div><span>I agree to the Terms of Service</span></div></div></div></div></div>
  <aside><input id="generic-box" type="checkbox" required></aside>
</div>`;

const noAuthProceedNegative = `<!doctype html><meta charset="utf-8">
<div id="generic-shell">
  <section>
    <div><div><div><div><div><span>I agree to the Terms of Service</span></div></div></div></div></div>
    <aside><input id="generic-box" type="checkbox" required></aside>
  </section>
  <footer><div><button id="continue" type="button">Continue</button></div></footer>
</div>`;

const pages = new Map([
  ['/deep-native-label', deepNativeLabel],
  ['/long-text', longText],
  ['/dynamic-aria', dynamicAria],
  ['/custom-container', customContainer],
  ['/deep-generic-negative', deepGenericNegative],
  ['/no-auth-proceed-negative', noAuthProceedNegative]
]);

const server = http.createServer((req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  const body = pages.get((req.url || '/').split('?')[0]);
  if (!body) { res.statusCode = 404; res.end('not found'); return; }
  res.end(body);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const {port} = server.address();

const options = {
  headless: !HEADED,
  pipe: true,
  enableExtensions: [EXTENSION],
  args: ['--no-first-run', '--no-default-browser-check', '--disable-dev-shm-usage', '--no-sandbox']
};
if (process.env.CHROME_PATH) options.executablePath = process.env.CHROME_PATH;
const browser = await puppeteer.launch(options);

async function worlds(page) {
  return extensionWorldSentinels(page);
}

async function waitForEngine(page, label, timeout = 4500) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const current = await worlds(page);
    if (current.some(world => world.gate === VERSION && world.engine === VERSION)) return current;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`${label}: Probe/Gate did not reach Engine within ${timeout}ms`);
}

async function waitChecked(page, label) {
  try {
    await page.waitForFunction(() => document.querySelector('#target-box')?.checked === true, {timeout: 4500});
  } catch (error) {
    const current = await worlds(page);
    const state = await page.evaluate(() => ({
      checked: document.querySelector('#target-box')?.checked,
      disabled: document.querySelector('#target-box')?.disabled,
      labelledby: document.querySelector('#target-box')?.getAttribute('aria-labelledby'),
      visibility: document.visibilityState,
      readyState: document.readyState
    }));
    console.error('activation-recall-diagnostic:', JSON.stringify({label, state, worlds: current}));
    throw error;
  }
}

async function runPositive(pathname, {pointer = false} = {}) {
  const page = await browser.newPage();
  try {
    await page.bringToFront();
    await page.goto(`http://127.0.0.1:${port}${pathname}`, {waitUntil: 'domcontentloaded'});
    await page.bringToFront();
    if (pointer) {
      await new Promise(resolve => setTimeout(resolve, 250));
      assert.equal(await page.$eval('#target-box', input => input.checked), false, `${pathname}: proceed path must not act before trusted intent`);
      assert.equal((await worlds(page)).some(world => world.gate === VERSION), false, `${pathname}: proceed path must not activate Gate before trusted intent`);
      await page.click('#continue');
    }
    await waitForEngine(page, pathname);
    assert.deepEqual(await page.$eval('#target-box', input => ({checked: input.checked, disabled: input.disabled})), {checked: false, disabled: true}, `${pathname}: activation must be observable independently of action`);
    await page.$eval('#target-box', input => { input.disabled = false; });
    await waitChecked(page, pathname);
    assert.equal((await worlds(page)).some(world => world.gate === VERSION && world.engine === VERSION), true, `${pathname}: current Gate/Engine must remain observable after action`);
  } finally {
    await page.close();
  }
}

async function runNegative(pathname, {pointer = false} = {}) {
  const page = await browser.newPage();
  try {
    await page.bringToFront();
    await page.goto(`http://127.0.0.1:${port}${pathname}`, {waitUntil: 'domcontentloaded'});
    await page.bringToFront();
    await new Promise(resolve => setTimeout(resolve, 250));
    assert.equal(await page.$eval('#generic-box', input => input.checked), false, `${pathname}: negative control must begin unchecked`);
    assert.equal((await worlds(page)).some(world => world.gate === VERSION), false, `${pathname}: insufficient evidence must not pre-activate Gate`);
    if (pointer) await page.click('#continue');
    await new Promise(resolve => setTimeout(resolve, 700));
    assert.equal(await page.$eval('#generic-box', input => input.checked), false, `${pathname}: insufficient evidence must not gain automated consent authority`);
    assert.equal((await worlds(page)).some(world => world.gate === VERSION), false, `${pathname}: insufficient evidence must not activate Gate`);
  } finally {
    await page.close();
  }
}

try {
  await runPositive('/deep-native-label');
  await runPositive('/long-text');
  await runPositive('/dynamic-aria');
  await runPositive('/custom-container', {pointer: true});
  await runNegative('/deep-generic-negative');
  await runNegative('/no-auth-proceed-negative', {pointer: true});
  console.log('e2e-activation-recall: PASS');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
