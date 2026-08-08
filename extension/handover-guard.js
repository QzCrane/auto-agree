(() => {
  'use strict';
  const VERSION = '10.0.0';
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
  const MAX_LOCAL_WRAPPER_DEPTH = 2;
  const MAX_LOCAL_WRAPPER_NODES = 24;
  const MAX_LOCAL_CONTROL_DEPTH = 3;

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
    queueMicrotask(() => {
      for (const leased of lease) authorized.delete(leased);
    });
  }

  // Return one exact delegated control only if the wrapper can be proven small and unambiguous.
  // The traversal is bounded from the first direct child onward; no querySelector walks an
  // arbitrary trusted-event ancestor subtree.
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

  function localDelegationTarget(target) {
    if (!(target instanceof Element) || isProceedAction(target)) return null;

    const semanticWrapper = target.closest?.('label,[role="checkbox"],[role="radio"],[role="switch"]');
    if (semanticWrapper instanceof HTMLLabelElement) {
      const associated = semanticWrapper.control;
      if (associated instanceof Element && isControl(associated)) return associated;
      return boundedUniqueDelegatedControl(semanticWrapper);
    }
    if (semanticWrapper instanceof Element && isControl(semanticWrapper)) return semanticWrapper;
    if (isControl(target)) return target;

    let p = target;
    for (let depth = 0; depth <= MAX_LOCAL_WRAPPER_DEPTH && p instanceof Element; depth++, p = composedParent(p)) {
      if (WIDE_CONTAINER.test(p.localName) || isProceedAction(p)) continue;
      const delegated = boundedUniqueDelegatedControl(p);
      if (delegated) return delegated;
    }
    return null;
  }

  function beginLocalLease(event) {
    const delegated = localDelegationTarget(event.target instanceof Element ? event.target : null);
    if (!delegated) return;
    causalLocal.add(delegated);
    localLeaseByEvent.set(event, delegated);
  }

  function finishLocalLease(event) {
    const delegated = localLeaseByEvent.get(event);
    if (!delegated) return;
    causalLocal.delete(delegated);
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
      // A current-authorized outer click may synchronously enter page component code that delegates
      // to one exact descendant control. The causal lease expires when the outer event bubbles out.
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