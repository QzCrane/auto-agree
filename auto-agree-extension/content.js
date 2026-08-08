(() => {
  'use strict';

  const THRESHOLD = 8;
  const seenRoots = new WeakSet();
  const attempts = new WeakMap();
  const anchorAttempts = new WeakSet();
  let scanQueued = false;

  const POSITIVE = [
    [10, /(我已|本人已|已)(阅读|阅悉|知悉).{0,20}(并)?(同意|接受|遵守)/i],
    [8, /阅读.{0,12}(并)?同意/i],
    [6, /(用户|服务|使用|会员|平台|软件|许可|最终用户|TRAE)?\s*(协议|条款)/i],
    [6, /隐私\s*(政策|协议|条款|声明|保护)/i],
    [6, /\bterms(?:\s+of\s+(?:service|use))?\b/i],
    [6, /\bprivacy\s+(?:policy|notice|agreement|terms)\b/i],
    [5, /\b(?:user|license)\s+agreement\b|\beula\b/i],
    [5, /\b(?:i\s+)?(?:have\s+read\s+and\s+)?(?:agree|accept)(?:\s+to)?\b/i],
    [4, /(同意|接受).{0,18}(协议|条款|隐私)/i],
    [4, /(协议|条款|隐私).{0,18}(同意|接受)/i],
  ];

  const STRONG_AGREEMENT = /(?:我已|本人已|已)?\s*(?:阅读|阅悉|知悉)?\s*(?:并)?\s*(?:同意|接受).{0,80}(?:协议|条款|隐私)|(?:协议|条款|隐私).{0,80}(?:同意|接受)/i;

  const NEGATIVE = [
    /(captcha|recaptcha|hcaptcha|turnstile|人机|机器人|验证.{0,5}(真人|人类))/i,
    /(营销|推广|促销|广告|newsletter|marketing|promotion|优惠|活动通知|推荐信息|商业信息)/i,
    /(自动续费|免密支付|连续包月|连续包年|auto.?renew|subscription)/i,
    /(记住我|保持登录|自动登录|remember\s+me|keep\s+me\s+signed\s+in)/i,
    /(保险|捐赠|小费|warranty|insurance|donation|\btip\b)/i,
    /(通讯录|精准定位|个性化广告|第三方共享|share.{0,12}third.?part)/i,
  ];

  const AUTH = /(登录|注册|手机号|手机号码|短信验证码|获取验证码|发送验证码|验证码登录|立即注册|login|log\s*in|sign\s*in|sign\s*up|register|phone|mobile|verification\s*code|\botp\b)/i;

  const BOX_SELECTOR = [
    'input[type="checkbox"]',
    '[role="checkbox"]',
    '[aria-checked="true"]',
    '[aria-checked="false"]',
    '[data-state="checked"]',
    '[data-state="unchecked"]',
    '.ant-checkbox-wrapper',
    '.ant-checkbox',
    '.el-checkbox',
    '.van-checkbox',
    '.n-checkbox',
    '.arco-checkbox',
    '.semi-checkbox',
    '.t-checkbox',
    '[class*="checkbox" i]',
    '[class*="check-box" i]'
  ].join(',');

  const ANCHOR_SELECTOR = 'label,p,span,div,section,li';

  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 1800);
  const hasAgreementSignal = text => POSITIVE.some(([, re]) => re.test(text));
  const hasNegativeSignal = text => NEGATIVE.some(re => re.test(text));

  function visible(el) {
    if (!(el instanceof Element)) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
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
    for (let i = 0; i < 7 && p instanceof Element; i++, p = p.parentElement) {
      const text = normalize(p.innerText || p.textContent);
      if (text.length <= 1000 && hasAgreementSignal(text) && !hasNegativeSignal(text)) return p;
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
    const parts = [document.title, location.hostname, location.pathname];
    let p = el;
    for (let i = 0; i < 9 && p instanceof Element; i++, p = p.parentElement) {
      if (p.matches?.('form,[role="dialog"],[class*="login" i],[class*="signin" i],[class*="signup" i],[class*="register" i],[class*="auth" i]')) {
        parts.push(p.innerText || p.textContent);
        break;
      }
    }
    return normalize(parts.filter(Boolean).join(' | ')).slice(0, 3500);
  }

  function nativeInput(el) {
    if (el instanceof HTMLInputElement && el.type === 'checkbox') return el;
    const c = semanticContainer(el);
    return c?.querySelector?.('input[type="checkbox"]') || null;
  }

  function explicitCheckedNode(el) {
    const c = semanticContainer(el);
    if (!(c instanceof Element)) return null;
    if (c.matches?.('[aria-checked],[data-state]')) return c;
    return c.querySelector?.('[aria-checked],[data-state]') || null;
  }

  function checked(el) {
    const input = nativeInput(el);
    if (input?.checked) return true;
    const c = semanticContainer(el);
    if (!(c instanceof Element)) return false;
    if (c.getAttribute('aria-checked') === 'true') return true;
    if (c.getAttribute('data-state') === 'checked') return true;
    if (c.querySelector?.('[aria-checked="true"],[data-state="checked"]')) return true;

    // Common component libraries. The v1.0 implementation missed several of these,
    // which could make a successful first click look "unchecked" and get clicked again.
    if (c.matches?.(
      '.semi-checkbox-checked,.ant-checkbox-wrapper-checked,.ant-checkbox-checked,.arco-checkbox-checked,.n-checkbox--checked,.van-checkbox__icon--checked,.is-checked,[class*="checkbox-checked" i],[class*="checkbox_checked" i],[class*="checkbox--checked" i]'
    )) return true;
    if (c.querySelector?.(
      '.semi-checkbox-checked,.ant-checkbox-wrapper-checked,.ant-checkbox-checked,.arco-checkbox-checked,.n-checkbox--checked,.van-checkbox__icon--checked,.is-checked,[class*="checkbox-checked" i],[class*="checkbox_checked" i],[class*="checkbox--checked" i]'
    )) return true;

    const classes = `${c.className || ''} ${c.parentElement?.className || ''}`;
    return /(^|\s)(is-checked|checked|checkbox-checked|semi-checkbox-checked|ant-checkbox-checked|arco-checkbox-checked)(\s|$)/i.test(String(classes));
  }

  function stateObservable(el) {
    if (nativeInput(el) || explicitCheckedNode(el)) return true;
    const c = semanticContainer(el);
    if (!(c instanceof Element)) return false;
    // Retry only for component families whose checked state we explicitly know how to read.
    return !!c.querySelector?.('.semi-checkbox,.ant-checkbox,.ant-checkbox-wrapper,.el-checkbox,.van-checkbox,.n-checkbox,.arco-checkbox');
  }

  function disabled(el) {
    const input = nativeInput(el);
    const c = semanticContainer(el);
    return !!(input?.disabled || c?.matches?.(':disabled') || c?.getAttribute?.('aria-disabled') === 'true');
  }

  function score(el, text) {
    if (!text || hasNegativeSignal(text)) return -100;
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

    const knownBox = c?.matches?.(BOX_SELECTOR) ? c : c?.querySelector?.(BOX_SELECTOR);
    if (knownBox instanceof HTMLElement) return knownBox;

    return c instanceof HTMLElement ? c : null;
  }

  function safeClick(target) {
    if (!(target instanceof HTMLElement) || !target.isConnected) return false;
    target.click();
    return true;
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
    safeClick(target);

    // Retry only if the state is actually observable. v1.0 retried blindly and could
    // toggle a custom checkbox back OFF when its checked state wasn't recognized.
    if (n === 0 && stateObservable(target)) {
      setTimeout(() => {
        if (target.isConnected && !checked(target) && !disabled(target)) {
          attempts.set(target, 2);
          safeClick(target);
        }
      }, 650);
    }
  }

  function smallestAgreementElement(node) {
    if (!(node instanceof Element)) return null;
    const elements = [];
    if (node.matches?.(ANCHOR_SELECTOR)) elements.push(node);
    elements.push(...(node.querySelectorAll?.(ANCHOR_SELECTOR) || []));

    let best = null;
    let bestLen = Infinity;
    for (const el of elements) {
      if (!visible(el)) continue;
      const text = normalize(el.innerText || el.textContent);
      if (text.length < 4 || text.length > 600 || !STRONG_AGREEMENT.test(text) || hasNegativeSignal(text)) continue;
      if (text.length < bestLen) {
        best = el;
        bestLen = text.length;
      }
    }
    return best;
  }

  function agreementRow(anchor) {
    let best = anchor;
    let p = anchor;
    for (let i = 0; i < 5 && p instanceof Element; i++, p = p.parentElement) {
      const text = normalize(p.innerText || p.textContent);
      if (text.length > 0 && text.length <= 900 && STRONG_AGREEMENT.test(text) && !hasNegativeSignal(text)) best = p;
      else if (text.length > 900) break;
    }
    return best;
  }

  function smallVisualControl(row, anchor) {
    if (!(row instanceof Element)) return null;
    const ar = anchor.getBoundingClientRect();
    const acy = ar.top + ar.height / 2;
    const candidates = row.querySelectorAll('input,button,[role],span,div,i,svg');
    let best = null;
    let bestScore = -Infinity;

    for (const el of candidates) {
      if (!(el instanceof HTMLElement || el instanceof SVGElement) || el === anchor || el.closest('a')) continue;
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8 || r.width > 42 || r.height > 42) continue;
      const ratio = r.width / r.height;
      if (ratio < 0.55 || ratio > 1.8) continue;

      const cy = r.top + r.height / 2;
      const vertical = Math.abs(cy - acy);
      if (vertical > Math.max(28, ar.height * 1.6)) continue;

      let s = 0;
      const cls = normalize(el.getAttribute?.('class'));
      const role = el.getAttribute?.('role') || '';
      if (/check|tick|agree|select/i.test(cls)) s += 8;
      if (role === 'checkbox') s += 12;
      if (el instanceof HTMLInputElement && el.type === 'checkbox') s += 20;
      if (r.right <= ar.left + 30) s += 6;
      if (Math.abs(r.width - r.height) <= 6) s += 2;
      if (getComputedStyle(el).cursor === 'pointer') s += 2;
      s -= vertical / 20;

      if (s > bestScore) {
        best = el;
        bestScore = s;
      }
    }

    if (!(best instanceof Element)) return null;
    let target = best;
    for (let i = 0; i < 2 && target.parentElement && target.parentElement !== row; i++) {
      const p = target.parentElement;
      const ps = getComputedStyle(p);
      if (p.matches('button,[role="checkbox"],label') || ps.cursor === 'pointer' || p.hasAttribute('tabindex')) target = p;
      else break;
    }
    return target instanceof HTMLElement ? target : best.parentElement instanceof HTMLElement ? best.parentElement : null;
  }

  function maybeCheckFromAgreementText(anchor) {
    if (!(anchor instanceof Element) || anchorAttempts.has(anchor) || !visible(anchor)) return;
    const text = normalize(anchor.innerText || anchor.textContent);
    if (!STRONG_AGREEMENT.test(text) || hasNegativeSignal(text)) return;

    const row = agreementRow(anchor);
    if (!(row instanceof Element) || !visible(row)) return;

    // First use all reliable checkbox paths inside the semantic row.
    const known = row.matches?.(BOX_SELECTOR) ? row : row.querySelector?.(BOX_SELECTOR);
    if (known instanceof Element) {
      maybeCheck(known);
      anchorAttempts.add(anchor);
      return;
    }

    // Then support classless custom visual checkboxes by geometry + semantic proximity.
    const visual = smallVisualControl(row, anchor);
    if (visual instanceof HTMLElement) {
      anchorAttempts.add(anchor);
      safeClick(visual);
      return;
    }

    // Final conservative fallback: many custom checkbox rows bind the click handler to
    // the label/row itself. Never click an <a>, and only do this for a strong agreement row.
    if (row instanceof HTMLElement && row.tagName !== 'A') {
      anchorAttempts.add(anchor);
      safeClick(row);
    }
  }

  function scanAgreementAnchors(root) {
    if (!root) return;
    const anchor = smallestAgreementElement(root);
    if (anchor) maybeCheckFromAgreementText(anchor);
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

    // Reverse discovery: agreement text -> nearby control. This is what v1.0 lacked.
    scanAgreementAnchors(root);

    const all = root.querySelectorAll?.('*') || [];
    for (const el of all) if (el.shadowRoot) observe(el.shadowRoot);
  }

  function queueFullScan() {
    if (scanQueued) return;
    scanQueued = true;
    queueMicrotask(() => {
      scanQueued = false;
      scan(document);
    });
  }

  function observe(root) {
    if (!root || seenRoots.has(root)) return;
    seenRoots.add(root);
    scan(root);

    new MutationObserver(records => {
      let needFullScan = false;
      for (const record of records) {
        if (record.type === 'attributes') {
          const target = record.target;
          if (target instanceof Element) {
            if (target.matches(BOX_SELECTOR) || target.closest?.(BOX_SELECTOR)) {
              const box = target.matches(BOX_SELECTOR) ? target : target.closest(BOX_SELECTOR);
              if (box) maybeCheck(box);
            }
            const text = normalize(target.innerText || target.textContent);
            if (STRONG_AGREEMENT.test(text)) needFullScan = true;
          }
          continue;
        }
        for (const node of record.addedNodes) {
          if (node instanceof Element) {
            scan(node);
            if (STRONG_AGREEMENT.test(normalize(node.innerText || node.textContent))) needFullScan = true;
          }
        }
      }
      if (needFullScan) queueFullScan();
    }).observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'checked', 'aria-checked', 'aria-required', 'data-state', 'disabled']
    });
  }

  function boot() {
    observe(document);

    // Last-moment pass before Login/Register/Get-code without submitting anything itself.
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
