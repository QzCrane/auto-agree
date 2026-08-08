(() => {
  'use strict';
  const VERSION = '10.0.0';
  if (globalThis.__AUTO_AGREE_HANDOVER_GUARD__?.version === VERSION) return;

  const CORE = globalThis.__AUTO_AGREE_SEMANTIC__;
  if (!CORE || CORE.version !== VERSION || typeof CORE.assessText !== 'function') {
    throw new Error(`Auto Agree handover semantic dependency unavailable for ${VERSION}`);
  }
  const { normalize, joinNormalized, assessText } = CORE;

  const authorized = new WeakSet();
  const rejected = new WeakSet();
  // Correctness authority is not "this control was once reached by a trusted event". The exact
  // source Event must still be inside browser dispatch when a nested synthetic control click is
  // observed. Bubble cleanup remains an eager release path, but stopPropagation cannot extend
  // authority into a later task because Event.eventPhase returns NONE after dispatch completes.
  const causalLocal = new WeakMap();
  const localLeaseByEvent = new WeakMap();
  const CONTROL = 'input[type="checkbox"],input[type="radio"],[role="checkbox"],[role="radio"],[role="switch"],[aria-checked]';
  const CUSTOM = new Set(['sl-checkbox','ion-checkbox','md-checkbox','mat-checkbox','fluent-checkbox','vaadin-checkbox','ui5-checkbox','calcite-checkbox','lightning-input']);
  const WIDE_CONTAINER = /^(?:html|body|form|dialog|main|section|article|aside|nav|header|footer)$/i;
  const MAX_LOCAL_WRAPPER_DEPTH = 2;
  const MAX_LOCAL_WRAPPER_NODES = 64;
  const MAX_LOCAL_CONTROL_DEPTH = 3;
  let runtimeRevoked = false;

  function runtimeCurrent() {
    if (runtimeRevoked) return false;
    try {
      if (chrome.runtime?.getManifest?.()?.version === VERSION) return true;
    } catch (_) {}
    runtimeRevoked = true;
    return false;
  }

  function composedParent(el) {
    if (!(el instanceof Element)) return null;
    if (el.assignedSlot instanceof Element) return el.assignedSlot;
    if (el.parentElement) return el.parentElement;
    const root = el.getRootNode?.();
    return root instanceof ShadowRoot && root.host instanceof Element ? root.host : null;
  }

  function boundedText(root, maxNodes = 48, maxChars = 900) {
    if (!root || maxNodes <= 0 || maxChars <= 0) return '';
    const parts = [];
    let chars = 0, nodes = 0;
    const append = value => {
      const left = maxChars - chars;
      if (left <= 0 || value == null) return;
      const part = normalize(value, left);
      if (!part) return;
      parts.push(part);
      chars += Math.min(left, part.length + 1);
    };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node;
    while (nodes++ < maxNodes && chars < maxChars && (node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) append(node.data || '');
      else if (node instanceof Element) {
        if (/^(?:script|style|noscript|template)$/i.test(node.localName)) continue;
        append(node.getAttribute('aria-label'));
        append(node.getAttribute('title'));
      }
    }
    return joinNormalized(parts, maxChars);
  }

  function ownText(el) {
    if (!(el instanceof Element)) return '';
    return joinNormalized([
      el.getAttribute('aria-label'),
      el.getAttribute('title'),
      el.getAttribute('name'),
      el.getAttribute('placeholder'),
      el.getAttribute('data-testid'),
      el.id
    ], 360);
  }

  function rootQueryById(el, id) {
    if (!(el instanceof Element) || !id) return null;
    const root = el.getRootNode?.() || document;
    try {
      if (root instanceof Document) return root.getElementById(id);
      return root.querySelector?.(`#${CSS.escape(id)}`) || null;
    } catch (_) { return null; }
  }

  function referencedText(el, maxChars = 480) {
    if (!(el instanceof Element)) return '';
    const parts = [];
    for (const attr of ['aria-labelledby', 'aria-describedby']) {
      const value = normalize(el.getAttribute(attr), 260);
      if (!value) continue;
      const ids = value.split(/\s+/).filter(id => id && id !== 'zzsemanticgapzz').slice(0, 6);
      for (const id of ids) {
        const ref = rootQueryById(el, id);
        if (ref instanceof Element) parts.push(boundedText(ref, 18, 260));
      }
    }
    return joinNormalized(parts, maxChars);
  }

  function associatedLabelText(el, maxChars = 420) {
    if (!(el instanceof HTMLInputElement)) return '';
    const parts = [];
    try {
      for (const label of Array.from(el.labels || []).slice(0, 2)) {
        if (label instanceof Element) parts.push(boundedText(label, 24, 300));
      }
    } catch (_) {}
    return joinNormalized(parts, maxChars);
  }

  function isControl(el) {
    if (!(el instanceof Element)) return false;
    try { if (el.matches(CONTROL)) return true; } catch (_) {}
    if (CUSTOM.has(el.localName)) return true;
    const cls = typeof el.className === 'string' ? el.className : el.getAttribute('class') || '';
    return cls.length <= 500 && /(?:checkbox|check-box|form-check-input|check_control|check-control)/i.test(cls);
  }

  function isProceedAction(el) {
    if (!(el instanceof Element)) return false;
    try { if (el.matches('button,a[href],[role="button"]')) return true; } catch (_) {}
    if (el instanceof HTMLInputElement) return /^(?:button|submit|image|reset)$/i.test(el.type || '');
    return false;
  }

  function shadowText(host) {
    if (!(host instanceof HTMLElement)) return '';
    let root = host.shadowRoot;
    if (!root && chrome.dom?.openOrClosedShadowRoot) {
      try { root = chrome.dom.openOrClosedShadowRoot(host); } catch (_) {}
    }
    return root instanceof ShadowRoot ? boundedText(root, 40, 640) : '';
  }

  function eventElements(event, limit = 10) {
    const out = [];
    const seen = new WeakSet();
    const add = node => {
      if (!(node instanceof Element) || seen.has(node) || out.length >= limit) return;
      seen.add(node);
      out.push(node);
    };
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    for (const node of path) {
      add(node);
      if (out.length >= limit) break;
    }
    if (!out.length) {
      let p = event.target instanceof Element ? event.target : null;
      for (let i = 0; i < limit && p instanceof Element; i++, p = composedParent(p)) add(p);
    }
    return out;
  }

  function candidateNodes(event) {
    const out = eventElements(event, 10);
    const seen = new WeakSet(out);
    let p = out[0] || (event.target instanceof Element ? event.target : null);
    for (let i = 0; i < 7 && p instanceof Element && out.length < 10; i++, p = composedParent(p)) {
      if (!seen.has(p)) { seen.add(p); out.push(p); }
    }
    return out;
  }

  function consume(set, nodes) {
    let allowed = false;
    for (const node of nodes) if (set.has(node)) allowed = true;
    if (!allowed) return false;
    for (const node of nodes) set.delete(node);
    return true;
  }

  function consumeLiveCausal(nodes) {
    let allowed = false;
    for (const node of nodes) {
      const source = causalLocal.get(node);
      if (!(source instanceof Event)) continue;
      if (source.eventPhase === Event.NONE) {
        causalLocal.delete(node);
        continue;
      }
      allowed = true;
    }
    if (!allowed) return false;
    // Causal delegation is one-shot even during the same source dispatch. A wrapper that needs
    // multiple downstream actions must receive separate explicit user/current-Engine authority.
    for (const node of nodes) causalLocal.delete(node);
    return true;
  }

  function block(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
  }

  function agreementLike(nodes) {
    let hasControl = false;
    const parts = [];
    let chars = 0;
    for (const node of nodes.slice(0, 10)) {
      hasControl ||= isControl(node);
      const values = [ownText(node), referencedText(node), associatedLabelText(node), boundedText(node, 18, 260), shadowText(node)];
      for (const value of values) {
        if (!value || chars >= 1400) continue;
        const part = normalize(value, 1400 - chars);
        if (!part) continue;
        parts.push(part);
        chars += Math.min(1400 - chars, part.length + 1);
      }
      if (chars >= 1400) break;
    }
    const assessment = assessText(joinNormalized(parts, 1400));
    return !!assessment?.legal && (hasControl || !!assessment.assent || !!assessment.required || !!assessment.validation);
  }

  function markRejected(el) {
    const lease = [];
    let node = el;
    for (let i = 0; i < 10 && node instanceof Element; i++, node = composedParent(node)) {
      rejected.add(node);
      lease.push(node);
    }
    queueMicrotask(() => {
      for (const leased of lease) rejected.delete(leased);
    });
  }

  function authorize(el) {
    if (!(el instanceof Element)) return false;
    if (!runtimeCurrent()) {
      markRejected(el);
      return false;
    }
    const lease = [];
    let node = el;
    for (let i = 0; i < 10 && node instanceof Element; i++, node = composedParent(node)) {
      authorized.add(node);
      lease.push(node);
    }
    queueMicrotask(() => {
      for (const leased of lease) authorized.delete(leased);
    });
    return true;
  }

  function boundedUniqueDelegatedControl(root) {
    if (!(root instanceof Element) || WIDE_CONTAINER.test(root.localName) || isProceedAction(root)) return null;
    const stack = [];
    for (let child = root.firstElementChild; child; child = child.nextElementSibling) {
      if (stack.length >= MAX_LOCAL_WRAPPER_NODES) return null;
      stack.push({ node: child, depth: 1 });
    }
    let visited = 0;
    let found = null;
    while (stack.length) {
      const entry = stack.pop();
      if (++visited > MAX_LOCAL_WRAPPER_NODES) return null;
      const node = entry.node;
      if (!(node instanceof Element)) continue;
      if (isControl(node)) {
        if (found && found !== node) return null;
        found = node;
      }
      if (entry.depth >= MAX_LOCAL_CONTROL_DEPTH) continue;
      for (let child = node.firstElementChild; child; child = child.nextElementSibling) {
        if (stack.length + visited >= MAX_LOCAL_WRAPPER_NODES) return null;
        stack.push({ node: child, depth: entry.depth + 1 });
      }
    }
    return found;
  }

  function labelDelegationTarget(label) {
    if (!(label instanceof HTMLLabelElement)) return null;
    const associated = label.control;
    if (associated instanceof Element && isControl(associated)) return associated;
    return boundedUniqueDelegatedControl(label);
  }

  function localDelegationTarget(event) {
    const path = eventElements(event, 8);
    if (!path.length) return null;
    for (const node of path) {
      if (isProceedAction(node)) return null;
      if (node instanceof HTMLLabelElement) return labelDelegationTarget(node);
      if (isControl(node)) return node;
      if (WIDE_CONTAINER.test(node.localName)) break;
    }
    for (let i = 0; i < path.length && i <= MAX_LOCAL_WRAPPER_DEPTH; i++) {
      const node = path[i];
      if (!(node instanceof Element) || WIDE_CONTAINER.test(node.localName) || isProceedAction(node)) continue;
      const delegated = boundedUniqueDelegatedControl(node);
      if (delegated) return delegated;
    }
    return null;
  }

  function beginLocalLease(event) {
    const delegated = localDelegationTarget(event);
    if (!delegated) return;
    causalLocal.set(delegated, event);
    localLeaseByEvent.set(event, delegated);
  }

  function finishLocalLease(event) {
    const delegated = localLeaseByEvent.get(event);
    if (!delegated) return;
    if (causalLocal.get(delegated) === event) causalLocal.delete(delegated);
    localLeaseByEvent.delete(event);
  }

  function onTrustedCapture(event) {
    if (event.isTrusted && !runtimeRevoked) beginLocalLease(event);
  }

  function onClick(event) {
    const nodes = candidateNodes(event);
    if (!nodes.length) return;

    if (!event.isTrusted && !runtimeCurrent()) {
      if (consume(rejected, nodes)) block(event);
      return;
    }

    if (event.isTrusted) { beginLocalLease(event); return; }
    if (consume(authorized, nodes)) {
      beginLocalLease(event);
      return;
    }
    if (consumeLiveCausal(nodes)) return;
    if (!agreementLike(nodes)) return;
    block(event);
  }

  addEventListener('pointerdown', onTrustedCapture, true);
  addEventListener('pointerdown', finishLocalLease, false);
  addEventListener('keydown', onTrustedCapture, true);
  addEventListener('keydown', finishLocalLease, false);
  addEventListener('click', onClick, true);
  addEventListener('click', finishLocalLease, false);
  globalThis.__AUTO_AGREE_HANDOVER_GUARD__ = Object.freeze({ version: VERSION, authorize, runtimeCurrent });
})();