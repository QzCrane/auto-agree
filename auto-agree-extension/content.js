(() => {
  'use strict';

  // Auto Agree Login Terms v2.0
  // Design goals:
  // 1) High precision: accept mandatory legal terms/privacy, never generic checkboxes.
  // 2) Broad coverage: native controls, ARIA controls, web components, iframes, open/closed Shadow DOM.
  // 3) Low overhead: one MutationObserver, incremental subtree walks, no global class watching,
  //    no repeated full-document scans, and geometry reads only for high-confidence fallbacks.
  // 4) Idempotence: never blindly click twice when state is not observable.

  const VERSION = '2.0.0';
  const WALK_SYNC_BUDGET = 900;
  const WALK_IDLE_BUDGET = 3500;
  const MAX_CONTEXT_TEXT = 2200;
  const MAX_ROW_TEXT = 1300;
  const MAX_PENDING_VISIBILITY = 256;
  const CLICK_COOLDOWN_MS = 2500;

  const SHOW_ELEMENT_TEXT = NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT;

  // Legal-document vocabulary. Kept separate from assent words so a checkbox named
  // merely "Privacy mode" is not mistaken for consent.
  const LEGAL = /(?:用户协议|使用协议|服务协议|平台协议|会员协议|软件许可|许可协议|最终用户许可|服務協議|使用協議|用戶協議|條款|条款|隐私(?:政策|协议|条款|声明|保护)|隱私(?:政策|協議|條款|聲明|保護)|terms?(?:\s+of\s+(?:service|use|sale))?|privacy\s+(?:policy|notice|agreement|terms)|user\s+agreement|license\s+agreement|eula|conditions?\s+d['’]utilisation|politique\s+de\s+confidentialit[eé]|nutzungsbedingungen|datenschutz(?:erkl[aä]rung)?|t[eé]rminos(?:\s+y\s+condiciones)?|pol[ií]tica\s+de\s+privacidad|termos(?:\s+de\s+uso)?|pol[ií]tica\s+de\s+privacidade|termini(?:\s+di\s+servizio)?|informativa\s+(?:sulla\s+)?privacy|利用規約|プライバシーポリシー|이용약관|개인정보(?:처리)?방침|услов(?:ия|иями)(?:\s+использования)?|политик(?:а|ой)\s+конфиденциальности|الشروط|سياسة\s+الخصوصية|voorwaarden|privacybeleid|warunki(?:\s+korzystania)?|polityka\s+prywatności|kullanım\s+koşulları|gizlilik\s+politikası|điều\s+khoản|chính\s+sách\s+quyền\s+riêng\s+tư|syarat(?:\s+dan\s+ketentuan)?|kebijakan\s+privasi|dasar\s+privasi|ข้อกำหนด|เงื่อนไข|นโยบายความเป็นส่วนตัว|नियम(?:\s+और\s+शर्तें)?|शर्तें|गोपनीयता\s+नीति|όροι|πολιτική\s+απορρήτου|תנאי(?:\s+שימוש)?|מדיניות\s+פרטיות|villkor|integritetspolicy|vilkår|personvern|betingelser|privatlivspolitik)/iu;

  const ASSENT = /(?:我已|本人已|已)?\s*(?:阅读|閱讀|阅悉|閱悉|知悉)?\s*(?:并|並)?\s*(?:同意|接受|遵守)|(?:同意|接受)(?:上述|以上|相关|相關)?|(?:i\s+)?(?:have\s+)?(?:read\s+(?:and|&)\s+)?(?:agree|accept)(?:\s+to)?|i\s+consent\s+to|j['’](?:ai\s+lu\s+et\s+)?accepte|ich\s+(?:stimme\s+zu|akzeptiere)|(?:he\s+le[ií]do\s+y\s+)?acepto|(?:li\s+e\s+)?aceito|(?:ho\s+letto\s+e\s+)?accetto|同意する|同意します|동의(?:합니다|함)?|(?:я\s+)?(?:согласен|принимаю)|أوافق|أقبل|ik\s+ga\s+akkoord|akkoord|accepteer|zgadzam\s+się|akceptuję|kabul\s+ediyorum|onaylıyorum|tôi\s+đồng\s+ý|đồng\s+ý|chấp\s+nhận|saya\s+setuju|setuju|menerima|ยอมรับ|ตกลง|मैं\s+सहमत\s+हूँ|सहमत|स्वीकार|συμφωνώ|αποδέχομαι|אני\s+מסכים|מסכים|מאשר|jag\s+godkänner|godkänner|jeg\s+godtar|jeg\s+accepterer|accepterer/iu;

  const READ_WORD = /(?:阅读|閱讀|阅悉|閱悉|知悉|read|lu|le[ií]do|lido|letto|gelesen|確認|확인)/iu;
  const REQUIRED = /(?:必选|必須|必须|需(?:要)?同意|请先(?:阅读|閱讀)?(?:并|並)?同意|請先(?:閱讀)?(?:並)?同意|required|mandatory|must\s+(?:agree|accept)|please\s+(?:agree|accept)|erforderlich|obligatorio|obrigat[oó]rio|必須|필수)/iu;
  const VALIDATION = /(?:请先|請先).{0,18}(?:同意|接受|勾选|勾選)|(?:同意|接受).{0,18}(?:后|後)(?:继续|繼續|登录|登入|注册|註冊)|must.{0,20}(?:agree|accept)|please.{0,20}(?:agree|accept)/iu;

  // Hard exclusions. These are not "annoying prerequisite legal acknowledgements" and may
  // create separate commercial, privacy, identity, or security consequences.
  const NEGATIVE = /(?:不同意|不接受|拒绝|拒絕|decline|disagree|do\s+not\s+agree|don['’]t\s+agree|captcha|recaptcha|hcaptcha|turnstile|人机|人機|机器人|機器人|营销|營銷|推广|推廣|促销|促銷|广告|廣告|newsletter|marketing|promotion|优惠|優惠|活动通知|活動通知|商业信息|商業信息|自动续费|自動續費|连续包月|連續包月|连续包年|連續包年|auto.?renew|subscription|记住我|記住我|保持登录|保持登入|自动登录|自動登入|remember\s+me|keep\s+me\s+signed\s+in|保险|保險|捐赠|捐贈|小费|小費|warranty|insurance|donation|通讯录|通訊錄|精准定位|精準定位|个性化广告|個性化廣告|第三方共享|share.{0,16}third.?part|cookie|cookies|优惠券|優惠券)/iu;

  // Do not silently attest facts about the user. A combined checkbox containing one of these
  // declarations is intentionally left alone even if it also links Terms.
  const ATTESTATION = /(?:已满\s*18|已滿\s*18|年满\s*18|年滿\s*18|成年人|成年人士|over\s+18|18\s+years?\s+old|legal\s+age|本人确认|本人確認|i\s+certify|i\s+confirm\s+that|i\s+declare|实名认证|實名認證)/iu;

  const AUTH = /(?:登录|登入|登陆|註冊|注册|手机号|手機號|手机号码|手機號碼|短信验证码|短信驗證碼|获取验证码|獲取驗證碼|发送验证码|發送驗證碼|验证码登录|驗證碼登入|login|log\s*in|sign\s*in|sign\s*up|register|phone|mobile|verification\s*code|\botp\b|connexion|anmelden|iniciar\s+sesi[oó]n|entrar|accedi|ログイン|로그인|войти|تسجيل\s+الدخول|inloggen|zaloguj(?:\s+się)?|giriş\s+yap|đăng\s+nhập|masuk|เข้าสู่ระบบ|लॉग\s*इन|σύνδεση|התחברות|logga\s+in|logg\s+inn|log\s+ind)/iu;

  const PROCEED = /(?:登录|登入|登陆|注册|註冊|继续|繼續|下一步|下一頁|提交|确认|確認|完成|获取验证码|獲取驗證碼|发送验证码|發送驗證碼|login|log\s*in|sign\s*in|sign\s*up|register|continue|next|submit|confirm|verify|get\s+code|send\s+code)/iu;

  const FAST_TEXT = /(?:同意|接受|协议|協議|条款|條款|隐私|隱私|terms?|privacy|agreement|eula|利用規約|プライバシー|동의|약관|개인정보|соглас|услов|конфиденц|أوافق|الشروط|الخصوصية|voorwaarden|privacybeleid|warunki|prywatności|kullanım|gizlilik|đồng\s+ý|điều\s+khoản|setuju|syarat|ยอมรับ|ข้อกำหนด|सहमत|गोपनीयता|συμφωνώ|όροι|מסכים|תנאי|villkor|vilkår|betingelser)/iu;
  const CLASS_CHECK = /(?:checkbox|check-box|Checkbox|CheckBox|form-check-input|check_control|check-control)/;

  const CUSTOM_CHECK_TAGS = new Set([
    'sl-checkbox', 'ion-checkbox', 'md-checkbox', 'mat-checkbox', 'fluent-checkbox',
    'vaadin-checkbox', 'ui5-checkbox', 'calcite-checkbox', 'lightning-input'
  ]);

  const observedRoots = new WeakSet();
  const candidateMemo = new WeakMap();
  const anchorMemo = new WeakMap();
  const clickMemo = new WeakMap();
  const pendingVisibility = new Set();
  const dirtyRoots = new Set();
  const urgentRoots = new Set();
  const idleJobs = [];
  let flushQueued = false;
  let idleQueued = false;
  let pendingRescueTimer = 0;
  let pendingRescuePhase = 0;

  const mutationObserver = new MutationObserver(onMutations);
  const resizeObserver = typeof ResizeObserver === 'function'
    ? new ResizeObserver(entries => {
        for (const entry of entries) {
          const el = entry.target;
          if (!pendingVisibility.has(el)) continue;
          if (!el.isConnected) {
            unpendVisibility(el);
            continue;
          }
          if (entry.contentRect.width > 0 || entry.contentRect.height > 0) {
            unpendVisibility(el);
            processElementOrAnchor(el, true);
            processAgreementAnchor(el, true);
          }
        }
      })
    : null;

  function normalize(value, max = MAX_ROW_TEXT) {
    if (value == null) return '';
    const s = String(value).replace(/\s+/gu, ' ').trim();
    return s.length > max ? s.slice(0, max) : s;
  }

  function textOf(el, max = MAX_ROW_TEXT) {
    if (!(el instanceof Element)) return '';
    const parts = [];
    const aria = el.getAttribute('aria-label');
    const title = el.getAttribute('title');
    if (aria) parts.push(aria);
    if (title) parts.push(title);

    // textContent is used only after a semantic/candidate node has been found. We do not
    // call innerText here because innerText can require style/layout work.
    const t = el.textContent;
    if (t) parts.push(t.length > max ? t.slice(0, max) : t);
    return normalize(parts.join(' | '), max);
  }

  function ownFastText(el) {
    if (!(el instanceof Element)) return '';
    return normalize(`${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''}`, 500);
  }

  function composedParent(el) {
    if (!(el instanceof Element)) return null;
    if (el.assignedSlot instanceof Element) return el.assignedSlot;
    if (el.parentElement) return el.parentElement;
    const root = el.getRootNode?.();
    return root instanceof ShadowRoot && root.host instanceof Element ? root.host : null;
  }

  function ancestors(el, limit = 8) {
    const out = [];
    let p = el;
    for (let i = 0; i < limit && p instanceof Element; i++, p = composedParent(p)) out.push(p);
    return out;
  }

  function isCheckboxLike(el) {
    if (!(el instanceof Element)) return false;
    const tag = el.localName;
    if (tag === 'input') {
      const type = (el.getAttribute('type') || '').toLowerCase();
      return type === 'checkbox' || type === 'radio';
    }
    const role = (el.getAttribute('role') || '').toLowerCase();
    if (role === 'checkbox' || role === 'radio' || role === 'switch') return true;
    if (el.hasAttribute('aria-checked')) return true;
    const state = (el.getAttribute('data-state') || '').toLowerCase();
    if (state === 'checked' || state === 'unchecked' || state === 'on' || state === 'off') return true;
    if (CUSTOM_CHECK_TAGS.has(tag)) return true;
    const cls = typeof el.className === 'string' ? el.className : el.getAttribute('class') || '';
    return cls.length <= 500 && CLASS_CHECK.test(cls);
  }

  function nativeInput(el) {
    if (el instanceof HTMLInputElement && /^(checkbox|radio)$/i.test(el.type)) return el;
    const row = semanticRow(el);
    if (!(row instanceof Element)) return null;
    const found = row.querySelector?.('input[type="checkbox"],input[type="radio"]');
    return found instanceof HTMLInputElement ? found : null;
  }

  function labelFor(input) {
    if (!(input instanceof HTMLInputElement)) return null;
    if (input.labels?.length) return input.labels[0];
    if (input.id) {
      try {
        const root = input.getRootNode();
        const label = root.querySelector?.(`label[for="${CSS.escape(input.id)}"]`);
        if (label instanceof HTMLLabelElement) return label;
      } catch (_) {}
    }
    return input.closest?.('label') || null;
  }

  function assessText(text) {
    const t = normalize(text);
    if (!t) return { eligible: false, score: -100, text: t };
    if (NEGATIVE.test(t) || ATTESTATION.test(t)) return { eligible: false, score: -100, text: t };

    const legal = LEGAL.test(t);
    const assent = ASSENT.test(t);
    const required = REQUIRED.test(t);
    const validation = VALIDATION.test(t);
    const read = READ_WORD.test(t);
    let score = 0;

    if (legal) score += 4;
    if (assent) score += 5;
    if (legal && assent) score += 6;
    if (read && assent) score += 2;
    if (required) score += 4;
    if (validation) score += 6;

    // Text alone is enough only when it explicitly couples assent/requiredness to legal terms.
    const eligible = (legal && assent) || (legal && (required || validation));
    return { eligible, legal, assent, required, validation, read, score, text: t };
  }

  function semanticRow(el) {
    if (!(el instanceof Element)) return null;
    const input = el instanceof HTMLInputElement ? el : null;
    let start = input ? (labelFor(input) || input) : el;

    let fallback = start;
    for (const p of ancestors(start, 7)) {
      if (p.matches?.('label,[role="checkbox"],[role="radio"],[role="switch"],sl-checkbox,ion-checkbox,md-checkbox,mat-checkbox,fluent-checkbox,vaadin-checkbox,ui5-checkbox,calcite-checkbox')) {
        fallback = p;
      }
      const txt = textOf(p, MAX_ROW_TEXT);
      if (txt.length > MAX_ROW_TEXT - 10) continue;
      const a = assessText(txt);
      if (a.eligible) return p;
    }
    return fallback;
  }

  function contextRoot(el) {
    for (const p of ancestors(el, 10)) {
      if (p.matches?.('form,dialog,[role="dialog"],[aria-modal="true"]')) return p;
      const cls = typeof p.className === 'string' ? p.className : '';
      if (/(?:login|signin|sign-in|signup|sign-up|register|auth|verify|verification|modal|dialog)/i.test(cls)) return p;
    }
    return null;
  }

  function contextEvidence(el) {
    const c = contextRoot(el);
    const parts = [document.title || '', location.hostname || '', location.pathname || ''];
    if (c) parts.push(textOf(c, MAX_CONTEXT_TEXT));
    const text = normalize(parts.join(' | '), MAX_CONTEXT_TEXT);
    const auth = AUTH.test(text);
    let disabledProceed = false;
    let score = auth ? 2 : 0;

    if (c) {
      // Only query a small semantic context, and only for already-promising candidates.
      const buttons = c.querySelectorAll?.('button,input[type="submit"],[role="button"]') || [];
      for (let i = 0; i < Math.min(buttons.length, 24); i++) {
        const b = buttons[i];
        const label = normalize(`${b.textContent || ''} ${b.getAttribute?.('aria-label') || ''} ${b.value || ''}`, 240);
        if (!PROCEED.test(label)) continue;
        if (b.disabled || b.getAttribute?.('aria-disabled') === 'true') {
          disabledProceed = true;
          score += 2;
        }
        break;
      }
    }
    return { root: c, text, auth, disabledProceed, score };
  }

  function linkEvidence(row) {
    if (!(row instanceof Element)) return 0;
    const links = row.querySelectorAll?.('a[href]') || [];
    let hits = 0;
    for (let i = 0; i < Math.min(links.length, 12); i++) {
      const a = links[i];
      const t = normalize(`${a.textContent || ''} ${a.getAttribute('href') || ''}`, 400);
      if (LEGAL.test(t)) hits++;
    }
    return Math.min(hits, 2) * 2;
  }

  function readState(el) {
    if (!(el instanceof Element)) return { known: false, checked: false };
    const input = nativeInput(el);
    if (input) return { known: true, checked: !!input.checked };

    const row = semanticRow(el) || el;
    const nodes = [el, row];
    const explicit = row.querySelector?.('[aria-checked],[data-state],[data-checked]');
    if (explicit) nodes.push(explicit);

    for (const n of nodes) {
      if (!(n instanceof Element)) continue;
      const aria = n.getAttribute('aria-checked');
      if (aria === 'true') return { known: true, checked: true };
      if (aria === 'false' || aria === 'mixed') return { known: true, checked: false };
      const state = (n.getAttribute('data-state') || '').toLowerCase();
      if (state === 'checked' || state === 'on') return { known: true, checked: true };
      if (state === 'unchecked' || state === 'off') return { known: true, checked: false };
      const dc = n.getAttribute('data-checked');
      if (dc === '' || dc === 'true') return { known: true, checked: true };
      if (dc === 'false') return { known: true, checked: false };
    }

    const classProbe = [el, row, row.parentElement].filter(Boolean);
    for (const n of classProbe) {
      const cls = typeof n.className === 'string' ? n.className : n.getAttribute?.('class') || '';
      if (/(?:^|\s)(?:is-checked|checked|checkbox-checked|semi-checkbox-checked|ant-checkbox-checked|ant-checkbox-wrapper-checked|arco-checkbox-checked|n-checkbox--checked|Mui-checked|p-highlight)(?:\s|$)/i.test(cls)) {
        return { known: true, checked: true };
      }
    }
    return { known: false, checked: false };
  }

  function disabled(el) {
    if (!(el instanceof Element)) return true;
    const input = nativeInput(el);
    if (input?.disabled) return true;
    for (const n of [el, semanticRow(el)]) {
      if (!(n instanceof Element)) continue;
      if (n.matches?.(':disabled') || n.getAttribute('aria-disabled') === 'true' || n.hasAttribute('disabled')) return true;
    }
    return false;
  }

  function requiredControl(el) {
    const input = nativeInput(el);
    const row = semanticRow(el);
    return !!(input?.required || input?.getAttribute('aria-required') === 'true' || row?.getAttribute?.('aria-required') === 'true');
  }

  function rendered(el) {
    if (!(el instanceof Element) || !el.isConnected) return false;

    // Do not read geometry here. getBoundingClientRect()/getClientRects() can force a full
    // layout of a very large page immediately after DOM insertion. Agreement candidates are
    // rare, so walking a few composed ancestors and reading only visibility-related computed
    // styles is much cheaper and still filters hidden templates/modals.
    let p = el;
    for (let i = 0; i < 10 && p instanceof Element; i++, p = composedParent(p)) {
      if (p.hidden || p.getAttribute('aria-hidden') === 'true') return false;
      const style = getComputedStyle(p);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || Number(style.opacity || 1) === 0) return false;
    }
    return true;
  }

  function explicitlyHidden(el) {
    let p = el instanceof Element ? el : null;
    for (let i = 0; i < 10 && p instanceof Element; i++, p = composedParent(p)) {
      if (p.hidden || p.getAttribute('aria-hidden') === 'true') return true;
    }
    return false;
  }

  function rowRendered(row, control) {
    // Reliable checkbox/radio/switch controls do not need a geometry/style visibility read.
    // Programmatic .click() works for hidden native controls too, and avoiding computed style
    // here prevents a large freshly-inserted DOM from being synchronously laid out just so we
    // can accept its mandatory terms. Explicit hidden/aria-hidden remains a conservative wait.
    if (isCheckboxLike(control) || control instanceof HTMLInputElement) {
      return !explicitlyHidden(row || control);
    }

    if (rendered(row) || rendered(control)) return true;
    const child = row?.firstElementChild;
    return !!(child && rendered(child));
  }

  function schedulePendingRescue() {
    if (pendingRescueTimer || !pendingVisibility.size) return;
    pendingRescuePhase = 0;
    const delays = [120, 480, 1200];
    const next = () => {
      if (!pendingVisibility.size || pendingRescuePhase >= delays.length) {
        pendingRescueTimer = 0;
        return;
      }
      const delay = delays[pendingRescuePhase++];
      pendingRescueTimer = setTimeout(() => {
        pendingRescueTimer = 0;
        recheckPending();
        next();
      }, delay);
    };
    next();
  }

  function pendVisibility(el) {
    if (!(el instanceof Element) || !el.isConnected || pendingVisibility.has(el)) return;
    if (pendingVisibility.size >= MAX_PENDING_VISIBILITY) {
      const oldest = pendingVisibility.values().next().value;
      if (oldest) unpendVisibility(oldest);
    }
    pendingVisibility.add(el);
    try { resizeObserver?.observe(el); } catch (_) {}
    schedulePendingRescue();
  }

  function unpendVisibility(el) {
    pendingVisibility.delete(el);
    try { resizeObserver?.unobserve(el); } catch (_) {}
  }

  function classSignature(el) {
    if (!(el instanceof Element)) return '';
    const row = semanticRow(el) || el;
    const bits = [];
    let count = 0;
    const add = n => {
      if (!(n instanceof Element) || count >= 18) return;
      bits.push(
        n.localName,
        typeof n.className === 'string' ? n.className.slice(0, 180) : '',
        n.getAttribute('aria-checked') || '',
        n.getAttribute('data-state') || '',
        n.getAttribute('data-checked') || ''
      );
      count++;
    };
    add(el); add(row);
    const walker = document.createTreeWalker(row, NodeFilter.SHOW_ELEMENT);
    let n;
    while (count < 18 && (n = walker.nextNode())) add(n);
    return bits.join('|');
  }

  function controlConfidence(el) {
    if (el instanceof HTMLInputElement && /^(checkbox|radio)$/i.test(el.type)) return 4;
    const role = (el.getAttribute?.('role') || '').toLowerCase();
    if (role === 'checkbox' || role === 'radio' || role === 'switch') return 3;
    if (CUSTOM_CHECK_TAGS.has(el.localName)) return 3;
    if (isCheckboxLike(el)) return 2;
    return 0;
  }

  function candidateText(el) {
    const row = semanticRow(el) || el;
    const pieces = [textOf(row, MAX_ROW_TEXT), ownFastText(el)];
    const input = nativeInput(el);
    if (input) {
      const label = labelFor(input);
      if (label && label !== row) pieces.push(textOf(label, 900));
    }
    return normalize(pieces.join(' | '), MAX_ROW_TEXT);
  }

  function candidateDecision(el) {
    const row = semanticRow(el) || el;
    const text = candidateText(el);
    const sem = assessText(text);
    if (sem.score < 0) return { accept: false, row, sem, score: sem.score };

    const controlScore = controlConfidence(el);
    const isRequired = requiredControl(el);
    const links = linkEvidence(row);
    const ctx = (sem.legal || sem.assent) ? contextEvidence(row) : { auth: false, disabledProceed: false, score: 0 };
    let score = sem.score + controlScore + links + ctx.score;
    if (isRequired) score += 4;

    // Precise gates: either the text explicitly couples assent/requiredness to legal terms,
    // the control itself is required, or a reliable legal checkbox is inside an auth flow
    // whose proceed control is currently gated. The last branch covers terse labels such as
    // just "Terms of Service / Privacy Policy" without requiring site-specific selectors.
    const accept = score >= 12 && (
      sem.eligible ||
      (sem.legal && isRequired) ||
      (sem.legal && ctx.auth && ctx.disabledProceed && controlScore >= 3)
    );
    return { accept, row, sem, score, text };
  }

  function fingerprint(el, decision) {
    const state = readState(el);
    return `${decision.text || ''}|${decision.score}|${state.known ? (state.checked ? '1' : '0') : '?'}|${el.getAttribute?.('aria-disabled') || ''}|${el.hasAttribute?.('disabled') ? 'd' : ''}`;
  }

  function clickTarget(el, row) {
    const input = nativeInput(el);
    if (input && !input.disabled) return input;

    for (const n of [el, row]) {
      if (!(n instanceof HTMLElement)) continue;
      const role = (n.getAttribute('role') || '').toLowerCase();
      if (role === 'checkbox' || role === 'radio' || role === 'switch') return n;
      if (CUSTOM_CHECK_TAGS.has(n.localName)) return n;
    }

    // Prefer an actual label when available; native label activation preserves the page's
    // own event chain and toggles hidden native controls correctly.
    if (input) {
      const label = labelFor(input);
      if (label instanceof HTMLElement) return label;
    }

    for (const n of [el, row]) {
      if (!(n instanceof HTMLElement)) continue;
      const cls = typeof n.className === 'string' ? n.className : '';
      if (CLASS_CHECK.test(cls)) return n;
    }
    return row instanceof HTMLElement ? row : el instanceof HTMLElement ? el : null;
  }

  function performClick(control, row, preferredTarget = null) {
    if (!(control instanceof Element) || disabled(control)) return false;
    const beforeState = readState(control);
    if (beforeState.known && beforeState.checked) return true;

    const target = preferredTarget instanceof HTMLElement ? preferredTarget : clickTarget(control, row);
    if (!(target instanceof HTMLElement) || !target.isConnected) return false;

    const now = performance.now();
    const prev = clickMemo.get(target);
    if (prev && now - prev.time < CLICK_COOLDOWN_MS) return prev.succeeded;

    const beforeSig = classSignature(control);
    clickMemo.set(target, { time: now, succeeded: false });
    target.click();

    // Never blindly click twice. Re-evaluate after the framework has processed the click.
    queueMicrotask(() => {
      if (!control.isConnected) return;
      const after = readState(control);
      const afterSig = classSignature(control);
      const succeeded = (after.known && after.checked) || (!beforeState.known && afterSig !== beforeSig);
      clickMemo.set(target, { time: performance.now(), succeeded });

      // A second click is allowed only when the state is explicitly observable and is still
      // false. Unknown custom controls get exactly one click to prevent ON→OFF toggles.
      if (beforeState.known && after.known && !after.checked && !disabled(control)) {
        setTimeout(() => {
          const latest = readState(control);
          if (!target.isConnected || latest.checked || !latest.known || disabled(control)) return;
          target.click();
          clickMemo.set(target, { time: performance.now(), succeeded: readState(control).checked });
        }, 180);
      }
    });
    return true;
  }

  function processCandidate(el, urgent = false) {
    if (!(el instanceof Element) || !el.isConnected || disabled(el)) return;
    const state = readState(el);
    if (state.known && state.checked) return;

    const decision = candidateDecision(el);
    const fp = fingerprint(el, decision);
    if (!urgent && candidateMemo.get(el) === fp) return;
    candidateMemo.set(el, fp);
    if (!decision.accept) return;

    if (!rowRendered(decision.row, el)) {
      pendVisibility(decision.row || el);
      return;
    }
    unpendVisibility(decision.row || el);
    performClick(el, decision.row);
  }

  function findAgreementRow(anchor) {
    if (!(anchor instanceof Element)) return null;
    let best = null;
    let bestScore = -Infinity;
    for (const p of ancestors(anchor, 7)) {
      const text = textOf(p, MAX_ROW_TEXT);
      if (!text || text.length > MAX_ROW_TEXT - 5) continue;
      const sem = assessText(text);
      if (sem.score < 0) break;
      if (sem.eligible && sem.score > bestScore) {
        best = p;
        bestScore = sem.score;
      }
      // Once a strong, compact row is found, do not climb into a large form that may contain
      // unrelated optional marketing controls.
      if (best && text.length > 420) break;
    }
    return best;
  }

  function knownControlIn(row) {
    if (!(row instanceof Element)) return null;
    if (isCheckboxLike(row)) return row;
    const walker = document.createTreeWalker(row, NodeFilter.SHOW_ELEMENT);
    let n, visited = 0;
    while (visited++ < 160 && (n = walker.nextNode())) {
      if (isCheckboxLike(n)) return n;
      probeShadow(n);
    }
    return null;
  }

  function geometryControl(row, anchor) {
    if (!(row instanceof Element) || !(anchor instanceof Element)) return null;
    const ar = anchor.getBoundingClientRect();
    const acy = ar.top + ar.height / 2;
    const walker = document.createTreeWalker(row, NodeFilter.SHOW_ELEMENT);
    const reads = [];
    let n, visited = 0;

    while (visited++ < 120 && (n = walker.nextNode())) {
      if (!(n instanceof HTMLElement) || n === anchor || n.closest?.('a[href]')) continue;
      const tag = n.localName;
      if (!['span','div','i','svg','button','label'].includes(tag) && !isCheckboxLike(n)) continue;
      const rect = n.getBoundingClientRect();
      reads.push([n, rect]);
    }

    let best = null;
    let bestScore = -Infinity;
    for (const [n, r] of reads) {
      if (r.width < 8 || r.height < 8 || r.width > 48 || r.height > 48) continue;
      const ratio = r.width / r.height;
      if (ratio < 0.5 || ratio > 2) continue;
      const cy = r.top + r.height / 2;
      const vertical = Math.abs(cy - acy);
      if (vertical > Math.max(32, ar.height * 1.8)) continue;

      let s = 0;
      if (isCheckboxLike(n)) s += 20;
      const role = (n.getAttribute('role') || '').toLowerCase();
      if (role === 'checkbox' || role === 'radio' || role === 'switch') s += 15;
      const cls = typeof n.className === 'string' ? n.className : '';
      if (CLASS_CHECK.test(cls) || /(?:tick|agree|select)/i.test(cls)) s += 8;
      if (r.right <= ar.left + 36) s += 6;
      if (Math.abs(r.width - r.height) <= 7) s += 2;
      s -= vertical / 18;
      if (s > bestScore) { bestScore = s; best = n; }
    }

    if (!(best instanceof HTMLElement)) return null;
    let target = best;
    for (let i = 0; i < 2; i++) {
      const p = target.parentElement;
      if (!(p instanceof HTMLElement) || p === row) break;
      const role = (p.getAttribute('role') || '').toLowerCase();
      const cls = typeof p.className === 'string' ? p.className : '';
      if (p.localName === 'label' || role === 'checkbox' || role === 'radio' || role === 'switch' || CLASS_CHECK.test(cls)) target = p;
      else break;
    }
    return target;
  }

  function processAgreementAnchor(anchor, urgent = false) {
    if (!(anchor instanceof Element) || !anchor.isConnected) return;
    const row = findAgreementRow(anchor);
    if (!(row instanceof Element)) return;

    const text = textOf(row, MAX_ROW_TEXT);
    const sem = assessText(text);
    if (!sem.eligible || sem.score < 10) return;

    const memo = `${text}|${row.getAttribute('aria-hidden') || ''}|${row.hidden ? 'h' : ''}`;
    if (!urgent && anchorMemo.get(anchor) === memo) return;
    anchorMemo.set(anchor, memo);

    if (!rowRendered(row, anchor)) {
      pendVisibility(row);
      return;
    }
    unpendVisibility(row);

    const control = knownControlIn(row);
    if (control) {
      processCandidate(control, true);
      return;
    }

    // Classless custom checkbox fallback. Geometry is deliberately deferred until after
    // strong semantic classification, so layout work is rare and batched as reads-before-write.
    const visual = geometryControl(row, anchor);
    if (visual) {
      const state = readState(visual);
      if (!(state.known && state.checked)) performClick(visual, row, visual);
      return;
    }

    // Final fallback for frameworks that bind the toggle handler to the whole agreement row.
    // This never clicks an <a>; HTMLElement.click() on the row itself does not activate its child links.
    if (row instanceof HTMLElement && row.localName !== 'a') {
      const before = classSignature(row);
      const rec = clickMemo.get(row);
      if (rec && performance.now() - rec.time < CLICK_COOLDOWN_MS) return;
      row.click();
      clickMemo.set(row, { time: performance.now(), succeeded: classSignature(row) !== before });
    }
  }

  function processElementOrAnchor(el, urgent = false) {
    if (!(el instanceof Element)) return;
    if (isCheckboxLike(el)) processCandidate(el, urgent);
    const fast = ownFastText(el);
    if (fast && FAST_TEXT.test(fast)) processAgreementAnchor(el, urgent);
    if (pendingVisibility.has(el) && rendered(el)) {
      unpendVisibility(el);
      if (isCheckboxLike(el)) processCandidate(el, true);
      else processAgreementAnchor(el, true);
    }
  }

  function probeShadow(host, force = false) {
    if (!(host instanceof HTMLElement)) return;
    const tag = host.localName;
    const shouldProbe = force || !!host.shadowRoot || tag.includes('-') || CUSTOM_CHECK_TAGS.has(tag) || isCheckboxLike(host);
    if (!shouldProbe) return;

    let root = host.shadowRoot;
    if (!root && typeof chrome !== 'undefined' && chrome.dom?.openOrClosedShadowRoot) {
      try { root = chrome.dom.openOrClosedShadowRoot(host); } catch (_) {}
    }
    if (root instanceof ShadowRoot) observeRoot(root);
  }

  function handleWalkNode(node, urgent) {
    if (node.nodeType === Node.TEXT_NODE) {
      const data = node.data;
      if (data && data.length <= 1200 && FAST_TEXT.test(data)) {
        const p = node.parentElement;
        if (p) processAgreementAnchor(p, urgent);
      }
      return;
    }
    if (node instanceof Element) {
      processElementOrAnchor(node, urgent);
      probeShadow(node);
    }
  }

  function makeWalkJob(root, urgent) {
    if (!root) return null;
    if (root instanceof Element) handleWalkNode(root, urgent);
    const walker = document.createTreeWalker(root, SHOW_ELEMENT_TEXT);
    return { walker, urgent };
  }

  function runWalkJob(job, budget) {
    let n, count = 0;
    while (count++ < budget && (n = job.walker.nextNode())) handleWalkNode(n, job.urgent);
    return !!n;
  }

  function processSubtree(root, urgent = false) {
    if (!root) return;
    const job = makeWalkJob(root, urgent);
    if (!job) return;
    const more = runWalkJob(job, urgent ? WALK_IDLE_BUDGET : WALK_SYNC_BUDGET);
    if (more) {
      idleJobs.push(job);
      scheduleIdle();
    }
  }

  function scheduleIdle() {
    if (idleQueued) return;
    idleQueued = true;
    const runner = deadline => {
      idleQueued = false;
      let safety = 0;
      while (idleJobs.length && safety++ < 20) {
        const job = idleJobs[0];
        const budget = deadline?.timeRemaining?.() > 4 ? WALK_IDLE_BUDGET : WALK_SYNC_BUDGET;
        const more = runWalkJob(job, budget);
        if (!more) idleJobs.shift();
        if (deadline?.timeRemaining && deadline.timeRemaining() < 2) break;
      }
      if (idleJobs.length) scheduleIdle();
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(runner, { timeout: 500 });
    else setTimeout(() => runner(null), 50);
  }

  function queueRoot(root, urgent = false) {
    if (!root) return;
    (urgent ? urgentRoots : dirtyRoots).add(root);
    if (flushQueued) return;
    flushQueued = true;
    queueMicrotask(flushRoots);
  }

  function hasQueuedAncestor(node, set) {
    let p = node?.parentNode;
    while (p) {
      if (set.has(p)) return true;
      if (p instanceof ShadowRoot) p = p.host;
      else p = p.parentNode;
    }
    return false;
  }

  function flushRoots() {
    flushQueued = false;
    const urgentList = [...urgentRoots];
    const dirtyList = [...dirtyRoots];
    const urgentSet = new Set(urgentList);
    const dirtySet = new Set(dirtyList);
    urgentRoots.clear();
    dirtyRoots.clear();

    for (const root of urgentList) {
      if (!hasQueuedAncestor(root, urgentSet)) processSubtree(root, true);
    }
    for (const root of dirtyList) {
      if (!hasQueuedAncestor(root, dirtySet) && !hasQueuedAncestor(root, urgentSet) && !urgentSet.has(root)) {
        processSubtree(root, false);
      }
    }
  }

  function onMutations(records) {
    const added = new Set();
    for (const record of records) {
      if (record.type === 'childList') {
        for (const node of record.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) added.add(node);
          else if (node.nodeType === Node.TEXT_NODE && node.data && FAST_TEXT.test(node.data)) {
            const p = node.parentElement;
            if (p) processAgreementAnchor(p, false);
          }
        }
      } else if (record.type === 'characterData') {
        const node = record.target;
        if (node.data && FAST_TEXT.test(node.data)) {
          const p = node.parentElement;
          if (p) processAgreementAnchor(p, false);
        }
      } else if (record.type === 'attributes') {
        const el = record.target;
        if (el instanceof Element) processElementOrAnchor(el, true);
      }
    }

    // Drop descendants when the same mutation batch already contains an ancestor subtree.
    // This prevents parser/framework batches from making us walk the same new DOM repeatedly.
    for (const node of added) {
      let p = node.parentNode;
      let covered = false;
      while (p) {
        if (added.has(p)) { covered = true; break; }
        if (p instanceof ShadowRoot) break;
        p = p.parentNode;
      }
      if (!covered) queueRoot(node, false);
    }
  }

  function observeRoot(root) {
    if (!root || observedRoots.has(root)) return;
    observedRoots.add(root);
    try {
      mutationObserver.observe(root, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: [
          'checked', 'required', 'disabled', 'hidden', 'role', 'title',
          'aria-checked', 'aria-required', 'aria-disabled', 'aria-hidden', 'aria-label',
          'data-state', 'data-checked'
        ]
      });
    } catch (_) { return; }
    queueRoot(root, false);
  }

  function recheckPending() {
    for (const el of [...pendingVisibility]) {
      if (!(el instanceof Element) || !el.isConnected) {
        unpendVisibility(el);
        continue;
      }
      if (rendered(el)) {
        unpendVisibility(el);
        processElementOrAnchor(el, true);
        processAgreementAnchor(el, true);
      }
    }
  }

  function eventContextRoot(event) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    for (const n of path) {
      if (n instanceof HTMLElement) probeShadow(n, true);
    }
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return null;
    return contextRoot(target) || target.closest?.('form,[role="dialog"],dialog') || null;
  }

  function isProceedInteraction(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return false;
    const clickable = target.closest?.('button,input[type="submit"],a,[role="button"],[tabindex]') || target;
    const text = normalize(`${clickable.textContent || ''} ${clickable.getAttribute?.('aria-label') || ''} ${clickable.value || ''}`, 360);
    return PROCEED.test(text) || AUTH.test(text);
  }

  function preflight(event) {
    // First, a composed event can expose a host whose closed shadow root was attached after
    // our mutation callback. chrome.dom lets us acquire that root here without monkey-patching the page.
    const root = eventContextRoot(event);
    recheckPending();

    if (root) queueRoot(root, true);
    if (!isProceedInteraction(event)) return;

    // Synchronous local scan before the page's submit/login handler runs.
    if (root) processSubtree(root, true);

    // Rescue class-toggled, pre-existing login modals without globally observing class/style churn.
    setTimeout(recheckPending, 0);
    setTimeout(recheckPending, 120);
    setTimeout(recheckPending, 500);
  }

  function onKeydown(event) {
    if (event.key !== 'Enter') return;
    preflight(event);
  }

  function boot() {
    observeRoot(document);

    // document_start normally runs before page DOM construction; process any rare nodes that
    // already exist without waiting for DOMContentLoaded.
    if (document.documentElement) queueRoot(document.documentElement, false);

    addEventListener('pointerdown', preflight, true);
    addEventListener('click', recheckPending, true);
    addEventListener('transitionend', () => { if (pendingVisibility.size) recheckPending(); }, true);
    addEventListener('animationend', () => { if (pendingVisibility.size) recheckPending(); }, true);
    addEventListener('keydown', onKeydown, true);
    addEventListener('submit', preflight, true);
    addEventListener('focusin', event => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const hint = normalize(`${target.getAttribute('name') || ''} ${target.getAttribute('type') || ''} ${target.getAttribute('placeholder') || ''} ${target.getAttribute('autocomplete') || ''}`, 280);
      if (/(?:phone|mobile|tel|otp|code|验证码|驗證碼|手机号|手機號|email|password)/iu.test(hint)) preflight(event);
    }, true);

    // Lightweight metadata for extension-side debugging only; isolated-world globals are not
    // visible to the host page.
    globalThis.__AUTO_AGREE__ = Object.freeze({ version: VERSION });
  }

  boot();
})();
