'use strict';

const engineInflight = new Map();
const gateInflight = new Map();
const profileCache = new Map();
const PROFILE_PREFIX = 'site:';
const PROFILE_INDEX_KEY = '__auto_agree_profile_index__';
const LEGACY_PROFILE_INDEX_KEYS = ['__auto_agree_profile_index_v5__', '__auto_agree_profile_index_v4__', '__auto_agree_profile_index_v3__'];
const PROFILE_CACHE_MAX = 32;
const PROFILE_ORIGIN_MAX = 256;
const PROFILE_FLOW_MAX = 8;
const PROFILE_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const INJECTION_MAX_GLOBAL = 4;
const INJECTION_MAX_PER_TAB = 2;
const INJECTION_QUEUE_MAX = 64;
const injectionQueue = [];
const injectionActiveByTab = new Map();
let injectionActive = 0;
const VERSION = '7.0.0';
let storageWriteChain = Promise.resolve();

function cacheProfile(key, value) {
  if (profileCache.has(key)) profileCache.delete(key);
  profileCache.set(key, value);
  while (profileCache.size > PROFILE_CACHE_MAX) profileCache.delete(profileCache.keys().next().value);
  return value;
}

function cachedProfile(key) {
  if (!profileCache.has(key)) return undefined;
  const value = profileCache.get(key);
  cacheProfile(key, value);
  return value;
}

function targetFor(sender) {
  const tabId = sender.tab?.id;
  if (!Number.isInteger(tabId)) return null;
  if (sender.documentId) return { tabId, documentIds: [sender.documentId] };
  if (Number.isInteger(sender.frameId)) return { tabId, frameIds: [sender.frameId] };
  return { tabId };
}

function sanitizeLocator(locator) {
  if (!locator || typeof locator !== 'object') return null;
  const selector = typeof locator.selector === 'string' ? locator.selector.trim() : '';
  if (!selector || selector.length > 420 || /[\u0000-\u001f]/.test(selector)) return null;
  if (!Array.isArray(locator.hosts) || locator.hosts.length > 8) return null;
  const hosts = [];
  for (const raw of locator.hosts) {
    if (typeof raw !== 'string') return null;
    const value = raw.trim();
    if (!value || value.length > 360 || /[\u0000-\u001f]/.test(value)) return null;
    hosts.push(value);
  }
  return { hosts, selector };
}

function locatorKey(locator) {
  try { return JSON.stringify(locator || null); } catch (_) { return ''; }
}

function sanitizeDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== 'object') return null;
  const kind = ['native','aria','data','class','custom','unknown'].includes(descriptor.kind) ? descriptor.kind : 'unknown';
  const severity = Math.max(0, Math.min(4, Number(descriptor.severity || 0)));
  return {
    kind,
    severity,
    legal: !!descriptor.legal,
    assent: !!descriptor.assent,
    required: !!descriptor.required,
    auth: !!descriptor.auth,
    linkBucket: Math.max(0, Math.min(2, Number(descriptor.linkBucket || 0)))
  };
}

function sanitizeProfile(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const now = Date.now();
  const input = Array.isArray(profile.flows) ? profile.flows : [];
  const map = new Map();
  for (const flow of input) {
    if (!flow?.locator || !flow?.fingerprint) continue;
    const locator = sanitizeLocator(flow.locator);
    if (!locator) continue;
    const ts = Number(flow.ts || 0);
    if (!Number.isFinite(ts) || now - ts > PROFILE_TTL_MS) continue;
    const fingerprint = String(flow.fingerprint).slice(0, 520);
    const key = `${fingerprint}|${locatorKey(locator)}`;
    const prev = map.get(key);
    const clean = {
      fingerprint,
      locator,
      descriptor: sanitizeDescriptor(flow.descriptor),
      successes: Math.max(0, Math.min(100000, Number(flow.successes || 0))),
      failures: Math.max(0, Math.min(1000, Number(flow.failures || 0))),
      ts
    };
    if (!prev || clean.ts > prev.ts) map.set(key, clean);
  }
  const flows = [...map.values()].sort((a,b) => b.ts - a.ts).slice(0, PROFILE_FLOW_MAX);
  return flows.length ? { version: VERSION, flows } : null;
}

function mergeProfiles(current, incoming) {
  const all = [...(current?.flows || []), ...(incoming?.flows || [])];
  const map = new Map();
  for (const flow of all) {
    const locator = sanitizeLocator(flow?.locator);
    if (!locator || !flow?.fingerprint) continue;
    const fingerprint = String(flow.fingerprint).slice(0, 520);
    const key = `${fingerprint}|${locatorKey(locator)}`;
    const next = {
      fingerprint,
      locator,
      descriptor: sanitizeDescriptor(flow.descriptor),
      successes: Math.max(0, Math.min(100000, Number(flow.successes || 0))),
      failures: Math.max(0, Math.min(1000, Number(flow.failures || 0))),
      ts: Number(flow.ts || 0)
    };
    const prev = map.get(key);
    if (!prev || next.ts > prev.ts) map.set(key, next);
    else if (next.ts === prev.ts) {
      prev.successes = Math.max(prev.successes, next.successes);
      prev.failures = Math.max(prev.failures, next.failures);
    } else {
      prev.successes = Math.max(prev.successes, next.successes);
    }
  }
  return sanitizeProfile({ version: VERSION, flows: [...map.values()] });
}

async function getProfile(origin) {
  if (!origin || origin === 'null') return null;
  const key = `${PROFILE_PREFIX}${origin}`;
  const hot = cachedProfile(key);
  if (hot !== undefined) return hot;
  try {
    const session = await chrome.storage.session?.get(key);
    const value = sanitizeProfile(session?.[key]);
    if (value) return cacheProfile(key, value);
  } catch (_) {}
  try {
    const local = await chrome.storage.local.get(key);
    const value = sanitizeProfile(local?.[key]);
    cacheProfile(key, value);
    if (value) {
      try { await chrome.storage.session?.set({ [key]: value }); } catch (_) {}
    }
    return value;
  } catch (_) { return null; }
}

async function updateProfileIndex(origin) {
  let index = {};
  try {
    const keys = [PROFILE_INDEX_KEY, ...LEGACY_PROFILE_INDEX_KEYS];
    const stored = await chrome.storage.local.get(keys);
    for (const key of keys) Object.assign(index, stored?.[key] || {});
    if (LEGACY_PROFILE_INDEX_KEYS.some(key => stored?.[key])) {
      try { await chrome.storage.local.remove(LEGACY_PROFILE_INDEX_KEYS); } catch (_) {}
    }
  } catch (_) {}
  const now = Date.now();
  index[origin] = now;
  const entries = Object.entries(index).filter(([,ts]) => Number.isFinite(Number(ts))).sort((a,b) => Number(b[1]) - Number(a[1]));
  const keep = entries.slice(0, PROFILE_ORIGIN_MAX);
  const drop = entries.slice(PROFILE_ORIGIN_MAX);
  const next = Object.fromEntries(keep);
  await chrome.storage.local.set({ [PROFILE_INDEX_KEY]: next });
  if (drop.length) {
    const keys = drop.map(([oldOrigin]) => `${PROFILE_PREFIX}${oldOrigin}`);
    try { await chrome.storage.local.remove(keys); } catch (_) {}
    try { await chrome.storage.session?.remove(keys); } catch (_) {}
    for (const key of keys) profileCache.delete(key);
  }
}

async function removeProfileIndexOrigin(origin) {
  try {
    const stored = await chrome.storage.local.get(PROFILE_INDEX_KEY);
    const index = stored?.[PROFILE_INDEX_KEY] || {};
    if (Object.prototype.hasOwnProperty.call(index, origin)) {
      delete index[origin];
      await chrome.storage.local.set({ [PROFILE_INDEX_KEY]: index });
    }
  } catch (_) {}
}

function invalidateProfileFlow(origin, payload) {
  if (!origin || origin === 'null' || !payload?.fingerprint || !payload?.locator) return Promise.resolve(false);
  const locator = sanitizeLocator(payload.locator);
  if (!locator) return Promise.resolve(false);
  const fingerprint = String(payload.fingerprint).slice(0, 520);
  const targetKey = `${fingerprint}|${locatorKey(locator)}`;
  const task = async () => {
    const key = `${PROFILE_PREFIX}${origin}`;
    const current = await getProfile(origin);
    if (!current?.flows?.length) return false;
    const flows = current.flows.filter(flow => `${flow.fingerprint}|${locatorKey(flow.locator)}` !== targetKey);
    const next = sanitizeProfile({ version: VERSION, flows });
    if (!next) {
      cacheProfile(key, null);
      try { await chrome.storage.session?.remove(key); } catch (_) {}
      try { await chrome.storage.local.remove(key); } catch (_) {}
      await removeProfileIndexOrigin(origin);
      return true;
    }
    cacheProfile(key, next);
    try { await chrome.storage.session?.set({ [key]: next }); } catch (_) {}
    await chrome.storage.local.set({ [key]: next });
    await updateProfileIndex(origin);
    return true;
  };
  storageWriteChain = storageWriteChain.then(task, task);
  return storageWriteChain;
}

function putProfile(origin, profile) {
  if (!origin || origin === 'null' || !profile) return Promise.resolve(false);
  const task = async () => {
    const key = `${PROFILE_PREFIX}${origin}`;
    const current = await getProfile(origin);
    const merged = mergeProfiles(current, sanitizeProfile(profile));
    if (!merged) return false;
    cacheProfile(key, merged);
    try { await chrome.storage.session?.set({ [key]: merged }); } catch (_) {}
    await chrome.storage.local.set({ [key]: merged });
    await updateProfileIndex(origin);
    return true;
  };
  storageWriteChain = storageWriteChain.then(task, task);
  return storageWriteChain;
}

function drainInjectionQueue() {
  if (injectionActive >= INJECTION_MAX_GLOBAL || !injectionQueue.length) return;
  for (let i = 0; i < injectionQueue.length && injectionActive < INJECTION_MAX_GLOBAL; ) {
    const job = injectionQueue[i];
    const tabActive = injectionActiveByTab.get(job.target.tabId) || 0;
    if (tabActive >= INJECTION_MAX_PER_TAB) { i++; continue; }
    injectionQueue.splice(i, 1);
    injectionActive++;
    injectionActiveByTab.set(job.target.tabId, tabActive + 1);
    chrome.scripting.executeScript({ target: job.target, files: job.files, world: 'ISOLATED', injectImmediately: true })
      .then(job.resolve, job.reject)
      .finally(() => {
        injectionActive = Math.max(0, injectionActive - 1);
        const next = Math.max(0, (injectionActiveByTab.get(job.target.tabId) || 1) - 1);
        if (next) injectionActiveByTab.set(job.target.tabId, next); else injectionActiveByTab.delete(job.target.tabId);
        drainInjectionQueue();
      });
  }
}

function scheduleInjection(target, files, priority) {
  if (injectionQueue.length >= INJECTION_QUEUE_MAX) return Promise.reject(new Error('injection-queue-full'));
  return new Promise((resolve, reject) => {
    injectionQueue.push({ target, files, priority, resolve, reject, queuedAt: Date.now() });
    injectionQueue.sort((a,b) => b.priority - a.priority || a.queuedAt - b.queuedAt);
    drainInjectionQueue();
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') return false;

  if (message.type === 'AUTO_AGREE_PROFILE_GET') {
    getProfile(message.origin).then(
      profile => sendResponse({ ok: true, profile }),
      error => sendResponse({ ok: false, error: String(error?.message || error) })
    );
    return true;
  }

  if (message.type === 'AUTO_AGREE_PROFILE_PUT') {
    putProfile(message.origin, message.profile).then(
      () => sendResponse({ ok: true }),
      error => sendResponse({ ok: false, error: String(error?.message || error) })
    );
    return true;
  }

  if (message.type === 'AUTO_AGREE_PROFILE_INVALIDATE') {
    invalidateProfileFlow(message.origin, message.profile).then(
      () => sendResponse({ ok: true }),
      error => sendResponse({ ok: false, error: String(error?.message || error) })
    );
    return true;
  }

  if (message.type !== 'AUTO_AGREE_GATE' && message.type !== 'AUTO_AGREE_ACTIVATE') return false;

  const target = targetFor(sender);
  if (!target) {
    sendResponse({ ok: false, error: 'missing-target' });
    return false;
  }

  const key = sender.documentId || `${target.tabId}:${sender.frameId ?? 0}`;
  const isGate = message.type === 'AUTO_AGREE_GATE';
  const map = isGate ? gateInflight : engineInflight;
  const files = isGate ? ['semantic-core.js', 'gate.js'] : ['risk-core.js', 'engine.js'];
  let promise = map.get(key);
  if (!promise) {
    promise = scheduleInjection(target, files, isGate ? 1 : 2).finally(() => map.delete(key));
    map.set(key, promise);
  }

  promise.then(
    () => sendResponse({ ok: true }),
    error => sendResponse({ ok: false, error: String(error?.message || error) })
  );
  return true;
});
