(() => {
  'use strict';
  const VERSION = '10.0.0';
  if (globalThis.__AUTO_AGREE_RISK__?.version === VERSION) return;
  const BASE = globalThis.__AUTO_AGREE_SEMANTIC__;
  if (!BASE || BASE.version !== VERSION) return;
  const SEVERITY = Object.freeze({ ROUTINE: 0, PRIVACY: 1, OPTIONAL: 2, CONSEQUENTIAL: 3, ATTESTATION: 4 });
  const NEGATIVE = /(?:不同意|不接受|拒绝|拒絕|decline|disagree|do\s+not\s+agree|don['’]t\s+agree|captcha|recaptcha|hcaptcha|turnstile|人机|人機|机器人|機器人|营销|營銷|推广|推廣|促销|促銷|广告|廣告|newsletter|marketing|promotion|优惠|優惠|活动通知|活動通知|商业信息|商業信息|自动续费|自動續費|连续包月|連續包月|连续包年|連續包年|auto.?renew|subscription|记住我|記住我|保持登录|保持登入|自动登录|自動登入|remember\s+me|keep\s+me\s+signed\s+in|捐赠|捐贈|小费|小費|warranty|donation|通讯录|通訊錄|精准定位|精準定位|个性化广告|個性化廣告|第三方共享|share.{0,16}third.?part|cookie|cookies|优惠券|優惠券)/iu;
  const ATTESTATION = /(?:已满\s*18|已滿\s*18|年满\s*18|年滿\s*18|成年人|成年人士|over\s+18|18\s+years?\s+old|legal\s+age|本人确认|本人確認|i\s+certify|i\s+confirm\s+that|i\s+declare|实名认证|實名認證|information\s+(?:is|are)\s+(?:true|accurate)|信息真实|資料真實)/iu;
  const CONSEQUENTIAL_LOCAL = /(?:授权扣款|授權扣款|直接扣款|购买协议|購買協議|订单协议|訂單協議|贷款协议|貸款協議|信贷协议|信貸協議|投资风险|投資風險|交易授权|交易授權|授权交易|授權交易|投资授权|投資授權|投保确认|投保確認|知情同意|劳动合同|勞動合同|雇佣合同|仲裁|放弃.{0,12}权利|放棄.{0,12}權利|集体诉讼|集體訴訟|生物识别.{0,10}(?:同意|授权|授權)|(?:同意|授权|授權).{0,10}生物识别|生物識別.{0,10}(?:同意|授權)|(?:同意|授權).{0,10}生物識別|人脸识别.{0,10}(?:同意|授权|授權)|(?:同意|授权|授權).{0,10}人脸识别|人臉識別.{0,10}(?:同意|授權)|(?:同意|授權).{0,10}人臉識別|授权书|授權書|担保|擔保|purchase\s+agreement|order\s+agreement|terms?\s+of\s+sale|authori[sz]e.{0,20}(?:payment|debit|charge)|direct\s+debit|(?:loan|credit)\s+agreement|investment\s+risk|trading\s+authori[sz]ation|authori[sz](?:e|ation).{0,18}(?:trading|trade|investment)|(?:trading|trade|investment).{0,18}authori[sz](?:e|ation)|insurance\s+(?:application|purchase|policy\s+application)|medical\s+consent|informed\s+consent|consent.{0,18}(?:medical|treatment|surgery)|(?:medical|treatment|surgery).{0,18}consent|employment\s+(?:agreement|contract)|electronic\s+signature|e-?sign(?:ature)?|auto.?renew|subscription\s+plan|arbitration|waiv(?:e|er)|class\s+action|biometric.{0,16}(?:consent|authori[sz])|(?:consent|authori[sz]).{0,16}biometric|facial\s+recognition.{0,16}(?:consent|authori[sz])|(?:consent|authori[sz]).{0,16}facial\s+recognition|power\s+of\s+attorney|guarant(?:or|ee))/iu;
  const TRANSACTION_ACTION = /(?:下单|下單|提交订单|提交訂單|确认订单|確認訂單|立即购买|立即購買|去支付|确认支付|確認支付|授权扣款|授權扣款|申请贷款|申請貸款|申请借款|申請借款|投保|买入|買入|卖出|賣出|交易下单|交易下單|认购|認購|开通自动续费|開通自動續費|checkout|place\s+(?:an?\s+)?order|complete\s+(?:the\s+)?purchase|buy\s+now|pay\s+now|make\s+(?:a\s+)?payment|authori[sz]e\s+(?:the\s+)?(?:payment|debit|charge)|apply\s+for\s+(?:a\s+)?loan|place\s+(?:a\s+)?trade|subscribe.{0,20}(?:pay|billing|charge)|start\s+(?:a\s+)?subscription|enable\s+auto.?renew)/iu;
  const COMPACT_RISK = /(?:(?:consent|authori[sz](?:e|ation)?).{0,36}(?:facialrecognition|biometric)|(?:facialrecognition|biometric).{0,36}(?:consent|authori[sz](?:e|ation)?)|authori[sz](?:e|ation)?.{0,32}(?:payment|debit|charge|trading|trade|investment)|(?:loan|credit)agreement|investmentrisk|insurance(?:application|purchase)|medicalconsent|informedconsent|employment(?:agreement|contract)|electronicsignature|arbitration|classaction|powerofattorney|autorenew|subscriptionplan)/i;
  const COMPACT_NEGATIVE = /(?:donotagree|dontagree|rememberme|keepmesignedin|newsletter|marketing|promotion|autorenew|subscription|captcha|recaptcha|hcaptcha|turnstile|thirdpartyshare|sharethirdparty|donation|warranty|cookie|cookies)/i;
  const COMPACT_ATTESTATION = /(?:over18|18years?old|legalage|icertify|iconfirmthat|ideclare|information(?:is|are)(?:true|accurate))/i;

  // Compact companions keep the risk boundary at least as multilingual and fragmentation-tolerant
  // as routine consent detection. Matching here is intentionally fail-closed: these phrases can
  // suppress an automatic click, but never create click authority.
  const COMPACT_MULTILINGUAL_NEGATIVE = /(?:publicit[eé]s?|werbung|publicidad|publicidade|pubblicit[aà]|広告|광고|реклам[а-яё]*|الإعلانات|reclame|reklam(?:y|e)?|quảngcáo|iklan|โฆษณา|विज्ञापन|διαφημίσεις|פרסומות)/iu;
  const COMPACT_MULTILINGUAL_CONSEQUENTIAL = /(?:pr[eé]l[eè]vementautomatique|abbuchung|d[eé]bitodirecto|d[eé]bitodireto|addebitodiretto|口座引き落とし|자동이체|прямоесписание|الخصمالمباشر|automatischeincasso|poleceniazapłaty|otomatiködem|ghinợtrựctiếp|debitlangsung|หักบัญชีอัตโนมัติ|सीधेडेबिट|άμεσηχρέωση|חיובישיר|autogiro|direktebelastning|direktedebitering)/iu;
  const COMPACT_MULTILINGUAL_ATTESTATION = /(?:plusde18ans|über18jahrealt|mayorde18años|maisde18anos|piùdi18anni|18歳以上|18세이상|больше18лет|يزيدعن18عام|ouderdan18jaar|ponad18lat|18yaşındanbüyük|trên18tuổi|diatas18tahun|อายุมากกว่า18ปี|18वर्षसेअधिक|άνωτων18ετών|מעלגיל18|över18år|over18år)/iu;

  const { normalize, compactSemantic, hasNonLatin } = BASE;
  function containsNegative(value) {
    const t=normalize(value); if(!t)return false;
    if(NEGATIVE.test(t))return true;
    const c=compactSemantic(t);
    return COMPACT_NEGATIVE.test(c)||COMPACT_MULTILINGUAL_NEGATIVE.test(c)||(hasNonLatin(t)&&NEGATIVE.test(c));
  }
  function containsAttestation(value) {
    const t=normalize(value); if(!t)return false;
    if(ATTESTATION.test(t))return true;
    const c=compactSemantic(t);
    return COMPACT_ATTESTATION.test(c)||COMPACT_MULTILINGUAL_ATTESTATION.test(c)||(hasNonLatin(t)&&ATTESTATION.test(c));
  }
  function severityFor(localText, contextText='', transaction=false) {
    const local=normalize(localText,1800), context=normalize(contextText,2400), compact=compactSemantic(local,1800), nonLatin=hasNonLatin(local);
    if(containsAttestation(local)) return {level:SEVERITY.ATTESTATION,kind:'attestation'};
    if(CONSEQUENTIAL_LOCAL.test(local)||COMPACT_RISK.test(compact)||COMPACT_MULTILINGUAL_CONSEQUENTIAL.test(compact)||(nonLatin&&CONSEQUENTIAL_LOCAL.test(compact))||transaction||TRANSACTION_ACTION.test(context)) return {level:SEVERITY.CONSEQUENTIAL,kind:'consequential'};
    if(containsNegative(local)) return {level:SEVERITY.OPTIONAL,kind:'optional-or-negative'};
    if(/privacy|隐私|隱私|プライバシー|개인정보|конфиденц|الخصوصية|gizlilik|privasi|गोपनीयता|απορρήτου|פרטיות/i.test(local)) return {level:SEVERITY.PRIVACY,kind:'routine-privacy'};
    return {level:SEVERITY.ROUTINE,kind:'routine'};
  }
  globalThis.__AUTO_AGREE_RISK__=Object.freeze({
    version:VERSION,
    SEVERITY,
    patterns:Object.freeze({NEGATIVE,ATTESTATION,CONSEQUENTIAL_LOCAL,TRANSACTION_ACTION,COMPACT_RISK,COMPACT_NEGATIVE,COMPACT_ATTESTATION,COMPACT_MULTILINGUAL_NEGATIVE,COMPACT_MULTILINGUAL_CONSEQUENTIAL,COMPACT_MULTILINGUAL_ATTESTATION}),
    containsNegative,
    containsAttestation,
    severityFor
  });
})();
