from pathlib import Path
import runpy

try:
    runpy.run_path('tools/v12_scheduler_core_migrate.py', run_name='__main__')
except SystemExit as error:
    if str(error) != 'static Worker scheduler insertion anchor changed':
        raise

static = Path('tests/static-contract.mjs')
text = static.read_text()
if "const schedulerCore=fs.readFileSync(path.join(root,'scheduler-core.js'),'utf8');" not in text:
    anchor = "const worker=fs.readFileSync(path.join(root,'worker.js'),'utf8');\n"
    insertion = """const worker=fs.readFileSync(path.join(root,'worker.js'),'utf8');
const schedulerCore=fs.readFileSync(path.join(root,'scheduler-core.js'),'utf8');
assert.match(worker,/importScripts\\('scheduler-core\\.js'\\)/,'real Worker must load SchedulerCore before scheduling');
assert.match(worker,/const SCHEDULER = globalThis\\.__AUTO_AGREE_SCHEDULER_CORE__/,'Worker must consume one scheduler policy authority');
assert.match(worker,/SCHEDULER\\.pickNextIndex\\(/,'Worker next selection must delegate to SchedulerCore');
assert.match(worker,/SCHEDULER\\.pickPreemptionIndex\\(/,'Worker preemption selection must delegate to SchedulerCore');
assert.match(worker,/SCHEDULER\\.isStale\\(/,'Worker stale semantics must delegate to SchedulerCore');
assert.equal(/const INJECTION_MAX_GLOBAL = 4|const INJECTION_MAX_PER_TAB = 2|const INJECTION_QUEUE_MAX = 64|const INJECTION_AGING_MS = 1200|const INJECTION_STALE_MS = 15000/.test(worker),false,'Worker must not retain a second numeric scheduler policy');
assert.match(schedulerCore,/maxGlobal:\\s*4/);assert.match(schedulerCore,/maxPerTab:\\s*2/);assert.match(schedulerCore,/queueMax:\\s*64/);assert.match(schedulerCore,/agingMs:\\s*1200/);assert.match(schedulerCore,/staleMs:\\s*15000/);
assert.equal(/\\bchrome\\b|\\bdocument\\b|\\bElement\\b|\\bNode\\b/.test(schedulerCore),false,'SchedulerCore must remain browser-independent');
"""
    if text.count(anchor) != 1:
        raise SystemExit('format-robust static Worker anchor changed')
    static.write_text(text.replace(anchor, insertion))

print('v12 SchedulerCore format-robust migration prepared successfully')
