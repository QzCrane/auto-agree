'use strict';

const engineInflight = new Map();
const gateInflight = new Map();
const profileCache = new Map();
const PROFILE_PREFIX = 'site:';
const PROFILE_INDEX_KEY = '__auto_agree_profile_index__';
const LEGACY_PROFILE_INDEX_KEYS = ['__auto_agree_profile_index_v5__', '__auto_agree_profile_index_v4__', '__auto_agree_profile_index_v3__'];
if (!globalThis.__AUTO_AGREE_SCHEDULER_CORE__ && typeof importScripts === 'function') importScripts('scheduler-core.js');
const SCHEDULER = globalThis.__AUTO_AGREE_SCHEDULER_CORE__;
if (!SCHEDULER) throw new Error('scheduler-core-missing');
if (!globalThis.__AUTO_AGREE_PROFILE_CORE__ && typeof importScripts === 'function') importScripts('profile-core.js');
const PROFILE = globalThis.__AUTO_AGREE_PROFILE_CORE__;
if (!PROFILE) throw new Error('profile-core-missing');
const {
  maxGlobal: INJECTION_MAX_GLOBAL,
  maxPerTab: INJECTION_MAX_PER_TAB,
  queueMax: INJECTION_QUEUE_MAX,
  agingMs: INJECTION_AGING_MS,
  staleMs: INJECTION_STALE_MS
} = SCHEDULER.CONFIG;
const {
  hotCacheMax: PROFILE_CACHE_MAX,
  maxOrigins: PROFILE_ORIGIN_MAX
} = PROFILE.CONFIG;
const REHYDRATE_KEY = '__auto_agree_update_rehydrate__';
const injectionQueue = [];
const injectionActiveByTab = new Map();
let injectionActive = 0;
let injectionSeq = 0;
let lastScheduledTab = -1;
const VERSION = chrome.runtime.getManifest().version;
/** @type {Promise<boolean | void>} */
let storageWriteChain = Promise.resolve();
let rehydratePromise = null;

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
    const value = PROFILE.sanitizeProfile(session?.[key], { version: VERSION });
    if (value) return cacheProfile(key, value);
  } catch (_) {}
  try {
    const local = await chrome.storage.local.get(key);
    const value = PROFILE.sanitizeProfile(local?.[key], { version: VERSION });
    cacheProfile(key, value);
    if (value) {
      try { await chrome.storage.session?.set({ [key]: value }); } catch (_) {}
    }
    return value;
  } catch (_) { return null; }
}

async function updateProfileIndex(origin) {
  const combined = Object.create(null);
  try {
    const keys = [PROFILE_INDEX_KEY, ...LEGACY_PROFILE_INDEX_KEYS];
    const stored = await chrome.storage.local.get(keys);
    for (const key of keys) {
      const entry = stored?.[key];
      if (!entry || typeof entry !== 'object') continue;
      for (const [storedOrigin, ts] of Object.entries(entry)) combined[storedOrigin] = ts;
    }
    if (LEGACY_PROFILE_INDEX_KEYS.some(key => stored?.[key])) {
      try { await chrome.storage.local.remove(LEGACY_PROFILE_INDEX_KEYS); } catch (_) {}
    }
  } catch (_) {}
  const compacted = PROFILE.compactOriginIndex(combined, origin);
  await chrome.storage.local.set({ [PROFILE_INDEX_KEY]: compacted.index });
  if (compacted.drop.length) {
    const keys = compacted.drop.map(oldOrigin => `${PROFILE_PREFIX}${oldOrigin}`);
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
  if (!origin || origin === 'null') return Promise.resolve(false);
  const targetKey = PROFILE.flowIdentity(payload);
  if (!targetKey) return Promise.resolve(false);
  const task = async () => {
    const key = `${PROFILE_PREFIX}${origin}`;
    const current = await getProfile(origin);
    if (!current?.flows?.length) return false;
    const flows = current.flows.filter(flow => PROFILE.flowIdentity(flow) !== targetKey);
    const next = PROFILE.sanitizeProfile({ flows }, { version: VERSION });
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
    const merged = PROFILE.mergeProfiles(current, profile, { version: VERSION });
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

function effectivePriority(job, now = Date.now()) {
  return SCHEDULER.effectivePriority(job, now);
}

function pruneStaleInjectionJobs(now = Date.now()) {
  for (let i = injectionQueue.length - 1; i >= 0; i--) {
    const job = injectionQueue[i];
    if (!SCHEDULER.isStale(job, now)) continue;
    injectionQueue.splice(i, 1);
    try { job.reject(new Error('injection-stale')); } catch (_) {}
  }
}

function pickNextInjectionIndex(now = Date.now()) {
  pruneStaleInjectionJobs(now);
  return SCHEDULER.pickNextIndex(injectionQueue, injectionActiveByTab, lastScheduledTab, now);
}

function finishInjection(job) {
  injectionActive = Math.max(0, injectionActive - 1);
  const tabId = job.target.tabId;
  const next = Math.max(0, (injectionActiveByTab.get(tabId) || 1) - 1);
  if (next) injectionActiveByTab.set(tabId, next); else injectionActiveByTab.delete(tabId);
  drainInjectionQueue();
}

function drainInjectionQueue() {
  while (injectionActive < INJECTION_MAX_GLOBAL && injectionQueue.length) {
    const index = pickNextInjectionIndex();
    if (index < 0) return;
    const [job] = injectionQueue.splice(index, 1);
    const tabId = job.target.tabId;
    lastScheduledTab = tabId;
    injectionActive++;
    injectionActiveByTab.set(tabId, (injectionActiveByTab.get(tabId) || 0) + 1);
    chrome.scripting.executeScript({ target: job.target, files: job.files, world: 'ISOLATED', injectImmediately: true })
      .then(job.resolve, job.reject)
      .finally(() => finishInjection(job));
  }
}

function makeQueueRoom(priority, now = Date.now()) {
  pruneStaleInjectionJobs(now);
  if (injectionQueue.length < INJECTION_QUEUE_MAX) return true;
  if (priority <= 1) return false;
  const victim = SCHEDULER.pickPreemptionIndex(injectionQueue, priority, now);
  if (victim < 0) return false;
  const [dropped] = injectionQueue.splice(victim, 1);
  try { dropped.reject(new Error('injection-preempted')); } catch (_) {}
  return true;
}

function scheduleInjection(target, files, priority) {
  const now = Date.now();
  if (!makeQueueRoom(priority, now)) return Promise.reject(new Error('injection-queue-full'));
  return new Promise((resolve, reject) => {
    injectionQueue.push({ target, files, priority, resolve, reject, queuedAt: now, seq: injectionSeq++ });
    drainInjectionQueue();
  });
}

function senderLifecycleAllowed(sender) {
  const state = sender?.documentLifecycle;
  return !state || state === 'active';
}

function profileOriginForSender(sender) {
  for (const raw of [sender?.origin, sender?.url]) {
    if (typeof raw !== 'string' || !raw || raw === 'null') continue;
    try {
      const parsed = new URL(raw);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.origin;
    } catch (_) {}
  }
  return null;
}

async function protectAndRehydrateTab(tabId) {
  const target = { tabId, allFrames: true };
  await scheduleInjection(target, ['runtime-kernel.js', 'generation-lease.js', 'semantic-core.js', 'dom-core.js', 'handover-guard.js'], 4);
  await scheduleInjection(target, ['bootstrap.js'], 3);
}

async function rehydrateExistingTabs() {
  if (!chrome.tabs?.query) return;
  let tabs = [];
  try { tabs = await chrome.tabs.query({}); } catch (_) { return; }
  let pending = [...new Set(tabs.map(tab => tab?.id).filter(Number.isInteger))];
  for (let pass = 0; pass < 2 && pending.length; pass++) {
    const retry = [];
    for (let i = 0; i < pending.length; i += 12) {
      const ids = pending.slice(i, i + 12);
      const results = await Promise.allSettled(ids.map(tabId => protectAndRehydrateTab(tabId)));
      for (let j = 0; j < results.length; j++) if (results[j].status === 'rejected') retry.push(ids[j]);
    }
    pending = retry;
    if (pending.length && pass === 0) await new Promise(resolve => setTimeout(resolve, 180));
  }
}

async function startUpdateRehydrate() {
  const marker = { version: VERSION, ts: Date.now() };
  try { await chrome.storage.session?.set({ [REHYDRATE_KEY]: marker }); } catch (_) {}
  try { await rehydrateExistingTabs(); }
  finally { try { await chrome.storage.session?.remove(REHYDRATE_KEY); } catch (_) {} }
}

function requestUpdateRehydrate() {
  if (!rehydratePromise) rehydratePromise = startUpdateRehydrate().finally(() => { rehydratePromise = null; });
  return rehydratePromise;
}

chrome.runtime.onInstalled?.addListener?.(details => {
  if (details?.reason === 'update') void requestUpdateRehydrate();
});

void (async () => {
  try {
    const stored = await chrome.storage.session?.get(REHYDRATE_KEY);
    const resumeMarker = stored?.[REHYDRATE_KEY];
    if (resumeMarker && typeof resumeMarker === 'object' && 'version' in resumeMarker && resumeMarker.version === VERSION) {
      await requestUpdateRehydrate();
    }
  } catch (_) {}
})();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') return false;
  if (!senderLifecycleAllowed(sender)) {
    sendResponse({ ok: false, error: `inactive-document:${sender.documentLifecycle}` });
    return false;
  }

  const profileOrigin = profileOriginForSender(sender);
  const isProfileMessage = message.type === 'AUTO_AGREE_PROFILE_GET' || message.type === 'AUTO_AGREE_PROFILE_PUT' || message.type === 'AUTO_AGREE_PROFILE_INVALIDATE';
  if (isProfileMessage && !profileOrigin) {
    sendResponse({ ok: false, error: 'missing-profile-origin' });
    return false;
  }

  if (message.type === 'AUTO_AGREE_PROFILE_GET') {
    getProfile(profileOrigin).then(
      profile => sendResponse({ ok: true, profile }),
      error => sendResponse({ ok: false, error: String(error?.message || error) })
    );
    return true;
  }

  if (message.type === 'AUTO_AGREE_PROFILE_PUT') {
    putProfile(profileOrigin, message.profile).then(
      () => sendResponse({ ok: true }),
      error => sendResponse({ ok: false, error: String(error?.message || error) })
    );
    return true;
  }

  if (message.type === 'AUTO_AGREE_PROFILE_INVALIDATE') {
    invalidateProfileFlow(profileOrigin, message.profile).then(
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
  const files = isGate
    ? ['runtime-kernel.js', 'generation-lease.js', 'semantic-core.js', 'gate.js']
    : ['runtime-kernel.js', 'generation-lease.js', 'semantic-core.js', 'dom-core.js', 'handover-guard.js', 'decision-core.js', 'profile-core.js', 'risk-core.js', 'engine.js'];
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
