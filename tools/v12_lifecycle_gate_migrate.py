from pathlib import Path


def replace_exact(path, old, new, count=1):
    p = Path(path)
    text = p.read_text()
    actual = text.count(old)
    if actual != count:
        raise SystemExit(f'{path}: expected {count} occurrence(s), got {actual}: {old[:180]!r}')
    p.write_text(text.replace(old, new))


gate = Path('extension/gate.js')
text = gate.read_text()

old = """  let observer = null;
  let backgroundRunning = false;
  let backgroundEpoch = 0;
  let eventsAttached = false;
  let lifecycleAttached = false;
  let paused = false;
  let lifecycleEpoch = 0;
"""
new = """  let observer = null;
  let backgroundRunning = false;
  let backgroundToken = 0;
  let eventsAttached = false;
  let lifecycleAttached = false;
  const lifecycle = KERNEL.createLifecycleState(false);
"""
if text.count(old) != 1:
    raise SystemExit('Gate lifecycle declaration anchor changed')
text = text.replace(old, new)

# Simple guards with unambiguous counts.
replacements = [
    ('if (requested || paused) return;', 'if (requested || lifecycle.paused) return;', 3),
    ('if (requested || paused || !root || deepQueued.has(root) || !rootConnected(root)) return;', 'if (requested || lifecycle.paused || !root || deepQueued.has(root) || !rootConnected(root)) return;', 1),
    ('if (requested || paused || probeEventShadow(event)) return;', 'if (requested || lifecycle.paused || probeEventShadow(event)) return;', 2),
]
for old, new, count in replacements:
    actual = text.count(old)
    if actual != count:
        raise SystemExit(f'Gate guard count changed: expected {count}, got {actual}: {old}')
    text = text.replace(old, new)

old = """      requested = false;
      attachLifecycle();
      if (document.visibilityState === 'hidden' || document.prerendering) paused = true;
      else { paused = false; attachEvents(); startObserver(); }
      const delay = HANDOFF_RETRY_DELAYS[handoffRetry++];
      if (delay == null) return;
      const retrySeed = seed instanceof Element && seed.isConnected ? seed : null;
      setTimeout(() => {
        if (!paused && !requested) activate('worker-restart-retry', retrySeed);
      }, delay);
"""
new = """      requested = false;
      attachLifecycle();
      const shouldPause = document.visibilityState === 'hidden' || document.prerendering;
      lifecycle.transition(shouldPause);
      if (!shouldPause) { attachEvents(); startObserver(); }
      const delay = HANDOFF_RETRY_DELAYS[handoffRetry++];
      if (delay == null) return;
      const retrySeed = seed instanceof Element && seed.isConnected ? seed : null;
      setTimeout(() => {
        if (!lifecycle.paused && !requested) activate('worker-restart-retry', retrySeed);
      }, delay);
"""
if text.count(old) != 1:
    raise SystemExit('Gate handoff lifecycle anchor changed')
text = text.replace(old, new)

old = """  async function drainBackground(epoch = lifecycleEpoch) {
    if (paused || epoch !== lifecycleEpoch) { if (backgroundEpoch === epoch) backgroundRunning = false; return; }
    try {
      let rounds = 0;
      while (!requested && !paused && epoch === lifecycleEpoch && (batchJobs.length || deepJobs.length) && rounds++ < 20) {
"""
new = """  async function drainBackground(token = lifecycle.capture()) {
    if (!lifecycle.isCurrent(token)) { if (backgroundToken === token) backgroundRunning = false; return; }
    try {
      let rounds = 0;
      while (!requested && lifecycle.isCurrent(token) && (batchJobs.length || deepJobs.length) && rounds++ < 20) {
"""
if text.count(old) != 1:
    raise SystemExit('Gate background entry anchor changed')
text = text.replace(old, new)

old = """        if ((batchJobs.length || deepJobs.length) && globalThis.scheduler?.yield) { await scheduler.yield(); if (paused || epoch !== lifecycleEpoch) break; }
        else break;
      }
    } finally {
      if (!batchJobs.length && !deepJobs.length) promoteDeepRecovery();
      if (backgroundEpoch === epoch) backgroundRunning = false;
      if (!requested && !paused && epoch === lifecycleEpoch && (batchJobs.length || deepJobs.length)) scheduleBackground();
    }
  }

  function scheduleBackground() {
    if (requested || paused || backgroundRunning || (!batchJobs.length && !deepJobs.length)) return;
    backgroundRunning = true;
    const epoch = lifecycleEpoch;
    backgroundEpoch = epoch;
    postBackground(() => drainBackground(epoch));
  }
"""
new = """        if ((batchJobs.length || deepJobs.length) && globalThis.scheduler?.yield) { await scheduler.yield(); if (!lifecycle.isCurrent(token)) break; }
        else break;
      }
    } finally {
      if (!batchJobs.length && !deepJobs.length) promoteDeepRecovery();
      if (backgroundToken === token) backgroundRunning = false;
      if (!requested && lifecycle.isCurrent(token) && (batchJobs.length || deepJobs.length)) scheduleBackground();
    }
  }

  function scheduleBackground() {
    if (requested || lifecycle.paused || backgroundRunning || (!batchJobs.length && !deepJobs.length)) return;
    backgroundRunning = true;
    const token = lifecycle.capture();
    backgroundToken = token;
    postBackground(() => drainBackground(token));
  }
"""
if text.count(old) != 1:
    raise SystemExit('Gate background exit/schedule anchor changed')
text = text.replace(old, new)

# Mutation guard is unique as a full function prefix.
old = """  function onMutations(records) {
    if (requested || paused) return;
"""
new = """  function onMutations(records) {
    if (requested || lifecycle.paused) return;
"""
if text.count(old) != 1:
    raise SystemExit('Gate mutation lifecycle anchor changed')
text = text.replace(old, new)

old = """  function pauseGate() {
    if (paused || requested) return;
    paused = true;
    lifecycleEpoch++;
    observer?.disconnect();
    detachEvents();
    clearGateWork();
  }

  function resumeGate() {
    if (!paused || requested || document.prerendering || document.visibilityState === 'hidden') return;
    paused = false;
    lifecycleEpoch++;
    localChecked = new WeakSet();
    attachEvents();
    startObserver();
  }
"""
new = """  function pauseGate() {
    if (lifecycle.paused || requested) return;
    lifecycle.pause();
    observer?.disconnect();
    detachEvents();
    clearGateWork();
  }

  function resumeGate() {
    if (!lifecycle.paused || requested || document.prerendering || document.visibilityState === 'hidden') return;
    lifecycle.resume();
    localChecked = new WeakSet();
    attachEvents();
    startObserver();
  }
"""
if text.count(old) != 1:
    raise SystemExit('Gate pause/resume anchor changed')
text = text.replace(old, new)

old = """  attachLifecycle();
  if (document.visibilityState === 'hidden') paused = true;
  else { attachEvents(); startObserver(); }
"""
new = """  attachLifecycle();
  if (document.visibilityState === 'hidden') lifecycle.pause();
  else { attachEvents(); startObserver(); }
"""
if text.count(old) != 1:
    raise SystemExit('Gate boot lifecycle anchor changed')
text = text.replace(old, new)

# Fail closed if any private lifecycle symbol survived.
for forbidden in ['let paused =', 'let lifecycleEpoch =', 'backgroundEpoch', ' lifecycleEpoch']:
    if forbidden in text:
        raise SystemExit(f'Gate private lifecycle authority survived: {forbidden!r}')
if 'const lifecycle = KERNEL.createLifecycleState(false);' not in text:
    raise SystemExit('Gate shared lifecycle authority missing')
gate.write_text(text)

# Extend the permanent static lifecycle contract from Probe to Gate.
static = Path('tests/static-lifecycle.mjs')
text = static.read_text()
if "const gate = fs.readFileSync('extension/gate.js', 'utf8');" not in text:
    text = text.replace(
        "const probe = fs.readFileSync('extension/bootstrap.js', 'utf8');\n",
        "const probe = fs.readFileSync('extension/bootstrap.js', 'utf8');\nconst gate = fs.readFileSync('extension/gate.js', 'utf8');\n",
    )
anchor = """assert.match(probe, /lifecycle\\.resume\\(\\)/, 'Probe resume must use shared lifecycle transition');

console.log('static-lifecycle: PASS');
"""
replacement = """assert.match(probe, /lifecycle\\.resume\\(\\)/, 'Probe resume must use shared lifecycle transition');

assert.match(gate, /const\\s+lifecycle\\s*=\\s*KERNEL\\.createLifecycleState\\(false\\)/, 'Gate must use the shared lifecycle authority');
assert.equal(/let\\s+paused\\s*=|let\\s+lifecycleEpoch\\s*=|backgroundEpoch/.test(gate), false, 'Gate must not retain a second private lifecycle authority');
assert.match(gate, /async function drainBackground\\(token\\s*=\\s*lifecycle\\.capture\\(\\)\\)/, 'Gate background drain must be lifecycle-token scoped');
assert.match(gate, /while\\s*\\(!requested\\s*&&\\s*lifecycle\\.isCurrent\\(token\\)/, 'Gate background loop must reject stale or paused generations');
assert.match(gate, /if\\s*\\(backgroundToken\\s*===\\s*token\\)\\s*backgroundRunning\\s*=\\s*false/, 'stale Gate callbacks must not clear a newer background generation');
assert.match(gate, /lifecycle\\.transition\\(shouldPause\\)/, 'Gate worker-handoff recovery must transition the shared lifecycle');
assert.match(gate, /lifecycle\\.pause\\(\\)/, 'Gate pause must use shared lifecycle transition');
assert.match(gate, /lifecycle\\.resume\\(\\)/, 'Gate resume must use shared lifecycle transition');

console.log('static-lifecycle: PASS');
"""
if text.count(anchor) != 1:
    raise SystemExit('static lifecycle Gate insertion anchor changed')
static.write_text(text.replace(anchor, replacement))

print('v12 Gate lifecycle migration prepared successfully')
