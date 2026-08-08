'use strict';

const inflight = new Map();
const profileCache = new Map();
const PROFILE_PREFIX = 'site:';
const PROFILE_CACHE_MAX = 32;

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

async function getProfile(origin) {
  if (!origin || origin === 'null') return null;
  const key = `${PROFILE_PREFIX}${origin}`;
  const hot = cachedProfile(key);
  if (hot !== undefined) return hot;
  try {
    const session = await chrome.storage.session?.get(key);
    if (session?.[key]) {
      return cacheProfile(key, session[key]);
    }
  } catch (_) {}
  try {
    const local = await chrome.storage.local.get(key);
    const value = local?.[key] || null;
    if (value) {
      cacheProfile(key, value);
      try { await chrome.storage.session?.set({ [key]: value }); } catch (_) {}
    }
    return value;
  } catch (_) { return null; }
}

async function putProfile(origin, profile) {
  if (!origin || origin === 'null' || !profile) return false;
  const key = `${PROFILE_PREFIX}${origin}`;
  cacheProfile(key, profile);
  try { await chrome.storage.session?.set({ [key]: profile }); } catch (_) {}
  await chrome.storage.local.set({ [key]: profile });
  return true;
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

  if (message.type !== 'AUTO_AGREE_ACTIVATE') return false;

  const target = targetFor(sender);
  if (!target) {
    sendResponse({ ok: false, error: 'missing-target' });
    return false;
  }

  const key = sender.documentId || `${target.tabId}:${sender.frameId ?? 0}`;
  let promise = inflight.get(key);
  if (!promise) {
    promise = chrome.scripting.executeScript({
      target,
      files: ['engine.js'],
      world: 'ISOLATED',
      injectImmediately: true
    }).finally(() => inflight.delete(key));
    inflight.set(key, promise);
  }

  promise.then(
    () => sendResponse({ ok: true }),
    error => sendResponse({ ok: false, error: String(error?.message || error) })
  );
  return true;
});
