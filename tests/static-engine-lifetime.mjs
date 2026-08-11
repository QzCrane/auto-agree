import fs from 'node:fs';
import assert from 'node:assert/strict';

const engine = fs.readFileSync('extension/engine.js', 'utf8');
const rootBatchTtlE2e = fs.readFileSync('tests/e2e-engine-rootbatch-ttl.mjs', 'utf8');

assert.match(engine, /ROOT_BATCH_TTL_MS\s*=\s*3000/, 'Engine RootBatch TTL constant must remain explicit');
assert.equal(
  /performance\.now\(\)\s*-\s*job\.createdAt\s*>\s*ROOT_BATCH_TTL_MS\)\s*return\s+false/.test(engine),
  false,
  'Engine must not erase still-live RootBatch work by age alone'
);
assert.match(
  engine,
  /if\s*\(performance\.now\(\)\s*-\s*job\.createdAt\s*>\s*ROOT_BATCH_TTL_MS\)\s*job\.createdAt\s*=\s*performance\.now\(\)/,
  'live Engine RootBatch work must refresh liveness age and continue from its existing index'
);
assert.match(rootBatchTtlE2e, /const\s+ROOTS\s*=\s*60/, 'RootBatch TTL discriminator must create enough roots to force backlog');
assert.match(rootBatchTtlE2e, /const\s+POSITIVE\s*=\s*42/, 'RootBatch TTL target must remain away from the early synchronous roots');
assert.match(rootBatchTtlE2e, /performance\.now\(\)\s*\+\s*3400/, 'RootBatch TTL discriminator must cross the 3000 ms production TTL');
assert.match(rootBatchTtlE2e, /live Engine RootBatch work must survive age beyond ROOT_BATCH_TTL_MS exactly once/, 'RootBatch TTL discriminator must retain exactly-once progress');

console.log('static-engine-lifetime: PASS');
