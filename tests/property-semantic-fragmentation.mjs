import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { LANGUAGE_CORPUS } from './fixtures/language-corpus.mjs';

const context = vm.createContext({ console, WeakRef, performance });
vm.runInContext(fs.readFileSync('extension/runtime-kernel.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('extension/semantic-core.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('extension/decision-core.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('extension/risk-core.js', 'utf8'), context);
const core = context.__AUTO_AGREE_SEMANTIC__;
const risk = context.__AUTO_AGREE_RISK__;
assert.ok(core && risk);
const S = risk.SEVERITY;

let routineCases = 0;
let riskCases = 0;
for (const sample of LANGUAGE_CORPUS) {
  const baseline = core.assessText(sample.routine);
  assert.equal(baseline.legal, true, `${sample.id} baseline legal: ${sample.routine}`);
  assert.equal(baseline.assent, true, `${sample.id} baseline assent: ${sample.routine}`);
  for (let cut = 1; cut < sample.routine.length; cut++) {
    const fragmented = `${sample.routine.slice(0, cut)} ${sample.routine.slice(cut)}`;
    const assessed = core.assessText(fragmented);
    assert.equal(assessed.legal, true, `${sample.id} fragment legal @${cut}: ${fragmented}`);
    assert.equal(assessed.assent, true, `${sample.id} fragment assent @${cut}: ${fragmented}`);
    routineCases++;
  }

  const riskPhrases = [
    ['optional', sample.optional, S.OPTIONAL, false],
    ['consequential', sample.consequential, S.CONSEQUENTIAL, false],
    ['attestation', sample.attestation, S.ATTESTATION, true],
    ...sample.highConsequence.map((text, index) => [`high-${index}`, text, S.CONSEQUENTIAL, false])
  ];
  for (const [kind, phrase, floor, exact] of riskPhrases) {
    const baselineSeverity = risk.severityFor(phrase).level;
    if (exact) assert.equal(baselineSeverity, floor, `${sample.id} ${kind} baseline`);
    else assert.ok(baselineSeverity >= floor, `${sample.id} ${kind} baseline`);
    for (let cut = 1; cut < phrase.length; cut++) {
      const fragmented = `${phrase.slice(0, cut)} ${phrase.slice(cut)}`;
      const severity = risk.severityFor(fragmented).level;
      if (exact) assert.equal(severity, floor, `${sample.id} ${kind} fragment @${cut}: ${fragmented}`);
      else assert.ok(severity >= floor, `${sample.id} ${kind} fragment @${cut}: ${fragmented}`);
      riskCases++;
    }
  }
}

console.log(`property-semantic-fragmentation: PASS (${routineCases} routine + ${riskCases} risk fragments)`);
