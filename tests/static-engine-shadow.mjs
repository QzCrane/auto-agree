import fs from 'node:fs';
import assert from 'node:assert/strict';

const engine = fs.readFileSync('extension/engine.js', 'utf8');
const shadowE2e = fs.readFileSync('tests/e2e-engine-shadow-overflow.mjs', 'utf8');

assert.match(engine, /MAX_SHADOW_JOBS\s*=\s*8/, 'Engine shadow recovery must preserve the hard 8-job cap');
assert.equal(
  /while\s*\(shadowJobs\.length\s*>=\s*MAX_SHADOW_JOBS\)[\s\S]{0,260}shadowJobs\.shift\(\)/.test(engine),
  false,
  'Engine broad-shadow pressure must not evict an older unfinished FIFO cursor'
);
assert.match(engine, /let\s+shadowRecoveryRef\s*=\s*null/, 'Engine needs one weak broad-shadow recovery scope');
assert.match(engine, /function\s+makeShadowJob\s*\(/, 'Engine shadow jobs must share one bounded constructor');
assert.match(engine, /function\s+rememberShadowRecovery\s*\(/, 'new excess broad-shadow roots must remain recoverable');
assert.match(engine, /function\s+promoteShadowRecovery\s*\(/, 'broad-shadow recovery must re-enter ordinary bounded traversal');
assert.match(engine, /shadowRecoveryRef\s*=\s*new WeakRef\(merged\)/, 'broad-shadow recovery must not strongly own DOM');
assert.match(
  engine,
  /if\s*\(shadowJobs\.length\s*>=\s*MAX_SHADOW_JOBS\)\s*\{[\s\S]{0,260}rememberShadowRecovery\(root\)[\s\S]{0,160}return;/,
  'Engine must preserve existing shadow FIFO cursors and compress only the new excess root'
);
assert.match(
  engine,
  /function\s+hasBackgroundWork\s*\(\)[\s\S]{0,260}shadowRecoveryRef/,
  'background liveness must include pending broad-shadow recovery'
);
assert.match(
  engine,
  /if\s*\(!rootBatches\.length\s*&&\s*!walkJobs\.length\s*&&\s*!batchJobs\.length\s*&&\s*!shadowJobs\.length\)\s*promoteShadowRecovery\(\)/,
  'broad-shadow recovery must not overtake RootBatch, walk, batch, or ordinary shadow work'
);
assert.match(
  engine,
  /shadowJobs\.length\s*=\s*0;\s*shadowRecoveryRef\s*=\s*null;\s*batchJobs\.length\s*=\s*0/,
  'Engine lifecycle retirement must clear broad-shadow recovery state'
);

assert.match(shadowE2e, /const\s+ROOTS\s*=\s*14/, 'closed-shadow saturation must materially exceed the 8-job cap');
assert.match(shadowE2e, /const\s+NODES\s*=\s*900/, 'closed-shadow roots must require background continuation');
assert.match(shadowE2e, /attachShadow\(\{mode:\s*'closed'\}\)/, 'the unique target must remain hidden in a closed ShadowRoot');
assert.match(shadowE2e, /document\.createElement\('div'\)/, 'the closed ShadowRoot host must remain a plain DIV invisible to ordinary probing');
assert.match(shadowE2e, /timeout:\s*9000/, 'closed-shadow saturation keeps a fixed eventual-progress deadline');
assert.match(shadowE2e, /broad closed-shadow discovery must survive MAX_SHADOW_JOBS pressure exactly once/, 'closed-shadow saturation must require exactly-once recovery');

console.log('static-engine-shadow: PASS');
