import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context = vm.createContext({ console, WeakRef, performance });
vm.runInContext(fs.readFileSync('extension/runtime-kernel.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('extension/semantic-core.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('extension/risk-core.js', 'utf8'), context);
const core = context.__AUTO_AGREE_SEMANTIC__;
const risk = context.__AUTO_AGREE_RISK__;
assert.ok(core && risk);
const S = risk.SEVERITY;

const positives = [
  'I have read and agree to the Terms of Service',
  'I agree to the Privacy Policy',
  '我已阅读并同意用户协议和隐私政策',
  '利用規約に同意します',
  '이용약관에 동의합니다',
  'أوافق على الشروط وسياسة الخصوصية'
];
const optional = [
  'I agree to receive marketing newsletters',
  'Remember me and keep me signed in',
  'Accept cookies for personalized ads',
  '我同意接收营销推广信息'
];
const consequential = [
  'I agree to the Terms and authorize payment/debit',
  'I agree to arbitration and waive class action rights',
  'I consent to facial recognition and biometric processing',
  '我同意服务协议并授权扣款',
  '我同意用户协议和人脸识别授权',
  'medical informed consent',
  'accept automatic renewal'
];
const attestations = [
  'I confirm that I am over 18 and agree to the Terms',
  'I certify that the information is accurate',
  '本人确认以上信息真实并同意用户协议'
];

for (const text of positives) {
  const a = core.assessText(text);
  assert.equal(a.legal, true, text);
  const sev = risk.severityFor(text);
  assert.ok(sev.level <= S.PRIVACY, `${text}: ${sev.level}`);
}
for (const text of optional) assert.ok(risk.severityFor(text).level >= S.OPTIONAL, text);
for (const text of consequential) assert.ok(risk.severityFor(text).level >= S.CONSEQUENTIAL, text);
for (const text of attestations) assert.equal(risk.severityFor(text).level, S.ATTESTATION, text);

const multilingualRisk = [
  { lang:'fr', optional:"J’accepte de recevoir des publicités", consequential:"J’autorise le prélèvement automatique", attestation:"Je confirme avoir plus de 18 ans" },
  { lang:'de', optional:'Ich stimme dem Erhalt von Werbung zu', consequential:'Ich autorisiere die Abbuchung', attestation:'Ich bestätige, dass ich über 18 Jahre alt bin' },
  { lang:'es', optional:'Acepto recibir publicidad', consequential:'Autorizo el débito directo', attestation:'Confirmo que soy mayor de 18 años' },
  { lang:'pt', optional:'Aceito receber publicidade', consequential:'Autorizo o débito direto', attestation:'Confirmo que tenho mais de 18 anos' },
  { lang:'it', optional:'Accetto di ricevere pubblicità', consequential:"Autorizzo l’addebito diretto", attestation:'Confermo di avere più di 18 anni' },
  { lang:'ja', optional:'広告の受信に同意します', consequential:'口座引き落としを承認します', attestation:'18歳以上であることを確認します' },
  { lang:'ko', optional:'광고 수신에 동의합니다', consequential:'자동 이체를 승인합니다', attestation:'만 18세 이상임을 확인합니다' },
  { lang:'ru', optional:'Я согласен получать рекламу', consequential:'Я разрешаю прямое списание', attestation:'Я подтверждаю, что мне больше 18 лет' },
  { lang:'ar', optional:'أوافق على تلقي الإعلانات', consequential:'أفوض الخصم المباشر', attestation:'أؤكد أن عمري يزيد عن 18 عامًا' },
  { lang:'nl', optional:'Ik ga akkoord met reclame', consequential:'Ik machtig de automatische incasso', attestation:'Ik bevestig dat ik ouder dan 18 jaar ben' },
  { lang:'pl', optional:'Zgadzam się na reklamy', consequential:'Upoważniam do polecenia zapłaty', attestation:'Potwierdzam, że mam ponad 18 lat' },
  { lang:'tr', optional:'Reklam almayı kabul ediyorum', consequential:'Otomatik ödemeye yetki veriyorum', attestation:'18 yaşından büyük olduğumu onaylıyorum' },
  { lang:'vi', optional:'Tôi đồng ý nhận quảng cáo', consequential:'Tôi ủy quyền ghi nợ trực tiếp', attestation:'Tôi xác nhận rằng tôi trên 18 tuổi' },
  { lang:'id', optional:'Saya setuju menerima iklan', consequential:'Saya mengizinkan debit langsung', attestation:'Saya mengonfirmasi bahwa saya berusia di atas 18 tahun' },
  { lang:'th', optional:'ฉันยินยอมรับโฆษณา', consequential:'ฉันอนุญาตให้หักบัญชีอัตโนมัติ', attestation:'ฉันยืนยันว่าฉันอายุมากกว่า 18 ปี' },
  { lang:'hi', optional:'मैं विज्ञापन प्राप्त करने के लिए सहमत हूँ', consequential:'मैं सीधे डेबिट को अधिकृत करता हूँ', attestation:'मैं पुष्टि करता हूँ कि मेरी उम्र 18 वर्ष से अधिक है' },
  { lang:'el', optional:'Συμφωνώ να λαμβάνω διαφημίσεις', consequential:'Εξουσιοδοτώ την άμεση χρέωση', attestation:'Επιβεβαιώνω ότι είμαι άνω των 18 ετών' },
  { lang:'he', optional:'אני מסכים לקבל פרסומות', consequential:'אני מאשר חיוב ישיר', attestation:'אני מאשר שאני מעל גיל 18' },
  { lang:'sv', optional:'Jag godkänner reklam', consequential:'Jag godkänner autogiro', attestation:'Jag bekräftar att jag är över 18 år' },
  { lang:'no', optional:'Jeg godtar reklame', consequential:'Jeg godkjenner direkte belastning', attestation:'Jeg bekrefter at jeg er over 18 år' },
  { lang:'da', optional:'Jeg accepterer reklame', consequential:'Jeg godkender direkte debitering', attestation:'Jeg bekræfter, at jeg er over 18 år' }
];
for (const sample of multilingualRisk) {
  assert.ok(risk.severityFor(sample.optional).level >= S.OPTIONAL, `${sample.lang} optional: ${sample.optional}`);
  assert.ok(risk.severityFor(sample.consequential).level >= S.CONSEQUENTIAL, `${sample.lang} consequential: ${sample.consequential}`);
  assert.equal(risk.severityFor(sample.attestation).level, S.ATTESTATION, `${sample.lang} attestation: ${sample.attestation}`);
}

const multilingualHighConsequence = [
  { lang:'fr', terms:['contrat de prêt','consentement médical','reconnaissance faciale','arbitrage','renouvellement automatique'] },
  { lang:'de', terms:['Darlehensvertrag','medizinische Einwilligung','Gesichtserkennung','Schiedsverfahren','automatische Verlängerung'] },
  { lang:'es', terms:['contrato de préstamo','consentimiento médico','reconocimiento facial','arbitraje','renovación automática'] },
  { lang:'pt', terms:['contrato de empréstimo','consentimento médico','reconhecimento facial','arbitragem','renovação automática'] },
  { lang:'it', terms:['contratto di prestito','consenso medico','riconoscimento facciale','arbitrato','rinnovo automatico'] },
  { lang:'ja', terms:['ローン契約','医療同意','顔認識','仲裁','自動更新'] },
  { lang:'ko', terms:['대출 계약','의료 동의','안면 인식','중재','자동 갱신'] },
  { lang:'ru', terms:['кредитный договор','медицинское согласие','распознавание лица','арбитраж','автоматическое продление'] },
  { lang:'ar', terms:['اتفاقية قرض','موافقة طبية','التعرف على الوجه','تحكيم','التجديد التلقائي'] },
  { lang:'nl', terms:['leningsovereenkomst','medische toestemming','gezichtsherkenning','arbitrage','automatische verlenging'] },
  { lang:'pl', terms:['umowa kredytowa','zgoda medyczna','rozpoznawanie twarzy','arbitraż','automatyczne odnowienie'] },
  { lang:'tr', terms:['kredi sözleşmesi','tıbbi onam','yüz tanıma','tahkim','otomatik yenileme'] },
  { lang:'vi', terms:['hợp đồng vay','đồng ý y tế','nhận diện khuôn mặt','trọng tài','tự động gia hạn'] },
  { lang:'id', terms:['perjanjian pinjaman','persetujuan medis','pengenalan wajah','arbitrase','perpanjangan otomatis'] },
  { lang:'th', terms:['สัญญาเงินกู้','ความยินยอมทางการแพทย์','การจดจำใบหน้า','อนุญาโตตุลาการ','ต่ออายุอัตโนมัติ'] },
  { lang:'hi', terms:['ऋण समझौता','चिकित्सा सहमति','चेहरा पहचान','मध्यस्थता','स्वचालित नवीनीकरण'] },
  { lang:'el', terms:['σύμβαση δανείου','ιατρική συγκατάθεση','αναγνώριση προσώπου','διαιτησία','αυτόματη ανανέωση'] },
  { lang:'he', terms:['הסכם הלוואה','הסכמה רפואית','זיהוי פנים','בוררות','חידוש אוטומטי'] },
  { lang:'sv', terms:['låneavtal','medicinskt samtycke','ansiktsigenkänning','skiljeförfarande','automatisk förnyelse'] },
  { lang:'no', terms:['låneavtale','medisinsk samtykke','ansiktsgjenkjenning','voldgift','automatisk fornyelse'] },
  { lang:'da', terms:['låneaftale','medicinsk samtykke','ansigtsgenkendelse','voldgift','automatisk fornyelse'] }
];
for (const sample of multilingualHighConsequence) {
  for (const term of sample.terms) {
    assert.ok(risk.severityFor(term).level >= S.CONSEQUENTIAL, `${sample.lang} high-consequence: ${term}`);
  }
}

const legalBases = positives.slice(0, 3);
const dangerousSuffixes = [
  ' and authorize payment',
  ' and consent to facial recognition',
  ' and waive my right to class action arbitration',
  ' 并授权扣款',
  ' 并同意人脸识别授权'
];
let cases = 0;
for (let i = 0; i < 10000; i++) {
  const base = legalBases[i % legalBases.length];
  const suffix = dangerousSuffixes[(i * 7) % dangerousSuffixes.length];
  const text = `${base}${suffix}`;
  const sev = risk.severityFor(text);
  assert.ok(sev.level >= S.CONSEQUENTIAL, `${text}: ${sev.level}`);
  cases++;
}

const huge = `${'x'.repeat(1_000_000)} I agree to the Terms of Service`;
const normalized = core.normalize(huge, 1000);
assert.ok(normalized.length <= 1000);
assert.equal(core.assessText(normalized).legal, true);
console.log(`property-consent-model: PASS (${cases + positives.length + optional.length + consequential.length + attestations.length + multilingualRisk.length * 3 + multilingualHighConsequence.length * 5 + 1} assertions)`);
