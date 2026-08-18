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
<label id="legal-row"><div><div><div><div><div><span id="legal">I agree to the Terms of Service</span></div></div></div></div></div><aside><input id="target-box" type="checkbox" required></aside></label>`;

const longText = `<!doctype html><meta charset="utf-8">
<label><input id="target-box" type="checkbox" required><span id="legal">I agree to the Terms of Service ${'ordinary filler '.repeat(90)}</span></label>`;

const dynamicAria = `<!doctype html><meta charset="utf-8">
<div><div><div><div><div><div><div><div><div><div><span id="legal-copy">I agree to the Terms of Service</span></div></div></div></div></div></div></div></div></div></div>
<div><input id="target-box" type="checkbox" required></div>
<script>setTimeout(() => document.querySelector('#target-box').setAttribute('aria-labelledby', 'legal-copy'), 180);</script>`;

const customContainer = `<!doctype html><meta charset="utf-8">
<div id="auth-shell">
  <section>
    <div><div><div><div><div><span>I agree to the Terms of Service</span></div></div></div></div></div>
    <aside><input id="target-box" type="checkbox" required></aside>
  </section>
  <footer><div><button id="continue" type="button">Continue</button></div></footer>
</div>`;

const deepGenericNegative = `<!doctype html><meta charset="utf-8">
<div id="generic-shell">
  <div><div><div><div><div><span>I agree to the Terms of Service</span></div></div></div></div></div>
  <aside><input id="generic-box" type="checkbox" required></aside>
</div>`;

const pages = new Map([
  ['/deep-native-label', deepNativeLabel],
  ['/long-text', longText],
  ['/dynamic-aria', dynamicAria],
  ['/custom-container', customContainer],
  ['/deep-generic-negative', deepGenericNegative]
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

async function waitChecked(page, label) {
  try {
    await page.waitForFunction(() => document.querySelector('#target-box')?.checked === true, {timeout: 4500});
  } catch (error) {
    const worlds = await extensionWorldSentinels(page);
    const state = await page.evaluate(() => ({
      checked: document.querySelector('#target-box')?.checked,
      labelledby: document.querySelector('#target-box')?.getAttribute('aria-labelledby'),
      visibility: document.visibilityState,
      readyState: document.readyState
    }));
    console.error('activation-recall-diagnostic:', JSON.stringify({label, state, worlds}));
    throw error;
  }
  const worlds = await extensionWorldSentinels(page);
  assert.ok(worlds.some(world => world.gate === VERSION && world.engine === VERSION), `${label}: Gate and Engine must both be reached`);
}

async function runPositive(pathname, {pointer = false} = {}) {
  const page = await browser.newPage();
  try {
    await page.bringToFront();
    await page.goto(`http://127.0.0.1:${port}${pathname}`, {waitUntil: 'domcontentloaded'});
    await page.bringToFront();
    if (pointer) {
      await new Promise(resolve => setTimeout(resolve, 250));
      assert.equal(await page.$eval('#target-box', input => input.checked), false, `${pathname}: proceed path must not activate before trusted intent`);
      await page.click('#continue');
    }
    await waitChecked(page, pathname);
  } finally {
    await page.close();
  }
}

async function runNegative(pathname) {
  const page = await browser.newPage();
  try {
    await page.bringToFront();
    await page.goto(`http://127.0.0.1:${port}${pathname}`, {waitUntil: 'domcontentloaded'});
    await page.bringToFront();
    await new Promise(resolve => setTimeout(resolve, 700));
    assert.equal(await page.$eval('#generic-box', input => input.checked), false, `${pathname}: unrelated deep geometry must not gain automated consent authority`);
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
  console.log('e2e-activation-recall: PASS');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
