(() => {
  'use strict';

  const CONFIG = Object.freeze({
    hotCacheMax: 32,
    maxOrigins: 256,
    maxFlows: 8,
    ttlMs: 180 * 24 * 60 * 60 * 1000,
    maxFingerprintLength: 520,
    maxSelectorLength: 420,
    maxHosts: 8,
    maxHostLength: 360,
    maxSuccesses: 100000,
    maxFailures: 1000,
    maxSeverity: 4,
    maxLinkBucket: 2
  });

  const CONTROL = /[\u0000-\u001f]/;
  const KINDS = new Set(['native', 'aria', 'data', 'class', 'custom', 'unknown']);

  function finiteNumber(value, fallback = 0) {
    try {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    } catch (_) { return fallback; }
  }

  function boundedNumber(value, min, max, fallback = min) {
    const n = finiteNumber(value, fallback);
    return Math.max(min, Math.min(max, n));
  }

  function sanitizeLocator(locator) {
    if (!locator || typeof locator !== 'object') return null;
    const selector = typeof locator.selector === 'string' ? locator.selector.trim() : '';
    if (!selector || selector.length > CONFIG.maxSelectorLength || CONTROL.test(selector)) return null;
    if (!Array.isArray(locator.hosts) || locator.hosts.length > CONFIG.maxHosts) return null;
    const hosts = [];
    for (const raw of locator.hosts) {
      if (typeof raw !== 'string') return null;
      const value = raw.trim();
      if (!value || value.length > CONFIG.maxHostLength || CONTROL.test(value)) return null;
      hosts.push(value);
    }
    return { hosts, selector };
  }

  function locatorKey(locator) {
    const clean = sanitizeLocator(locator);
    if (!clean) return '';
    try { return JSON.stringify(clean); } catch (_) { return ''; }
  }

  function sanitizeFingerprint(value) {
    if (typeof value !== 'string') return '';
    return value.slice(0, CONFIG.maxFingerprintLength);
  }

  function sanitizeDescriptor(descriptor) {
    if (!descriptor || typeof descriptor !== 'object') return null;
    const kind = KINDS.has(descriptor.kind) ? descriptor.kind : 'unknown';
    return {
      kind,
      severity: boundedNumber(descriptor.severity, 0, CONFIG.maxSeverity, 0),
      legal: !!descriptor.legal,
      assent: !!descriptor.assent,
      required: !!descriptor.required,
      auth: !!descriptor.auth,
      linkBucket: boundedNumber(descriptor.linkBucket, 0, CONFIG.maxLinkBucket, 0)
    };
  }

  function descriptorCompatible(stored, live, optionalSeverity) {
    if (!stored || typeof stored !== 'object') return true;
    if (!live || typeof live !== 'object' || !Number.isFinite(optionalSeverity)) return false;
    const historical = sanitizeDescriptor(stored);
    const current = sanitizeDescriptor(live);
    if (!historical || !current) return false;
    if (historical.severity >= optionalSeverity) return false;
    if (historical.kind !== 'unknown' && current.kind !== historical.kind) return false;
    if (historical.legal && !current.legal) return false;
    if (historical.required && !current.required && !current.assent) return false;
    if (historical.linkBucket > current.linkBucket + 1) return false;
    return true;
  }

  function sanitizeFlow(flow, now = Date.now()) {
    if (!flow || typeof flow !== 'object') return null;
    const locator = sanitizeLocator(flow.locator);
    const fingerprint = sanitizeFingerprint(flow.fingerprint);
    if (!locator || !fingerprint) return null;
    const ts = finiteNumber(flow.ts, NaN);
    const current = finiteNumber(now, Date.now());
    if (!Number.isFinite(ts) || ts > current || current - ts > CONFIG.ttlMs) return null;
    return {
      fingerprint,
      locator,
      descriptor: sanitizeDescriptor(flow.descriptor),
      successes: boundedNumber(flow.successes, 0, CONFIG.maxSuccesses, 0),
      failures: boundedNumber(flow.failures, 0, CONFIG.maxFailures, 0),
      ts
    };
  }

  function flowIdentity(flow) {
    const locator = sanitizeLocator(flow?.locator);
    const fingerprint = sanitizeFingerprint(flow?.fingerprint);
    if (!locator || !fingerprint) return '';
    const locatorPart = locatorKey(locator);
    return locatorPart ? `${fingerprint}|${locatorPart}` : '';
  }

  function sanitizeProfile(profile, { version = '', now = Date.now() } = {}) {
    if (!profile || typeof profile !== 'object') return null;
    const map = new Map();
    const input = Array.isArray(profile.flows) ? profile.flows : [];
    for (const raw of input) {
      const clean = sanitizeFlow(raw, now);
      if (!clean) continue;
      const key = flowIdentity(clean);
      const prev = map.get(key);
      if (!prev || clean.ts > prev.ts) map.set(key, clean);
    }
    const flows = [...map.values()].sort((a, b) => b.ts - a.ts).slice(0, CONFIG.maxFlows);
    return flows.length ? { version: String(version || ''), flows } : null;
  }

  function mergeProfiles(current, incoming, { version = '', now = Date.now() } = {}) {
    const left = sanitizeProfile(current, { version, now });
    const right = sanitizeProfile(incoming, { version, now });
    const all = [...(left?.flows || []), ...(right?.flows || [])];
    const map = new Map();
    for (const flow of all) {
      const key = flowIdentity(flow);
      if (!key) continue;
      const next = { ...flow, locator: { hosts: [...flow.locator.hosts], selector: flow.locator.selector } };
      const prev = map.get(key);
      if (!prev || next.ts > prev.ts) map.set(key, next);
      else if (next.ts === prev.ts) {
        prev.successes = Math.max(prev.successes, next.successes);
        prev.failures = Math.max(prev.failures, next.failures);
      } else {
        prev.successes = Math.max(prev.successes, next.successes);
      }
    }
    return sanitizeProfile({ flows: [...map.values()] }, { version, now });
  }

  function compactOriginIndex(index, origin, now = Date.now()) {
    const current = finiteNumber(now, Date.now());
    const entries = new Map();
    if (index && typeof index === 'object') {
      for (const [key, rawTs] of Object.entries(index)) {
        if (typeof key !== 'string' || !key || key === '__proto__' || key === 'prototype' || key === 'constructor') continue;
        const ts = finiteNumber(rawTs, NaN);
        if (!Number.isFinite(ts) || ts > current) continue;
        entries.set(key, ts);
      }
    }
    if (typeof origin === 'string' && origin && origin !== 'null') entries.set(origin, current);
    const ordered = [...entries.entries()].sort((a, b) => b[1] - a[1]);
    const keep = ordered.slice(0, CONFIG.maxOrigins);
    const drop = ordered.slice(CONFIG.maxOrigins).map(([key]) => key);
    return { index: Object.fromEntries(keep), drop };
  }

  // Intentionally overwrite the global on every injection. The core is immutable and stateless;
  // old worlds keep their captured object while a newly injected consumer captures this object.
  // A stale singleton must never make a post-update world reuse old profile semantics.
  globalThis.__AUTO_AGREE_PROFILE_CORE__ = Object.freeze({
    CONFIG,
    sanitizeLocator,
    locatorKey,
    sanitizeDescriptor,
    descriptorCompatible,
    sanitizeFlow,
    flowIdentity,
    sanitizeProfile,
    mergeProfiles,
    compactOriginIndex
  });
})();
