from pathlib import Path
import re


def replace_exact(path, old, new, count=1):
    p=Path(path); text=p.read_text(); actual=text.count(old)
    if actual!=count: raise SystemExit(f'{path}: expected {count}, got {actual}: {old[:180]!r}')
    p.write_text(text.replace(old,new))

replace_exact(
  'extension/engine.js',
  """          const retryVerifier = armVerifier(fresh, fresh.state, 1);
          authorizeHandoverClick(target);
          try { target.click(); } catch (_) { stopVerifier(fresh.control); return; }
          clickMemo.set(fresh.control, { time: performance.now(), succeeded: false, retry: true });
          retryVerifier();
""",
  """          const retryVerifier = armVerifier(fresh, fresh.state, 1);
          if (!dispatchAuthorizedClick(target)) { stopVerifier(fresh.control); return; }
          clickMemo.set(fresh.control, { time: performance.now(), succeeded: false, retry: true });
          retryVerifier();
"""
)
replace_exact(
  'extension/engine.js',
  """  function authorizeHandoverClick(target) {
    try { globalThis.__AUTO_AGREE_HANDOVER_GUARD__?.authorize?.(target); } catch (_) {}
  }

  function commitClick(s, target) {
""",
  """  function dispatchAuthorizedClick(target) {
    if (!(target instanceof HTMLElement)) return false;
    let authorized = false;
    try { authorized = globalThis.__AUTO_AGREE_HANDOVER_GUARD__?.authorize?.(target) === true; } catch (_) { return false; }
    if (!authorized) return false;
    try { target.click(); return true; } catch (_) { return false; }
  }

  function commitClick(s, target) {
"""
)
replace_exact(
  'extension/engine.js',
  """    const check = armVerifier(s, before, 0);
    authorizeHandoverClick(target);
    try { target.click(); } catch (_) { oneShotUnknown.delete(s.control); stopVerifier(s.control); return false; }
    clickMemo.set(s.control, { time: performance.now(), succeeded: false });
""",
  """    const check = armVerifier(s, before, 0);
    if (!dispatchAuthorizedClick(target)) { oneShotUnknown.delete(s.control); stopVerifier(s.control); return false; }
    clickMemo.set(s.control, { time: performance.now(), succeeded: false });
"""
)

# Broad architecture contract only asserts that Engine consumes the Guard. Exact dispatch semantics
# belong to static-action-authority.mjs, so one invariant has one test authority.
replace_exact(
  'tests/static-contract.mjs',
  "assert.match(engine,/authorizeHandoverClick/);assert.match(engine,/__AUTO_AGREE_DECISION__/,'Engine must consume the pure decision authority');",
  "assert.match(engine,/__AUTO_AGREE_HANDOVER_GUARD__/,'Engine must consume handover action authority');assert.match(engine,/__AUTO_AGREE_DECISION__/,'Engine must consume the pure decision authority');"
)

# Strong static contract: only one Engine function may call guard.authorize or target.click.
Path('tests/static-action-authority.mjs').write_text(r'''import fs from 'node:fs';
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
''')

# The old package.json hand-maintained chain silently dropped classless-decision in an unrelated
# merge. Deterministic gates are now discovered by tests/run-core.mjs, so adding a test file is
# sufficient to make it part of CI and no future package-line merge can forget one.
pkg=Path('package.json'); text=pkg.read_text()
text, count = re.subn(r'"check":\s*"[^"]+"', '"check": "node tests/run-core.mjs && npm run typecheck"', text, count=1)
if count != 1: raise SystemExit('package check script replacement failed')
pkg.write_text(text)

print('v12 action authority migration prepared successfully')
