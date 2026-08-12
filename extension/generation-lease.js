(() => {
  'use strict';
  const VERSION = '11.0.0';
  if (globalThis.__AUTO_AGREE_GENERATION_LEASE__?.version === VERSION) return;

  const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'click');
  const nativeClick = descriptor?.value;
  if (typeof nativeClick !== 'function') throw new Error('Auto Agree generation lease cannot resolve HTMLElement.click');

  function current() {
    try {
      return chrome.runtime?.getManifest?.()?.version === VERSION;
    } catch (_) {
      return false;
    }
  }

  function guardedClick(...args) {
    if (!current()) return undefined;
    return Reflect.apply(nativeClick, this, args);
  }

  Object.defineProperty(HTMLElement.prototype, 'click', {
    ...descriptor,
    value: guardedClick
  });

  globalThis.__AUTO_AGREE_GENERATION_LEASE__ = Object.freeze({ version: VERSION, current });
})();