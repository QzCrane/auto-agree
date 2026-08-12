import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context = vm.createContext({ console, WeakRef, performance });
vm.runInContext(fs.readFileSync('extension/runtime-kernel.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('extension/semantic-core.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('extension/decision-core.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('extension/risk-core.js', 'utf8'), context);
const core = context.__AUTO_AGREE_SEMANTIC__;
const risk = context.__AUTO_AGREE_RISK__;
assert.ok(core && risk);
const S = risk.SEVERITY;

// Focused cross-category edge cases live here. The complete language support commitment belongs
// to fixtures/language-corpus.mjs + language-parity.mjs so routine authority cannot grow alone.
const routineEdges = [
  'I agree to the Privacy Policy',
  '我已阅读并同意用户协议和隐私政策',
  '利用規約に同意します',
  '이용약관에 동의합니다',
  'أوافق على الشروط وسياسة الخصوصية'
];
const optionalEdges = [
  'I agree to receive marketing newsletters',
  'Remember me and keep me signed in',
  'Accept cookies for personalized ads',
  '我同意接收营销推广信息'
];
const consequentialEdges = [
  'I agree to the Terms and authorize payment/debit',
  'I agree to arbitration and waive class action rights',
  'I consent to facial recognition and biometric processing',
  '我同意服务协议并授权扣款',
  '我同意用户协议和人脸识别授权',
  'medical informed consent',
  'accept automatic renewal'
];
const attestationEdges = [
  'I confirm that I am over 18 and agree to the Terms',
  'I certify that the information is accurate',
  '本人确认以上信息真实并同意用户协议'
];

for (const text of routineEdges) {
  const a = core.assessText(text);
  assert.equal(a.legal, true, text);
  assert.ok(risk.severityFor(text).level <= S.PRIVACY, text);
}
for (const text of optionalEdges) assert.ok(risk.severityFor(text).level >= S.OPTIONAL, text);
for (const text of consequentialEdges) assert.ok(risk.severityFor(text).level >= S.CONSEQUENTIAL, text);
for (const text of attestationEdges) assert.equal(risk.severityFor(text).level, S.ATTESTATION, text);

const legalBases = [
  'I have read and agree to the Terms of Service',
  'I agree to the Privacy Policy',
  '我已阅读并同意用户协议和隐私政策'
];
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
  assert.ok(risk.severityFor(text).level >= S.CONSEQUENTIAL, text);
  cases++;
}

const huge = `${'x'.repeat(1_000_000)} I agree to the Terms of Service`;
const normalized = core.normalize(huge, 1000);
assert.ok(normalized.length <= 1000);
assert.equal(core.assessText(normalized).legal, true);
console.log(`property-consent-model: PASS (${cases + routineEdges.length + optionalEdges.length + consequentialEdges.length + attestationEdges.length + 1} focused assertions)`);
