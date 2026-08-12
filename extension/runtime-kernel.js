(() => {
  'use strict';

  // This is the single birth-generation literal for isolated-world runtime modules. Other
  // production modules snapshot this value when they initialize instead of carrying independent
  // release strings. A stale execution world therefore retains the generation it was born with.
  const VERSION = '11.0.0';
  if (globalThis.__AUTO_AGREE_RUNTIME_KERNEL__?.version === VERSION) return;

  function objectScope(value) {
    return value !== null && (typeof value === 'object' || typeof value === 'function');
  }

  /**
   * Bounded FIFO admission with one weak recovery representation.
   *
   * Domain code owns traversal and job shape. The kernel owns only the cross-cutting invariant:
   * already-admitted FIFO jobs are never evicted merely to admit newer work; new overflow may be
   * weakly compressed into one domain-defined final-state scope.
   *
   * @param {{
   *   capacity: number,
   *   isLive: (scope: object) => boolean,
   *   coalesce?: (currentScope: object, nextScope: object, currentMeta: unknown, nextMeta: unknown) => {scope: object, meta?: unknown} | null
   * }} options
   */
  function createBoundedFifo(options) {
    const capacity = options?.capacity;
    const isLive = options?.isLive;
    const coalesce = options?.coalesce;
    if (!Number.isInteger(capacity) || capacity < 1) throw new TypeError('bounded-work-capacity');
    if (typeof isLive !== 'function') throw new TypeError('bounded-work-isLive');
    if (coalesce != null && typeof coalesce !== 'function') throw new TypeError('bounded-work-coalesce');

    const queue = [];
    let recoveryRef = null;
    let recoveryMeta;
    let recoveryPresent = false;

    function live(scope) {
      if (!objectScope(scope)) return false;
      try { return isLive(scope) === true; } catch (_) { return false; }
    }

    function clearRecovery() {
      recoveryRef = null;
      recoveryMeta = undefined;
      recoveryPresent = false;
    }

    function remember(scope, meta) {
      if (!live(scope)) return false;
      let mergedScope = scope;
      let mergedMeta = meta;
      const current = recoveryRef?.deref?.();
      if (current && live(current)) {
        if (coalesce) {
          let merged = null;
          try { merged = coalesce(current, scope, recoveryMeta, meta); } catch (_) { return false; }
          if (!merged || !objectScope(merged.scope)) return false;
          mergedScope = merged.scope;
          mergedMeta = merged.meta;
        } else {
          mergedScope = current;
          mergedMeta = recoveryMeta;
        }
      }
      if (!live(mergedScope)) return false;
      recoveryRef = new WeakRef(mergedScope);
      recoveryMeta = mergedMeta;
      recoveryPresent = true;
      return true;
    }

    function admit(job, scope, meta) {
      if (queue.length >= capacity) return { admitted: false, recovered: remember(scope, meta) };
      queue.push(job);
      return { admitted: true, recovered: false };
    }

    function takeRecovery() {
      if (!recoveryPresent) return null;
      const scope = recoveryRef?.deref?.();
      const meta = recoveryMeta;
      clearRecovery();
      return live(scope) ? { scope, meta } : null;
    }

    function promote(makeJob) {
      if (queue.length || typeof makeJob !== 'function') return false;
      const pending = takeRecovery();
      if (!pending) return false;
      const job = makeJob(pending.scope, pending.meta);
      if (!job) return false;
      queue.push(job);
      return true;
    }

    function clear() {
      queue.length = 0;
      clearRecovery();
    }

    const api = {
      capacity,
      queue,
      admit,
      remember,
      promote,
      clearRecovery,
      clear,
      get hasRecovery() {
        if (!recoveryPresent) return false;
        const scope = recoveryRef?.deref?.();
        if (live(scope)) return true;
        clearRecovery();
        return false;
      }
    };
    return Object.freeze(api);
  }

  /**
   * Refresh age metadata when the TTL boundary is crossed. This function deliberately does not
   * decide whether a job is live or obsolete; callers with an owner/root must use refreshLiveAge.
   * RootBatch-like aggregate work that has no single owner may use this primitive while its normal
   * traversal independently skips dead WeakRefs.
   *
   * @param {{createdAt?: number}} job
   * @param {number} ttlMs
   * @param {number} [now]
   * @returns {boolean} true only when createdAt was refreshed
   */
  function touchExpiredAge(job, ttlMs, now = performance.now()) {
    if (!job || !Number.isFinite(ttlMs) || ttlMs < 0) return false;
    if (!Number.isFinite(now)) now = performance.now();
    const createdAt = Number(job.createdAt);
    if (Number.isFinite(createdAt) && now - createdAt <= ttlMs) return false;
    job.createdAt = now;
    return true;
  }

  /**
   * Age is liveness metadata, not obsolescence authority. A dead/disconnected owner returns false;
   * a live owner refreshes an expired age and preserves the caller's existing cursor/state.
   *
   * @param {{createdAt?: number}} job
   * @param {number} ttlMs
   * @param {object | null | undefined} owner
   * @param {(owner: object) => boolean} isLive
   * @param {number} [now]
   */
  function refreshLiveAge(job, ttlMs, owner, isLive, now = performance.now()) {
    if (!job || !objectScope(owner) || typeof isLive !== 'function') return false;
    let live = false;
    try { live = isLive(owner) === true; } catch (_) { return false; }
    if (!live) return false;
    touchExpiredAge(job, ttlMs, now);
    return true;
  }

  globalThis.__AUTO_AGREE_RUNTIME_KERNEL__ = Object.freeze({
    version: VERSION,
    createBoundedFifo,
    touchExpiredAge,
    refreshLiveAge
  });
})();