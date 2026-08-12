from pathlib import Path


def replace_exact(path, old, new, count=1):
    p = Path(path)
    text = p.read_text()
    actual = text.count(old)
    if actual != count:
        raise SystemExit(f'{path}: expected {count} occurrence(s), got {actual}: {old[:180]!r}')
    p.write_text(text.replace(old, new))


# Worker becomes the side-effect adapter; scheduler-core owns numeric policy + pure selection.
replace_exact(
    'extension/worker.js',
    """const INJECTION_MAX_GLOBAL = 4;
const INJECTION_MAX_PER_TAB = 2;
const INJECTION_QUEUE_MAX = 64;
const INJECTION_AGING_MS = 1200;
const INJECTION_STALE_MS = 15000;
const REHYDRATE_KEY = '__auto_agree_update_rehydrate__';
""",
    """if (!globalThis.__AUTO_AGREE_SCHEDULER_CORE__ && typeof importScripts === 'function') importScripts('scheduler-core.js');
const SCHEDULER = globalThis.__AUTO_AGREE_SCHEDULER_CORE__;
if (!SCHEDULER) throw new Error('scheduler-core-missing');
const {
  maxGlobal: INJECTION_MAX_GLOBAL,
  maxPerTab: INJECTION_MAX_PER_TAB,
  queueMax: INJECTION_QUEUE_MAX,
  agingMs: INJECTION_AGING_MS,
  staleMs: INJECTION_STALE_MS
} = SCHEDULER.CONFIG;
const REHYDRATE_KEY = '__auto_agree_update_rehydrate__';
""",
)
replace_exact(
    'extension/worker.js',
    """function effectivePriority(job, now = Date.now()) {
  const age = Math.max(0, now - job.queuedAt);
  const boost = Math.min(3, Math.floor(age / INJECTION_AGING_MS));
  return job.priority + boost;
}

function pruneStaleInjectionJobs(now = Date.now()) {
  for (let i = injectionQueue.length - 1; i >= 0; i--) {
    const job = injectionQueue[i];
    if (now - job.queuedAt <= INJECTION_STALE_MS) continue;
    injectionQueue.splice(i, 1);
    try { job.reject(new Error('injection-stale')); } catch (_) {}
  }
}

function pickNextInjectionIndex(now = Date.now()) {
  pruneStaleInjectionJobs(now);
  let best = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < injectionQueue.length; i++) {
    const job = injectionQueue[i];
    const tabId = job.target.tabId;
    if ((injectionActiveByTab.get(tabId) || 0) >= INJECTION_MAX_PER_TAB) continue;
    const score = effectivePriority(job, now);
    if (score > bestScore) { best = i; bestScore = score; continue; }
    if (score < bestScore || best < 0) continue;
    const prior = injectionQueue[best];
    const jobRotates = tabId !== lastScheduledTab;
    const priorRotates = prior.target.tabId !== lastScheduledTab;
    if (jobRotates !== priorRotates) { if (jobRotates) best = i; continue; }
    if (job.queuedAt < prior.queuedAt || (job.queuedAt === prior.queuedAt && job.seq < prior.seq)) best = i;
  }
  return best;
}
""",
    """function effectivePriority(job, now = Date.now()) {
  return SCHEDULER.effectivePriority(job, now);
}

function pruneStaleInjectionJobs(now = Date.now()) {
  for (let i = injectionQueue.length - 1; i >= 0; i--) {
    const job = injectionQueue[i];
    if (!SCHEDULER.isStale(job, now)) continue;
    injectionQueue.splice(i, 1);
    try { job.reject(new Error('injection-stale')); } catch (_) {}
  }
}

function pickNextInjectionIndex(now = Date.now()) {
  pruneStaleInjectionJobs(now);
  return SCHEDULER.pickNextIndex(injectionQueue, injectionActiveByTab, lastScheduledTab, now);
}
""",
)
replace_exact(
    'extension/worker.js',
    """  let victim = -1;
  for (let i = 0; i < injectionQueue.length; i++) {
    const job = injectionQueue[i];
    if (job.priority >= priority) continue;
    if (victim < 0) { victim = i; continue; }
    const current = injectionQueue[victim];
    const jobScore = effectivePriority(job, now);
    const currentScore = effectivePriority(current, now);
    if (jobScore < currentScore || (jobScore === currentScore && job.queuedAt > current.queuedAt)) victim = i;
  }
""",
    """  const victim = SCHEDULER.pickPreemptionIndex(injectionQueue, priority, now);
""",
)

# All Worker VM tests preload the same physical SchedulerCore dependency used by Chrome.
for name in ['worker-profile-governance.mjs','worker-restart.mjs','worker-scheduler.mjs']:
    replace_exact(
        f'tests/{name}',
        "const source=fs.readFileSync('extension/worker.js','utf8');",
        "const source=fs.readFileSync('extension/scheduler-core.js','utf8')+'\\n'+fs.readFileSync('extension/worker.js','utf8');",
    )

contract = Path('tests/worker-contract.mjs')
text = contract.read_text()
old = "vm.runInNewContext(fs.readFileSync('extension/worker.js','utf8'),{chrome,console,Promise,Map,Set,Date,Error,Number,String,Array,Object,JSON,Math,URL,setTimeout,clearTimeout});"
new = "vm.runInNewContext(fs.readFileSync('extension/scheduler-core.js','utf8')+'\\n'+fs.readFileSync('extension/worker.js','utf8'),{chrome,console,Promise,Map,Set,Date,Error,Number,String,Array,Object,JSON,Math,URL,setTimeout,clearTimeout});"
if text.count(old) != 1:
    raise SystemExit('worker-contract VM load anchor changed')
contract.write_text(text.replace(old,new))

# Static contract makes the dependency and single policy owner explicit.
static = Path('tests/static-contract.mjs')
text = static.read_text()
old = """const worker=fs.readFileSync(path.join(root,'worker.js'),'utf8');
assert.match(worker,/semantic-core\\.js/);assert.match(worker,/chrome\\.runtime\\.getManifest\\(\\)\\.version/,'Worker generation authority must come from Chrome manifest');
"""
new = """const worker=fs.readFileSync(path.join(root,'worker.js'),'utf8');
const schedulerCore=fs.readFileSync(path.join(root,'scheduler-core.js'),'utf8');
assert.match(worker,/semantic-core\\.js/);assert.match(worker,/chrome\\.runtime\\.getManifest\\(\\)\\.version/,'Worker generation authority must come from Chrome manifest');
assert.match(worker,/importScripts\\('scheduler-core\\.js'\\)/,'real Worker must load SchedulerCore before scheduling');
assert.match(worker,/const SCHEDULER = globalThis\\.__AUTO_AGREE_SCHEDULER_CORE__/,'Worker must consume one scheduler policy authority');
assert.match(worker,/SCHEDULER\\.pickNextIndex\\(/,'Worker next selection must delegate to SchedulerCore');
assert.match(worker,/SCHEDULER\\.pickPreemptionIndex\\(/,'Worker preemption selection must delegate to SchedulerCore');
assert.match(worker,/SCHEDULER\\.isStale\\(/,'Worker stale semantics must delegate to SchedulerCore');
assert.equal(/const INJECTION_MAX_GLOBAL = 4|const INJECTION_MAX_PER_TAB = 2|const INJECTION_QUEUE_MAX = 64|const INJECTION_AGING_MS = 1200|const INJECTION_STALE_MS = 15000/.test(worker),false,'Worker must not retain a second numeric scheduler policy');
assert.match(schedulerCore,/maxGlobal:\s*4/);assert.match(schedulerCore,/maxPerTab:\s*2/);assert.match(schedulerCore,/queueMax:\s*64/);assert.match(schedulerCore,/agingMs:\s*1200/);assert.match(schedulerCore,/staleMs:\s*15000/);
assert.equal(/\\bchrome\\b|\\bdocument\\b|\\bElement\\b|\\bNode\\b/.test(schedulerCore),false,'SchedulerCore must remain browser-independent');
"""
if text.count(old) != 1:
    raise SystemExit('static Worker scheduler insertion anchor changed')
static.write_text(text.replace(old,new))

print('v12 SchedulerCore migration prepared successfully')
