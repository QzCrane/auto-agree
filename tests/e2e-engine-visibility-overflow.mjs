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
const FIXTURE = '<!doctype html><meta charset="utf-8"><form><input type="email" value="user@example.com"><label><input id="seed" type="checkbox" required>I agree to the Terms of Service</label><button>Continue</button></form><main id="mount"></main>';

async function withServer(fn) {
  const server = http.createServer((_req, res) => {
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
    enableExtensions: [EXTENSION],
    args: ['--no-first-run', '--no-default-browser-check', '--disable-dev-shm-usage', '--no-sandbox']
  };
  if (process.env.CHROME_PATH) options.executablePath = process.env.CHROME_PATH;
  return puppeteer.launch(options);
}

await withServer(async url => {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.bringToFront();
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => document.querySelector('#seed')?.checked === true, {timeout: 5000});
    const worlds = await extensionWorldSentinels(page);
    assert.ok(worlds.some(world => world.engine === VERSION), 'Engine must own the page before visibility saturation');

    await page.evaluate(() => {
      const fragment = document.createDocumentFragment();
      for (let index = 0; index < 220; index++) {
        const label = document.createElement('label');
        label.style.display = 'none';
        label.innerHTML = `<input id="hidden-${index}" type="checkbox" required>I agree to the Terms of Service ${index}`;
        const input = label.querySelector('input');
        input.addEventListener('click', () => {
          input.dataset.clicks = String(Number(input.dataset.clicks || 0) + 1);
        });
        fragment.append(label);
      }
      document.querySelector('#mount').append(fragment);
    });

    await new Promise(resolve => setTimeout(resolve, 400));
    await page.$eval('#hidden-219', input => { input.parentElement.style.display = 'block'; });
    await page.waitForFunction(() => document.querySelector('#hidden-219')?.checked === true, {timeout: 7000});
    const result = await page.$eval('#hidden-219', input => ({
      checked: input.checked,
      clicks: Number(input.dataset.clicks || 0)
    }));
    assert.deepEqual(result, {checked: true, clicks: 1});
    console.log('e2e-engine-visibility-overflow: PASS');
  } finally {
    await browser.close();
  }
});
