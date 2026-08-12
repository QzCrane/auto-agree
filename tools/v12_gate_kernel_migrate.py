from pathlib import Path


def replace_exact(path, old, new, count=1):
    p = Path(path)
    text = p.read_text()
    actual = text.count(old)
    if actual != count:
        raise SystemExit(f'{path}: expected {count} occurrence(s), got {actual}: {old[:160]!r}')
    p.write_text(text.replace(old, new))


replace_exact(
    'extension/gate.js',
    """  const batchJobs = [];
  const deepJobs = [];
  const deepQueued = new WeakSet();
  let deepRecoveryRef = null;
  let deepRecoveryComposite = false;
  let localChecked = new WeakSet();
""",
    """  const batchJobs = [];
  const deepQueued = new WeakSet();
  const deepWork = KERNEL.createBoundedFifo({
    capacity: MAX_DEEP_JOBS,
    isLive: rootConnected,
    coalesce: (current, next, currentComposite, nextComposite) => {
      const merged = commonDeepRecoveryRoot(current, next);
      const sameScope = merged === current && merged === next;
      return { scope: merged, meta: sameScope ? (!!currentComposite && !!nextComposite) : false };
    }
  });
  const deepJobs = deepWork.queue;
  let localChecked = new WeakSet();
""",
)

# Activation cleanup keeps per-job queued ownership cleanup, then clears kernel queue/recovery.
replace_exact(
    'extension/gate.js',
    """    batchJobs.length = 0;
    for (const job of deepJobs) releaseDeep(job);
    deepJobs.length = 0;
    deepRecoveryRef = null;
    deepRecoveryComposite = false;
    chrome.runtime.sendMessage({ type: 'AUTO_AGREE_ACTIVATE', reason }, response => {
""",
    """    batchJobs.length = 0;
    for (const job of deepJobs) releaseDeep(job);
    deepWork.clear();
    chrome.runtime.sendMessage({ type: 'AUTO_AGREE_ACTIVATE', reason }, response => {
""",
)

p = Path('extension/gate.js')
text = p.read_text()
old = """  function rememberDeepRecovery(root, allowComposite) {
    if (!root || !rootConnected(root)) return;
    const current = deepRecoveryRef?.deref?.();
    if (!current || !rootConnected(current)) {
      deepRecoveryRef = new WeakRef(root);
      deepRecoveryComposite = !!allowComposite;
      return;
    }
    const merged = commonDeepRecoveryRoot(current, root);
    const sameScope = merged === current && merged === root;
    deepRecoveryRef = new WeakRef(merged);
    deepRecoveryComposite = sameScope ? (deepRecoveryComposite && !!allowComposite) : false;
  }

  function promoteDeepRecovery() {
    if (deepJobs.length || !deepRecoveryRef) return false;
    const root = deepRecoveryRef.deref?.();
    const allowComposite = deepRecoveryComposite;
    deepRecoveryRef = null;
    deepRecoveryComposite = false;
    if (!root || !rootConnected(root) || deepQueued.has(root)) return false;
    deepQueued.add(root);
    deepJobs.push({ rootRef: new WeakRef(root), cursorRef: null, started: false, flags: 0, allowComposite, createdAt: performance.now() });
    return true;
  }

  function queueDeep(root, allowComposite = true) {
    if (requested || paused || !root || deepQueued.has(root) || !rootConnected(root)) return;
    if (deepJobs.length >= MAX_DEEP_JOBS) {
      // Preserve older live FIFO cursors. Only the new excess final state is compressed into the
      // bounded weak recovery scope, so queue pressure cannot make age/order a correctness oracle.
      rememberDeepRecovery(root, allowComposite);
      scheduleBackground();
      return;
    }
    deepQueued.add(root);
    deepJobs.push({ rootRef: new WeakRef(root), cursorRef: null, started: false, flags: 0, allowComposite, createdAt: performance.now() });
    scheduleBackground();
  }
"""
new = """  function promoteDeepRecovery() {
    if (deepJobs.length || !deepWork.hasRecovery) return false;
    return deepWork.promote((root, allowComposite) => {
      if (!root || !rootConnected(root) || deepQueued.has(root)) return null;
      deepQueued.add(root);
      return { rootRef: new WeakRef(root), cursorRef: null, started: false, flags: 0, allowComposite: !!allowComposite, createdAt: performance.now() };
    });
  }

  function queueDeep(root, allowComposite = true) {
    if (requested || paused || !root || deepQueued.has(root) || !rootConnected(root)) return;
    const job = { rootRef: new WeakRef(root), cursorRef: null, started: false, flags: 0, allowComposite: !!allowComposite, createdAt: performance.now() };
    const result = deepWork.admit(job, root, !!allowComposite);
    if (!result.admitted) {
      scheduleBackground();
      return;
    }
    deepQueued.add(root);
    scheduleBackground();
  }
"""
if text.count(old) != 1:
    raise SystemExit('Gate deep private recovery block changed')
text = text.replace(old, new)

old = """  function clearGateWork() {
    for (const job of deepJobs) releaseDeep(job);
    deepJobs.length = 0;
    batchJobs.length = 0;
    deepRecoveryRef = null;
    deepRecoveryComposite = false;
    backgroundRunning = false;
  }
"""
new = """  function clearGateWork() {
    for (const job of deepJobs) releaseDeep(job);
    deepWork.clear();
    batchJobs.length = 0;
    backgroundRunning = false;
  }
"""
if text.count(old) != 1:
    raise SystemExit('Gate lifecycle cleanup block changed')
text = text.replace(old, new)
p.write_text(text)

# Update only Gate deep static recovery assertions. Domain safety metadata remains explicit.
sb = Path('tests/static-bounded-work.mjs')
text = sb.read_text()
start = text.index("assert.equal(\n  /while\\s*\\(deepJobs\\.length\\s*>=\\s*MAX_DEEP_JOBS")
end = text.index("\n// A deep slice that enters with no remaining background budget", start)
new_gate_deep = r'''assert.equal(
  /while\s*\(deepJobs\.length\s*>=\s*MAX_DEEP_JOBS\)/.test(gate),
  false,
  'Gate deep pressure must not evict existing FIFO cursors to admit newer work'
);
assert.match(gate, /MAX_DEEP_JOBS\s*=\s*10/, 'Gate deep recovery must preserve the hard deep-job cap');
assert.match(gate, /const\s+deepWork\s*=\s*KERNEL\.createBoundedFifo/, 'Gate deep work must use the shared bounded FIFO authority');
assert.match(gate, /capacity:\s*MAX_DEEP_JOBS/, 'Gate shared deep FIFO capacity must remain ten');
assert.match(gate, /const\s+merged\s*=\s*commonDeepRecoveryRoot\(current, next\)/, 'Gate retains domain-specific final-state coalescing');
assert.match(gate, /const\s+sameScope\s*=\s*merged\s*===\s*current\s*&&\s*merged\s*===\s*next/, 'Gate must distinguish exact-scope recovery from broader coalescing');
assert.match(
  gate,
  /meta:\s*sameScope\s*\?\s*\(!!currentComposite\s*&&\s*!!nextComposite\)\s*:\s*false/,
  'coalescing distinct Gate scopes must fail closed on composite authority'
);
assert.match(gate, /deepWork\.admit\(job, root, !!allowComposite\)/, 'new Gate deep work must route through shared admission');
assert.match(gate, /deepWork\.promote\(/, 'Gate deep recovery must re-enter bounded background traversal through the kernel');
assert.match(gate, /deepWork\.hasRecovery/, 'Gate must expose pending weak recovery to promotion');
assert.match(gate, /deepWork\.clear\(\)/, 'Gate activation/lifecycle retirement must clear kernel-owned deep work');
assert.equal(/deepRecoveryRef|deepRecoveryComposite|rememberDeepRecovery/.test(gate), false, 'Gate must not retain a second private deep recovery authority');
assert.match(gate, /if\s*\(!batchJobs\.length\s*&&\s*!deepJobs\.length\)\s*promoteDeepRecovery\(\)/, 'Gate recovery must be promoted only after ordinary bounded work drains');
'''
text = text[:start] + new_gate_deep + text[end:]
sb.write_text(text)

print('v12 Gate deep kernel migration prepared successfully')
