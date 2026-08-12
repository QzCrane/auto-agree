from pathlib import Path


def replace_exact(path, old, new, count=1):
    p = Path(path)
    text = p.read_text()
    actual = text.count(old)
    if actual != count:
        raise SystemExit(f'{path}: expected {count} occurrence(s), got {actual}: {old[:140]!r}')
    p.write_text(text.replace(old, new))


replace_exact(
    'extension/bootstrap.js',
    """  const MAX_DEEP = 4;
  const deep = [];
  const queued = new WeakSet();
  let deepRecoveryRef = null;
""",
    """  const MAX_DEEP = 4;
  const DEEP_JOB_TTL_MS = 2400;
  const deepWork = KERNEL.createBoundedFifo({
    capacity: MAX_DEEP,
    isLive: rootConnected,
    coalesce: (current, next) => ({ scope: commonDeepRecoveryRoot(current, next) })
  });
  const deep = deepWork.queue;
  const queued = new WeakSet();
""",
)

probe = Path('extension/bootstrap.js')
text = probe.read_text()
old = """  function rememberDeepRecovery(root) {
    if (!root || !rootConnected(root)) return;
    const current = deepRecoveryRef?.deref?.();
    const merged = current && rootConnected(current) ? commonDeepRecoveryRoot(current, root) : root;
    if (merged && rootConnected(merged)) deepRecoveryRef = new WeakRef(merged);
  }

  function promoteDeepRecovery() {
    if (deep.length || !deepRecoveryRef) return false;
    const root = deepRecoveryRef.deref?.();
    deepRecoveryRef = null;
    if (!root || !rootConnected(root) || queued.has(root)) return false;
    queued.add(root);
    deep.push({ rootRef: new WeakRef(root), cursorRef: null, started: false, createdAt: performance.now() });
    return true;
  }

  function queueDeep(root) {
    if (gateRequested || paused || !root || queued.has(root) || !rootConnected(root)) return;
    queued.add(root);
    while (deep.length >= MAX_DEEP) {
      const dropped = deep.shift();
      const droppedRoot = dropped?.rootRef?.deref?.();
      releaseDeep(dropped);
      rememberDeepRecovery(droppedRoot);
    }
    deep.push({ rootRef: new WeakRef(root), cursorRef: null, started: false, createdAt: performance.now() });
    scheduleDrain();
  }
"""
new = """  function promoteDeepRecovery() {
    if (deep.length || !deepWork.hasRecovery) return false;
    return deepWork.promote(root => {
      if (!root || !rootConnected(root) || queued.has(root)) return null;
      queued.add(root);
      return { rootRef: new WeakRef(root), cursorRef: null, started: false, createdAt: performance.now() };
    });
  }

  function queueDeep(root) {
    if (gateRequested || paused || !root || queued.has(root) || !rootConnected(root)) return;
    const job = { rootRef: new WeakRef(root), cursorRef: null, started: false, createdAt: performance.now() };
    const result = deepWork.admit(job, root, null);
    if (!result.admitted) {
      scheduleDrain();
      return;
    }
    queued.add(root);
    scheduleDrain();
  }
"""
if text.count(old) != 1:
    raise SystemExit('Probe recovery block changed')
text = text.replace(old, new)

old = """        const job = deep[0]; let steps = 0, done = false;
        const root = job?.rootRef?.deref?.();
        if (performance.now() - job.createdAt > 2400 || !root || !rootConnected(root)) { releaseDeep(deep.shift()); continue; }
        let n = job.started ? job.cursorRef?.deref?.() : firstNode(root);
        job.started = true;
        if (n && !(n === root || root.contains(n))) n = firstNode(root);
        while (steps++ < 96 && performance.now() - start < 1.8 && n) {
          const next = nextNode(n, root);
"""
new = """        const job = deep[0]; let steps = 0, done = false;
        const root = job?.rootRef?.deref?.();
        if (!root || !KERNEL.refreshLiveAge(job, DEEP_JOB_TTL_MS, root, rootConnected)) { releaseDeep(deep.shift()); continue; }
        let n = job.started ? job.cursorRef?.deref?.() : firstNode(root);
        if (n && !(n === root || root.contains(n))) n = firstNode(root);
        while (steps++ < 96 && performance.now() - start < 1.8 && n) {
          job.started = true;
          const next = nextNode(n, root);
"""
if text.count(old) != 1:
    raise SystemExit('Probe drain block changed')
text = text.replace(old, new)

old = """  function clearProbeWork() {
    for (const job of deep) releaseDeep(job);
    deep.length = 0;
    deepRecoveryRef = null;
    drainScheduled = false;
  }
"""
new = """  function clearProbeWork() {
    for (const job of deep) releaseDeep(job);
    deepWork.clear();
    drainScheduled = false;
  }
"""
if text.count(old) != 1:
    raise SystemExit('Probe clear block changed')
probe.write_text(text.replace(old, new))

# Replace the Probe portion of the bounded-work static contract with kernel-owned invariants.
sb = Path('tests/static-bounded-work.mjs')
text = sb.read_text()
if "const probeTtlE2e" not in text:
    text = text.replace(
        "const gateTtlE2e = fs.readFileSync('tests/e2e-gate-live-ttl.mjs', 'utf8');",
        "const probeTtlE2e = fs.readFileSync('tests/e2e-probe-live-ttl.mjs', 'utf8');\nconst gateTtlE2e = fs.readFileSync('tests/e2e-gate-live-ttl.mjs', 'utf8');",
    )
start = text.index("assert.equal(\n  /while\\s*\\(deep\\.length\\s*>=\\s*MAX_DEEP")
end = text.index("\nassert.equal(\n  /while\\s*\\(batchJobs", start)
new_probe = r'''assert.equal(
  /while\s*\(deep\.length\s*>=\s*MAX_DEEP\)/.test(probe),
  false,
  'Probe deep pressure must not evict existing FIFO cursors to admit newer work'
);
assert.match(probe, /MAX_DEEP\s*=\s*4/, 'Probe recovery must preserve the hard deep-job cap');
assert.match(probe, /DEEP_JOB_TTL_MS\s*=\s*2400/, 'Probe live-work TTL boundary must remain explicit');
assert.match(probe, /const\s+deepWork\s*=\s*KERNEL\.createBoundedFifo/, 'Probe deep work must use shared bounded FIFO authority');
assert.match(probe, /capacity:\s*MAX_DEEP/, 'Probe shared FIFO capacity must remain four');
assert.match(probe, /commonDeepRecoveryRoot\(current, next\)/, 'Probe retains domain-specific final-state coalescing');
assert.match(probe, /deepWork\.admit\(job, root, null\)/, 'new Probe deep work must route through shared admission');
assert.match(probe, /deepWork\.promote\(/, 'Probe recovery must re-enter ordinary deep traversal through the kernel');
assert.match(probe, /deepWork\.hasRecovery/, 'Probe must expose pending weak recovery to promotion');
assert.match(probe, /deepWork\.clear\(\)/, 'Probe lifecycle cleanup must clear kernel-owned queue and recovery');
assert.equal(/performance\.now\(\)\s*-\s*job\.createdAt\s*>\s*2400/.test(probe), false, 'Probe must not keep a private age-only deletion predicate');
assert.match(probe, /KERNEL\.refreshLiveAge\(job,\s*DEEP_JOB_TTL_MS,\s*root,\s*rootConnected\)/, 'Probe live root age must use shared lifetime authority');
assert.equal(
  /let\s+n\s*=\s*job\.started[^;]+;\s*job\.started\s*=\s*true;/.test(probe),
  false,
  'Probe must not mark a zero-budget deep slice started before processing its first node'
);
assert.match(
  probe,
  /while\s*\(steps\+\+\s*<\s*96\s*&&\s*performance\.now\(\)\s*-\s*start\s*<\s*1\.8\s*&&\s*n\)\s*\{\s*job\.started\s*=\s*true;/,
  'Probe deep jobs become started only inside a slice that actually processes a node'
);
assert.match(probeTtlE2e, /performance\.now\(\)\s*\+\s*2700/, 'Probe live-TTL E2E must cross the 2400 ms production boundary');
assert.match(probeTtlE2e, /live Probe deep work must survive age beyond its 2400 ms boundary exactly once/, 'Probe live-TTL E2E must require exactly-once eventual progress');
'''
text = text[:start] + new_probe + text[end:]
sb.write_text(text)

print('v12 Probe kernel migration prepared successfully')
