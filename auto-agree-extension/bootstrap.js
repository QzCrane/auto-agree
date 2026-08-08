(() => {
  'use strict';
  if (globalThis.__AUTO_AGREE_BOOTSTRAP__) return;
  globalThis.__AUTO_AGREE_BOOTSTRAP__ = '3.0.0';

  const TEXT_HINT = /(?:登录|登入|登陆|注册|註冊|手机号|手機號|验证码|驗證碼|获取验证码|獲取驗證碼|发送验证码|發送驗證碼|同意|接受|协议|協議|条款|條款|隐私|隱私|login|log\s*in|sign\s*in|sign\s*up|register|verification\s*code|\botp\b|agree|accept|terms?|privacy|agreement|eula|利用規約|プライバシー|同意します|로그인|동의|약관|개인정보|conditions?\s+d['’]utilisation|confidentialit[eé]|accepte|nutzungsbedingungen|datenschutz|akzeptiere|stimme\s+zu|t[eé]rminos|privacidad|acepto|termos|privacidade|aceito|termini|accetto|услов|конфиденц|соглас|الشروط|الخصوصية|أوافق|voorwaarden|privacybeleid|akkoord|warunki|prywatno|zgadzam|kullanım|gizlilik|kabul|điều\s+khoản|quyền\s+riêng|đồng\s+ý|syarat|privasi|setuju|ข้อกำหนด|ความเป็นส่วนตัว|ยอมรับ|नियम|शर्तें|गोपनीयता|सहमत|όροι|απορρήτου|συμφωνώ|תנאי|פרטיות|מסכים|villkor|integritet|vilkår|personvern|betingelser|privatliv)/iu;
  const ATTR_HINT = /(?:login|signin|signup|register|phone|mobile|tel|otp|verification|code|email|password|agree|accept|terms?|privacy|agreement|登录|登入|注册|註冊|手机号|手機號|验证码|驗證碼|同意|协议|協議|条款|條款|隐私|隱私)/iu;
  // Generic checkboxes are deliberately NOT an activation signal. Settings/admin pages may
  // contain thousands of them. Legal/auth text, credential controls, or explicitly-required
  // consent controls activate the full engine instead.

  let requested = false;
  let observer = null;
  const LARGE_BATCH = 96;
  const SYNC_MUTATION_BUDGET_MS = 2.0;
  const BACKGROUND_BUDGET_MS = 3.0;
  const MAX_BATCH_JOBS = 6;
  const MAX_DEEP_JOBS = 12;
  const JOB_TTL_MS = 2500;
  const batchJobs = [];
  const deepJobs = [];
  const deepQueued = new WeakSet();
  let batchScheduled = false;

  function strongControl(el) {
    if (!(el instanceof HTMLInputElement)) return false;
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    if (type === 'password' || type === 'tel' || type === 'email') return true;
    const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
    return ac === 'one-time-code' || ac.includes('tel') || ac.includes('otp');
  }

  function hintAttrs(el) {
    if (!(el instanceof Element)) return false;
    const value = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''} ` +
      `${el.getAttribute('name') || ''} ${el.getAttribute('placeholder') || ''} ` +
      `${el.getAttribute('autocomplete') || ''} ${el.getAttribute('data-testid') || ''}`;
    return ATTR_HINT.test(value);
  }

  function scanHint(root, maxNodes = 80, budgetMs = 1.25) {
    if (!root) return { hit: false, truncated: false };
    if (root.nodeType === Node.TEXT_NODE) {
      const data = root.data;
      return { hit: !!(data && data.length <= 1200 && TEXT_HINT.test(data)), truncated: false };
    }
    if (!(root instanceof Element || root instanceof DocumentFragment || root instanceof Document)) return { hit: false, truncated: false };
    if (root instanceof Element) {
      if (strongControl(root) || (root.hasAttributes?.() && hintAttrs(root))) return { hit: true, truncated: false };
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    const start = performance.now();
    let count = 0;
    while (count < maxNodes && performance.now() - start < budgetMs) {
      const node = walker.nextNode();
      if (!node) return { hit: false, truncated: false };
      count++;
      if (node.nodeType === Node.TEXT_NODE) {
        const data = node.data;
        if (data && data.length <= 1200 && TEXT_HINT.test(data)) return { hit: true, truncated: false };
      } else if (node instanceof Element && (strongControl(node) || (node.hasAttributes?.() && hintAttrs(node)))) {
        return { hit: true, truncated: false };
      }
    }
    return { hit: false, truncated: !!walker.nextNode() };
  }

  function boundedHint(root) { return scanHint(root).hit; }

  function queueDeepHint(root) {
    if (requested || !(root instanceof Element || root instanceof DocumentFragment || root instanceof Document) || deepQueued.has(root)) return;
    if (root instanceof Element && !root.isConnected) return;
    deepQueued.add(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    if (deepJobs.length >= MAX_DEEP_JOBS) deepJobs.shift();
    deepJobs.push({ root, walker, checkedRoot: false, createdAt: performance.now() });
    scheduleBatchDrain();
  }

  function deepNodeHit(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const data = node.data;
      return !!(data && data.length <= 1200 && TEXT_HINT.test(data));
    }
    return node instanceof Element && (strongControl(node) || (node.hasAttributes?.() && hintAttrs(node)));
  }

  function drainDeepSlice(job, start) {
    if (!job.checkedRoot) {
      job.checkedRoot = true;
      if (deepNodeHit(job.root)) return { hit: job.root, done: true };
    }
    while (performance.now() - start < BACKGROUND_BUDGET_MS) {
      const node = job.walker.nextNode();
      if (!node) return { hit: null, done: true };
      if (deepNodeHit(node)) return { hit: node, done: true };
    }
    return { hit: null, done: false };
  }

  function batchHint(node) {
    if (!node) return false;
    if (node.nodeType === Node.TEXT_NODE) {
      const data = node.data;
      return !!(data && data.length <= 1200 && TEXT_HINT.test(data));
    }
    if (!(node instanceof Element || node instanceof DocumentFragment)) return false;
    if (node instanceof Element && (strongControl(node) || (node.hasAttributes?.() && hintAttrs(node)))) return true;

    // Large MutationRecord batches are usually flat list/table updates. Check the node and its
    // immediate children without allocating a TreeWalker for every sibling. Only genuinely
    // nested nodes fall back to the bounded subtree detector.
    const children = node.childNodes;
    let nested = false;
    for (let i = 0; i < Math.min(children.length, 12); i++) {
      const child = children[i];
      if (child.nodeType === Node.TEXT_NODE) {
        const data = child.data;
        if (data && data.length <= 1200 && TEXT_HINT.test(data)) return true;
      } else if (child instanceof Element) {
        if (strongControl(child) || (child.hasAttributes?.() && hintAttrs(child))) return true;
        if (child.childNodes.length) nested = true;
      }
    }
    if (!nested) return false;
    const result = scanHint(node);
    if (!result.hit && result.truncated) queueDeepHint(node);
    return result.hit;
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
    if (globalThis.scheduler?.postTask) {
      scheduler.postTask(fn, { priority: 'background' }).catch(() => setTimeout(fn, 0));
    } else if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(fn, { timeout: 250 });
    } else {
      setTimeout(fn, 0);
    }
  }

  function enqueueBatch(nodes, index, owner) {
    while (batchJobs.length >= MAX_BATCH_JOBS) batchJobs.shift();
    batchJobs.push({ nodes, index, owner, createdAt: performance.now() });
    scheduleBatchDrain();
  }

  function scheduleBatchDrain() {
    if (requested || batchScheduled || (!batchJobs.length && !deepJobs.length)) return;
    batchScheduled = true;
    postBackground(drainBatchJobs);
  }

  async function drainBatchJobs() {
    if (requested) { batchJobs.length = 0; deepJobs.length = 0; batchScheduled = false; return; }
    let rounds = 0;
    while (!requested && (batchJobs.length || deepJobs.length) && rounds++ < 16) {
      const start = performance.now();
      while (batchJobs.length && performance.now() - start < BACKGROUND_BUDGET_MS) {
        const job = batchJobs[0];
        if (performance.now() - job.createdAt > JOB_TTL_MS || (job.owner instanceof Element && !job.owner.isConnected)) {
          const owner = job.owner;
          batchJobs.shift();
          if (owner instanceof Element && owner.isConnected) queueDeepHint(owner);
          continue;
        }
        while (job.index < job.nodes.length && performance.now() - start < BACKGROUND_BUDGET_MS) {
          const node = job.nodes[job.index++];
          if (batchHint(node)) {
            batchJobs.length = 0; deepJobs.length = 0; batchScheduled = false;
            return activate('mutation-batch', node);
          }
        }
        if (job.index >= job.nodes.length) batchJobs.shift();
      }
      if (!batchJobs.length && deepJobs.length && performance.now() - start < BACKGROUND_BUDGET_MS) {
        const job = deepJobs[0];
        if (performance.now() - job.createdAt > JOB_TTL_MS || (job.root instanceof Element && !job.root.isConnected)) deepJobs.shift();
        else {
          const result = drainDeepSlice(job, start);
          if (result.hit) {
            batchJobs.length = 0; deepJobs.length = 0; batchScheduled = false;
            return activate('deep-subtree', result.hit);
          }
          if (result.done) deepJobs.shift();
        }
      }
      if ((batchJobs.length || deepJobs.length) && globalThis.scheduler?.yield) await scheduler.yield();
      else break;
    }
    batchScheduled = false;
    scheduleBatchDrain();
  }

  function shallowBatchHint(node) {
    if (!node) return false;
    if (node.nodeType === Node.TEXT_NODE) {
      const data = node.data;
      return !!(data && data.length <= 1200 && TEXT_HINT.test(data));
    }
    if (!(node instanceof Element)) return false;
    if (strongControl(node) || (node.hasAttributes?.() && hintAttrs(node))) return true;
    const children = node.childNodes;
    for (let i = 0; i < Math.min(children.length, 6); i++) {
      const child = children[i];
      if (child.nodeType === Node.TEXT_NODE) {
        const data = child.data;
        if (data && data.length <= 1200 && TEXT_HINT.test(data)) return true;
      } else if (child instanceof Element && (strongControl(child) || (child.hasAttributes?.() && hintAttrs(child)))) return true;
    }
    return false;
  }

  function sampleLargeBatch(nodes) {
    const n = nodes.length;
    const seen = new Set();
    const indices = [0, 1, 2, n - 5, n - 4, n - 3, n - 2, n - 1];
    for (const i of indices) {
      if (i < 0 || i >= n || seen.has(i)) continue;
      seen.add(i);
      const node = nodes[i];
      if (shallowBatchHint(node)) return node;
    }
    return null;
  }

  function onMutations(records) {
    const started = performance.now();
    for (let ri = 0; ri < records.length; ri++) {
      const record = records[ri];
      if (record.type === 'childList') {
        const nodes = record.addedNodes;
        if (nodes.length > LARGE_BATCH) {
          const hit = sampleLargeBatch(nodes);
          if (hit) return activate('mutation-sample', hit);
          enqueueBatch(nodes, 0, record.target);
          continue;
        }
        for (let i = 0; i < nodes.length; i++) {
          if (performance.now() - started >= SYNC_MUTATION_BUDGET_MS) {
            enqueueBatch(nodes, i, record.target);
            break;
          }
          const node = nodes[i];
          const remaining = Math.max(0.2, SYNC_MUTATION_BUDGET_MS - (performance.now() - started));
          const result = scanHint(node, 80, Math.min(0.7, remaining));
          if (result.hit) return activate('mutation', node);
          if (result.truncated) queueDeepHint(node);
        }
      } else if (record.type === 'characterData') {
        const target = record.target;
        const data = target?.data;
        if (data && data.length <= 1200 && TEXT_HINT.test(data)) return activate('text', target);
      } else if (record.type === 'attributes') {
        const target = record.target;
        if (!(target instanceof Element)) continue;
        if (strongControl(target) || (target.hasAttributes?.() && hintAttrs(target))) return activate('attribute', target);
        if ((record.attributeName === 'role' || record.attributeName === 'aria-required') && performance.now() - started < SYNC_MUTATION_BUDGET_MS) {
          const parent = target.parentElement;
          if (parent) {
            const result = scanHint(parent, 24, Math.min(0.35, Math.max(0.15, SYNC_MUTATION_BUDGET_MS - (performance.now() - started))));
            if (result.hit) return activate('attribute-context', target);
            if (result.truncated) queueDeepHint(parent);
          }
        }
      }
    }
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
        attributeFilter: ['type', 'role', 'aria-checked', 'aria-required', 'aria-label', 'title', 'name', 'placeholder', 'autocomplete']
      });
    } catch (_) {}
    if (document.documentElement) {
      const result = scanHint(document.documentElement);
      if (result.hit) activate('initial', document.documentElement);
      else if (result.truncated) queueDeepHint(document.documentElement);
    }
  }

  addEventListener('focusin', event => {
    const target = event.target;
    if (target instanceof Element && ((target.hasAttributes?.() && hintAttrs(target)) || strongControl(target))) activate('focus', target);
  }, true);

  startObserver();
})();
