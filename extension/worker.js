const VERSION = '10.0.0';
const PROFILE_PREFIX = 'site:';
const PROFILE_MAX = 128;
const PROFILE_TTL_MS = 21 * 24 * 60 * 60 * 1000;
const INJECTION_MAX_GLOBAL = 4;
const INJECTION_MAX_PER_TAB = 2;
const INJECTION_QUEUE_MAX = 64;
const INJECTION_AGING_MS = 1800;
const INJECTION_STALE_MS = 12_000;
const REHYDRATE_KEY = '__auto_agree_update_rehydrate__';
const gateInflight = new Map();
const engineInflight = new Map();
const profileCache = new Map();
const injectionQueue = [];
const injectionActiveByTab = new Map();
let injectionActive = 0;
let injectionSeq = 0;
let lastScheduledTab = null;
let storageWriteChain = Promise.resolve();
let rehydratePromise = null;

function targetFor(sender) {
  const tabId = sender?.tab?.id;
  if (!Number.isInteger(tabId)) return null;
  const target = { tabId };
  if (sender.documentId) target.documentIds = [sender.documentId];
  else if (Number.isInteger(sender.frameId)) target.frameIds = [sender.frameId];
  return target;
}

function cleanOrigin(raw) {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch (_) { return ''; }
}

function profileKey(origin) {
  const clean = cleanOrigin(origin);
  return clean ? PROFILE_PREFIX + clean : '';
}

function sanitizeLocator(locator) {
  if (!locator || typeof locator !== 'object') return null;
  const hosts = Array.isArray(locator.hosts) ? locator.hosts.filter(x => typeof x === 'string' && x.length < 160).slice(0, 8) : [];
  const selector = typeof locator.selector === 'string' && locator.selector.length < 360 ? locator.selector : '';
  if (!selector) return null;
  return { hosts, selector };
}

function sanitizeDescriptor(value) {
  if (!value || typeof value !== 'object') return null;
  const kind = typeof value.kind === 'string' ? value.kind.slice(0, 24) : '';
  const severity = Number.isInteger(value.severity) ? Math.max(0, Math.min(4, value.severity)) : 0;
  const linkBucket = Number.isInteger(value.linkBucket) ? Math.max(0, Math.min(4, value.linkBucket)) : 0;
  return {
    kind,
    severity,
    legal: !!value.legal,
    assent: !!value.assent,
    required: !!value.required,
    auth: !!value.auth,
    linkBucket
  };
}

function sanitizeFlow(flow) {
  if (!flow || typeof flow !== 'object') return null;
  const fingerprint = typeof flow.fingerprint === 'string' ? flow.fingerprint.slice(0, 220) : '';
  const locator = sanitizeLocator(flow.locator);
  const descriptor = sanitizeDescriptor(flow.descriptor);
  if (!fingerprint || !locator || !descriptor) return null;
  return {
    fingerprint,
    locator,
    descriptor,
    successes: Math.max(0, Math.min(10000, Number(flow.successes) || 0)),
    failures: Math.max(0, Math.min(10000, Number(flow.failures) || 0)),
    ts: Number(flow.ts) || Date.now()
  };
}

function sanitizeProfile(value) {
  if (!value || typeof value !== 'object') return { version: VERSION, flows: [] };
  const flows = Array.isArray(value.flows) ? value.flows.map(sanitizeFlow).filter(Boolean).slice(0, 32) : [];
  return { version: VERSION, flows };
}

function cacheProfile(key, profile) {
  if (!key) return;
  profileCache.delete(key);
  profileCache.set(key, profile);
  while (profileCache.size > PROFILE_MAX) profileCache.delete(profileCache.keys().next().value);
}

async function getProfile(origin) {
  const key = profileKey(origin);
  if (!key) return { version: VERSION, flows: [] };
  const cached = profileCache.get(key);
  if (cached) {
    cacheProfile(key, cached);
    return cached;
  }
  let stored = null;
  try {
    const result = await chrome.storage.local.get(key);
    stored = result?.[key];
  } catch (_) {}
  const profile = sanitizeProfile(stored);
  const cutoff = Date.now() - PROFILE_TTL_MS;
  profile.flows = profile.flows.filter(flow => flow.ts >= cutoff);
  cacheProfile(key, profile);
  return profile;
}

function putProfile(origin, incoming) {
  const key = profileKey(origin);
  if (!key) return Promise.resolve();
  const next = sanitizeProfile(incoming);
  storageWriteChain = storageWriteChain.then(async () => {
    const current = await getProfile(origin);
    const byId = new Map(current.flows.map(flow => [flow.fingerprint, flow]));
    for (const flow of next.flows) {
      const prior = byId.get(flow.fingerprint);
      if (!prior || flow.ts >= prior.ts) byId.set(flow.fingerprint, flow);
    }
    const merged = { version: VERSION, flows: [...byId.values()].sort((a, b) => b.ts - a.ts).slice(0, 32) };
    cacheProfile(key, merged);
    await chrome.storage.local.set({ [key]: merged });
  }).catch(() => {});
  return storageWriteChain;
}

function invalidateProfileFlow(origin, incoming) {
  const key = profileKey(origin);
  if (!key) return Promise.resolve();
  const target = sanitizeFlow(incoming);
  storageWriteChain = storageWriteChain.then(async () => {
    const current = await getProfile(origin);
    if (!target) return;
    current.flows = current.flows.filter(flow => flow.fingerprint !== target.fingerprint);
    cacheProfile(key, current);
    await chrome.storage.local.set({ [key]: current });
  }).catch(() => {});
  return storageWriteChain;
}

function effectivePriority(job, now = Date.now()) {
  const age = Math.max(0, now - job.queuedAt);
  const boost = Math.min(3, Math.floor(age / INJECTION_AGING_MS));
  return job.priority + boost;
}

function pruneStaleInjectionJobs(now = Date.now()) {
  for (let i = injectionQueue.length - 1; i >= 0; i--) {
    const job = injectionQueue[i];
    if (now - job.queuedAt <= INJECTION_STALE_MS) continue;
    injectionQueue.splice(i, 1);
    try { job.reject(new Error('injection-stale')); } catch (_) {}
  }
}

function pickNextInjectionIndex(now = Date.now()) {
  pruneStaleInjectionJobs(now);
  let best = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < injectionQueue.length; i++) {
    const job = injectionQueue[i];
    const tabId = job.target.tabId;
    if ((injectionActiveByTab.get(tabId) || 0) >= INJECTION_MAX_PER_TAB) continue;
    const score = effectivePriority(job, now);
    if (score > bestScore) { best = i; bestScore = score; continue; }
    if (score < bestScore || best < 0) continue;
    const prior = injectionQueue[best];
    const jobRotates = tabId !== lastScheduledTab;
    const priorRotates = prior.target.tabId !== lastScheduledTab;
    if (jobRotates !== priorRotates) { if (jobRotates) best = i; continue; }
    if (job.queuedAt < prior.queuedAt || (job.queuedAt === prior.queuedAt && job.seq < prior.seq)) best = i;
  }
  return best;
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
  let victim = -1;
  for (let i = 0; i < injectionQueue.length; i++) {
    const job = injectionQueue[i];
    if (job.priority >= priority) continue;
    if (victim < 0) { victim = i; continue; }
    const current = injectionQueue[victim];
    const jobScore = effectivePriority(job, now);
    const currentScore = effectivePriority(current, now);
    if (jobScore < currentScore || (jobScore === currentScore && job.queuedAt > current.queuedAt)) victim = i;
  }
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
  // Phase 1 is the authority boundary. semantic-core.js is deliberately first so the guard consumes
  // the exact same multilingual semantics as Gate/Engine. Bootstrap never runs if protection fails.
  await scheduleInjection(target, ['semantic-core.js', 'handover-guard.js'], 4);
  // Phase 2 is replayable recovery. A retry may harmlessly repeat the idempotent protection phase.
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
    if (stored?.[REHYDRATE_KEY]?.version === VERSION) await requestUpdateRehydrate();
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
  const files = isGate ? ['semantic-core.js', 'gate.js'] : ['semantic-core.js', 'risk-core.js', 'engine.js'];
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