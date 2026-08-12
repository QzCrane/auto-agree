import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const context = vm.createContext({ console, WeakRef, performance });
vm.runInContext(fs.readFileSync('extension/runtime-kernel.js', 'utf8'), context);
const kernel = context.__AUTO_AGREE_RUNTIME_KERNEL__;
assert.ok(kernel);
assert.equal(kernel.version, '11.0.0');

{
  const root = { live: true, name: 'root' };
  const a = { live: true, name: 'a' };
  const b = { live: true, name: 'b' };
  const c = { live: true, name: 'c' };
  const work = kernel.createBoundedFifo({
    capacity: 2,
    isLive: scope => scope.live === true,
    coalesce: (_current, _next, currentUrgent, nextUrgent) => ({
      scope: root,
      meta: !!currentUrgent || !!nextUrgent
    })
  });
  assert.equal(work.admit({ id: 'a' }, a, false).admitted, true);
  assert.equal(work.admit({ id: 'b' }, b, false).admitted, true);
  assert.equal(work.admit({ id: 'c' }, c, true).admitted, false);
  assert.deepEqual(Array.from(work.queue, job => job.id), ['a', 'b'], 'overflow must not evict old FIFO jobs');
  assert.equal(work.hasRecovery, true);
  work.queue.shift();
  work.queue.shift();
  let promoted = null;
  assert.equal(work.promote((scope, urgent) => (promoted = { scope, urgent })), true);
  assert.equal(promoted.scope, c, 'first recovery keeps the exact excess scope until coalescing is necessary');
  assert.equal(promoted.urgent, true);
  assert.equal(work.queue.length, 1);
  work.clear();
  assert.equal(work.queue.length, 0);
  assert.equal(work.hasRecovery, false);
}

{
  const owner = { live: true };
  const job = { createdAt: 100 };
  assert.equal(kernel.refreshLiveAge(job, 50, owner, item => item.live, 200), true);
  assert.equal(job.createdAt, 200, 'live expired work refreshes age');
  owner.live = false;
  assert.equal(kernel.refreshLiveAge(job, 50, owner, item => item.live, 400), false);
  assert.equal(job.createdAt, 200, 'dead work does not refresh itself');
}

fc.assert(
  fc.property(
    fc.integer({ min: 1, max: 8 }),
    fc.array(fc.boolean(), { minLength: 2, maxLength: 40 }),
    (capacity, urgentFlags) => {
      const stableRoot = { live: true, id: 'coalesced' };
      const scopes = urgentFlags.map((urgent, id) => ({ live: true, urgent, id }));
      const work = kernel.createBoundedFifo({
        capacity,
        isLive: scope => scope.live === true,
        coalesce: (_current, _next, currentUrgent, nextUrgent) => ({
          scope: stableRoot,
          meta: !!currentUrgent || !!nextUrgent
        })
      });

      const admittedIds = [];
      let overflowUrgent = false;
      for (const scope of scopes) {
        const result = work.admit({ id: scope.id }, scope, scope.urgent);
        if (result.admitted) admittedIds.push(scope.id);
        else overflowUrgent ||= scope.urgent;
        assert.ok(work.queue.length <= capacity, 'hard capacity must never be exceeded');
      }

      assert.deepEqual(
        Array.from(work.queue, job => job.id),
        admittedIds,
        'new overflow must never reorder or evict already-admitted FIFO jobs'
      );

      while (work.queue.length) work.queue.shift();
      if (scopes.length > capacity) {
        let recoveredMeta = null;
        assert.equal(work.promote((_scope, meta) => ({ meta: (recoveredMeta = meta) })), true);
        assert.equal(recoveredMeta, overflowUrgent, 'coalesced metadata must preserve urgent authority monotonically');
        assert.equal(work.queue.length, 1, 'one bounded recovery representation promotes to one job');
      }
    }
  ),
  { seed: 0xB0A1DED, numRuns: 1500, verbose: 2 }
);

console.log('runtime-kernel: PASS (deterministic + 1500 fast-check sequences)');
