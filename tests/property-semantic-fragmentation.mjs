import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context = vm.createContext({ console, WeakRef, performance });
vm.runInContext(fs.readFileSync('extension/runtime-kernel.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('extension/semantic-core.js', 'utf8'), context);
const core = context.__AUTO_AGREE_SEMANTIC__;
assert.ok(core);

const phrases = [
  'I have read and agree to the Terms of Service',
  "J'ai lu et j'accepte les conditions d'utilisation",
  'Ich akzeptiere die Nutzungsbedingungen',
  'He leído y acepto los términos y condiciones',
  'Li e aceito os termos de uso',
  'Ho letto e accetto i termini di servizio',
  '利用規約に同意します',
  '이용약관에 동의합니다',
  'Я согласен с условиями использования',
  'أوافق على الشروط وسياسة الخصوصية',
  'Ik ga akkoord met de voorwaarden',
  'Zgadzam się na warunki korzystania',
  'Kullanım koşullarını kabul ediyorum',
  'Tôi đồng ý với điều khoản',
  'Saya setuju dengan syarat dan ketentuan',
  'ยอมรับข้อกำหนดและเงื่อนไข',
  'मैं नियम और शर्तों से सहमत हूँ',
  'Συμφωνώ με τους όρους',
  'אני מסכים לתנאי שימוש',
  'Jag godkänner villkoren',
  'Jeg godtar vilkårene',
  'Jeg accepterer betingelserne'
];

let cases = 0;
for (const phrase of phrases) {
  const baseline = core.assessText(phrase);
  assert.equal(baseline.legal, true, `baseline legal: ${phrase}`);
  assert.equal(baseline.assent, true, `baseline assent: ${phrase}`);
  for (let cut = 1; cut < phrase.length; cut++) {
    const fragmented = `${phrase.slice(0, cut)} ${phrase.slice(cut)}`;
    const assessed = core.assessText(fragmented);
    assert.equal(assessed.legal, true, `fragment legal @${cut}: ${fragmented}`);
    assert.equal(assessed.assent, true, `fragment assent @${cut}: ${fragmented}`);
    cases++;
  }
}

console.log(`property-semantic-fragmentation: PASS (${cases} fragmented phrases)`);
