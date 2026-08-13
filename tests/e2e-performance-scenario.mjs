import http from 'node:http';
import assert from 'node:assert/strict';
import path from 'node:path';
import puppeteer from 'puppeteer';
import {extensionWorldSentinels} from './e2e-isolated-worlds.mjs';

const extensionPath = path.resolve(process.argv[2] || 'extension');
const HEADED = process.env.AUTO_AGREE_HEADED === '1';

const server = http.createServer((_req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end('<!doctype html><meta charset="utf-8"><title>AutoAgree paired performance</title><main id="mount"></main>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const {port} = server.address();
const url = name => `http://127.0.0.1:${port}/${name}`;

const options = {
  headless: !HEADED,
  pipe: true,
  enableExtensions: [extensionPath],
  args: ['--no-first-run', '--no-default-browser-check', '--disable-dev-shm-usage', '--no-sandbox']
};
if (process.env.CHROME_PATH) options.executablePath = process.env.CHROME_PATH;
const browser = await puppeteer.launch(options);

function metric(snapshot, name) {
  return snapshot.metrics.find(item => item.name === name)?.value || 0;
}

async function sessionWithBaseline(page) {
  const session = await page.createCDPSession();
  await session.send('Performance.enable');
  return {session, before: await session.send('Performance.getMetrics')};
}

async function finishMetric(owner) {
  const after = await owner.session.send('Performance.getMetrics');
  return metric(after, 'TaskDuration') - metric(owner.before, 'TaskDuration');
}

async function closePage(page) {
  if (!page || page.isClosed()) return;
  try { await page.close(); } catch {}
}

async function waitForTaskQuiescence(page, timeoutMs = 3500) {
  const session = await page.createCDPSession();
  try {
    await session.send('Performance.enable');
    let previous = await session.send('Performance.getMetrics');
    let stableWindows = 0;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 120));
      const current = await session.send('Performance.getMetrics');
      const delta = metric(current, 'TaskDuration') - metric(previous, 'TaskDuration');
      stableWindows = delta <= 0.02 ? stableWindows + 1 : 0;
      if (stableWindows >= 2) return;
      previous = current;
    }
    throw new Error('negative-idle page did not reach the bounded quiescence barrier');
  } finally {
    try { await session.detach(); } catch {}
  }
}

async function waitForEngine(page) {
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) {
    const worlds = await extensionWorldSentinels(page);
    if (worlds.some(world => typeof world.engine === 'string')) return;
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  throw new Error('Engine did not initialize for performance workload');
}

async function positiveTailLogin() {
  const page = await browser.newPage();
  try {
    await page.goto(url('positive-tail'), {waitUntil: 'domcontentloaded'});
    const owner = await sessionWithBaseline(page);
    const start = performance.now();
    await page.evaluate(() => {
      const form = document.createElement('form');
      form.innerHTML = '<input type="email" value="person@example.com"><button disabled>Continue</button>';
      const fragment = document.createDocumentFragment();
      for (let index = 0; index < 5000; index++) {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'unrelated';
        fragment.append(input);
      }
      const label = document.createElement('label');
      label.innerHTML = '<input id="target" type="checkbox" required>I agree to the Terms of Service';
      form.append(fragment, label);
      document.querySelector('#mount').append(form);
    });
    await page.waitForFunction(() => document.querySelector('#target')?.checked === true, {timeout: 5000});
    return {wallMs: performance.now() - start, taskDurationS: await finishMetric(owner)};
  } finally { await closePage(page); }
}

async function negativeIdle() {
  const page = await browser.newPage();
  try {
    await page.goto(url('negative-idle'), {waitUntil: 'domcontentloaded'});
    await page.evaluate(() => {
      const fragment = document.createDocumentFragment();
      for (let index = 0; index < 5000; index++) {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.dataset.benign = String(index);
        fragment.append(input);
      }
      document.querySelector('#mount').append(fragment);
    });
    await waitForTaskQuiescence(page);
    const owner = await sessionWithBaseline(page);
    const start = performance.now();
    await new Promise(resolve => setTimeout(resolve, 400));
    const checked = await page.$$eval('input:checked', nodes => nodes.length);
    assert.equal(checked, 0);
    return {wallMs: performance.now() - start, taskDurationS: await finishMetric(owner)};
  } finally { await closePage(page); }
}

async function negativeMutationChurn() {
  const page = await browser.newPage();
  try {
    await page.goto(url('negative-mutation'), {waitUntil: 'domcontentloaded'});
    const owner = await sessionWithBaseline(page);
    const start = performance.now();
    await page.evaluate(async () => {
      const mount = document.querySelector('#mount');
      for (let batch = 0; batch < 20; batch++) {
        const group = document.createElement('section');
        const fragment = document.createDocumentFragment();
        for (let index = 0; index < 200; index++) {
          const span = document.createElement('span');
          span.textContent = `ordinary catalog item ${batch}-${index}`;
          fragment.append(span);
        }
        group.append(fragment);
        mount.replaceChildren(group);
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
      mount.replaceChildren();
    });
    await new Promise(resolve => setTimeout(resolve, 150));
    return {wallMs: performance.now() - start, taskDurationS: await finishMetric(owner)};
  } finally { await closePage(page); }
}

async function hiddenQuiescence() {
  const page = await browser.newPage();
  const foreground = await browser.newPage();
  try {
    await page.bringToFront();
    await page.goto(url('hidden-quiescence'), {waitUntil: 'domcontentloaded'});
    await page.evaluate(() => {
      const label = document.createElement('label');
      label.id = 'activation-seed';
      label.innerHTML = '<input id="activation-target" type="checkbox" required>I agree to the Terms of Service';
      document.querySelector('#mount').append(label);
    });
    await page.waitForFunction(() => document.querySelector('#activation-target')?.checked === true, {timeout: 5000});
    await waitForEngine(page);
    await page.$eval('#activation-seed', seed => seed.remove());
    await foreground.goto(url('foreground'), {waitUntil: 'domcontentloaded'});
    await foreground.bringToFront();
    const state = await page.evaluate(() => document.visibilityState);
    assert.equal(state, 'hidden', 'background performance page must be physically hidden');
    const owner = await sessionWithBaseline(page);
    const start = performance.now();
    await page.evaluate(() => {
      const label = document.createElement('label');
      label.innerHTML = '<input id="hidden-target" type="checkbox" required>I agree to the Terms of Service';
      document.querySelector('#mount').append(label);
    });
    await new Promise(resolve => setTimeout(resolve, 500));
    assert.equal(await page.$eval('#hidden-target', input => input.checked), false);
    return {wallMs: performance.now() - start, taskDurationS: await finishMetric(owner)};
  } finally {
    await Promise.allSettled([closePage(page), closePage(foreground)]);
  }
}

async function multiTabScheduler() {
  const pages = await Promise.all(Array.from({length: 8}, () => browser.newPage()));
  try {
    await Promise.all(pages.map((page, index) => page.goto(url(`multi-tab-${index}`), {waitUntil: 'domcontentloaded'})));
    const owners = await Promise.all(pages.map(sessionWithBaseline));
    const start = performance.now();
    await Promise.all(pages.map(page => page.evaluate(() => {
      const form = document.createElement('form');
      form.innerHTML = '<input type="email" value="person@example.com"><button disabled>Continue</button><label><input class="target" type="checkbox" required>I agree to the Terms of Service</label>';
      document.querySelector('#mount').append(form);
    })));
    // Auto Agree intentionally quiesces hidden pages. Activate each tab in turn
    // so this workload measures bounded multi-tab resume/injection scheduling
    // without treating forbidden background automation as success.
    for (const page of pages) {
      await page.bringToFront();
      await page.waitForFunction(() => document.visibilityState === 'visible', {timeout: 2000});
      await page.waitForFunction(() => document.querySelector('.target')?.checked === true, {timeout: 7000});
      await waitForEngine(page);
    }
    const durations = await Promise.all(owners.map(finishMetric));
    return {wallMs: performance.now() - start, taskDurationS: durations.reduce((sum, value) => sum + value, 0)};
  } finally {
    // Teardown must not overwrite a completed workload when Chrome has already
    // closed one target or the transport. Workload/metric failures above still
    // reject; cleanup is idempotent and the outer browser owner closes the rest.
    await Promise.allSettled(pages.map(closePage));
  }
}

async function collectWorkloads() {
  return {
    positiveTailLogin: await positiveTailLogin(),
    negativeIdle: await negativeIdle(),
    negativeMutationChurn: await negativeMutationChurn(),
    hiddenQuiescence: await hiddenQuiescence(),
    multiTabScheduler: await multiTabScheduler()
  };
}

let timeout;
try {
  const bounded = new Promise((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error('performance scenario exceeded its 30 second wall budget')), 30_000);
  });
  const workloads = await Promise.race([collectWorkloads(), bounded]);
  console.log(`PERF_RESULT=${JSON.stringify({schemaVersion: 1, workloads})}`);
} finally {
  clearTimeout(timeout);
  try { await browser.close(); } catch {}
  await new Promise(resolve => server.close(resolve));
}
