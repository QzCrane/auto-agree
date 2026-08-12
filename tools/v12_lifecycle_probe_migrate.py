from pathlib import Path


def replace_exact(path, old, new, count=1):
    p = Path(path)
    text = p.read_text()
    actual = text.count(old)
    if actual != count:
        raise SystemExit(f'{path}: expected {count} occurrence(s), got {actual}: {old[:160]!r}')
    p.write_text(text.replace(old, new))


replace_exact(
    'extension/bootstrap.js',
    """  let eventsAttached = false;
  let lifecycleAttached = false;
  let paused = false;
  let lifecycleEpoch = 0;
""",
    """  let eventsAttached = false;
  let lifecycleAttached = false;
  const lifecycle = KERNEL.createLifecycleState(false);
""",
)

# Direct guards use the single lifecycle authority.
for old, new in [
    ('if (gateRequested || paused) return;', 'if (gateRequested || lifecycle.paused) return;'),
    ('if (paused || !root) return false;', 'if (lifecycle.paused || !root) return false;'),
    ('if (gateRequested || paused || !root || queued.has(root) || !rootConnected(root)) return;', 'if (gateRequested || lifecycle.paused || !root || queued.has(root) || !rootConnected(root)) return;'),
    ('if (gateRequested || paused || eventShadow(event)) return;', 'if (gateRequested || lifecycle.paused || eventShadow(event)) return;'),
    ('if (paused || gateRequested) return;', 'if (lifecycle.paused || gateRequested) return;'),
    ('if (gateRequested || paused) return;', 'if (gateRequested || lifecycle.paused) return;'),
]:
    replace_exact('extension/bootstrap.js', old, new)

# Handoff failure derives paused state from the browser and transitions the lifecycle generation.
replace_exact(
    'extension/bootstrap.js',
    """      gateRequested = false;
      attachLifecycle();
      if (document.visibilityState === 'hidden' || document.prerendering) paused = true;
      else { paused = false; attachEvents(); startObserver(); }
      const delay = HANDOFF_RETRY_DELAYS[handoffRetry++];
      if (delay == null) return;
      const retrySeed = seed instanceof Element && seed.isConnected ? seed : null;
      setTimeout(() => {
        if (!paused && !gateRequested) requestGate('worker-restart-retry', retrySeed);
      }, delay);
""",
    """      gateRequested = false;
      attachLifecycle();
      const shouldPause = document.visibilityState === 'hidden' || document.prerendering;
      lifecycle.transition(shouldPause);
      if (!shouldPause) { attachEvents(); startObserver(); }
      const delay = HANDOFF_RETRY_DELAYS[handoffRetry++];
      if (delay == null) return;
      const retrySeed = seed instanceof Element && seed.isConnected ? seed : null;
      setTimeout(() => {
        if (!lifecycle.paused && !gateRequested) requestGate('worker-restart-retry', retrySeed);
      }, delay);
""",
)

replace_exact(
    'extension/bootstrap.js',
    """  function scheduleDrain() {
    if (drainScheduled || gateRequested || paused) return;
    drainScheduled = true;
    const epoch = lifecycleEpoch;
    const run = () => {
      if (paused || gateRequested || epoch !== lifecycleEpoch) {
        if (epoch === lifecycleEpoch) drainScheduled = false;
        return;
      }
""",
    """  function scheduleDrain() {
    if (drainScheduled || gateRequested || lifecycle.paused) return;
    drainScheduled = true;
    const epoch = lifecycle.capture();
    const run = () => {
      if (gateRequested || !lifecycle.isCurrent(epoch)) {
        if (epoch === lifecycle.epoch) drainScheduled = false;
        return;
      }
""",
)

replace_exact(
    'extension/bootstrap.js',
    """  function pauseProbe() {
    if (paused || gateRequested) return;
    paused = true;
    lifecycleEpoch++;
    observer?.disconnect();
    detachEvents();
    clearProbeWork();
  }

  function resumeProbe() {
    if (!paused || gateRequested || document.prerendering || document.visibilityState === 'hidden') return;
    paused = false;
    lifecycleEpoch++;
    attachEvents();
    startObserver();
  }
""",
    """  function pauseProbe() {
    if (lifecycle.paused || gateRequested) return;
    lifecycle.pause();
    observer?.disconnect();
    detachEvents();
    clearProbeWork();
  }

  function resumeProbe() {
    if (!lifecycle.paused || gateRequested || document.prerendering || document.visibilityState === 'hidden') return;
    lifecycle.resume();
    attachEvents();
    startObserver();
  }
""",
)

replace_exact(
    'extension/bootstrap.js',
    """  function startActiveProbe() {
    paused = false;
    attachLifecycle();
""",
    """  function startActiveProbe() {
    lifecycle.resume();
    attachLifecycle();
""",
)

# Permanent static lifecycle gate, intentionally separate from DOM/resource contracts.
Path('tests/static-lifecycle.mjs').write_text(r'''import fs from 'node:fs';
import assert from 'node:assert/strict';

const kernel = fs.readFileSync('extension/runtime-kernel.js', 'utf8');
const probe = fs.readFileSync('extension/bootstrap.js', 'utf8');

assert.match(kernel, /function\s+createLifecycleState\s*\(/, 'runtime kernel must own lifecycle epoch state');
assert.match(kernel, /if\s*\(nextPaused\s*===\s*paused\)\s*return false/, 'idempotent lifecycle transitions must not invent generations');
assert.match(kernel, /epoch\+\+/, 'real lifecycle transitions must advance generation');
assert.match(kernel, /token\s*===\s*epoch\s*&&\s*\(!requireActive\s*\|\|\s*!paused\)/, 'lifecycle tokens must encode both generation and active authority');

assert.match(probe, /const\s+lifecycle\s*=\s*KERNEL\.createLifecycleState\(false\)/, 'Probe must use the shared lifecycle authority');
assert.equal(/let\s+paused\s*=|let\s+lifecycleEpoch\s*=/.test(probe), false, 'Probe must not retain a second private lifecycle authority');
assert.match(probe, /const\s+epoch\s*=\s*lifecycle\.capture\(\)/, 'Probe scheduled drains must capture lifecycle generation');
assert.match(probe, /!lifecycle\.isCurrent\(epoch\)/, 'Probe scheduled drains must reject stale/paused lifecycle tokens');
assert.match(probe, /if\s*\(epoch\s*===\s*lifecycle\.epoch\)\s*drainScheduled\s*=\s*false/, 'stale callbacks must not clear a newer generation scheduler flag');
assert.match(probe, /lifecycle\.transition\(shouldPause\)/, 'Probe worker-handoff recovery must advance lifecycle when browser paused state changes');
assert.match(probe, /lifecycle\.pause\(\)/, 'Probe pause must use shared lifecycle transition');
assert.match(probe, /lifecycle\.resume\(\)/, 'Probe resume must use shared lifecycle transition');

console.log('static-lifecycle: PASS');
''')

pkg = Path('package.json')
text = pkg.read_text()
old = 'node tests/runtime-kernel.mjs && node tests/decision-core.mjs'
new = 'node tests/runtime-kernel.mjs && node tests/static-lifecycle.mjs && node tests/decision-core.mjs'
if text.count(old) != 1:
    raise SystemExit('package lifecycle gate insertion anchor changed')
pkg.write_text(text.replace(old, new))

print('v12 Probe lifecycle migration prepared successfully')
