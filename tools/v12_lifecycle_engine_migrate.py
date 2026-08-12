from pathlib import Path


def replace_exact(text, old, new, label, count=1):
    actual = text.count(old)
    if actual != count:
        raise SystemExit(f'{label}: expected {count} occurrence(s), got {actual}: {old[:180]!r}')
    return text.replace(old, new)


engine = Path('extension/engine.js')
text = engine.read_text()

text = replace_exact(
    text,
    """  let pendingRescueTimer = 0;
  let pendingRescuePhase = 0;
""",
    """  let pendingRescueTimer = 0;
  let pendingRescueToken = 0;
  let pendingRescuePhase = 0;
""",
    'pending rescue declaration',
)
text = replace_exact(
    text,
    """  const contextTxnRefByKey = new WeakMap();
  let contextTxnScheduled = false;
  let contextTxnGeneration = 0;
""",
    """  const contextTxnRefByKey = new WeakMap();
  let contextTxnScheduled = false;
  let contextTxnToken = 0;
""",
    'context transaction declaration',
)
text = replace_exact(
    text,
    """  let queuedWalkRoots = new WeakSet();
  let queuedShadowRoots = new WeakSet();
  let flushQueued = false;
  let backgroundQueued = false;
  let backgroundEpoch = 0;
""",
    """  let queuedWalkRoots = new WeakSet();
  let queuedShadowRoots = new WeakSet();
  let flushQueued = false;
  let flushToken = 0;
  let backgroundQueued = false;
  let backgroundToken = 0;
""",
    'flush/background declaration',
)
text = replace_exact(
    text,
    """  let initialRescueTimer = 0;
  let siteProfile = null;
  let lifecyclePaused = false;
  let lifecycleGeneration = 0;
  let engineEventsAttached = false;
""",
    """  let initialRescueTimer = 0;
  let siteProfile = null;
  const lifecycle = KERNEL.createLifecycleState(false);
  let engineEventsAttached = false;
""",
    'Engine lifecycle declaration',
)

text = replace_exact(
    text,
    """  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(entries => {
    for (const resizeEntry of entries) {
""",
    """  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(entries => {
    if (lifecycle.paused) return;
    for (const resizeEntry of entries) {
""",
    'ResizeObserver lifecycle guard',
)

text = replace_exact(
    text,
    """  function commitContextTransaction(generation) {
    if (generation !== lifecycleGeneration || lifecyclePaused) { contextTxnScheduled = false; contextTxnRefs.clear(); return; }
    contextTxnScheduled = false;
    for (const ref of [...contextTxnRefs]) {
""",
    """  function commitContextTransaction(token) {
    if (!lifecycle.isCurrent(token)) {
      if (contextTxnToken === token) { contextTxnScheduled = false; contextTxnRefs.clear(); contextTxnToken = 0; }
      return;
    }
    if (contextTxnToken !== token) return;
    contextTxnScheduled = false;
    contextTxnToken = 0;
    for (const ref of [...contextTxnRefs]) {
""",
    'context transaction commit',
)
text = replace_exact(
    text,
    """    contextTxnRefs.add(ref);
    if (contextTxnScheduled) return key;
    contextTxnScheduled = true;
    const generation = lifecycleGeneration;
    contextTxnGeneration = generation;
    const commit = () => commitContextTransaction(generation);
""",
    """    contextTxnRefs.add(ref);
    if (contextTxnScheduled) return key;
    contextTxnScheduled = true;
    const token = lifecycle.capture();
    contextTxnToken = token;
    const commit = () => commitContextTransaction(token);
""",
    'context transaction schedule',
)

text = replace_exact(
    text,
    """  function schedulePendingRescue() {
    if (pendingRescueTimer || !pendingVisibility.size) return;
    const delays = [140, 520, 1300];
    const phase = Math.min(pendingRescuePhase, delays.length - 1);
    pendingRescueTimer = setTimeout(() => {
      pendingRescueTimer = 0;
      pendingRescuePhase++;
      recheckPending();
      if (pendingVisibility.size && pendingRescuePhase < delays.length) schedulePendingRescue();
      else if (!pendingVisibility.size) pendingRescuePhase = 0;
    }, delays[phase]);
  }
""",
    """  function schedulePendingRescue() {
    if (lifecycle.paused || pendingRescueTimer || !pendingVisibility.size) return;
    const delays = [140, 520, 1300];
    const phase = Math.min(pendingRescuePhase, delays.length - 1);
    const token = lifecycle.capture();
    pendingRescueToken = token;
    pendingRescueTimer = setTimeout(() => {
      if (!lifecycle.isCurrent(token)) {
        if (pendingRescueToken === token) pendingRescueTimer = 0;
        return;
      }
      if (pendingRescueToken !== token) return;
      pendingRescueTimer = 0;
      pendingRescueToken = 0;
      pendingRescuePhase++;
      recheckPending();
      if (pendingVisibility.size && pendingRescuePhase < delays.length) schedulePendingRescue();
      else if (!pendingVisibility.size) pendingRescuePhase = 0;
    }, delays[phase]);
  }
""",
    'pending rescue scheduler',
)

text = replace_exact(
    text,
    """    const verifier = { observer: null, listeners: [], timer: 0, done: false, controlRef: new WeakRef(s.control), generation: lifecycleGeneration };
""",
    """    const verifier = { observer: null, listeners: [], timer: 0, done: false, controlRef: new WeakRef(s.control), token: lifecycle.capture() };
""",
    'verifier token',
)
text = replace_exact(
    text,
    'if (lifecyclePaused || verifier.generation !== lifecycleGeneration) { stopVerifier(s.control); return; }',
    'if (!lifecycle.isCurrent(verifier.token)) { stopVerifier(s.control); return; }',
    'verifier stale checks',
    2,
)
text = replace_exact(
    text,
    """    const generation = lifecycleGeneration;
    const run = () => {
      deferredClicks.delete(s.control);
      if (lifecyclePaused || generation !== lifecycleGeneration) return;
""",
    """    const token = lifecycle.capture();
    const run = () => {
      deferredClicks.delete(s.control);
      if (!lifecycle.isCurrent(token)) return;
""",
    'deferred click token',
)

text = replace_exact(
    text,
    """  async function drainBackground(generation = lifecycleGeneration) {
    if (lifecyclePaused || generation !== lifecycleGeneration) { if (backgroundEpoch === generation) backgroundQueued = false; return; }
    try {
      let rounds = 0;
      while (!lifecyclePaused && generation === lifecycleGeneration && hasBackgroundWork() && rounds++ < 24) {
""",
    """  async function drainBackground(token = lifecycle.capture()) {
    if (!lifecycle.isCurrent(token)) { if (backgroundToken === token) backgroundQueued = false; return; }
    try {
      let rounds = 0;
      while (lifecycle.isCurrent(token) && hasBackgroundWork() && rounds++ < 24) {
""",
    'background entry',
)
text = replace_exact(
    text,
    """        if (hasBackgroundWork()) {
          await yieldMain();
          if (lifecyclePaused || generation !== lifecycleGeneration) break;
        }
      }
    } finally {
      if (!rootBatches.length && !walkJobs.length) promoteWalkRecovery();
      if (!rootBatches.length && !walkJobs.length && !batchJobs.length && !shadowJobs.length) promoteShadowRecovery();
      if (backgroundEpoch === generation) backgroundQueued = false;
      if (!lifecyclePaused && generation === lifecycleGeneration && hasBackgroundWork()) scheduleBackground();
    }
  }

  function scheduleBackground() {
    if (backgroundQueued || lifecyclePaused) return;
    backgroundQueued = true;
    const generation = lifecycleGeneration;
    backgroundEpoch = generation;
    if (globalThis.scheduler?.postTask) {
      scheduler.postTask(() => drainBackground(generation), { priority: 'background' }).catch(() => { if (backgroundEpoch === generation) backgroundQueued = false; if (!lifecyclePaused && generation === lifecycleGeneration) setTimeout(scheduleBackground, 16); });
    } else if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => drainBackground(generation), { timeout: 400 });
    } else {
      setTimeout(() => drainBackground(generation), 24);
    }
  }
""",
    """        if (hasBackgroundWork()) {
          await yieldMain();
          if (!lifecycle.isCurrent(token)) break;
        }
      }
    } finally {
      if (!rootBatches.length && !walkJobs.length) promoteWalkRecovery();
      if (!rootBatches.length && !walkJobs.length && !batchJobs.length && !shadowJobs.length) promoteShadowRecovery();
      if (backgroundToken === token) backgroundQueued = false;
      if (lifecycle.isCurrent(token) && hasBackgroundWork()) scheduleBackground();
    }
  }

  function scheduleBackground() {
    if (backgroundQueued || lifecycle.paused) return;
    backgroundQueued = true;
    const token = lifecycle.capture();
    backgroundToken = token;
    if (globalThis.scheduler?.postTask) {
      scheduler.postTask(() => drainBackground(token), { priority: 'background' }).catch(() => { if (backgroundToken === token) backgroundQueued = false; if (lifecycle.isCurrent(token)) setTimeout(scheduleBackground, 16); });
    } else if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => drainBackground(token), { timeout: 400 });
    } else {
      setTimeout(() => drainBackground(token), 24);
    }
  }
""",
    'background schedule/finish',
)

text = replace_exact(
    text,
    """  function queueRoot(root, urgent = false) {
    if (!root || lifecyclePaused) return;
    walkGeneration.set(root, currentWalkGeneration(root) + 1);
    (urgent ? urgentRoots : dirtyRoots).add(root);
    if (flushQueued) return;
    flushQueued = true;
    queueMicrotask(flushRoots);
  }
""",
    """  function queueRoot(root, urgent = false) {
    if (!root || lifecycle.paused) return;
    walkGeneration.set(root, currentWalkGeneration(root) + 1);
    (urgent ? urgentRoots : dirtyRoots).add(root);
    if (flushQueued) return;
    flushQueued = true;
    const token = lifecycle.capture();
    flushToken = token;
    queueMicrotask(() => flushRoots(token));
  }
""",
    'root flush schedule',
)
text = replace_exact(
    text,
    """  function flushRoots() {
    flushQueued = false;
    if (lifecyclePaused) { urgentRoots.clear(); dirtyRoots.clear(); return; }
    const urgent = [...urgentRoots];
""",
    """  function flushRoots(token) {
    if (!lifecycle.isCurrent(token)) {
      if (flushToken === token) flushQueued = false;
      return;
    }
    if (flushToken !== token) return;
    flushQueued = false;
    flushToken = 0;
    const urgent = [...urgentRoots];
""",
    'root flush consume',
)

text = replace_exact(
    text,
    """    queuedWalkRoots = new WeakSet();
    queuedShadowRoots = new WeakSet();
    flushQueued = false;
    backgroundQueued = false;
  }
""",
    """    queuedWalkRoots = new WeakSet();
    queuedShadowRoots = new WeakSet();
    flushQueued = false;
    flushToken = 0;
    backgroundQueued = false;
    backgroundToken = 0;
  }
""",
    'queued work lifecycle reset',
)

text = replace_exact(
    text,
    """  function pauseEngine() {
    if (lifecyclePaused) return;
    lifecyclePaused = true;
    lifecycleGeneration++;
""",
    """  function pauseEngine() {
    if (lifecycle.paused) return;
    lifecycle.pause();
""",
    'Engine pause transition',
)
text = replace_exact(
    text,
    """    if (pendingRescueTimer) clearTimeout(pendingRescueTimer);
    pendingRescueTimer = 0;
    pendingRescuePhase = 0;
    if (initialRescueTimer) clearTimeout(initialRescueTimer);
    initialRescueTimer = 0;
    stopAllVerifiers();
    contextTxnRefs.clear();
    contextTxnScheduled = false;
    clearQueuedWork();
""",
    """    if (pendingRescueTimer) clearTimeout(pendingRescueTimer);
    pendingRescueTimer = 0;
    pendingRescueToken = 0;
    pendingRescuePhase = 0;
    if (initialRescueTimer) clearTimeout(initialRescueTimer);
    initialRescueTimer = 0;
    stopAllVerifiers();
    contextTxnRefs.clear();
    contextTxnScheduled = false;
    contextTxnToken = 0;
    clearQueuedWork();
""",
    'Engine pause async reset',
)
text = replace_exact(
    text,
    """  function resumeEngine() {
    if (!lifecyclePaused || document.prerendering || document.visibilityState === 'hidden') return;
    lifecyclePaused = false;
    lifecycleGeneration++;
""",
    """  function resumeEngine() {
    if (!lifecycle.paused || document.prerendering || document.visibilityState === 'hidden') return;
    lifecycle.resume();
""",
    'Engine resume transition',
)

text = replace_exact(
    text,
    """    if (seedRoot) {
      const generation = lifecycleGeneration;
      initialRescueTimer = setTimeout(() => {
        initialRescueTimer = 0;
        if (lifecyclePaused || generation !== lifecycleGeneration) return;
        if (!meaningfulCandidateSeen) queueSeedShells(seedRoot);
      }, 420);
    }
""",
    """    if (seedRoot) {
      const token = lifecycle.capture();
      initialRescueTimer = setTimeout(() => {
        initialRescueTimer = 0;
        if (!lifecycle.isCurrent(token)) return;
        if (!meaningfulCandidateSeen) queueSeedShells(seedRoot);
      }, 420);
    }
""",
    'initial rescue token',
)
text = replace_exact(
    text,
    """  attachLifecycleEvents();
  if (document.visibilityState === 'hidden' || document.prerendering) lifecyclePaused = true;
  else boot();
""",
    """  attachLifecycleEvents();
  if (document.visibilityState === 'hidden' || document.prerendering) lifecycle.pause();
  else boot();
""",
    'Engine boot paused state',
)

# Remaining lifecyclePaused uses are domain guards, not generation ownership; point all of them at
# the shared state. Generation references are forbidden after the token-specific migrations above.
text = text.replace('lifecyclePaused', 'lifecycle.paused')
for forbidden in ['lifecycleGeneration', 'backgroundEpoch', 'contextTxnGeneration', 'let lifecycle.paused']:
    if forbidden in text:
        raise SystemExit(f'Engine private lifecycle authority survived: {forbidden!r}')
if text.count('const lifecycle = KERNEL.createLifecycleState(false);') != 1:
    raise SystemExit('Engine shared lifecycle authority missing or duplicated')
engine.write_text(text)

# Extend static lifecycle ownership to Engine and lock scheduler-state CAS behavior.
static = Path('tests/static-lifecycle.mjs')
st = static.read_text()
if "const engine = fs.readFileSync('extension/engine.js', 'utf8');" not in st:
    st = st.replace(
        "const gate = fs.readFileSync('extension/gate.js', 'utf8');\n",
        "const gate = fs.readFileSync('extension/gate.js', 'utf8');\nconst engine = fs.readFileSync('extension/engine.js', 'utf8');\n",
    )
anchor = """assert.match(gate, /lifecycle\\.resume\\(\\)/, 'Gate resume must use shared lifecycle transition');

console.log('static-lifecycle: PASS');
"""
replacement = """assert.match(gate, /lifecycle\\.resume\\(\\)/, 'Gate resume must use shared lifecycle transition');

assert.match(engine, /const\\s+lifecycle\\s*=\\s*KERNEL\\.createLifecycleState\\(false\\)/, 'Engine must use the shared lifecycle authority');
assert.equal(/lifecyclePaused|lifecycleGeneration|backgroundEpoch|contextTxnGeneration/.test(engine), false, 'Engine must not retain private lifecycle generation authority');
assert.match(engine, /contextTxnToken\\s*=\\s*token/, 'Engine context transactions must record the exact lifecycle token');
assert.match(engine, /if\\s*\\(contextTxnToken\\s*===\\s*token\\)\\s*\\{\\s*contextTxnScheduled\\s*=\\s*false;/, 'stale context callbacks may clear state only when they still own the recorded token');
assert.match(engine, /flushToken\\s*=\\s*token/, 'Engine root flush microtasks must record their lifecycle token');
assert.match(engine, /if\\s*\\(flushToken\\s*===\\s*token\\)\\s*flushQueued\\s*=\\s*false/, 'stale root-flush callbacks must not clear a newer generation scheduler flag');
assert.match(engine, /async function drainBackground\\(token\\s*=\\s*lifecycle\\.capture\\(\\)\\)/, 'Engine background drain must be lifecycle-token scoped');
assert.match(engine, /if\\s*\\(backgroundToken\\s*===\\s*token\\)\\s*backgroundQueued\\s*=\\s*false/, 'stale Engine background callbacks must not clear a newer generation scheduler flag');
assert.match(engine, /token:\s*lifecycle\\.capture\\(\\)/, 'Engine click verifiers must snapshot lifecycle ownership');
assert.match(engine, /!lifecycle\\.isCurrent\\(verifier\\.token\\)/, 'Engine click verification must reject stale generations');
assert.match(engine, /pendingRescueToken\\s*=\\s*token/, 'pending visibility rescue timers must be lifecycle-token scoped');
assert.match(engine, /if\\s*\\(pendingRescueToken\\s*===\\s*token\\)\\s*pendingRescueTimer\\s*=\\s*0/, 'stale pending-rescue callbacks must not clear a newer timer');
assert.match(engine, /new ResizeObserver\\(entries => \\{\\s*if \\(lifecycle\\.paused\\) return;/, 'queued ResizeObserver work must fail closed while Engine is paused');
assert.match(engine, /function pauseEngine\\(\\) \\{\\s*if \\(lifecycle\\.paused\\) return;\\s*lifecycle\\.pause\\(\\)/, 'Engine pause must use the shared transition authority');
assert.match(engine, /function resumeEngine\\(\\) \\{\\s*if \\(!lifecycle\\.paused/, 'Engine resume guard must read the shared lifecycle authority');
assert.match(engine, /lifecycle\\.resume\\(\\)/, 'Engine resume must advance the shared lifecycle generation');

console.log('static-lifecycle: PASS');
"""
if st.count(anchor) != 1:
    raise SystemExit('static lifecycle Engine insertion anchor changed')
static.write_text(st.replace(anchor, replacement))

print('v12 Engine lifecycle migration prepared successfully')
