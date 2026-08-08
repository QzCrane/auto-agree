'use strict';

const engineInflight = new Map();
const gateInflight = new Map();
const profileCache = new Map();
const PROFILE_PREFIX = 'site:';
const PROFILE_INDEX_KEY = '__auto_agree_profile_index_v5__';
const PROFILE_CACHE_MAX = 32;
const PROFILE_ORIGIN_MAX = 256;
const PROFILE_FLOW_MAX = 8;
const PROFILE_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const VERSION = '5.0.0';
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

function locatorKey(locator) {
  try { return JSON.stringify(locator || null); } catch (_) { return ''; }
}

function sanitizeProfile(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const now = Date.now();
  const input = Array.isArray(profile.flows) ? profile.flows : [];
  const map = new Map();
  for (const flow of input) {
    if (!flow?.locator || !flow?.fingerprint) continue;
    const ts = Number(flow.ts || 0);
    if (!Number.isFinite(ts) || now - ts > PROFILE_TTL_MS) continue;
    const key = `${flow.fingerprint}|${locatorKey(flow.locator)}`;
    const prev = map.get(key);
    const clean = {
      fingerprint: String(flow.fingerprint).slice(0, 520),
      locator: flow.locator,
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
    if (!flow?.locator || !flow?.fingerprint) continue;
    const key = `${flow.fingerprint}|${locatorKey(flow.locator)}`;
    const prev = map.get(key);
    if (!prev) map.set(key, { ...flow });
    else {
      prev.ts = Math.max(Number(prev.ts || 0), Number(flow.ts || 0));
      prev.successes = Math.max(Number(prev.successes || 0), Number(flow.successes || 0));
      prev.failures = Math.min(Number(prev.failures || 0), Number(flow.failures || 0));
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
  try { index = (await chrome.storage.local.get(PROFILE_INDEX_KEY))?.[PROFILE_INDEX_KEY] || {}; } catch (_) {}
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

  if (message.type !== 'AUTO_AGREE_GATE' && message.type !== 'AUTO_AGREE_ACTIVATE') return false;

  const target = targetFor(sender);
  if (!target) {
    sendResponse({ ok: false, error: 'missing-target' });
    return false;
  }

  const key = sender.documentId || `${target.tabId}:${sender.frameId ?? 0}`;
  const isGate = message.type === 'AUTO_AGREE_GATE';
  const map = isGate ? gateInflight : engineInflight;
  const file = isGate ? 'gate.js' : 'engine.js';
  let promise = map.get(key);
  if (!promise) {
    promise = chrome.scripting.executeScript({
      target,
      files: [file],
      world: 'ISOLATED',
      injectImmediately: true
    }).finally(() => map.delete(key));
    map.set(key, promise);
  }

  promise.then(
    () => sendResponse({ ok: true }),
    error => sendResponse({ ok: false, error: String(error?.message || error) })
  );
  return true;
});
