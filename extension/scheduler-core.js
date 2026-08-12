(() => {
  'use strict';
  if (globalThis.__AUTO_AGREE_SCHEDULER_CORE__) return;

  const CONFIG = Object.freeze({
    maxGlobal: 4,
    maxPerTab: 2,
    queueMax: 64,
    agingMs: 1200,
    staleMs: 15000,
    maxAgingBoost: 3
  });

  function number(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function effectivePriority(job, now = Date.now(), config = CONFIG) {
    const queuedAt = number(job?.queuedAt, now);
    const age = Math.max(0, number(now) - queuedAt);
    const agingMs = Math.max(1, number(config?.agingMs, CONFIG.agingMs));
    const maxBoost = Math.max(0, Math.floor(number(config?.maxAgingBoost, CONFIG.maxAgingBoost)));
    const boost = Math.min(maxBoost, Math.floor(age / agingMs));
    return number(job?.priority) + boost;
  }

  function isStale(job, now = Date.now(), config = CONFIG) {
    const queuedAt = number(job?.queuedAt, now);
    return number(now) - queuedAt > Math.max(0, number(config?.staleMs, CONFIG.staleMs));
  }

  function activeForTab(activeByTab, tabId) {
    if (!activeByTab) return 0;
    try {
      if (typeof activeByTab.get === 'function') return Math.max(0, number(activeByTab.get(tabId)));
      return Math.max(0, number(activeByTab[tabId]));
    } catch (_) { return 0; }
  }

  function pickNextIndex(queue, activeByTab, lastScheduledTab, now = Date.now(), config = CONFIG) {
    if (!Array.isArray(queue) || !queue.length) return -1;
    const maxPerTab = Math.max(1, Math.floor(number(config?.maxPerTab, CONFIG.maxPerTab)));
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < queue.length; i++) {
      const job = queue[i];
      const tabId = job?.target?.tabId;
      if (activeForTab(activeByTab, tabId) >= maxPerTab) continue;
      const score = effectivePriority(job, now, config);
      if (score > bestScore) { best = i; bestScore = score; continue; }
      if (score < bestScore || best < 0) continue;
      const prior = queue[best];
      const jobRotates = tabId !== lastScheduledTab;
      const priorRotates = prior?.target?.tabId !== lastScheduledTab;
      if (jobRotates !== priorRotates) { if (jobRotates) best = i; continue; }
      const queuedAt = number(job?.queuedAt);
      const priorQueuedAt = number(prior?.queuedAt);
      const seq = number(job?.seq);
      const priorSeq = number(prior?.seq);
      if (queuedAt < priorQueuedAt || (queuedAt === priorQueuedAt && seq < priorSeq)) best = i;
    }
    return best;
  }

  function pickPreemptionIndex(queue, incomingPriority, now = Date.now(), config = CONFIG) {
    if (!Array.isArray(queue) || !queue.length) return -1;
    let victim = -1;
    const incoming = number(incomingPriority);
    for (let i = 0; i < queue.length; i++) {
      const job = queue[i];
      if (number(job?.priority) >= incoming) continue;
      if (victim < 0) { victim = i; continue; }
      const current = queue[victim];
      const jobScore = effectivePriority(job, now, config);
      const currentScore = effectivePriority(current, now, config);
      if (jobScore < currentScore || (jobScore === currentScore && number(job?.queuedAt) > number(current?.queuedAt))) victim = i;
    }
    return victim;
  }

  globalThis.__AUTO_AGREE_SCHEDULER_CORE__ = Object.freeze({
    CONFIG,
    effectivePriority,
    isStale,
    pickNextIndex,
    pickPreemptionIndex
  });
})();
