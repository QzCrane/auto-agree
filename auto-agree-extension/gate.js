(() => {
  'use strict';
  if (globalThis.__AUTO_AGREE_GATE__) return;
  globalThis.__AUTO_AGREE_GATE__ = '6.0.0';

  // v4 bootstrap is an evidence gate, not a keyword gate. Weak signals such as a footer
  // "Privacy Policy" link or a newsletter email field must never load the full engine alone.
  const AUTH_ACTION = /(?:登录|登入|登陆|注册|註冊|验证码登录|驗證碼登入|获取验证码|獲取驗證碼|发送验证码|發送驗證碼|login|log\s*in|sign\s*in|sign\s*up|register|verification\s*code|connexion|anmelden|iniciar\s+sesi[oó]n|ログイン|로그인|войти|تسجيل\s+الدخول|inloggen|zaloguj|giriş\s+yap|đăng\s+nhập|masuk|เข้าสู่ระบบ|लॉग\s*इन|σύνδεση|התחברות|logga\s+in|logg\s+inn|log\s+ind)/iu;
  const LEGAL = /(?:用户协议|使用协议|服务协议|服務協議|平台协议|会员协议|许可协议|條款|条款|隐私(?:政策|协议|条款|声明)|隱私(?:政策|協議|條款|聲明)|terms?(?:\s+of\s+(?:service|use))?|privacy\s+(?:policy|notice|agreement|terms)|user\s+agreement|eula|利用規約|プライバシー|이용약관|개인정보|услов|конфиденц|الشروط|الخصوصية|voorwaarden|privacybeleid|warunki|prywatno|kullanım|gizlilik|điều\s+khoản|quyền\s+riêng|syarat|privasi|ข้อกำหนด|ความเป็นส่วนตัว|नियम|शर्तें|गोपनीयता|όροι|απορρήτου|תנאי|פרטיות|villkor|integritet|vilkår|personvern|betingelser|privatliv)/iu;
  const ASSENT = /(?:我已|本人已|已)?\s*(?:阅读|閱讀|阅悉|閱悉|知悉)?\s*(?:并|並)?\s*(?:同意|接受|遵守)|(?:同意|接受)(?:上述|以上|相关|相關)?|(?:i\s+)?(?:have\s+)?(?:read\s+(?:and|&)\s+)?(?:agree|accept)(?:\s+to)?|i\s+consent\s+to|同意します|동의|соглас|أوافق|akkoord|zgadzam|kabul|đồng\s+ý|setuju|ยอมรับ|सहमत|συμφωνώ|מסכים|godkänner|godtar|accepterer/iu;
  const REQUIRED_TEXT = /(?:必选|必須|必须|需(?:要)?同意|请先(?:阅读|閱讀)?(?:并|並)?同意|請先(?:閱讀)?(?:並)?同意|required|mandatory|must\s+(?:agree|accept)|please\s+(?:agree|accept))/iu;
  const CREDENTIAL_ATTR = /(?:phone|mobile|tel|email|username|user.?name|account|账号|帳號|手机号|手機號|邮箱|郵箱)/iu;
  const AUTH_ATTR = /(?:login|signin|sign-in|signup|sign-up|register|auth|verification|otp|password|验证码|驗證碼|登录|登入|注册|註冊)/iu;
  const LEGAL_ATTR = /(?:agree|accept|terms?|privacy|agreement|consent|同意|接受|协议|協議|条款|條款|隐私|隱私)/iu;
  const NON_AUTH = /(?:newsletter|subscribe|subscription\s+updates?|mailing\s+list|contact\s+us|contact\s+form|search|site\s+search|feedback|support\s+(?:request|ticket)|订阅资讯|訂閱資訊|邮件订阅|郵件訂閱|联系我们|聯絡我們|站内搜索|站內搜尋|意见反馈|意見反饋)/iu;
  const COMPACT_LEGAL = /(?:termsof(?:service|use)|privacypolicy|privacyagreement|useragreement|eula)/i;
  const COMPACT_ASSENT = /(?:i(?:have)?(?:read(?:and)?)?(?:agree|accept)(?:to)?|iconsentto)/i;
  const COMPACT_REQUIRED = /(?:required|mandatory|must(?:agree|accept)|please(?:agree|accept))/i;

  const F = Object.freeze({ AUTH: 1, STRONG_AUTH: 2, CREDENTIAL: 4, LEGAL: 8, ASSENT: 16, CONTROL: 32, REQUIRED: 64, NON_AUTH: 128 });
  const LARGE_BATCH = 96;
  const SYNC_MUTATION_BUDGET_MS = 1.6;
  const BACKGROUND_BUDGET_MS = 2.5;
  const MAX_BATCH_JOBS = 6;
  const MAX_DEEP_JOBS = 10;
  const JOB_TTL_MS = 2400;

  let requested = false;
  let observer = null;
  let backgroundRunning = false;
  let backgroundEpoch = 0;
  let eventsAttached = false;
  let lifecycleAttached = false;
  let paused = false;
  let lifecycleEpoch = 0;
  const batchJobs = [];
  const deepJobs = [];
  const deepQueued = new WeakSet();
  let localChecked = new WeakSet();

  function norm(value, max = 1000) {
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



  function joinNorm(values, max = 1000) {
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

  function compactSemantic(value, max = 1400) {
    const t = norm(value, max).toLowerCase();
    return t.replace(/[\s\p{P}\p{S}\u200b-\u200d\ufeff]+/gu, '').slice(0, max);
  }

  function hasNonLatin(value) { return /[^\u0000-\u024f]/u.test(value || ''); }

  function rootConnected(root) {
    if (!root) return false;
    if (root instanceof Document) return root === document;
    if (root instanceof ShadowRoot) return root.host?.isConnected === true;
    if (root instanceof Element) return root.isConnected;
    if (root instanceof DocumentFragment) return true;
    return false;
  }

  function nextNode(node, root) {
    if (!(node instanceof Node) || !(root instanceof Node)) return null;
    if (node instanceof Element && /^(?:script|style|noscript|template|head)$/i.test(node.localName)) {
      // skip non-interactive subtrees
    } else if (node.firstChild) return node.firstChild;
    let p = node;
    while (p && p !== root) {
      if (p.nextSibling) return p.nextSibling;
      p = p.parentNode;
    }
    return null;
  }

  function boundedEvidenceText(root, maxNodes = 120, maxChars = 1400) {
    if (!root) return '';
    const parts = []; let chars = 0; let nodes = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node;
    while (nodes++ < maxNodes && chars < maxChars && (node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = norm(node.data || '', Math.min(320, maxChars - chars));
        if (t) { parts.push(t); chars += t.length + 1; }
      } else if (node instanceof Element) {
        if (/^(?:script|style|noscript|template)$/i.test(node.localName)) continue;
        const t = joinNorm([node.getAttribute('aria-label'), node.getAttribute('title')], Math.min(220, maxChars - chars));
        if (t) { parts.push(t); chars += t.length + 1; }
        if (node instanceof HTMLSlotElement) {
          let assigned = [];
          try { assigned = node.assignedNodes({ flatten: true }).slice(0, 18); } catch (_) {}
          for (const a of assigned) {
            if (chars >= maxChars) break;
            let st = '';
            if (a.nodeType === Node.TEXT_NODE) st = a.data || '';
            else if (a instanceof Element) st = joinNorm([a.getAttribute('aria-label'), a.getAttribute('title'), a.getAttribute('data-testid')], Math.min(260, maxChars - chars));
            st = norm(st, Math.min(260, maxChars - chars));
            if (st) { parts.push(st); chars += st.length + 1; }
          }
        }
      }
    }
    return norm(parts.join(' '), maxChars);
  }

  function textFlags(text) {
    if (!text || text.length > 1400) return 0;
    const compact = compactSemantic(text);
    const nonLatin = hasNonLatin(text);
    let f = 0;
    if (AUTH_ACTION.test(text)) f |= F.AUTH;
    if (LEGAL.test(text) || COMPACT_LEGAL.test(compact) || (nonLatin && LEGAL.test(compact))) f |= F.LEGAL;
    if (ASSENT.test(text) || COMPACT_ASSENT.test(compact) || (nonLatin && ASSENT.test(compact))) f |= F.ASSENT;
    if (REQUIRED_TEXT.test(text) || COMPACT_REQUIRED.test(compact) || (nonLatin && REQUIRED_TEXT.test(compact))) f |= F.REQUIRED;
    if (NON_AUTH.test(text) || (nonLatin && NON_AUTH.test(compact))) f |= F.NON_AUTH;
    return f;
  }

  function isConsentControl(el) {
    if (!(el instanceof Element)) return false;
    if (el instanceof HTMLInputElement && /^(checkbox|radio)$/i.test(el.type || el.getAttribute('type') || '')) return true;
    const role = (el.getAttribute('role') || '').toLowerCase();
    return role === 'checkbox' || role === 'radio' || role === 'switch' || el.hasAttribute('aria-checked');
  }

  function elementFlags(el) {
    if (!(el instanceof Element)) return 0;
    let f = 0;
    if (isConsentControl(el)) f |= F.CONTROL;
    if (el.hasAttribute('required') || el.getAttribute('aria-required') === 'true') f |= F.REQUIRED;
    if (el instanceof HTMLInputElement) {
      const type = (el.type || el.getAttribute('type') || 'text').toLowerCase();
      const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
      if (type === 'password' || ac.includes('current-password') || ac.includes('new-password') || ac === 'one-time-code' || ac.includes('otp')) f |= F.STRONG_AUTH;
      if (type === 'tel' || type === 'email' || ac.includes('tel') || ac.includes('email') || ac.includes('username')) f |= F.CREDENTIAL;
    }
    const attrs = joinNorm([el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('name'), el.getAttribute('placeholder'), el.getAttribute('autocomplete'), el.getAttribute('data-testid'), el.id], 900);
    if (AUTH_ATTR.test(attrs)) f |= F.AUTH;
    if (CREDENTIAL_ATTR.test(attrs)) f |= F.CREDENTIAL;
    if (LEGAL_ATTR.test(attrs)) f |= F.LEGAL;
    if (NON_AUTH.test(attrs)) f |= F.NON_AUTH;
    f |= textFlags(attrs);
    return f;
  }

  function activationReason(flags) {
    if (flags & F.STRONG_AUTH) return 'strong-auth';
    if ((flags & F.AUTH) && (flags & F.CREDENTIAL) && !(flags & F.NON_AUTH)) return 'auth-credential';
    if ((flags & F.LEGAL) && (flags & F.ASSENT) && ((flags & F.CONTROL) || (flags & F.AUTH))) return 'legal-assent';
    if ((flags & F.LEGAL) && (flags & F.REQUIRED) && (flags & F.CONTROL)) return 'mandatory-legal-control';
    if ((flags & F.AUTH) && (flags & F.LEGAL) && (flags & F.CONTROL)) return 'auth-legal-control';
    return '';
  }

  function localScope(node) {
    const el = node instanceof Element ? node : node?.parentElement;
    if (!(el instanceof Element)) return null;
    const strong = el.closest?.('form,dialog,[role="dialog"],[aria-modal="true"]');
    if (strong) return strong;
    let p = el;
    for (let i = 0; i < 4 && p?.parentElement; i++, p = p.parentElement) {
      if (p.matches?.('section,aside,footer,header,main,article,div,li')) return p;
    }
    return el.parentElement || el;
  }

  function scanEvidence(root, maxNodes = 84, budgetMs = 0.9, allowComposite = true) {
    if (!root) return { hit: false, flags: 0, truncated: false, seed: null };
    if (root.nodeType === Node.TEXT_NODE) {
      const flags = textFlags(root.data || '');
      return { hit: false, flags, truncated: false, seed: root.parentElement };
    }
    if (!(root instanceof Element || root instanceof DocumentFragment || root instanceof Document || root instanceof ShadowRoot)) return { hit: false, flags: 0, truncated: false, seed: null };

    let flags = root instanceof Element ? elementFlags(root) : 0;
    let reason = allowComposite ? activationReason(flags) : ((flags & F.STRONG_AUTH) ? 'strong-auth' : '');
    if (reason) return { hit: true, flags, reason, truncated: false, seed: root instanceof Element ? root : null };

    // A legal sentence can be split through several inline elements, including through the
    // middle of a word. Only local/composite scopes with an actual consent control get this
    // bounded aggregate pass; whole-document discovery never concatenates arbitrary page text.
    if (allowComposite && root?.querySelector) {
      let hasControl = root instanceof Element && isConsentControl(root);
      if (!hasControl) { try { hasControl = !!root.querySelector('input[type="checkbox"],input[type="radio"],[role="checkbox"],[role="radio"],[role="switch"],[aria-checked]'); } catch (_) {} }
      if (hasControl) {
        flags |= textFlags(boundedEvidenceText(root));
        if ((reason = activationReason(flags))) return { hit: true, flags, reason, truncated: false, seed: root instanceof Element ? root : null };
      }
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    const start = performance.now();
    let count = 0;
    let node = null;
    while (count < maxNodes && performance.now() - start < budgetMs && (node = walker.nextNode())) {
      count++;
      let nf = 0;
      if (node.nodeType === Node.TEXT_NODE) nf = textFlags(node.data || '');
      else if (node instanceof Element) nf = elementFlags(node);
      if (!nf) continue;
      if (nf & F.STRONG_AUTH) return { hit: true, flags: flags | nf, reason: 'strong-auth', truncated: false, seed: node instanceof Element ? node : node.parentElement };
      flags |= nf;
      if (allowComposite && (reason = activationReason(flags))) return { hit: true, flags, reason, truncated: false, seed: node instanceof Element ? node : node.parentElement };

      // On a whole-document scan, weak evidence is only allowed to combine inside a local UI
      // container. This prevents footer Terms + newsletter Email from becoming a false activation.
      if (!allowComposite && (nf & (F.AUTH | F.LEGAL | F.ASSENT | F.CONTROL | F.CREDENTIAL))) {
        const scope = localScope(node);
        if (scope && !localChecked.has(scope)) {
          localChecked.add(scope);
          const local = scanEvidence(scope, 96, 0.75, true);
          if (local.hit) return local;
          if (local.truncated) queueDeep(scope, true);
        }
      }
    }
    return { hit: false, flags, truncated: !!walker.nextNode(), seed: null };
  }

  function attachEvents() {
    if (eventsAttached) return;
    eventsAttached = true;
    addEventListener('focusin', onFocus, true);
    addEventListener('pointerdown', onPointer, true);
  }

  function detachEvents() {
    if (!eventsAttached) return;
    eventsAttached = false;
    removeEventListener('focusin', onFocus, true);
    removeEventListener('pointerdown', onPointer, true);
  }

  function activate(reason, seed = null) {
    if (requested || paused) return;
    requested = true;
    globalThis.__AUTO_AGREE_BOOTSTRAP_CONTEXT__ = { reason, seed };
    observer?.disconnect();
    detachEvents();
    detachLifecycle();
    batchJobs.length = 0;
    deepJobs.length = 0;
    chrome.runtime.sendMessage({ type: 'AUTO_AGREE_ACTIVATE', reason }, response => {
      if (chrome.runtime.lastError || !response?.ok) {
        requested = false;
        attachLifecycle();
        if (document.visibilityState === 'hidden' || document.prerendering) paused = true;
        else { paused = false; attachEvents(); startObserver(); }
      }
    });
  }

  function postBackground(fn) {
    if (globalThis.scheduler?.postTask) scheduler.postTask(fn, { priority: 'background' }).catch(() => setTimeout(fn, 0));
    else if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: 250 });
    else setTimeout(fn, 0);
  }

  function releaseDeep(job) {
    const root = job?.rootRef?.deref?.();
    if (root) deepQueued.delete(root);
  }

  function queueDeep(root, allowComposite = true) {
    if (requested || paused || !root || deepQueued.has(root) || !rootConnected(root)) return;
    deepQueued.add(root);
    while (deepJobs.length >= MAX_DEEP_JOBS) releaseDeep(deepJobs.shift());
    deepJobs.push({ rootRef: new WeakRef(root), cursorRef: null, started: false, flags: 0, allowComposite, createdAt: performance.now() });
    scheduleBackground();
  }

  function queueBatch(nodes, index, owner) {
    if (!nodes?.length || index >= nodes.length) return;
    while (batchJobs.length >= MAX_BATCH_JOBS) batchJobs.shift();
    const ownerRef = owner instanceof Element ? new WeakRef(owner) : null;
    const remaining = nodes.length - index;
    if (remaining > LARGE_BATCH) {
      const first = nodes[index], last = nodes[nodes.length - 1];
      if (first instanceof Node && last instanceof Node) {
        batchJobs.push({ mode: 'range', ownerRef, currentRef: new WeakRef(first), lastRef: new WeakRef(last), createdAt: performance.now() });
      }
    } else {
      const refs = [];
      for (let i = index; i < nodes.length; i++) if (nodes[i] instanceof Node) refs.push(new WeakRef(nodes[i]));
      if (refs.length) batchJobs.push({ mode: 'refs', ownerRef, refs, index: 0, createdAt: performance.now() });
    }
    scheduleBackground();
  }

  function inspectNode(node, allowComposite = true, budget = 0.45) {
    if (!node) return null;
    const result = scanEvidence(node, 64, budget, allowComposite);
    if (result.hit) return result;
    if (result.truncated) queueDeep(node, allowComposite);
    return null;
  }

  function drainDeep(job, start) {
    const root = job?.rootRef?.deref?.();
    if (!root || !rootConnected(root)) return { done: true };
    let node = job.started ? job.cursorRef?.deref?.() : root.firstChild;
    job.started = true;
    if (node && !(node === root || root.contains(node))) node = root.firstChild;
    while (performance.now() - start < BACKGROUND_BUDGET_MS && node) {
      const next = nextNode(node, root);
      job.cursorRef = next instanceof Node ? new WeakRef(next) : null;
      let nf = node.nodeType === Node.TEXT_NODE ? textFlags(node.data || '') : (node instanceof Element ? elementFlags(node) : 0);
      if (node instanceof Element && isConsentControl(node)) {
        const scope = localScope(node);
        if (scope) {
          const local = scanEvidence(scope, 110, 0.7, true);
          if (local.hit) return { hit: true, reason: `deep-local-${local.reason || 'evidence'}`, seed: local.seed || scope };
        }
      }
      if (nf & F.STRONG_AUTH) return { hit: true, reason: 'deep-strong-auth', seed: node instanceof Element ? node : node.parentElement };
      job.flags |= nf;
      if (job.allowComposite) {
        const reason = activationReason(job.flags);
        if (reason) return { hit: true, reason: `deep-${reason}`, seed: node instanceof Element ? node : node.parentElement };
      } else if (nf) {
        const scope = localScope(node);
        if (scope && !localChecked.has(scope)) {
          localChecked.add(scope);
          const local = scanEvidence(scope, 110, 0.7, true);
          if (local.hit) return { hit: true, reason: `deep-local-${local.reason || 'evidence'}`, seed: local.seed || scope };
        }
      }
      node = next;
    }
    return { done: !node };
  }

  async function drainBackground(epoch = lifecycleEpoch) {
    if (paused || epoch !== lifecycleEpoch) { if (backgroundEpoch === epoch) backgroundRunning = false; return; }
    try {
      let rounds = 0;
      while (!requested && !paused && epoch === lifecycleEpoch && (batchJobs.length || deepJobs.length) && rounds++ < 20) {
        const start = performance.now();
        while (batchJobs.length && performance.now() - start < BACKGROUND_BUDGET_MS) {
          const job = batchJobs[0];
          const owner = job.ownerRef?.deref?.();
          if (performance.now() - job.createdAt > JOB_TTL_MS || (job.ownerRef && (!(owner instanceof Element) || !owner.isConnected))) { batchJobs.shift(); continue; }
          let done = false;
          while (performance.now() - start < BACKGROUND_BUDGET_MS && !done) {
            let node = null;
            if (job.mode === 'refs') {
              node = job.refs[job.index++]?.deref?.() || null;
              done = job.index >= job.refs.length;
            } else {
              node = job.currentRef?.deref?.() || null;
              const last = job.lastRef?.deref?.();
              if (!node) {
                if (owner instanceof Element && owner.isConnected) queueDeep(owner, true);
                done = true;
              } else {
                const isLast = node === last;
                const next = node.nextSibling;
                job.currentRef = next instanceof Node ? new WeakRef(next) : null;
                done = isLast || !next;
              }
            }
            if (node && (!(node instanceof Element) || node.isConnected)) {
              const hit = inspectNode(node, true, 0.35);
              if (hit) return activate(`mutation-${hit.reason || 'evidence'}`, hit.seed || node);
            }
          }
          if (done) batchJobs.shift();
        }
        if (!batchJobs.length && deepJobs.length && performance.now() - start < BACKGROUND_BUDGET_MS) {
          const job = deepJobs[0];
          const root = job?.rootRef?.deref?.();
          if (performance.now() - job.createdAt > JOB_TTL_MS || !root || !rootConnected(root)) releaseDeep(deepJobs.shift());
          else {
            const out = drainDeep(job, start);
            if (out.hit) return activate(out.reason, out.seed);
            if (out.done) releaseDeep(deepJobs.shift());
          }
        }
        if ((batchJobs.length || deepJobs.length) && globalThis.scheduler?.yield) { await scheduler.yield(); if (paused || epoch !== lifecycleEpoch) break; }
        else break;
      }
    } finally {
      if (backgroundEpoch === epoch) backgroundRunning = false;
      if (!requested && !paused && epoch === lifecycleEpoch && (batchJobs.length || deepJobs.length)) scheduleBackground();
    }
  }

  function scheduleBackground() {
    if (requested || paused || backgroundRunning || (!batchJobs.length && !deepJobs.length)) return;
    backgroundRunning = true;
    const epoch = lifecycleEpoch;
    backgroundEpoch = epoch;
    postBackground(() => drainBackground(epoch));
  }

  function sampleLargeBatch(nodes) {
    const n = nodes.length;
    const indices = [0, 1, 2, n - 5, n - 4, n - 3, n - 2, n - 1];
    const seen = new Set();
    for (const i of indices) {
      if (i < 0 || i >= n || seen.has(i)) continue;
      seen.add(i);
      const hit = inspectNode(nodes[i], true, 0.18);
      if (hit) return hit;
    }
    return null;
  }

  function onMutations(records) {
    if (requested || paused) return;
    const start = performance.now();
    for (const record of records) {
      if (record.type === 'childList') {
        const nodes = record.addedNodes;
        if (nodes.length > LARGE_BATCH) {
          const hit = sampleLargeBatch(nodes);
          if (hit) return activate(`mutation-sample-${hit.reason || 'evidence'}`, hit.seed);
          queueBatch(nodes, 0, record.target);
          continue;
        }
        for (let i = 0; i < nodes.length; i++) {
          if (performance.now() - start >= SYNC_MUTATION_BUDGET_MS) { queueBatch(nodes, i, record.target); break; }
          const hit = inspectNode(nodes[i], true, Math.min(0.35, Math.max(0.12, SYNC_MUTATION_BUDGET_MS - (performance.now() - start))));
          if (hit) return activate(`mutation-${hit.reason || 'evidence'}`, hit.seed || nodes[i]);
        }
      } else if (record.type === 'characterData') {
        const nf = textFlags(record.target?.data || '');
        if (nf & (F.AUTH | F.LEGAL | F.ASSENT)) {
          const scope = localScope(record.target);
          if (scope) {
            const hit = scanEvidence(scope, 88, 0.45, true);
            if (hit.hit) return activate(`text-${hit.reason || 'evidence'}`, hit.seed || scope);
            if (hit.truncated) queueDeep(scope, true);
          }
        }
      } else if (record.type === 'attributes') {
        const target = record.target;
        if (!(target instanceof Element)) continue;
        const ef = elementFlags(target);
        if (ef & F.STRONG_AUTH) return activate('attribute-strong-auth', target);
        if (ef & (F.AUTH | F.CREDENTIAL | F.LEGAL | F.ASSENT | F.CONTROL | F.REQUIRED)) {
          const scope = localScope(target);
          if (scope) {
            const hit = scanEvidence(scope, 84, 0.4, true);
            if (hit.hit) return activate(`attribute-${hit.reason || 'evidence'}`, hit.seed || target);
          }
        }
      }
    }
  }

  function probeEventShadow(event) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    for (const node of path) {
      if (!(node instanceof HTMLElement)) continue;
      let root = node.shadowRoot;
      if (!root && chrome.dom?.openOrClosedShadowRoot) {
        try { root = chrome.dom.openOrClosedShadowRoot(node); } catch (_) {}
      }
      if (!(root instanceof ShadowRoot)) continue;
      const hit = scanEvidence(root, 120, 0.75, true);
      if (hit.hit) { activate(`event-shadow-${hit.reason || 'evidence'}`, node); return true; }
      if (hit.truncated) queueDeep(root, true);
    }
    return false;
  }

  function onFocus(event) {
    if (requested || paused || probeEventShadow(event)) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const ef = elementFlags(target);
    if (ef & F.STRONG_AUTH) return activate('focus-strong-auth', target);
    const scope = localScope(target);
    if (!scope) return;
    const hit = scanEvidence(scope, 100, 0.6, true);
    if (hit.hit) activate(`focus-${hit.reason || 'evidence'}`, hit.seed || target);
    else if (hit.truncated) queueDeep(scope, true);
  }

  function onPointer(event) {
    if (requested || paused || probeEventShadow(event)) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const scope = localScope(target);
    if (!scope) return;
    const hit = scanEvidence(scope, 96, 0.55, true);
    if (hit.hit) activate(`pointer-${hit.reason || 'evidence'}`, hit.seed || target);
  }

  function edgeProbe(root) {
    if (!(root instanceof Element)) return null;
    const queue = [root];
    const seen = new WeakSet();
    let checked = 0;
    while (queue.length && checked++ < 28) {
      const el = queue.shift();
      if (!(el instanceof Element) || seen.has(el)) continue;
      seen.add(el);
      const hit = scanEvidence(el, 72, 0.42, true);
      if (hit.hit) return hit;
      const children = el.children;
      for (let i = 0; i < Math.min(3, children.length); i++) queue.push(children[i]);
      for (let i = Math.max(3, children.length - 4); i < children.length; i++) if (i >= 0) queue.push(children[i]);
    }
    return null;
  }

  function startObserver() {
    if (requested || paused) return;
    if (!observer) observer = new MutationObserver(onMutations);
    try {
      observer.observe(document, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['type','role','aria-required','aria-label','title','name','placeholder','autocomplete','data-testid']
      });
    } catch (_) {}

    if (document.documentElement) {
      const probeSeed = globalThis.__AUTO_AGREE_PROBE_CONTEXT__?.seed;
      const seedEl = probeSeed instanceof Element ? probeSeed : probeSeed?.parentElement;
      if (seedEl instanceof Element && seedEl.isConnected) {
        let seedShadow = seedEl.shadowRoot;
        if (!seedShadow && seedEl instanceof HTMLElement && chrome.dom?.openOrClosedShadowRoot) {
          try { seedShadow = chrome.dom.openOrClosedShadowRoot(seedEl); } catch (_) {}
        }
        if (seedShadow instanceof ShadowRoot) {
          const shadowHit = scanEvidence(seedShadow, 144, 1.15, true);
          if (shadowHit.hit) return activate(`probe-seed-shadow-${shadowHit.reason || 'evidence'}`, seedEl);
          if (shadowHit.truncated) queueDeep(seedShadow, true);
        }
        const scope = localScope(seedEl) || seedEl;
        const local = scanEvidence(scope, 112, 1.0, true);
        if (local.hit) return activate(`probe-seed-${local.reason || 'evidence'}`, local.seed || seedEl);
        if (local.truncated) queueDeep(scope, true);
      }
      // Probe structural edges next: login modals/forms are commonly appended near the tail of a
      // large SPA. This finds them without scanning thousands of unrelated settings controls.
      const edge = edgeProbe(document.documentElement);
      if (edge?.hit) return activate(`initial-edge-${edge.reason || 'evidence'}`, edge.seed || document.documentElement);
      // Whole-document scans only allow composite weak evidence inside local UI containers.
      const initial = scanEvidence(document.documentElement, 128, 2.2, false);
      if (initial.hit) activate(`initial-${initial.reason || 'evidence'}`, initial.seed || document.documentElement);
      else if (initial.truncated) queueDeep(document.documentElement, false);
    }
  }

  function clearGateWork() {
    for (const job of deepJobs) releaseDeep(job);
    deepJobs.length = 0;
    batchJobs.length = 0;
    backgroundRunning = false;
  }

  function pauseGate() {
    if (paused || requested) return;
    paused = true;
    lifecycleEpoch++;
    observer?.disconnect();
    detachEvents();
    clearGateWork();
  }

  function resumeGate() {
    if (!paused || requested || document.prerendering || document.visibilityState === 'hidden') return;
    paused = false;
    lifecycleEpoch++;
    localChecked = new WeakSet();
    attachEvents();
    startObserver();
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') pauseGate();
    else resumeGate();
  }
  function onPageHide(event) {
    if (event?.persisted) pauseGate();
    else { pauseGate(); detachLifecycle(); }
  }
  function onPageShow(event) { if (event?.persisted) resumeGate(); }
  function onFreeze() { pauseGate(); }
  function onResume() { resumeGate(); }

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

  attachLifecycle();
  if (document.visibilityState === 'hidden') paused = true;
  else { attachEvents(); startObserver(); }
})();
