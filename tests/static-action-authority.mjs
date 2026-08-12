import fs from 'node:fs';
import assert from 'node:assert/strict';

const engine=fs.readFileSync('extension/engine.js','utf8');
const guard=fs.readFileSync('extension/handover-guard.js','utf8');
const lease=fs.readFileSync('extension/generation-lease.js','utf8');

assert.match(engine,/function\s+dispatchAuthorizedClick\s*\(target\)/,'Engine must have one automated DOM dispatch authority adapter');
assert.match(engine,/authorize\?\.\(target\)\s*===\s*true/,'Engine must require explicit true authorization before dispatch');
assert.match(engine,/if\s*\(!authorized\)\s*return false/,'authorization rejection must fail before synthetic dispatch');
assert.match(engine,/try\s*\{\s*target\.click\(\);\s*return true;/,'the one adapter performs the synchronous click only after authorization');
assert.equal((engine.match(/__AUTO_AGREE_HANDOVER_GUARD__\?\.authorize\?\.\(target\)/g)||[]).length,1,'Engine must have exactly one handover-authorize call site');
assert.equal((engine.match(/target\.click\(\)/g)||[]).length,1,'Engine must have exactly one direct target.click call site');
assert.equal(/authorizeHandoverClick/.test(engine),false,'legacy fire-and-forget authorization helper must not survive');
assert.match(engine,/if\s*\(!dispatchAuthorizedClick\(target\)\)\s*\{\s*stopVerifier\(fresh\.control\);\s*return;/,'retry dispatch must use the same fail-closed adapter');
assert.match(engine,/if\s*\(!dispatchAuthorizedClick\(target\)\)\s*\{\s*oneShotUnknown\.delete\(s\.control\);\s*stopVerifier\(s\.control\);\s*return false;/,'initial dispatch must use the same fail-closed adapter');

// Defense in depth remains independent of the Engine adapter.
assert.match(guard,/addEventListener\('click', onClick, true\)/,'handover guard must retain capture-boundary enforcement');
assert.match(guard,/if\s*\(!event\.isTrusted\s*&&\s*!runtimeCurrent\(\)\)/,'guard must retain stale-runtime synthetic-click defense');
assert.match(guard,/if\s*\(consume\(authorized, nodes\)\)/,'guard must retain one-shot explicit authorization consumption');
assert.match(guard,/if\s*\(!agreementLike\(nodes\)\)\s*return;\s*block\(event\)/,'unauthorized agreement-like synthetic clicks must still fail closed at the event boundary');
assert.match(lease,/HTMLElement\.prototype/,'generation lease remains the lower-level stale-world click defense');

console.log('static-action-authority: PASS');
