import fs from 'node:fs';
import assert from 'node:assert/strict';

const engine = fs.readFileSync('extension/engine.js', 'utf8');
const kernel = fs.readFileSync('extension/runtime-kernel.js', 'utf8');
const shadowE2e = fs.readFileSync('tests/e2e-engine-shadow-overflow.mjs', 'utf8');

assert.match(engine, /MAX_SHADOW_JOBS\s*=\s*8/, 'Engine shadow recovery must preserve the hard 8-job cap');
assert.equal(/while\s*\(shadowJobs\.length\s*>=\s*MAX_SHADOW_JOBS\)[\s\S]{0,260}shadowJobs\.shift\(\)/.test(engine), false, 'Engine broad-shadow pressure must not evict an older unfinished FIFO cursor');
assert.match(engine, /const\s+shadowWork\s*=\s*KERNEL\.createBoundedFifo/, 'Engine broad Shadow must use shared bounded-work authority');
assert.match(engine, /capacity:\s*MAX_SHADOW_JOBS/, 'shared Shadow capacity must remain the proven 8-job cap');
assert.match(engine, /coalesce:\s*\(current, next\)[\s\S]{0,100}commonWalkRecoveryRoot\(current, next\)/, 'Shadow retains domain-specific common-root coalescing');
assert.match(engine, /shadowWork\.admit\(makeShadowJob\(root\), root, null\)/, 'new Shadow work must route through bounded FIFO admission');
assert.match(engine, /shadowWork\.promote\(/, 'Shadow recovery must re-enter ordinary traversal through the kernel');
assert.match(engine, /shadowWork\.hasRecovery/, 'background liveness must include pending kernel-owned Shadow recovery');
assert.match(engine, /shadowWork\.clear\(\)/, 'lifecycle retirement must clear kernel-owned Shadow work');
assert.match(kernel, /recoveryRef = new WeakRef\(mergedScope\)/, 'shared recovery must never strongly own the DOM scope');
assert.match(engine, /if\s*\(!rootBatches\.length\s*&&\s*!walkJobs\.length\s*&&\s*!batchJobs\.length\s*&&\s*!shadowJobs\.length\)\s*promoteShadowRecovery\(\)/, 'broad-shadow recovery must not overtake RootBatch, walk, batch, or ordinary shadow work');

assert.match(shadowE2e, /const\s+ROOTS\s*=\s*14/, 'closed-shadow saturation must materially exceed the 8-job cap');
assert.match(shadowE2e, /const\s+NODES\s*=\s*900/, 'closed-shadow roots must require background continuation');
assert.match(shadowE2e, /attachShadow\(\{mode:\s*'closed'\}\)/, 'the unique target must remain hidden in a closed ShadowRoot');
assert.match(shadowE2e, /document\.createElement\('div'\)/, 'the closed ShadowRoot host must remain a plain DIV invisible to ordinary probing');
assert.match(shadowE2e, /timeout:\s*9000/, 'closed-shadow saturation keeps a fixed eventual-progress deadline');
assert.match(shadowE2e, /broad closed-shadow discovery must survive MAX_SHADOW_JOBS pressure exactly once/, 'closed-shadow saturation must require exactly-once recovery');

console.log('static-engine-shadow: PASS');
