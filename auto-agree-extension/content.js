(() => {
  'use strict';

  const THRESHOLD = 8;
  const seenRoots = new WeakSet();
  const attempts = new WeakMap();

  const POSITIVE = [
    [8, /(我已|本人已|已)(阅读|阅悉|知悉).{0,12}(并)?(同意|接受|遵守)/i],
    [7, /阅读.{0,8}(并)?同意/i],
    [5, /(用户|服务|使用|会员|平台|软件|许可|最终用户)?(协议|条款)/i],
    [5, /隐私(政策|协议|条款|声明|保护)/i],
    [6, /\bterms(?:\s+of\s+(?:service|use))?\b/i],
    [6, /\bprivacy\s+(?:policy|notice|agreement|terms)\b/i],
    [5, /\b(?:user|license)\s+agreement\b|\beula\b/i],
    [5, /\b(?:i\s+)?(?:have\s+read\s+and\s+)?(?:agree|accept)(?:\s+to)?\b/i],
    [3, /(同意|接受).{0,12}(协议|条款|隐私)/i],
    [3, /(协议|条款|隐私).{0,12}(同意|接受)/i],
  ];

  // Deliberately excluded: these are choices, not merely agreement prerequisites.
  const NEGATIVE = [
    /(captcha|recaptcha|hcaptcha|turnstile|人机|机器人|验证.{0,5}(真人|人类))/i,
    /(营销|推广|促销|广告|newsletter|marketing|promotion|优惠|活动通知|推荐信息|商业信息)/i,
    /(自动续费|免密支付|连续包月|连续包年|auto.?renew|subscription)/i,
    /(记住我|保持登录|自动登录|remember\s+me|keep\s+me\s+signed\s+in)/i,
    /(保险|捐赠|小费|warranty|insurance|donation|\btip\b)/i,
    /(通讯录|精准定位|个性化广告|第三方共享|share.{0,12}third.?part)/i,
  ];

  const AUTH = /(登录|注册|手机号|手机号码|短信验证码|获取验证码|发送验证码|验证码登录|login|log\s*in|sign\s*in|sign\s*up|register|phone|mobile|verification\s*code|\botp\b)/i;

  const BOX_SELECTOR = [
    'input[type="checkbox"]',
    '[role="checkbox"]',
    '[aria-checked="true"]',
    '[aria-checked="false"]',
    '[data-state="checked"]',
    '[data-state="unchecked"]',
    '.ant-checkbox-wrapper',
    '.el-checkbox',
    '.van-checkbox',
    '.n-checkbox',
    '.arco-checkbox',
    '.semi-checkbox',
    '.t-checkbox',
    '[class*="checkbox" i]'
  ].join(',');

  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 1600);
  const hasAgreementSignal = text => POSITIVE.some(([, re]) => re.test(text));

  function visible(el) {
    if (!(el instanceof Element)) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function labelFor(input) {
    if (!(input instanceof HTMLInputElement)) return null;
    if (input.labels?.length) return input.labels[0];
    if (input.id) {
      try {
        const root = input.getRootNode();
        const label = root.querySelector?.(`label[for="${CSS.escape(input.id)}"]`);
        if (label) return label;
      } catch (_) {}
    }
    return input.closest('label');
  }

  function semanticContainer(el) {
    let base = el;
    if (el instanceof HTMLInputElement && el.type === 'checkbox') base = labelFor(el) || el;
    else base = el.closest?.('label,[role="checkbox"],.ant-checkbox-wrapper,.el-checkbox,.van-checkbox,.n-checkbox,.arco-checkbox,.semi-checkbox,.t-checkbox') || el;

    let p = base;
    for (let i = 0; i < 5 && p instanceof Element; i++, p = p.parentElement) {
      const text = normalize(p.innerText || p.textContent);
      if (text.length <= 700 && hasAgreementSignal(text)) return p;
    }
    return base;
  }

  function textFor(el) {
    const c = semanticContainer(el);
    const parts = [
      c?.getAttribute?.('aria-label'), c?.getAttribute?.('title'),
      c?.innerText || c?.textContent,
      el.getAttribute?.('aria-label'), el.getAttribute?.('title')
    ];
    for (const a of c?.querySelectorAll?.('a[href]') || []) {
      parts.push(a.innerText || a.textContent, a.getAttribute('href'));
    }
    return normalize(parts.filter(Boolean).join(' | '));
  }

  function contextFor(el) {
    const parts = [document.title, location.pathname];
    let p = el;
    for (let i = 0; i < 7 && p instanceof Element; i++, p = p.parentElement) {
      if (p.matches?.('form,[role="dialog"],[class*="login" i],[class*="signin" i],[class*="signup" i],[class*="register" i],[class*="auth" i]')) {
        parts.push(p.innerText || p.textContent);
        break;
      }
    }
    return normalize(parts.filter(Boolean).join(' | ')).slice(0, 3000);
  }

  function nativeInput(el) {
    if (el instanceof HTMLInputElement && el.type === 'checkbox') return el;
    const c = semanticContainer(el);
    return c?.querySelector?.('input[type="checkbox"]') || null;
  }

  function checked(el) {
    const input = nativeInput(el);
    if (input?.checked) return true;
    const c = semanticContainer(el);
    if (c?.getAttribute?.('aria-checked') === 'true') return true;
    if (c?.getAttribute?.('data-state') === 'checked') return true;
    if (c?.querySelector?.('[aria-checked="true"],[data-state="checked"]')) return true;
    const classes = `${c?.className || ''} ${c?.parentElement?.className || ''}`;
    return /(^|\s)(is-checked|checked|checkbox-checked|ant-checkbox-checked)(\s|$)/i.test(String(classes));
  }

  function disabled(el) {
    const input = nativeInput(el);
    const c = semanticContainer(el);
    return !!(input?.disabled || c?.matches?.(':disabled') || c?.getAttribute?.('aria-disabled') === 'true');
  }

  function score(el, text) {
    if (!text || NEGATIVE.some(re => re.test(text))) return -100;
    let s = 0;
    for (const [points, re] of POSITIVE) if (re.test(text)) s += points;

    const input = nativeInput(el);
    const c = semanticContainer(el);
    if (input?.required || input?.getAttribute('aria-required') === 'true' || c?.getAttribute?.('aria-required') === 'true') s += 5;
    if (/(必选|必须|required)/i.test(text)) s += 2;
    if (AUTH.test(contextFor(c || el))) s += 3;

    for (const a of c?.querySelectorAll?.('a[href]') || []) {
      if (/(协议|条款|隐私|terms|privacy|agreement|policy)/i.test(normalize(`${a.textContent || ''} ${a.getAttribute('href') || ''}`))) {
        s += 2;
        break;
      }
    }
    return s;
  }

  function clickTarget(el) {
    const c = semanticContainer(el);
    const input = nativeInput(el);
    if (input && !input.disabled) return input;
    const roleBox = c?.matches?.('[role="checkbox"]') ? c : c?.querySelector?.('[role="checkbox"]');
    if (roleBox instanceof HTMLElement) return roleBox;
    return c instanceof HTMLElement ? c : null;
  }

  function maybeCheck(el) {
    if (!(el instanceof Element) || disabled(el) || checked(el)) return;
    const c = semanticContainer(el);
    if (!(c instanceof Element) || (!visible(c) && !visible(el))) return;

    const text = textFor(el);
    if (score(el, text) < THRESHOLD) return;

    const target = clickTarget(el);
    if (!(target instanceof HTMLElement) || checked(target)) return;
    const n = attempts.get(target) || 0;
    if (n >= 2) return;

    attempts.set(target, n + 1);
    target.click();

    // One delayed retry for frameworks that attach handlers just after insertion.
    if (n === 0) {
      setTimeout(() => {
        if (target.isConnected && !checked(target) && !disabled(target)) {
          attempts.set(target, 2);
          target.click();
        }
      }, 500);
    }
  }

  function scan(root) {
    if (!root) return;
    const found = [];
    if (root instanceof Element && root.matches(BOX_SELECTOR)) found.push(root);
    found.push(...(root.querySelectorAll?.(BOX_SELECTOR) || []));

    const containers = new Set();
    for (const el of found) {
      const c = semanticContainer(el);
      if (containers.has(c)) continue;
      containers.add(c);
      maybeCheck(el);
    }

    const all = root.querySelectorAll?.('*') || [];
    for (const el of all) if (el.shadowRoot) observe(el.shadowRoot);
  }

  function observe(root) {
    if (!root || seenRoots.has(root)) return;
    seenRoots.add(root);
    scan(root);

    new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'attributes') {
          const target = record.target;
          if (target instanceof Element) {
            if (target.matches(BOX_SELECTOR) || target.closest?.(BOX_SELECTOR)) maybeCheck(target.matches(BOX_SELECTOR) ? target : target.closest(BOX_SELECTOR));
          }
          continue;
        }
        for (const node of record.addedNodes) {
          if (node instanceof Element) scan(node);
        }
      }
    }).observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'checked', 'aria-checked', 'aria-required', 'data-state', 'disabled']
    });
  }

  function boot() {
    observe(document);

    // Last-moment pass before Login/Register, without submitting anything itself.
    addEventListener('pointerdown', event => {
      const button = event.target instanceof Element
        ? event.target.closest('button,input[type="submit"],[role="button"]')
        : null;
      if (!button) return;
      const text = normalize(button.innerText || button.value || button.getAttribute('aria-label'));
      if (AUTH.test(text)) scan(document);
    }, true);
  }

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
