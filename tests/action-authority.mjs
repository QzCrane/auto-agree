import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const SOURCE = fs.readFileSync('extension/action-authority.js', 'utf8');
const VERSION = '11.0.0';

class HTMLElement {
  constructor(trace = []) { this.trace = trace; this.clicks = 0; this.throwOnClick = false; }
  click() {
    this.trace.push('click');
    this.clicks++;
    if (this.throwOnClick) throw new Error('synthetic-click-failure');
  }
}

function boot({ leaseVersion = VERSION, guardVersion = VERSION, current = true, authorize = true, leaseThrows = false, guardThrows = false } = {}) {
  const trace = [];
  const context = vm.createContext({ console, HTMLElement });
  context.__AUTO_AGREE_RUNTIME_KERNEL__ = Object.freeze({ version: VERSION });
  context.__AUTO_AGREE_GENERATION_LEASE__ = {
    version: leaseVersion,
    current() {
      trace.push('lease');
      if (leaseThrows) throw new Error('synthetic-lease-failure');
      return current;
    }
  };
  context.__AUTO_AGREE_HANDOVER_GUARD__ = {
    version: guardVersion,
    authorize() {
      trace.push('guard');
      if (guardThrows) throw new Error('synthetic-guard-failure');
      return authorize;
    }
  };
  vm.runInContext(SOURCE, context);
  return { context, authority: context.__AUTO_AGREE_ACTION_AUTHORITY__, trace };
}

{
  const { authority, trace } = boot();
  assert.ok(authority);
  assert.equal(Object.isFrozen(authority), true);
  const target = new HTMLElement(trace);
  assert.equal(authority.attemptClick(target), true);
  assert.equal(target.clicks, 1);
  assert.deepEqual(trace, ['lease', 'guard', 'click'], 'generation must be checked before minting guard authority and dispatch');
}

for (const scenario of [
  { name: 'stale generation', options: { current: false }, expected: ['lease'] },
  { name: 'lease exception', options: { leaseThrows: true }, expected: ['lease'] },
  { name: 'lease version mismatch', options: { leaseVersion: '10.0.0' }, expected: [] },
  { name: 'guard rejection', options: { authorize: false }, expected: ['lease', 'guard'] },
  { name: 'guard exception', options: { guardThrows: true }, expected: ['lease', 'guard'] },
  { name: 'guard version mismatch', options: { guardVersion: '10.0.0' }, expected: ['lease'] }
]) {
  const { authority, trace } = boot(scenario.options);
  const target = new HTMLElement(trace);
  assert.equal(authority.attemptClick(target), false, scenario.name);
  assert.equal(target.clicks, 0, `${scenario.name}: no click may be attempted`);
  assert.deepEqual(trace, scenario.expected, `${scenario.name}: protocol order`);
}

{
  const { authority, trace } = boot();
  const target = new HTMLElement(trace);
  target.throwOnClick = true;
  assert.equal(authority.attemptClick(target), false, 'click exception must fail closed');
  assert.equal(target.clicks, 1, 'one attempted click is allowed before the exception is observed');
  assert.deepEqual(trace, ['lease', 'guard', 'click']);
}

{
  const { authority, trace } = boot();
  assert.equal(authority.attemptClick({ click() { trace.push('plain-click'); } }), false, 'non-HTMLElement targets are outside the action protocol');
  assert.deepEqual(trace, []);
}

{
  const { authority, context, trace } = boot();
  // Dependencies are intentionally resolved at attempt time. This preserves cross-generation
  // handover behavior and lets real-Chrome discriminators replace the public Guard API without a test hook.
  context.__AUTO_AGREE_HANDOVER_GUARD__ = { version: VERSION, authorize() { trace.push('replacement-guard'); return false; } };
  const target = new HTMLElement(trace);
  assert.equal(authority.attemptClick(target), false);
  assert.deepEqual(trace, ['lease', 'replacement-guard']);
  assert.equal(target.clicks, 0);
}

console.log('action-authority: PASS');
