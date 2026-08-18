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

const deepStatic = `<!doctype html><meta charset="utf-8">
<form id="flow">
  <section id="shell">
    <div><div><div><div><div><span id="legal">I agree to the Terms of Service</span></div></div></div></div></div>
    <aside><input id="agree" type="checkbox" required></aside>
  </section>
</form>`;

const longText = `<!doctype html><meta charset="utf-8">
<form id="flow">
  <label><input id="agree" type="checkbox" required><span id="legal">I agree to the Terms of Service ${'ordinary filler '.repeat(90)}</span></label>
</form>`;

const dynamicAria = `<!doctype html><meta charset="utf-8">
<form id="flow">
  <div><div><div><div><div><span id="legal-copy">I agree to the Terms of Service</span></div></div></div></div></div>
  <div><input id="agree" type="checkbox" required></div>
</form>
<script>setTimeout(() => document.querySelector('#agree').setAttribute('aria-labelledby', 'legal-copy'), 180);</script>`;

const customContainer = `<!doctype html><meta charset="utf-8">
<div id="auth-shell">
  <section>
    <div><div><div><div><div><span>I agree to the Terms of Service</span></div></div></div></div></div>
    <aside><input id="agree" type="checkbox" required></aside>
  </section>
  <footer><div><button id="continue" type="button">Continue</button></div></footer>
</div>`;

const pages = new Map([
  ['/deep-static', deepStatic],
  ['/long-text', longText],
  ['/dynamic-aria', dynamicAria],
  ['/custom-container', customContainer]
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
    await page.waitForFunction(() => document.querySelector('#agree')?.checked === true, {timeout: 4500});
  } catch (error) {
    const worlds = await extensionWorldSentinels(page);
    const state = await page.evaluate(() => ({
      checked: document.querySelector('#agree')?.checked,
      labelledby: document.querySelector('#agree')?.getAttribute('aria-labelledby'),
      visibility: document.visibilityState,
      readyState: document.readyState
    }));
    console.error('activation-recall-diagnostic:', JSON.stringify({label, state, worlds}));
    throw error;
  }
  const worlds = await extensionWorldSentinels(page);
  assert.ok(worlds.some(world => world.gate === VERSION && world.engine === VERSION), `${label}: Gate and Engine must both be reached`);
}

async function run(pathname, {pointer = false} = {}) {
  const page = await browser.newPage();
  try {
    await page.bringToFront();
    await page.goto(`http://127.0.0.1:${port}${pathname}`, {waitUntil: 'domcontentloaded'});
    await page.bringToFront();
    if (pointer) {
      await new Promise(resolve => setTimeout(resolve, 250));
      await page.click('#continue');
    }
    await waitChecked(page, pathname);
  } finally {
    await page.close();
  }
}

try {
  await run('/deep-static');
  await run('/long-text');
  await run('/dynamic-aria');
  await run('/custom-container', {pointer: true});
  console.log('e2e-activation-recall: PASS');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
