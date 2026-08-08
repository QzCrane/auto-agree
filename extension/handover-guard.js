(() => {
  'use strict';
  const VERSION = '9.0.0';
  if (globalThis.__AUTO_AGREE_HANDOVER_GUARD__?.version === VERSION) return;

  // This guard exists only on pages that survive an extension update. Old isolated worlds can
  // remain observable and executable after the new extension generation is installed. Current
  // Engine clicks receive a synchronous one-shot authorization; stale generations do not.
  const authorized = new WeakSet();
  const causalLocal = new WeakSet();
  const localLeaseByEvent = new WeakMap();
  const LEGAL = /(?:terms?(?:\s+of\s+(?:service|use))?|privacy|agreement|eula|协议|協議|条款|條款|隐私|隱私|利用規約|プライバシー|약관|개인정보|услов|конфиденц|الشروط|الخصوصية)/iu;
  const ASSENT = /(?:agree|accept|consent|同意|接受|동의|同意する|соглас|أوافق)/iu;
  const REQUIRED = /(?:required|mandatory|must\s+(?:agree|accept)|please\s+(?:agree|accept)|必须|必須|需(?:要)?同意|请先(?:阅读|閱讀)?(?:并|並)?同意)/iu;
  const CONTROL = 'input[type="checkbox"],input[type="radio"],[role="checkbox"],[role="radio"],[role="switch"],[aria-checked]';
  const CUSTOM = new Set(['sl-checkbox','ion-checkbox','md-checkbox','mat-checkbox','fluent-checkbox','vaadin-checkbox','ui5-checkbox','calcite-checkbox','lightning-input']);
  const WIDE_CONTAINER = /^(?:html|body|form|dialog|main|section|article)$/i;

  function composedParent(el) {
    if (!(el instanceof Element)) return null;
    if (el.assignedSlot instanceof Element) return el.assignedSlot;
    if (el.parentElement) return el.parentElement;
    const root = el.getRootNode?.();
    return root instanceof ShadowRoot && root.host instanceof Element ? root.host : null;
  }

  function boundedText(root, maxNodes = 48, maxChars = 900) {
    if (!root) return '';
    const parts = [];
    let chars = 0, nodes = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node;
    while (nodes++ < maxNodes && chars < maxChars && (node = walker.nextNode())) {
      let value = '';
      if (node.nodeType === Node.TEXT_NODE) value = node.data || '';
      else if (node instanceof Element) {
        if (/^(?:script|style|noscript|template)$/i.test(node.localName)) continue;
        value = `${node.getAttribute('aria-label') || ''} ${node.getAttribute('title') || ''}`;
      }
      value = String(value).replace(/\s+/gu, ' ').trim();
      if (!value) continue;
      const left = maxChars - chars;
      const part = value.slice(0, left);
      parts.push(part);
      chars += part.length + 1;
    }
    return parts.join(' ').slice(0, maxChars);
  }

  function ownText(el) {
    if (!(el instanceof Element)) return '';
    return `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''} ${el.getAttribute('name') || ''}`.slice(0, 360);
  }

  function isControl(el) {
    if (!(el instanceof Element)) return false;
    try { if (el.matches(CONTROL)) return true; } catch (_) {}
    if (CUSTOM.has(el.localName)) return true;
    const cls = typeof el.className === 'string' ? el.className : el.getAttribute('class') || '';
    return cls.length <= 500 && /(?:checkbox|check-box|form-check-input|check_control|check-control)/i.test(cls);
  }

  function shadowText(host) {
    if (!(host instanceof HTMLElement)) return '';
    let root = host.shadowRoot;
    if (!root && chrome.dom?.openOrClosedShadowRoot) {
      try { root = chrome.dom.openOrClosedShadowRoot(host); } catch (_) {}
    }
    return root instanceof ShadowRoot ? boundedText(root, 40, 640) : '';
  }

  function candidateNodes(event) {
    const out = [];
    const seen = new WeakSet();
    const add = node => {
      if (!(node instanceof Element) || seen.has(node)) return;
      seen.add(node);
      out.push(node);
    };
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    for (const node of path.slice(0, 10)) add(node);
    let p = out[0] || (event.target instanceof Element ? event.target : null);
    for (let i = 0; i < 7 && p instanceof Element; i++, p = composedParent(p)) add(p);
    return out;
  }

  function consumeAuthorization(nodes) {
    let allowed = false;
    for (const node of nodes) if (authorized.has(node)) allowed = true;
    if (!allowed) return false;
    for (const node of nodes) authorized.delete(node);
    return true;
  }

  function consumeCausalLocal(nodes) {
    let allowed = false;
    for (const node of nodes) if (causalLocal.has(node)) allowed = true;
    if (!allowed) return false;
    for (const node of nodes) causalLocal.delete(node);
    return true;
  }

  function agreementLike(nodes) {
    let hasControl = false;
    const parts = [];
    let chars = 0;
    for (const node of nodes.slice(0, 10)) {
      hasControl ||= isControl(node);
      const values = [ownText(node), boundedText(node, 18, 260), shadowText(node)];
      for (const value of values) {
        if (!value || chars >= 1200) continue;
        const part = value.slice(0, 1200 - chars);
        parts.push(part);
        chars += part.length + 1;
      }
      if (chars >= 1200) break;
    }
    const text = parts.join(' ');
    return LEGAL.test(text) && (hasControl || ASSENT.test(text) || REQUIRED.test(text));
  }

  function authorize(el) {
    const lease = [];
    let node = el;
    for (let i = 0; i < 10 && node instanceof Element; i++, node = composedParent(node)) {
      authorized.add(node);
      lease.push(node);
    }
    // Current Engine invokes HTMLElement.click() synchronously in this same isolated world. If no
    // click reaches the guard, revoke the unused authorization at the next microtask checkpoint.
    queueMicrotask(() => {
      for (const leased of lease) authorized.delete(leased);
    });
  }

  function localInteractionRoot(target) {
    if (!(target instanceof Element)) return null;
    const semanticWrapper = target.closest?.('label,[role="checkbox"],[role="radio"],[role="switch"]');
    if (semanticWrapper instanceof Element) return semanticWrapper;
    if (isControl(target)) return target;
    let p = target;
    for (let depth = 0; depth < 3 && p instanceof Element; depth++, p = composedParent(p)) {
      if (WIDE_CONTAINER.test(p.localName)) continue;
      try { if (p.querySelector?.(CONTROL)) return p; } catch (_) {}
    }
    return null;
  }

  function beginLocalLease(event) {
    const root = localInteractionRoot(event.target instanceof Element ? event.target : null);
    if (!root) return;
    causalLocal.add(root);
    localLeaseByEvent.set(event, root);
  }

  function finishLocalLease(event) {
    const root = localLeaseByEvent.get(event);
    if (!root) return;
    causalLocal.delete(root);
    localLeaseByEvent.delete(event);
  }

  function onTrustedCapture(event) {
    if (event.isTrusted) beginLocalLease(event);
  }

  function onClick(event) {
    if (event.isTrusted) { beginLocalLease(event); return; }
    const nodes = candidateNodes(event);
    if (!nodes.length) return;
    if (consumeAuthorization(nodes)) {
      // The current Engine's authorized outer click may synchronously enter MAIN-world component
      // code that delegates to a hidden/native descendant via .click(). Keep one narrow local lease
      // only until this outer event finishes bubbling; stale MutationObservers run after it expires.
      beginLocalLease(event);
      return;
    }
    if (consumeCausalLocal(nodes)) return;
    if (!agreementLike(nodes)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
  }

  addEventListener('pointerdown', onTrustedCapture, true);
  addEventListener('pointerdown', finishLocalLease, false);
  addEventListener('keydown', onTrustedCapture, true);
  addEventListener('keydown', finishLocalLease, false);
  addEventListener('click', onClick, true);
  addEventListener('click', finishLocalLease, false);
  globalThis.__AUTO_AGREE_HANDOVER_GUARD__ = Object.freeze({ version: VERSION, authorize });
})();