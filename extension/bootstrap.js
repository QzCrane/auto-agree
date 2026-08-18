(() => {
  'use strict';
  const KERNEL = globalThis.__AUTO_AGREE_RUNTIME_KERNEL__;
  const VERSION = KERNEL?.version;
  if (!KERNEL || !VERSION || globalThis.__AUTO_AGREE_PROBE__) return;
  globalThis.__AUTO_AGREE_PROBE__ = VERSION;

  // This file is intentionally tiny and cheap: it only decides whether a frame deserves the
  // richer semantic gate. It never clicks, never interprets consent, and never scans unbounded DOM.
  const ATTR = /(?:password|one-time-code|otp|verification|phone|mobile|tel|email|username|user.?name|login|signin|sign-in|signup|sign-up|register|auth|agree|accept|terms?|privacy|agreement|consent|验证码|驗證碼|手机号|手機號|登录|登入|注册|註冊|同意|协议|協議|条款|條款|隐私|隱私)/iu;
  const TEXT = /(?:login|log\s*in|sign\s*in|sign\s*up|register|verification\s*code|agree|accept|terms?(?:\s+of\s+(?:service|use))?|privacy|user\s+agreement|登录|登入|注册|註冊|验证码|驗證碼|同意|接受|协议|協議|条款|條款|隐私|隱私|利用規約|プライバシー|로그인|동의|약관|개인정보|соглас|услов|конфиденц|أوافق|الشروط|الخصوصية)/iu;
  const AUTH_CONTEXT = /(?:login|log\s*in|sign\s*in|sign\s*up|register|verification\s*code|验证码|驗證碼|登录|登入|注册|註冊)/iu;
  const LEGAL_CONTEXT = /(?:agree|accept|terms?(?:\s+of\s+(?:service|use))?|privacy|user\s+agreement|同意|接受|协议|協議|条款|條款|隐私|隱私|利用規約|プライバシー|동의|약관|개인정보|соглас|услов|конфиденц|أوافق|الشروط|الخصوصية)/iu;
  const PROCEED = /(?:login|log\s*in|sign\s*in|sign\s*up|register|continue|next|proceed|submit|verify|confirm|登录|登入|注册|註冊|继续|繼續|下一步|提交|确认|確認|验证|驗證)/iu;
  const NON_AUTH = /(?:newsletter|subscribe|mailing\s+list|contact\s+us|contact\s+form|site\s+search|feedback|support\s+(?:request|ticket)|订阅资讯|訂閱資訊|邮件订阅|郵件訂閱|联系我们|聯絡我們|站内搜索|站內搜尋|意见反馈|意見反饋)/iu;
  const CONTROL = 'input[type="checkbox"],input[type="radio"],[role="checkbox"],[role="radio"],[role="switch"],[aria-checked]';
  const MAX_DEEP = 4;
  const DEEP_JOB_TTL_MS = 2400;
  const deepWork = KERNEL.createBoundedFifo({
    capacity: MAX_DEEP,
    isLive: rootConnected,
    coalesce: (current, next) => ({ scope: commonDeepRecoveryRoot(current, next) })
  });
  const deep = deepWork.queue;
  const queued = new WeakSet();
  let observer = null;
  let gateRequested = false;
  let handoffRetry = 0;
  let handoffBackoff = false;
  let handoffTimer = 0;
  const HANDOFF_RETRY_DELAYS = [40, 160, 640];
  let drainScheduled = false;
  let eventsAttached = false;
  let lifecycleAttached = false;
  const lifecycle = KERNEL.createLifecycleState(false);

  function norm(value, max = 480) {
    if (value == null || max <= 0) return '';
    const raw = String(value);
    const inspect = Math.max(256, max * 4 + 128);
    const normalized = fragment => fragment.replace(/\s+/gu, ' ').trim();
    const take = (fragment, budget, mode = 'head') => {
      if (budget <= 0) return '';
      const text = normalized(fragment);
      if (text.length <= budget) return text;
      if (mode === 'tail') return text.slice(-budget);
      if (mode === 'center') {
        const start = Math.max(0, Math.floor((text.length - budget) / 2));
        return text.slice(start, start + budget);
      }
      return text.slice(0, budget);
    };
    if (raw.length <= inspect) return take(raw, max);
    // Bounded semantic sampling: inspect fixed-size head/center/tail windows. This keeps CPU
    // independent of pathological multi-MB strings while avoiding a systematic tail/middle blind spot.
    const gap = ' zzsemanticgapzz ';
    const gapCost = gap.length * 2;
    const headBudget = Math.max(24, Math.floor((max - gapCost) / 3));
    const middleBudget = Math.max(24, Math.floor((max - gapCost) / 3));
    const tailBudget = Math.max(0, max - gapCost - headBudget - middleBudget);
    const windowSize = Math.max(96, Math.max(headBudget, middleBudget, tailBudget) * 4);
    const center = Math.floor(raw.length / 2);
    const middleStart = Math.max(0, center - Math.floor(windowSize / 2));
    const chunks = [
      take(raw.slice(0, windowSize), headBudget, 'head'),
      take(raw.slice(middleStart, middleStart + windowSize), middleBudget, 'center'),
      take(raw.slice(Math.max(0, raw.length - windowSize)), tailBudget, 'tail')
    ].filter(Boolean);
    return take(chunks.join(gap), max);
  }

  function joinNorm(values, max = 480) {
    let out = '';
    for (const value of values) {
      const left = max - out.length;
      if (left <= 0) break;
      const part = norm(value, left);
      if (!part) continue;
      out += (out ? ' ' : '') + part;
      if (out.length > max) out = out.slice(0, max);
    }
    return out;
  }

  function rootConnected(root) {
    if (!root) return false;
    if (root instanceof Document) return root === document;
    if (root instanceof ShadowRoot) return root.host?.isConnected === true;
    if (root instanceof Element) return root.isConnected;
    if (root instanceof DocumentFragment) return true;
    return false;
  }

  function firstNode(root) { return root?.firstChild || null; }

  function nextNode(node, root) {
    if (!(node instanceof Node) || !(root instanceof Node)) return null;
    if (node instanceof Element && /^(?:script|style|noscript|template|head)$/i.test(node.localName)) {
      // Skip non-interactive metadata/script subtrees entirely.
    } else if (node.firstChild) return node.firstChild;
    let p = node;
    while (p && p !== root) {
      if (p.nextSibling) return p.nextSibling;
      p = p.parentNode;
    }
    return null;
  }

  function directText(root, maxNodes = 42, maxChars = 520) {
    if (!root) return '';
    let out = '', count = 0;
    const append = value => { out = joinNorm([out, value], maxChars); };
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n;
    while (count++ < maxNodes && out.length < maxChars && (n = w.nextNode())) {
      if (n.nodeType === Node.TEXT_NODE) append(n.data || '');
      else if (n instanceof Element) {
        append(n.getAttribute('aria-label'));
        append(n.getAttribute('placeholder'));
        if (n instanceof HTMLSlotElement) {
          let assigned = [];
          try { assigned = n.assignedNodes({ flatten: true }).slice(0, 12); } catch (_) {}
          for (const a of assigned) {
            if (out.length >= maxChars) break;
            if (a.nodeType === Node.TEXT_NODE) append(a.data || '');
            else if (a instanceof Element) {
              append(a.getAttribute('aria-label'));
              append(a.getAttribute('title'));
            }
          }
        }
      }
    }
    return out;
  }

  function localScope(el) {
    if (!(el instanceof Element)) return null;
    return el.closest?.('form,dialog,[role="dialog"],[aria-modal="true"]') || el.parentElement || el;
  }

  function checkboxLike(el) {
    if (!(el instanceof Element)) return false;
    if (el instanceof HTMLInputElement && /^(checkbox|radio)$/i.test(el.type || '')) return true;
    const role = (el.getAttribute('role') || '').toLowerCase();
    return role === 'checkbox' || role === 'radio' || role === 'switch' || el.hasAttribute('aria-checked');
  }

  function strongInput(el) {
    if (!(el instanceof HTMLInputElement)) return false;
    const type = (el.type || 'text').toLowerCase();
    const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
    return type === 'password' || ac.includes('current-password') || ac.includes('new-password') || ac === 'one-time-code' || ac.includes('otp');
  }

  function credentialInput(el) {
    if (!(el instanceof HTMLInputElement)) return false;
    const type = (el.type || 'text').toLowerCase();
    const a = joinNorm([el.name, el.id, el.placeholder, el.autocomplete], 300);
    return type === 'tel' || type === 'email' || /(?:phone|mobile|tel|email|username|user.?name|account|手机号|手機號|邮箱|郵箱|账号|帳號)/iu.test(a);
  }

  function ownHint(el) {
    if (!(el instanceof Element)) return '';
    return joinNorm([el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('name'), el.getAttribute('placeholder'), el.getAttribute('autocomplete'), el.getAttribute('data-testid'), el.id], 520);
  }

  function referencedSemantic(el) {
    if (!(el instanceof Element)) return '';
    const ids = joinNorm([el.getAttribute('aria-labelledby'), el.getAttribute('aria-describedby')], 300).split(/\s+/).filter(Boolean).slice(0, 6);
    if (!ids.length) return '';
    const root = el.getRootNode();
    const parts = [];
    for (const id of ids) {
      let ref = null;
      try {
        if (root instanceof Document) ref = root.getElementById(id);
        else if (root instanceof DocumentFragment) ref = root.querySelector(`#${CSS.escape(id)}`);
      } catch (_) {}
      if (ref instanceof Element) parts.push(directText(ref, 18, 240));
    }
    return joinNorm(parts, 420);
  }

  function explicitLabelScope(el) {
    if (!(el instanceof Element)) return null;
    let p = el;
    for (let depth = 0; depth < 8 && p instanceof Element; depth++, p = p.parentElement) {
      if (!p.matches?.('label')) continue;
      try { if (p.querySelector?.(CONTROL)) return p; } catch (_) {}
      const id = p.getAttribute('for');
      if (!id) return null;
      const root = p.getRootNode();
      let target = null;
      try {
        if (root instanceof Document) target = root.getElementById(id);
        else if (root instanceof DocumentFragment) target = root.querySelector(`#${CSS.escape(id)}`);
      } catch (_) {}
      return target instanceof Element && checkboxLike(target) ? p : null;
    }
    return null;
  }

  function textControlScope(el) {
    if (!(el instanceof Element)) return null;
    const explicit = explicitLabelScope(el);
    if (explicit) return explicit;
    let p = el;
    // Generic geometry remains deliberately narrow. Deeper activation is allowed only through an
    // explicit native label relation above, a live ARIA relation, or a bounded access/proceed proof.
    for (let depth = 0; depth < 3 && p instanceof Element; depth++, p = p.parentElement) {
      try { if (p.querySelector?.(CONTROL)) return p; } catch (_) {}
      if (p.matches?.('label[for]')) {
        const id = p.getAttribute('for');
        const root = p.getRootNode();
        let target = null;
        try {
          if (root instanceof Document) target = root.getElementById(id);
          else if (root instanceof DocumentFragment) target = root.querySelector(`#${CSS.escape(id)}`);
        } catch (_) {}
        if (target instanceof Element && checkboxLike(target)) return p;
      }
      if (p.matches?.('form,dialog,[role="dialog"],[aria-modal="true"]')) break;
    }
    return null;
  }

  function suspicious(el) {
    if (!(el instanceof Element)) return false;
    if (strongInput(el)) return true;
    if (credentialInput(el)) {
      const scope = localScope(el);
      const text = directText(scope, 44, 520);
      if (NON_AUTH.test(text) && !AUTH_CONTEXT.test(text)) return false;
      return true;
    }
    const own = ownHint(el);
    if (own && ATTR.test(own)) {
      if (TEXT.test(own)) return true;
    }
    if (checkboxLike(el)) {
      const referenced = referencedSemantic(el);
      return !!referenced && TEXT.test(referenced);
    }
    return false;
  }

  function attachEvents() {
    if (eventsAttached) return;
    eventsAttached = true;
    addEventListener('focusin', eventProbe, true);
    addEventListener('pointerdown', eventProbe, true);
  }

  function detachEvents() {
    if (!eventsAttached) return;
    eventsAttached = false;
    removeEventListener('focusin', eventProbe, true);
    removeEventListener('pointerdown', eventProbe, true);
  }

  function requestGate(reason, seed) {
    if (gateRequested || handoffBackoff || lifecycle.paused) return;
    gateRequested = true;
    globalThis.__AUTO_AGREE_PROBE_CONTEXT__ = { reason, seedRef: seed instanceof Element && typeof WeakRef === 'function' ? new WeakRef(seed) : null };
    observer?.disconnect();
    detachEvents();
    detachLifecycle();
    // The semantic gate owns discovery from this point. Drop queued roots immediately so the
    // retired probe cannot retain transient DOM while its already-posted drain callback unwinds.
    for (const job of deep) releaseDeep(job);
    deepWork.clear();
    chrome.runtime.sendMessage({ type: 'AUTO_AGREE_GATE', reason }, response => {
      if (!chrome.runtime.lastError && response?.ok) {
        handoffRetry = 0;
        handoffBackoff = false;
        if (handoffTimer) clearTimeout(handoffTimer);
        handoffTimer = 0;
        return;
      }
      gateRequested = false;
      handoffBackoff = true;
      const delay = HANDOFF_RETRY_DELAYS[Math.min(handoffRetry++, HANDOFF_RETRY_DELAYS.length - 1)];
      const retrySeed = seed instanceof Element && seed.isConnected ? seed : null;
      if (handoffTimer) clearTimeout(handoffTimer);
      handoffTimer = setTimeout(() => {
        handoffTimer = 0;
        handoffBackoff = false;
        if (!lifecycle.paused && !gateRequested) requestGate('worker-restart-retry', retrySeed);
      }, delay);
      attachLifecycle();
      const shouldPause = document.visibilityState === 'hidden' || document.prerendering;
      lifecycle.transition(shouldPause);
      if (!shouldPause) { attachEvents(); startObserver(); }
    });
  }

  function scan(root, maxNodes = 96, budgetMs = 0.75) {
    if (lifecycle.paused || !root) return false;
    if (root instanceof Element && suspicious(root)) { requestGate('element', root); return true; }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    const start = performance.now();
    let n, count = 0;
    while (count++ < maxNodes && performance.now() - start < budgetMs && (n = walker.nextNode())) {
      if (n.nodeType === Node.TEXT_NODE) {
        const data = norm(n.data || '', 900);
        if (data && TEXT.test(data)) {
          const p = n.parentElement;
          const scope = p && textControlScope(p);
          if (scope) { requestGate('legal-control-text', p); return true; }
        }
      } else if (n instanceof Element && suspicious(n)) { requestGate('element', n); return true; }
    }
    if (n) queueDeep(root);
    return false;
  }

  function releaseDeep(job) {
    const root = job?.rootRef?.deref?.();
    if (root) queued.delete(root);
  }

  function recoveryElement(root) {
    if (root instanceof Document) return root.documentElement;
    if (root instanceof ShadowRoot) return root.host;
    return root instanceof Element ? root : null;
  }

  function commonDeepRecoveryRoot(a, b) {
    if (!a) return b;
    if (!b || a === b) return a;
    const ae = recoveryElement(a), be = recoveryElement(b);
    if (!(ae instanceof Element) || !(be instanceof Element)) return document.documentElement;
    const ar = ae.getRootNode?.(), br = be.getRootNode?.();
    if (ar !== br) return document.documentElement;
    let p = ae, hops = 0;
    while (p instanceof Element && hops++ < 32) {
      if (p === be || p.contains(be)) return p;
      p = p.parentElement;
    }
    if (ar instanceof ShadowRoot) return ar;
    return document.documentElement;
  }

  function promoteDeepRecovery() {
    if (deep.length || !deepWork.hasRecovery) return false;
    return deepWork.promote(root => {
      if (!root || !rootConnected(root) || queued.has(root)) return null;
      queued.add(root);
      return { rootRef: new WeakRef(root), cursorRef: null, started: false, createdAt: performance.now() };
    });
  }

  function queueDeep(root) {
    if (gateRequested || lifecycle.paused || !root || queued.has(root) || !rootConnected(root)) return;
    const job = { rootRef: new WeakRef(root), cursorRef: null, started: false, createdAt: performance.now() };
    const result = deepWork.admit(job, root, null);
    if (!result.admitted) {
      scheduleDrain();
      return;
    }
    queued.add(root);
    scheduleDrain();
  }

  function scheduleDrain() {
    if (drainScheduled || gateRequested || lifecycle.paused) return;
    drainScheduled = true;
    const epoch = lifecycle.capture();
    const run = () => {
      if (gateRequested || !lifecycle.isCurrent(epoch)) {
        if (epoch === lifecycle.epoch) drainScheduled = false;
        return;
      }
      drainScheduled = false;
      const start = performance.now();
      while (deep.length && performance.now() - start < 1.8 && !gateRequested) {
        const job = deep[0]; let steps = 0, done = false;
        const root = job?.rootRef?.deref?.();
        if (!root || !KERNEL.refreshLiveAge(job, DEEP_JOB_TTL_MS, root, rootConnected)) { releaseDeep(deep.shift()); continue; }
        let n = job.started ? job.cursorRef?.deref?.() : firstNode(root);
        if (n && !(n === root || root.contains(n))) n = firstNode(root);
        while (steps++ < 96 && performance.now() - start < 1.8 && n) {
          job.started = true;
          const next = nextNode(n, root);
          job.cursorRef = next instanceof Node ? new WeakRef(next) : null;
          if (n.nodeType === Node.TEXT_NODE) {
            const data = norm(n.data || '', 900);
            if (data && TEXT.test(data)) {
              const p = n.parentElement, scope = p && textControlScope(p);
              if (scope) { requestGate('deep-legal-control', p); return; }
            }
          } else if (n instanceof Element && suspicious(n)) { requestGate('deep-element', n); return; }
          n = next;
        }
        if (!n) { releaseDeep(deep.shift()); done = true; }
        if (!done) break;
      }
      if (!deep.length) promoteDeepRecovery();
      if (deep.length && !gateRequested) scheduleDrain();
    };
    if (globalThis.scheduler?.postTask) scheduler.postTask(run, { priority: 'background' }).catch(() => setTimeout(run, 16));
    else if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 300 });
    else setTimeout(run, 16);
  }

  function eventShadow(event) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    for (const node of path) {
      if (!(node instanceof HTMLElement)) continue;
      let root = node.shadowRoot;
      if (!root && chrome.dom?.openOrClosedShadowRoot) { try { root = chrome.dom.openOrClosedShadowRoot(node); } catch (_) {} }
      if (root instanceof ShadowRoot && scan(root, 56, 0.45)) return true;
    }
    return false;
  }

  function proceedLike(el) {
    if (!(el instanceof Element)) return false;
    let interactive = false;
    try { interactive = el.matches('button,a[href],[role="button"],input[type="submit"],input[type="button"]'); } catch (_) {}
    if (!interactive) return false;
    const value = el instanceof HTMLInputElement ? el.value : '';
    const hint = joinNorm([ownHint(el), el.textContent, value], 420);
    return !!hint && PROCEED.test(hint);
  }

  function proceedScopeEvidence(root, seed, maxNodes = 72, budgetMs = 0.45) {
    if (!(root instanceof Element)) return false;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    const start = performance.now();
    let auth = false, legal = false, control = false, n, count = 0;
    while (count++ < maxNodes && performance.now() - start < budgetMs && (n = walker.nextNode())) {
      if (n.nodeType === Node.TEXT_NODE) {
        const data = norm(n.data || '', 420);
        if (data) {
          if (!auth && AUTH_CONTEXT.test(data)) auth = true;
          if (!legal && LEGAL_CONTEXT.test(data)) legal = true;
        }
      } else if (n instanceof Element) {
        if (!control && checkboxLike(n)) control = true;
        if (!auth && (strongInput(n) || credentialInput(n))) auth = true;
        const hint = ownHint(n);
        if (hint) {
          if (!auth && AUTH_CONTEXT.test(hint)) auth = true;
          if (!legal && LEGAL_CONTEXT.test(hint)) legal = true;
        }
      }
      if (auth && legal && control) {
        requestGate('proceed-access-context', seed);
        return true;
      }
    }
    return false;
  }

  function scanProceedAncestors(target, initialScope) {
    if (!proceedLike(target)) return false;
    let p = initialScope instanceof Element ? initialScope.parentElement : target.parentElement;
    let depth = 0;
    while (p instanceof Element && depth++ < 6) {
      if (proceedScopeEvidence(p, target)) return true;
      if (p.matches?.('form,dialog,[role="dialog"],[aria-modal="true"]')) break;
      p = p.parentElement;
    }
    return false;
  }

  function eventProbe(event) {
    if (gateRequested || lifecycle.paused || eventShadow(event)) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (suspicious(target)) requestGate(event.type, target);
    else {
      const scope = localScope(target);
      if (scope && scan(scope, 64, 0.45)) return;
      scanProceedAncestors(target, scope);
    }
  }

  function onMutations(records) {
    if (lifecycle.paused || gateRequested) return;
    const start = performance.now();
    for (const r of records) {
      if (gateRequested) return;
      if (r.type === 'characterData') {
        const data = norm(r.target?.data || '', 900);
        if (data && TEXT.test(data) && r.target.parentElement) scan(localScope(r.target.parentElement) || r.target.parentElement, 56, 0.35);
      } else if (r.type === 'attributes') {
        if (r.target instanceof Element && suspicious(r.target)) return requestGate('attribute', r.target);
      } else if (r.type === 'childList') {
        const nodes = r.addedNodes;
        const idx = nodes.length > 24 ? [0,1,2,nodes.length-3,nodes.length-2,nodes.length-1] : [...Array(nodes.length).keys()];
        for (const i of idx) {
          const n = nodes[i];
          if (!n) continue;
          if (n.nodeType === Node.TEXT_NODE) {
            const data = norm(n.data || '', 900);
            if (data && TEXT.test(data) && n.parentElement) scan(localScope(n.parentElement) || n.parentElement, 48, 0.3);
          } else if (n.nodeType === Node.ELEMENT_NODE || n.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
            if (scan(n, 48, 0.3)) return;
          }
          if (performance.now() - start > 1.0) { queueDeep(r.target); break; }
        }
        if (nodes.length > 24) queueDeep(r.target);
      }
    }
  }

  function edgeProbe(root) {
    if (!(root instanceof Element)) return false;
    const q = [root]; const seen = new WeakSet(); let count = 0;
    while (q.length && count++ < 22) {
      const el = q.shift(); if (!(el instanceof Element) || seen.has(el)) continue; seen.add(el);
      if (suspicious(el) || scan(el, 32, 0.22)) return true;
      const c = el.children;
      for (let i=0;i<Math.min(2,c.length);i++) q.push(c[i]);
      for (let i=Math.max(2,c.length-3);i<c.length;i++) if(i>=0) q.push(c[i]);
    }
    return false;
  }

  function startObserver() {
    if (gateRequested || lifecycle.paused) return;
    if (!observer) observer = new MutationObserver(onMutations);
    try {
      observer.observe(document, {
        subtree:true,
        childList:true,
        characterData:true,
        attributes:true,
        attributeFilter:[
          'type','name','id','title','placeholder','autocomplete','role','aria-label','aria-checked',
          'aria-labelledby','aria-describedby','aria-required','data-testid','for'
        ]
      });
    } catch (_) {}
    if (document.documentElement) {
      if (!edgeProbe(document.documentElement)) scan(document.documentElement, 80, 1.0);
    }
  }

  function clearProbeWork() {
    for (const job of deep) releaseDeep(job);
    deepWork.clear();
    drainScheduled = false;
  }

  function pauseProbe() {
    if (lifecycle.paused || gateRequested) return;
    lifecycle.pause();
    if (handoffTimer) clearTimeout(handoffTimer);
    handoffTimer = 0;
    handoffBackoff = false;
    observer?.disconnect();
    detachEvents();
    clearProbeWork();
  }

  function resumeProbe() {
    if (!lifecycle.paused || gateRequested || handoffBackoff || document.prerendering || document.visibilityState === 'hidden') return;
    lifecycle.resume();
    attachEvents();
    startObserver();
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') pauseProbe();
    else resumeProbe();
  }

  function onPageHide(event) {
    if (event?.persisted) pauseProbe();
    else { pauseProbe(); detachLifecycle(); }
  }

  function onPageShow(event) { if (event?.persisted) resumeProbe(); }
  function onFreeze() { pauseProbe(); }
  function onResume() { resumeProbe(); }

  function attachLifecycle() {
    if (lifecycleAttached) return;
    lifecycleAttached = true;
    addEventListener('pagehide', onPageHide, true);
    addEventListener('pageshow', onPageShow, true);
    document.addEventListener('freeze', onFreeze, true);
    document.addEventListener('resume', onResume, true);
    document.addEventListener('visibilitychange', onVisibilityChange, true);
  }

  function detachLifecycle() {
    if (!lifecycleAttached) return;
    lifecycleAttached = false;
    removeEventListener('pagehide', onPageHide, true);
    removeEventListener('pageshow', onPageShow, true);
    document.removeEventListener('freeze', onFreeze, true);
    document.removeEventListener('resume', onResume, true);
    document.removeEventListener('visibilitychange', onVisibilityChange, true);
  }

  function startActiveProbe() {
    lifecycle.resume();
    attachLifecycle();
    if (document.visibilityState === 'hidden') { pauseProbe(); return; }
    attachEvents();
    startObserver();
  }

  // Never synthesize consent while Chrome is prerendering a page the user has not activated yet.
  // Chrome dispatches `prerenderingchange` on activation; discovery begins only then.
  attachLifecycle();
  if (document.prerendering) document.addEventListener('prerenderingchange', startActiveProbe, { once: true });
  else startActiveProbe();
})();