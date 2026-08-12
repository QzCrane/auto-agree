(() => {
  'use strict';
  const KERNEL = globalThis.__AUTO_AGREE_RUNTIME_KERNEL__;
  const VERSION = KERNEL?.version;
  if (!KERNEL || !VERSION) return;
  if (globalThis.__AUTO_AGREE_SEMANTIC__?.version === VERSION) return;
  const SEVERITY = Object.freeze({ ROUTINE: 0, PRIVACY: 1, OPTIONAL: 2, CONSEQUENTIAL: 3, ATTESTATION: 4 });

  const LEGAL = /(?:用户协议|使用协议|服务协议|平台协议|会员协议|软件许可|许可协议|最终用户许可|服務協議|使用協議|用戶協議|條款|条款|隐私(?:政策|协议|条款|声明|保护)|隱私(?:政策|協議|條款|聲明|保護)|terms?(?:\s+of\s+(?:service|use|sale))?|privacy\s+(?:policy|notice|agreement|terms)|user\s+agreement|license\s+agreement|eula|conditions?\s+d['’]utilisation|politique\s+de\s+confidentialit[eé]|nutzungsbedingungen|datenschutz(?:erkl[aä]rung)?|t[eé]rminos(?:\s+y\s+condiciones)?|pol[ií]tica\s+de\s+privacidad|termos(?:\s+de\s+uso)?|pol[ií]tica\s+de\s+privacidade|termini(?:\s+di\s+servizio)?|informativa\s+(?:sulla\s+)?privacy|利用規約|プライバシーポリシー|이용약관|개인정보(?:처리)?방침|услов(?:ия|иями)(?:\s+использования)?|политик(?:а|ой)\s+конфиденциальности|الشروط|سياسة\s+الخصوصية|voorwaarden|privacybeleid|warunki(?:\s+korzystania)?|polityka\s+prywatności|kullanım\s+koşulları|gizlilik\s+politikası|điều\s+khoản|chính\s+sách\s+quyền\s+riêng\s+tư|syarat(?:\s+dan\s+ketentuan)?|kebijakan\s+privasi|dasar\s+privasi|ข้อกำหนด|เงื่อนไข|นโยบายความเป็นส่วนตัว|नियम(?:\s+और\s+शर्तें)?|शर्तें|गोपनीयता\s+नीति|όρ(?:οι|ους)|πολιτική\s+απορρήτου|תנאי(?:\s+שימוש)?|מדיניות\s+פרטיות|villkor|integritetspolicy|vilkår|personvern|betingelser|privatlivspolitik)/iu;
  const ASSENT = /(?:我已|本人已|已)?\s*(?:阅读|閱讀|阅悉|閱悉|知悉)?\s*(?:并|並)?\s*(?:同意|接受|遵守)|(?:同意|接受)(?:上述|以上|相关|相關)?|(?:i\s+)?(?:have\s+)?(?:read\s+(?:and|&)\s+)?(?:agree|accept)(?:\s+to)?|i\s+consent\s+to|j['’](?:ai\s+lu\s+et\s+)?accepte|ich\s+(?:stimme\s+zu|akzeptiere)|(?:he\s+le[ií]do\s+y\s+)?acepto|(?:li\s+e\s+)?aceito|(?:ho\s+letto\s+e\s+)?accetto|同意する|同意します|동의(?:합니다|함)?|(?:я\s+)?(?:согласен|принимаю)|أوافق|أقبل|ik\s+ga\s+akkoord|akkoord|accepteer|zgadzam\s+się|akceptuję|kabul\s+ediyorum|onaylıyorum|tôi\s+đồng\s+ý|đồng\s+ý|chấp\s+nhận|saya\s+setuju|setuju|menerima|ยอมรับ|ตกลง|मैं\s+सहमत\s+हूँ|सहमत|स्वीकार|συμφωνώ|αποδέχομαι|אני\s+מסכים|מסכים|מאשר|jag\s+godkänner|godkänner|jeg\s+godtar|jeg\s+accepterer|accepterer/iu;
  const READ_WORD = /(?:阅读|閱讀|阅悉|閱悉|知悉|read|lu|le[ií]do|lido|letto|gelesen|確認|확인)/iu;
  const REQUIRED = /(?:必选|必須|必须|需(?:要)?同意|请先(?:阅读|閱讀)?(?:并|並)?同意|請先(?:閱讀)?(?:並)?同意|required|mandatory|must\s+(?:agree|accept)|please\s+(?:agree|accept)|erforderlich|obligatorio|obrigat[oó]rio|필수)/iu;
  const VALIDATION = /(?:请先|請先).{0,18}(?:同意|接受|勾选|勾選)|(?:同意|接受).{0,18}(?:后|後)(?:继续|繼續|登录|登入|注册|註冊)|must.{0,20}(?:agree|accept)|please.{0,20}(?:agree|accept)/iu;
  const AUTH = /(?:登录|登入|登陆|註冊|注册|手机号|手機號|手机号码|手機號碼|短信验证码|短信驗證碼|获取验证码|獲取驗證碼|发送验证码|發送驗證碼|验证码登录|驗證碼登入|login|log\s*in|sign\s*in|sign\s*up|register|phone|mobile|verification\s*code|\botp\b|connexion|anmelden|iniciar\s+sesi[oó]n|entrar|accedi|ログイン|로그인|войти|تسجيل\s+الدخول|inloggen|zaloguj(?:\s+się)?|giriş\s+yap|đăng\s+nhập|masuk|เข้าสู่ระบบ|लॉग\s*इन|σύνδεση|התחברות|logga\s+in|logg\s+inn|log\s+ind)/iu;
  const PROCEED = /(?:登录|登入|登陆|注册|註冊|继续|繼續|下一步|下一頁|提交|确认|確認|完成|获取验证码|獲取驗證碼|发送验证码|發送驗證碼|login|log\s*in|sign\s*in|sign\s*up|register|continue|next|submit|confirm|verify|get\s+code|send\s+code)/iu;
  const FAST_TEXT = /(?:同意|接受|协议|協議|条款|條款|隐私|隱私|terms?|privacy|agreement|eula|利用規約|プライバシー|동의|약관|개인정보|соглас|услов|конфиденц|أوافق|الشروط|الخصوصية|voorwaarden|privacybeleid|warunki|prywatności|kullanım|gizlilik|đồng\s+ý|điều\s+khoản|setuju|syarat|ยอมรับ|ข้อกำหนด|सहमत|गोपनीयता|συμφωνώ|όρ(?:οι|ους)|מסכים|תנאי|villkor|vilkår|betingelser)/iu;
  const CREDENTIAL = /(?:phone|mobile|tel|otp|code|verification|验证码|驗證碼|手机号|手機號|email|password|用户名|用戶名|账号|帳號)/iu;
  const COMPACT_LEGAL = /(?:termsof(?:service|use|sale)|privacypolicy|privacynotice|privacyagreement|privacyterms|useragreement|licenseagreement|eula|conditions?dutilisation|politiquedeconfidentialit[eé]|nutzungsbedingungen|datenschutz(?:erkl[aä]rung)?|t[eé]rminos(?:ycondiciones)?|pol[ií]ticadeprivacidad|termos(?:deuso)?|pol[ií]ticadeprivacidade|termini(?:diservizio)?|informativa(?:sulla)?privacy|利用規約|プライバシーポリシー|이용약관|개인정보(?:처리)?방침|услов(?:ия|иями)(?:использования)?|политик(?:а|ой)конфиденциальности|الشروط|سياسةالخصوصية|voorwaarden|privacybeleid|warunki(?:korzystania)?|politykaprywatności|kullanımkoşulları|gizlilikpolitikası|điềukhoản|chínhsáchquyềnriêngtư|syarat(?:danketentuan)?|kebijakanprivasi|dasarprivasi|ข้อกำหนด|เงื่อนไข|นโยบายความเป็นส่วนตัว|नियम(?:औरशर्तें)?|शर्तें|गोपनीयतानीति|όρ(?:οι|ους)|πολιτικήαπορρήτου|תנאי(?:שימוש)?|מדיניותפרטיות|villkor(?:en)?|integritetspolicy|vilkår(?:ene)?|personvern|betingelser(?:ne)?|privatlivspolitik)/iu;
  const COMPACT_ASSENT = /(?:i(?:have)?(?:read(?:and)?)?(?:agree|accept)(?:to)?|iconsentto|jaccepte|ich(?:stimmezu|akzeptiere)|acepto|aceito|accetto|同意する|同意します|동의(?:합니다|함)?|согласен|принимаю|أوافق|أقبل|ikgaakkoord|akkoord|accepteer|zgadzamsię|akceptuję|kabulediyorum|onaylıyorum|tôiđồngý|đồngý|chấpnhận|sayasetuju|setuju|menerima|ยอมรับ|ตกลง|मैंसहमतहूँ|सहमत|स्वीकार|συμφωνώ|αποδέχομαι|אנימסכים|מסכים|מאשר|jaggodkänner|godkänner|jeggodtar|jegaccepterer|accepterer)/iu;

  function normalize(value, max = 1400) {
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
    const gap = ' zzsemanticgapzz ';
    const gapCost = gap.length * 2;
    const headBudget = Math.max(24, Math.floor((max - gapCost) / 3));
    const middleBudget = Math.max(24, Math.floor((max - gapCost) / 3));
    const tailBudget = Math.max(0, max - gapCost - headBudget - middleBudget);
    const windowSize = Math.max(96, Math.max(headBudget, middleBudget, tailBudget) * 4);
    const center = Math.floor(raw.length / 2);
    const middleStart = Math.max(0, center - Math.floor(windowSize / 2));
    return take([
      take(raw.slice(0, windowSize), headBudget, 'head'),
      take(raw.slice(middleStart, middleStart + windowSize), middleBudget, 'center'),
      take(raw.slice(Math.max(0, raw.length - windowSize)), tailBudget, 'tail')
    ].filter(Boolean).join(gap), max);
  }

  function joinNormalized(values, max = 1400) {
    let out = '';
    for (const value of values) {
      const left = max - out.length;
      if (left <= 0) break;
      const part = normalize(value, left);
      if (!part) continue;
      out += (out ? ' ' : '') + part;
      if (out.length > max) out = out.slice(0, max);
    }
    return out;
  }

  function compactSemantic(value, max = 1400) {
    const t = normalize(value, max).toLowerCase();
    return t.replace(/[\s\p{P}\p{S}\u200b-\u200d\ufeff]+/gu, '').slice(0, max);
  }

  function hasNonLatin(value) { return /[^\u0000-\u024f]/u.test(value || ''); }

  function assessText(text) {
    const t = normalize(text);
    if (!t) return { eligible: false, score: -100, text: t };
    const compact = compactSemantic(t);
    const nonLatin = hasNonLatin(t);
    const legal = LEGAL.test(t) || COMPACT_LEGAL.test(compact) || (nonLatin && LEGAL.test(compact));
    const assent = ASSENT.test(t) || COMPACT_ASSENT.test(compact) || (nonLatin && ASSENT.test(compact));
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
    return { eligible: (legal && assent) || (legal && (required || validation)), legal, assent, required, validation, read, score, text: t };
  }

  function fastSemantic(text) {
    if (!text) return false;
    if (FAST_TEXT.test(text)) return true;
    const compact = compactSemantic(text, 900);
    const nonLatin = hasNonLatin(text);
    return COMPACT_LEGAL.test(compact) || COMPACT_ASSENT.test(compact) ||
      (nonLatin && (LEGAL.test(compact) || ASSENT.test(compact)));
  }

  globalThis.__AUTO_AGREE_SEMANTIC__ = Object.freeze({
    version: VERSION,
    patterns: Object.freeze({ LEGAL, ASSENT, READ_WORD, REQUIRED, VALIDATION, AUTH, PROCEED, FAST_TEXT, CREDENTIAL, COMPACT_LEGAL, COMPACT_ASSENT }),
    normalize,
    joinNormalized,
    compactSemantic,
    hasNonLatin,
    assessText,
    fastSemantic
  });
})();
