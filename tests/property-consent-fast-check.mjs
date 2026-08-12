import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const context = vm.createContext({ console, WeakRef, performance });
vm.runInContext(fs.readFileSync('extension/runtime-kernel.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('extension/semantic-core.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('extension/decision-core.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('extension/risk-core.js', 'utf8'), context);
const core = context.__AUTO_AGREE_SEMANTIC__;
const risk = context.__AUTO_AGREE_RISK__;
assert.ok(core && risk);
const S = risk.SEVERITY;

const routine = [
  'I have read and agree to the Terms of Service',
  'I agree to the Privacy Policy',
  '我已阅读并同意用户协议和隐私政策',
  '利用規約に同意します',
  '이용약관에 동의합니다',
  'أوافق على الشروط وسياسة الخصوصية',
  "J'ai lu et j'accepte les conditions d'utilisation",
  'He leído y acepto los términos y condiciones'
];

const dangerous = [
  'authorize payment and direct debit',
  'consent to facial recognition and biometric processing',
  'agree to a loan agreement',
  'accept binding arbitration and waive class action rights',
  'give medical informed consent',
  'accept automatic renewal',
  '授权扣款',
  '同意人脸识别授权',
  '已满18岁并确认信息真实',
  'consentimiento médico',
  'reconocimiento facial',
  'autorise le prélèvement automatique'
];

const separators = [' ', ' · ', ' / ', ' — ', '\n', ' | ', ' : ', ' ; ', '   '];
const noise = ['', 'required', 'continue', 'login', 'account', 'please', 'now', '确认', '继续', 'privacy'];

const routineArb = fc.constantFrom(...routine);
const dangerousArb = fc.constantFrom(...dangerous);
const separatorArb = fc.constantFrom(...separators);
const noiseArb = fc.array(fc.constantFrom(...noise), { minLength: 0, maxLength: 4 });

const consequenceNeverDowngrades = fc.property(
  routineArb,
  dangerousArb,
  separatorArb,
  noiseArb,
  fc.boolean(),
  (base, danger, separator, pieces, dangerFirst) => {
    const filler = pieces.filter(Boolean).join(separator);
    const left = dangerFirst ? danger : base;
    const right = dangerFirst ? base : danger;
    const text = [left, filler, right].filter(Boolean).join(separator);
    const assessed = core.assessText(text);
    const severity = risk.severityFor(text);

    assert.equal(assessed.legal, true, `generated case lost routine legal evidence: ${text}`);
    assert.ok(
      severity.level >= S.CONSEQUENTIAL,
      `dangerous evidence was downgraded to ${severity.level}: ${text}`
    );
  }
);

fc.assert(consequenceNeverDowngrades, {
  seed: 0xA611E12,
  numRuns: 2500,
  endOnFailure: true,
  verbose: 2
});

const attestationNeverBecomesRoutine = fc.property(
  routineArb,
  separatorArb,
  fc.constantFrom(
    'I confirm that I am over 18',
    'I certify that the information is accurate',
    '本人确认以上信息真实',
    'Je confirme avoir plus de 18 ans',
    'Confirmo que soy mayor de 18 años'
  ),
  (base, separator, attestation) => {
    const text = `${base}${separator}${attestation}`;
    assert.equal(risk.severityFor(text).level, S.ATTESTATION, text);
  }
);

fc.assert(attestationNeverBecomesRoutine, {
  seed: 0xA611E13,
  numRuns: 1000,
  endOnFailure: true,
  verbose: 2
});

console.log('property-consent-fast-check: PASS (3500 generated cases with shrinking enabled)');
