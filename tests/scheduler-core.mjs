import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const source = fs.readFileSync('extension/scheduler-core.js', 'utf8');
assert.equal(/\bchrome\b|\bdocument\b|\bElement\b|\bNode\b|\bimportScripts\b/.test(source), false, 'SchedulerCore must remain browser/Chrome independent');

const context = vm.createContext({ console, Date, Number, Math, Map, Object });
vm.runInContext(source, context);
const core = context.__AUTO_AGREE_SCHEDULER_CORE__;
assert.ok(core, 'SchedulerCore must initialize');
assert.deepEqual(
  JSON.parse(JSON.stringify(core.CONFIG)),
  {maxGlobal:4,maxPerTab:2,queueMax:64,agingMs:1200,staleMs:15000,maxAgingBoost:3},
  'scheduler limits remain the proven Worker limits'
);

const C = core.CONFIG;
function legacyEffectivePriority(job, now) {
  const age = Math.max(0, now - job.queuedAt);
  const boost = Math.min(3, Math.floor(age / 1200));
  return job.priority + boost;
}
function legacyStale(job, now) { return now - job.queuedAt > 15000; }
function legacyPickNext(queue, activeByTab, lastScheduledTab, now) {
  let best = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < queue.length; i++) {
    const job = queue[i];
    const tabId = job.target.tabId;
    if ((activeByTab.get(tabId) || 0) >= 2) continue;
    const score = legacyEffectivePriority(job, now);
    if (score > bestScore) { best = i; bestScore = score; continue; }
    if (score < bestScore || best < 0) continue;
    const prior = queue[best];
    const jobRotates = tabId !== lastScheduledTab;
    const priorRotates = prior.target.tabId !== lastScheduledTab;
    if (jobRotates !== priorRotates) { if (jobRotates) best = i; continue; }
    if (job.queuedAt < prior.queuedAt || (job.queuedAt === prior.queuedAt && job.seq < prior.seq)) best = i;
  }
  return best;
}
function legacyPickPreemption(queue, priority, now) {
  let victim = -1;
  for (let i = 0; i < queue.length; i++) {
    const job = queue[i];
    if (job.priority >= priority) continue;
    if (victim < 0) { victim = i; continue; }
    const current = queue[victim];
    const jobScore = legacyEffectivePriority(job, now);
    const currentScore = legacyEffectivePriority(current, now);
    if (jobScore < currentScore || (jobScore === currentScore && job.queuedAt > current.queuedAt)) victim = i;
  }
  return victim;
}

const jobArb = fc.record({
  priority: fc.integer({min:1,max:4}),
  queuedAt: fc.integer({min:0,max:40000}),
  seq: fc.integer({min:0,max:100000}),
  tabId: fc.integer({min:0,max:12})
}).map(x => ({priority:x.priority,queuedAt:x.queuedAt,seq:x.seq,target:{tabId:x.tabId}}));

fc.assert(fc.property(jobArb, fc.integer({min:0,max:50000}), (job, now) => {
  assert.equal(core.effectivePriority(job, now), legacyEffectivePriority(job, now));
  assert.equal(core.isStale(job, now), legacyStale(job, now));
}), {seed:0x5C4ED001,numRuns:3500,verbose:2});

fc.assert(fc.property(
  fc.array(jobArb,{minLength:0,maxLength:64}),
  fc.array(fc.tuple(fc.integer({min:0,max:12}),fc.integer({min:0,max:2})),{maxLength:20}),
  fc.integer({min:-1,max:12}),
  fc.integer({min:0,max:50000}),
  (rawQueue, activePairs, lastTab, now) => {
    const queue = rawQueue.filter(job => !legacyStale(job, now));
    const active = new Map();
    for (const [tab,count] of activePairs) active.set(tab, Math.max(active.get(tab)||0,count));
    const expected = legacyPickNext(queue, active, lastTab, now);
    const actual = core.pickNextIndex(queue, active, lastTab, now);
    assert.equal(actual, expected, 'pure next-selection must remain byte-for-byte policy-equivalent to legacy Worker logic');
    if (actual >= 0) {
      const chosen = queue[actual];
      assert.ok((active.get(chosen.target.tabId)||0) < C.maxPerTab, 'selected tab must have a free per-tab slot');
      const chosenScore = core.effectivePriority(chosen, now);
      for (const job of queue) {
        if ((active.get(job.target.tabId)||0) >= C.maxPerTab) continue;
        assert.ok(core.effectivePriority(job, now) <= chosenScore, 'scheduler must select a maximal effective priority');
      }
    }
  }
), {seed:0x5C4ED002,numRuns:4000,verbose:2});

fc.assert(fc.property(
  fc.array(jobArb,{minLength:0,maxLength:64}),
  fc.integer({min:1,max:4}),
  fc.integer({min:0,max:50000}),
  (rawQueue, incomingPriority, now) => {
    const queue = rawQueue.filter(job => !legacyStale(job, now));
    const expected = legacyPickPreemption(queue, incomingPriority, now);
    const actual = core.pickPreemptionIndex(queue, incomingPriority, now);
    assert.equal(actual, expected, 'preemption victim must remain equivalent to the legacy Worker algorithm');
    if (actual >= 0) assert.ok(queue[actual].priority < incomingPriority, 'preemption can only evict lower base priority');
  }
), {seed:0x5C4ED003,numRuns:3000,verbose:2});

// Stateful slot-filling model: dispatching through the pure selector can never violate hard
// concurrency bounds. This deliberately randomizes already-active tab occupancy and queue order.
fc.assert(fc.property(
  fc.array(jobArb,{minLength:1,maxLength:64}),
  fc.integer({min:0,max:50000}),
  (rawQueue, now) => {
    const queue = rawQueue.filter(job => !core.isStale(job, now));
    const activeByTab = new Map();
    let activeGlobal = 0;
    let lastTab = -1;
    while (queue.length && activeGlobal < C.maxGlobal) {
      const index = core.pickNextIndex(queue, activeByTab, lastTab, now);
      if (index < 0) break;
      const [job] = queue.splice(index,1);
      const tab = job.target.tabId;
      activeGlobal++;
      activeByTab.set(tab,(activeByTab.get(tab)||0)+1);
      lastTab = tab;
      assert.ok(activeGlobal <= C.maxGlobal, 'global hard limit must hold');
      assert.ok(activeByTab.get(tab) <= C.maxPerTab, 'per-tab hard limit must hold');
    }
  }
), {seed:0x5C4ED004,numRuns:2000,verbose:2});

// Exact boundary semantics remain explicit.
assert.equal(core.isStale({queuedAt:0},15000),false,'age exactly equal to staleMs remains eligible');
assert.equal(core.isStale({queuedAt:0},15001),true,'age strictly greater than staleMs is stale');
assert.equal(core.effectivePriority({priority:1,queuedAt:0},5000),4,'Gate aging boost remains capped at +3');

console.log('scheduler-core: PASS (12500 differential/property cases)');
