(() => {
  'use strict';
  if (globalThis.__AUTO_AGREE_BOOTSTRAP__) return;
  globalThis.__AUTO_AGREE_BOOTSTRAP__ = '4.0.0';

  // v4 bootstrap is an evidence gate, not a keyword gate. Weak signals such as a footer
  // "Privacy Policy" link or a newsletter email field must never load the full engine alone.
  const AUTH_ACTION = /(?:登录|登入|登陆|注册|註冊|验证码登录|驗證碼登入|获取验证码|獲取驗證碼|发送验证码|發送驗證碼|login|log\s*in|sign\s*in|sign\s*up|register|verify|verification\s*code|connexion|anmelden|iniciar\s+sesi[oó]n|ログイン|로그인|войти|تسجيل\s+الدخول|inloggen|zaloguj|giriş\s+yap|đăng\s+nhập|masuk|เข้าสู่ระบบ|लॉग\s*इन|σύνδεση|התחברות|logga\s+in|logg\s+inn|log\s+ind)/iu;
  const LEGAL = /(?:用户协议|使用协议|服务协议|服務協議|平台协议|会员协议|许可协议|條款|条款|隐私(?:政策|协议|条款|声明)|隱私(?:政策|協議|條款|聲明)|terms?(?:\s+of\s+(?:service|use))?|privacy\s+(?:policy|notice|agreement|terms)|user\s+agreement|eula|利用規約|プライバシー|이용약관|개인정보|услов|конфиденц|الشروط|الخصوصية|voorwaarden|privacybeleid|warunki|prywatno|kullanım|gizlilik|điều\s+khoản|quyền\s+riêng|syarat|privasi|ข้อกำหนด|ความเป็นส่วนตัว|नियम|शर्तें|गोपनीयता|όροι|απορρήτου|תנאי|פרטיות|villkor|integritet|vilkår|personvern|betingelser|privatliv)/iu;
  const ASSENT = /(?:我已|本人已|已)?\s*(?:阅读|閱讀|阅悉|閱悉|知悉)?\s*(?:并|並)?\s*(?:同意|接受|遵守)|(?:同意|接受)(?:上述|以上|相关|相關)?|(?:i\s+)?(?:have\s+)?(?:read\s+(?:and|&)\s+)?(?:agree|accept)(?:\s+to)?|i\s+consent\s+to|同意します|동의|соглас|أوافق|akkoord|zgadzam|kabul|đồng\s+ý|setuju|ยอมรับ|सहमत|συμφωνώ|מסכים|godkänner|godtar|accepterer/iu;
  const REQUIRED_TEXT = /(?:必选|必須|必须|需(?:要)?同意|请先(?:阅读|閱讀)?(?:并|並)?同意|請先(?:閱讀)?(?:並)?同意|required|mandatory|must\s+(?:agree|accept)|please\s+(?:agree|accept))/iu;
  const CREDENTIAL_ATTR = /(?:phone|mobile|tel|email|username|user.?name|account|账号|帳號|手机号|手機號|邮箱|郵箱)/iu;
  const AUTH_ATTR = /(?:login|signin|sign-in|signup|sign-up|register|auth|verify|verification|otp|password|验证码|驗證碼|登录|登入|注册|註冊)/iu;
  const LEGAL_ATTR = /(?:agree|accept|terms?|privacy|agreement|consent|同意|接受|协议|協議|条款|條款|隐私|隱私)/iu;

  const F = Object.freeze({ AUTH: 1, STRONG_AUTH: 2, CREDENTIAL: 4, LEGAL: 8, ASSENT: 16, CONTROL: 32, REQUIRED: 64 });
  const LARGE_BATCH = 96;
  const SYNC_MUTATION_BUDGET_MS = 1.6;
  const BACKGROUND_BUDGET_MS = 2.5;
  const MAX_BATCH_JOBS = 6;
  const MAX_DEEP_JOBS = 10;
  const JOB_TTL_MS = 2400;

  let requested = false;
  let observer = null;
  let backgroundRunning = false;
  const batchJobs = [];
  const deepJobs = [];
  const deepQueued = new WeakSet();
  const localChecked = new WeakSet();

  function norm(value, max = 1000) {
    if (!value) return '';
    const s = String(value).replace(/\s+/gu, ' ').trim();
    return s.length > max ? s.slice(0, max) : s;
  }

  function textFlags(text) {
    if (!text || text.length > 1400) return 0;
    let f = 0;
    if (AUTH_ACTION.test(text)) f |= F.AUTH;
    if (LEGAL.test(text)) f |= F.LEGAL;
    if (ASSENT.test(text)) f |= F.ASSENT;
    if (REQUIRED_TEXT.test(text)) f |= F.REQUIRED;
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
    const attrs = norm(`${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''} ${el.getAttribute('name') || ''} ${el.getAttribute('placeholder') || ''} ${el.getAttribute('autocomplete') || ''} ${el.getAttribute('data-testid') || ''} ${el.id || ''}`, 900);
    if (AUTH_ATTR.test(attrs)) f |= F.AUTH;
    if (CREDENTIAL_ATTR.test(attrs)) f |= F.CREDENTIAL;
    if (LEGAL_ATTR.test(attrs)) f |= F.LEGAL;
    f |= textFlags(attrs);
    return f;
  }

  function activationReason(flags) {
    if (flags & F.STRONG_AUTH) return 'strong-auth';
    if ((flags & F.AUTH) && (flags & F.CREDENTIAL)) return 'auth-credential';
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

  function activate(reason, seed = null) {
    if (requested) return;
    requested = true;
    globalThis.__AUTO_AGREE_BOOTSTRAP_CONTEXT__ = { reason, seed };
    observer?.disconnect();
    chrome.runtime.sendMessage({ type: 'AUTO_AGREE_ACTIVATE', reason }, response => {
      if (chrome.runtime.lastError || !response?.ok) {
        requested = false;
        startObserver();
      }
    });
  }

  function postBackground(fn) {
    if (globalThis.scheduler?.postTask) scheduler.postTask(fn, { priority: 'background' }).catch(() => setTimeout(fn, 0));
    else if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: 250 });
    else setTimeout(fn, 0);
  }

  function queueDeep(root, allowComposite = true) {
    if (requested || !root || deepQueued.has(root)) return;
    if (root instanceof Element && !root.isConnected) return;
    deepQueued.add(root);
    if (deepJobs.length >= MAX_DEEP_JOBS) deepJobs.shift();
    deepJobs.push({ root, walker: document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT), flags: 0, allowComposite, createdAt: performance.now() });
    scheduleBackground();
  }

  function queueBatch(nodes, index, owner) {
    while (batchJobs.length >= MAX_BATCH_JOBS) batchJobs.shift();
    batchJobs.push({ nodes, index, owner, createdAt: performance.now() });
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
    while (performance.now() - start < BACKGROUND_BUDGET_MS) {
      const node = job.walker.nextNode();
      if (!node) return { done: true };
      let nf = node.nodeType === Node.TEXT_NODE ? textFlags(node.data || '') : (node instanceof Element ? elementFlags(node) : 0);
      if (!nf) continue;
      if (nf & F.STRONG_AUTH) return { hit: true, reason: 'deep-strong-auth', seed: node instanceof Element ? node : node.parentElement };
      job.flags |= nf;
      if (job.allowComposite) {
        const reason = activationReason(job.flags);
        if (reason) return { hit: true, reason: `deep-${reason}`, seed: node instanceof Element ? node : node.parentElement };
      } else {
        const scope = localScope(node);
        if (scope && !localChecked.has(scope)) {
          localChecked.add(scope);
          const local = scanEvidence(scope, 110, 0.7, true);
          if (local.hit) return { hit: true, reason: `deep-local-${local.reason || 'evidence'}`, seed: local.seed || scope };
        }
      }
    }
    return { done: false };
  }

  async function drainBackground() {
    try {
      let rounds = 0;
      while (!requested && (batchJobs.length || deepJobs.length) && rounds++ < 20) {
        const start = performance.now();
        while (batchJobs.length && performance.now() - start < BACKGROUND_BUDGET_MS) {
          const job = batchJobs[0];
          if (performance.now() - job.createdAt > JOB_TTL_MS || (job.owner instanceof Element && !job.owner.isConnected)) { batchJobs.shift(); continue; }
          while (job.index < job.nodes.length && performance.now() - start < BACKGROUND_BUDGET_MS) {
            const node = job.nodes[job.index++];
            const hit = inspectNode(node, true, 0.35);
            if (hit) return activate(`mutation-${hit.reason || 'evidence'}`, hit.seed || node);
          }
          if (job.index >= job.nodes.length) batchJobs.shift();
        }
        if (!batchJobs.length && deepJobs.length && performance.now() - start < BACKGROUND_BUDGET_MS) {
          const job = deepJobs[0];
          if (performance.now() - job.createdAt > JOB_TTL_MS || (job.root instanceof Element && !job.root.isConnected)) deepJobs.shift();
          else {
            const out = drainDeep(job, start);
            if (out.hit) return activate(out.reason, out.seed);
            if (out.done) deepJobs.shift();
          }
        }
        if ((batchJobs.length || deepJobs.length) && globalThis.scheduler?.yield) await scheduler.yield();
        else break;
      }
    } finally {
      backgroundRunning = false;
      if (!requested && (batchJobs.length || deepJobs.length)) scheduleBackground();
    }
  }

  function scheduleBackground() {
    if (requested || backgroundRunning || (!batchJobs.length && !deepJobs.length)) return;
    backgroundRunning = true;
    postBackground(drainBackground);
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
    if (requested || probeEventShadow(event)) return;
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
    if (requested || probeEventShadow(event)) return;
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
    if (requested) return;
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
      // Probe structural edges first: login modals/forms are commonly appended near the tail of a
      // large SPA. This finds them without scanning thousands of unrelated settings controls.
      const edge = edgeProbe(document.documentElement);
      if (edge?.hit) return activate(`initial-edge-${edge.reason || 'evidence'}`, edge.seed || document.documentElement);
      // Whole-document scans only allow composite weak evidence inside local UI containers.
      const initial = scanEvidence(document.documentElement, 128, 2.2, false);
      if (initial.hit) activate(`initial-${initial.reason || 'evidence'}`, initial.seed || document.documentElement);
      else if (initial.truncated) queueDeep(document.documentElement, false);
    }
  }

  addEventListener('focusin', onFocus, true);
  addEventListener('pointerdown', onPointer, true);
  startObserver();
})();
