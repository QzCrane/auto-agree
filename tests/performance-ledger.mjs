import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ledgerPath = path.join(root, 'docs', 'performance', 'ledger.json');
const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));

assert.equal(ledger.schemaVersion, 1, 'performance ledger schemaVersion must be 1');
assert.ok(Array.isArray(ledger.records) && ledger.records.length > 0, 'performance ledger must contain records');

const allowedEvidenceClasses = new Set([
  'synthetic-in-page',
  'synthetic-in-page-retrospective',
  'real-unpacked-extension',
  'real-unpacked-extension-release',
  'real-unpacked-extension-main',
]);

for (const [index, record] of ledger.records.entries()) {
  const prefix = `performance record #${index}`;
  assert.equal(typeof record.version, 'string', `${prefix}: version required`);
  assert.equal(typeof record.benchmarkId, 'string', `${prefix}: benchmarkId required`);
  assert.ok(record.benchmarkId.length > 0, `${prefix}: benchmarkId cannot be empty`);
  assert.ok(allowedEvidenceClasses.has(record.evidenceClass), `${prefix}: unknown evidenceClass ${record.evidenceClass}`);
  assert.equal(typeof record.source, 'string', `${prefix}: source required`);
  assert.ok(record.metrics && typeof record.metrics === 'object' && !Array.isArray(record.metrics), `${prefix}: metrics object required`);

  for (const [name, value] of Object.entries(record.metrics)) {
    assert.equal(typeof value, 'number', `${prefix}: metric ${name} must be numeric`);
    assert.ok(Number.isFinite(value), `${prefix}: metric ${name} must be finite`);
    assert.ok(value >= 0, `${prefix}: metric ${name} must be non-negative`);
  }

  if (record.evidenceClass.startsWith('real-unpacked-extension')) {
    assert.ok(record.environment && typeof record.environment === 'object', `${prefix}: real unpacked record requires environment`);
    assert.equal(typeof record.environment.chrome, 'string', `${prefix}: real unpacked record requires Chrome version`);
    assert.equal(typeof record.environment.nodeMajor, 'number', `${prefix}: real unpacked record requires Node major`);
  }
}

const mainRecords = ledger.records.filter((record) => record.evidenceClass === 'real-unpacked-extension-main');
assert.ok(mainRecords.length >= 1, 'ledger must retain at least one verified main performance record');

console.log(`performance-ledger: PASS (${ledger.records.length} records)`);
