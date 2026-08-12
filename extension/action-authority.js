(() => {
  'use strict';
  const KERNEL = globalThis.__AUTO_AGREE_RUNTIME_KERNEL__;
  const VERSION = KERNEL?.version;
  if (!KERNEL || !VERSION) return;
  if (globalThis.__AUTO_AGREE_ACTION_AUTHORITY__?.version === VERSION) return;

  function attemptClick(target) {
    if (!(target instanceof HTMLElement)) return false;

    // A stale generation must not mint a fresh handover authorization token. Re-checking the
    // generation again inside the patched HTMLElement.click remains the final race backstop.
    const lease = globalThis.__AUTO_AGREE_GENERATION_LEASE__;
    if (!lease || lease.version !== VERSION || typeof lease.current !== 'function') return false;
    try { if (lease.current() !== true) return false; } catch (_) { return false; }

    const guard = globalThis.__AUTO_AGREE_HANDOVER_GUARD__;
    if (!guard || guard.version !== VERSION || typeof guard.authorize !== 'function') return false;
    try { if (guard.authorize(target) !== true) return false; } catch (_) { return false; }

    try {
      target.click();
      return true;
    } catch (_) { return false; }
  }

  globalThis.__AUTO_AGREE_ACTION_AUTHORITY__ = Object.freeze({
    version: VERSION,
    attemptClick
  });
})();
