import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context = vm.createContext({ console });
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
  'medical informed consent'
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

// Property: adding a high-consequence clause must never lower severity below OPTIONAL.
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

// Property: normalization is bounded for pathological inputs.
const huge = `${'x'.repeat(1_000_000)} I agree to the Terms of Service`;
const normalized = core.normalize(huge, 1000);
assert.ok(normalized.length <= 1000);
assert.equal(core.assessText(normalized).legal, true);
console.log(`property-consent-model: PASS (${cases + positives.length + optional.length + consequential.length + attestations.length + 1} assertions)`);
