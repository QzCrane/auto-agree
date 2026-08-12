import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { LANGUAGE_CORPUS, LANGUAGE_IDS } from './fixtures/language-corpus.mjs';

const EXPECTED_LANGUAGES = Object.freeze(['zh','en','fr','de','es','pt','it','ja','ko','ru','ar','nl','pl','tr','vi','id','th','hi','el','he','sv','no','da']);
assert.deepEqual(LANGUAGE_IDS, EXPECTED_LANGUAGES, 'routine-support language families must be explicit and reviewable');
assert.equal(new Set(LANGUAGE_IDS).size, LANGUAGE_IDS.length, 'language ids must be unique');

const context = vm.createContext({ console, WeakRef, performance });
vm.runInContext(fs.readFileSync('extension/runtime-kernel.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('extension/semantic-core.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('extension/decision-core.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('extension/risk-core.js', 'utf8'), context);
const semantic = context.__AUTO_AGREE_SEMANTIC__;
const risk = context.__AUTO_AGREE_RISK__;
assert.ok(semantic && risk);
const S = risk.SEVERITY;

let assertions = 0;
for (const sample of LANGUAGE_CORPUS) {
  for (const field of ['routine','optional','consequential','attestation']) {
    assert.equal(typeof sample[field], 'string', `${sample.id}.${field} must be a string`);
    assert.ok(sample[field].trim(), `${sample.id}.${field} must be non-empty`);
  }
  assert.ok(Array.isArray(sample.highConsequence) && sample.highConsequence.length >= 5, `${sample.id} must declare high-consequence families`);

  const routine = semantic.assessText(sample.routine);
  assert.equal(routine.legal, true, `${sample.id} routine legal: ${sample.routine}`);
  assert.equal(routine.assent, true, `${sample.id} routine assent: ${sample.routine}`);
  assert.ok(risk.severityFor(sample.routine).level <= S.PRIVACY, `${sample.id} routine must remain auto-eligible severity`);
  assertions += 3;

  assert.ok(risk.severityFor(sample.optional).level >= S.OPTIONAL, `${sample.id} optional: ${sample.optional}`);
  assert.ok(risk.severityFor(sample.consequential).level >= S.CONSEQUENTIAL, `${sample.id} consequential: ${sample.consequential}`);
  assert.equal(risk.severityFor(sample.attestation).level, S.ATTESTATION, `${sample.id} attestation: ${sample.attestation}`);
  assertions += 3;

  for (const term of sample.highConsequence) {
    assert.ok(risk.severityFor(term).level >= S.CONSEQUENTIAL, `${sample.id} high-consequence: ${term}`);
    assertions++;
  }
}

console.log(`language-parity: PASS (${LANGUAGE_CORPUS.length} language families, ${assertions} safety assertions)`);
