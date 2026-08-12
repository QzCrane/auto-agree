(() => {
  'use strict';
  const KERNEL = globalThis.__AUTO_AGREE_RUNTIME_KERNEL__;
  const VERSION = KERNEL?.version;
  if (!KERNEL || !VERSION) return;
  if (globalThis.__AUTO_AGREE_DOM_CORE__?.version === VERSION) return;

  function composedParent(el) {
    if (!(el instanceof Element)) return null;
    if (el.assignedSlot instanceof Element) return el.assignedSlot;
    if (el.parentElement) return el.parentElement;
    const root = el.getRootNode?.();
    return root instanceof ShadowRoot && root.host instanceof Element ? root.host : null;
  }

  function rootQueryById(el, id) {
    if (!(el instanceof Element) || !id) return null;
    const root = el.getRootNode();
    try {
      if (root instanceof Document) return root.getElementById(id);
      if (root instanceof DocumentFragment) return root.querySelector(`#${CSS.escape(id)}`);
      return null;
    } catch (_) { return null; }
  }

  globalThis.__AUTO_AGREE_DOM_CORE__ = Object.freeze({
    version: VERSION,
    composedParent,
    rootQueryById
  });
})();
