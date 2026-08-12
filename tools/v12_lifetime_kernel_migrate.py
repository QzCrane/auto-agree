from pathlib import Path


def replace_exact(path, old, new, count=1):
    p = Path(path)
    text = p.read_text()
    actual = text.count(old)
    if actual != count:
        raise SystemExit(f'{path}: expected {count} occurrence(s), got {actual}: {old[:140]!r}')
    p.write_text(text.replace(old, new))


# Engine RootBatch has no single owner: age is metadata only; dead WeakRefs remain skipped by traversal.
replace_exact(
    'extension/engine.js',
    """  function runRootBatch(job, budgetMs) {
    if (performance.now() - job.createdAt > ROOT_BATCH_TTL_MS) job.createdAt = performance.now();
    const start = performance.now();
""",
    """  function runRootBatch(job, budgetMs) {
    KERNEL.touchExpiredAge(job, ROOT_BATCH_TTL_MS);
    const start = performance.now();
""",
)

# Engine mutation/sibling batches have owner-backed liveness when an owner exists.
replace_exact(
    'extension/engine.js',
    """  function runBatchJob(job, budgetMs) {
    const now = performance.now();
    const owner = batchOwner(job);
    if ((job.owner || job.ownerRef) && !(owner instanceof Element)) return false;
    if (owner instanceof Element && !owner.isConnected) return false;
    if (now - job.createdAt > BATCH_JOB_TTL_MS) job.createdAt = now;
    const start = now;
""",
    """  function runBatchJob(job, budgetMs) {
    const now = performance.now();
    const owner = batchOwner(job);
    if (job.owner || job.ownerRef) {
      if (!KERNEL.refreshLiveAge(job, BATCH_JOB_TTL_MS, owner, candidate => candidate instanceof Element && candidate.isConnected, now)) return false;
    } else {
      KERNEL.touchExpiredAge(job, BATCH_JOB_TTL_MS, now);
    }
    const start = now;
""",
)

# Gate batch: owner-backed jobs prove owner liveness; ownerless refs only refresh age metadata.
replace_exact(
    'extension/gate.js',
    """          const job = batchJobs[0];
          const owner = job.ownerRef?.deref?.();
          if (job.ownerRef && (!(owner instanceof Element) || !owner.isConnected)) { batchJobs.shift(); continue; }
          if (performance.now() - job.createdAt > JOB_TTL_MS) job.createdAt = performance.now();
          let done = false;
""",
    """          const job = batchJobs[0];
          const owner = job.ownerRef?.deref?.();
          if (job.ownerRef) {
            if (!KERNEL.refreshLiveAge(job, JOB_TTL_MS, owner, candidate => candidate instanceof Element && candidate.isConnected)) { batchJobs.shift(); continue; }
          } else {
            KERNEL.touchExpiredAge(job, JOB_TTL_MS);
          }
          let done = false;
""",
)

# Gate deep: the root itself is the lifetime owner.
replace_exact(
    'extension/gate.js',
    """          const job = deepJobs[0];
          const root = job?.rootRef?.deref?.();
          if (!root || !rootConnected(root)) releaseDeep(deepJobs.shift());
          else {
            if (performance.now() - job.createdAt > JOB_TTL_MS) job.createdAt = performance.now();
            const out = drainDeep(job, start);
""",
    """          const job = deepJobs[0];
          const root = job?.rootRef?.deref?.();
          if (!root || !KERNEL.refreshLiveAge(job, JOB_TTL_MS, root, rootConnected)) releaseDeep(deepJobs.shift());
          else {
            const out = drainDeep(job, start);
""",
)

# Static Engine lifetime contract now requires the shared authority and rejects private age rewrites.
Path('tests/static-engine-lifetime.mjs').write_text(r'''import fs from 'node:fs';
import assert from 'node:assert/strict';

const engine = fs.readFileSync('extension/engine.js', 'utf8');
const kernel = fs.readFileSync('extension/runtime-kernel.js', 'utf8');
const rootBatchTtlE2e = fs.readFileSync('tests/e2e-engine-rootbatch-ttl.mjs', 'utf8');
const batchTtlE2e = fs.readFileSync('tests/e2e-engine-batch-ttl.mjs', 'utf8');

assert.match(kernel, /function\s+touchExpiredAge\s*\(/, 'runtime kernel must own aggregate age refresh');
assert.match(kernel, /function\s+refreshLiveAge\s*\(/, 'runtime kernel must own owner-backed live-age semantics');
assert.match(kernel, /touchExpiredAge\(job, ttlMs, now\)/, 'owner-backed live age must reuse the same age metadata primitive');

assert.match(engine, /ROOT_BATCH_TTL_MS\s*=\s*3000/, 'Engine RootBatch TTL constant must remain explicit');
assert.equal(
  /performance\.now\(\)\s*-\s*job\.createdAt\s*>\s*ROOT_BATCH_TTL_MS/.test(engine),
  false,
  'Engine must not privately reinterpret RootBatch age'
);
assert.match(
  engine,
  /KERNEL\.touchExpiredAge\(job,\s*ROOT_BATCH_TTL_MS\)/,
  'RootBatch age metadata must use the shared lifetime kernel while retaining its existing index'
);
assert.match(rootBatchTtlE2e, /const\s+ROOTS\s*=\s*60/, 'RootBatch TTL discriminator must create enough roots to force backlog');
assert.match(rootBatchTtlE2e, /const\s+POSITIVE\s*=\s*42/, 'RootBatch TTL target must remain away from the early synchronous roots');
assert.match(rootBatchTtlE2e, /performance\.now\(\)\s*\+\s*3400/, 'RootBatch TTL discriminator must cross the 3000 ms production TTL');
assert.match(rootBatchTtlE2e, /live Engine RootBatch work must survive age beyond ROOT_BATCH_TTL_MS exactly once/, 'RootBatch TTL discriminator must retain exactly-once progress');

assert.match(engine, /BATCH_JOB_TTL_MS\s*=\s*3000/, 'Engine sibling-batch TTL constant must remain explicit');
assert.equal(
  /now\s*-\s*job\.createdAt\s*>\s*BATCH_JOB_TTL_MS/.test(engine),
  false,
  'Engine sibling batches must not own a private age-expiration predicate'
);
assert.match(
  engine,
  /KERNEL\.refreshLiveAge\(job,\s*BATCH_JOB_TTL_MS,\s*owner,\s*candidate\s*=>\s*candidate\s+instanceof\s+Element\s*&&\s*candidate\.isConnected,\s*now\)/,
  'owner-backed Engine batch liveness must use the shared lifetime kernel'
);
assert.match(
  engine,
  /KERNEL\.touchExpiredAge\(job,\s*BATCH_JOB_TTL_MS,\s*now\)/,
  'ownerless Engine batches must share age metadata semantics without inventing a fake owner'
);
assert.match(batchTtlE2e, /const\s+SIBLINGS\s*=\s*140/, 'sibling-batch TTL discriminator must force the >96 large MutationRecord path');
assert.match(batchTtlE2e, /const\s+POSITIVE\s*=\s*70/, 'sibling-batch TTL target must remain outside the first-three/last-five edge samples');
assert.match(batchTtlE2e, /performance\.now\(\)\s*\+\s*3400/, 'sibling-batch TTL discriminator must cross the 3000 ms production TTL');
assert.match(batchTtlE2e, /timeout:\s*9000/, 'sibling-batch TTL discriminator keeps a fixed eventual-progress deadline');
assert.match(batchTtlE2e, /live Engine sibling batch must survive age beyond BATCH_JOB_TTL_MS exactly once/, 'sibling-batch TTL discriminator must retain exactly-once progress');

console.log('static-engine-lifetime: PASS');
''')

# Gate static contract: liveness + age are now one kernel authority, no private createdAt TTL rewrite.
sb = Path('tests/static-bounded-work.mjs')
text = sb.read_text()
old = """const ttlRefreshes = gate.match(/if\\s*\\(performance\\.now\\(\\)\\s*-\\s*job\\.createdAt\\s*>\\s*JOB_TTL_MS\\)\\s*job\\.createdAt\\s*=\\s*performance\\.now\\(\\)/g) || [];
assert.ok(ttlRefreshes.length >= 2, 'connected Gate batch and deep work must refresh liveness age instead of expiring by age alone');
assert.equal(
  /performance\\.now\\(\\)\\s*-\\s*job\\.createdAt\\s*>\\s*JOB_TTL_MS[^\\n]*batchJobs\\.shift\\(\\)/.test(gate),
  false,
  'Gate batch TTL must not erase still-live work by age alone'
);
assert.equal(
  /performance\\.now\\(\\)\\s*-\\s*job\\.createdAt\\s*>\\s*JOB_TTL_MS[^\\n]*releaseDeep\\(deepJobs\\.shift\\(\\)\\)/.test(gate),
  false,
  'Gate deep TTL must not erase still-live cursors by age alone'
);
"""
new = """assert.equal(
  /performance\\.now\\(\\)\\s*-\\s*job\\.createdAt\\s*>\\s*JOB_TTL_MS/.test(gate),
  false,
  'Gate must not retain private age-expiration semantics once lifetime authority is shared'
);
assert.match(
  gate,
  /KERNEL\\.refreshLiveAge\\(job,\\s*JOB_TTL_MS,\\s*owner,\\s*candidate\\s*=>\\s*candidate\\s+instanceof\\s+Element\\s*&&\\s*candidate\\.isConnected\\)/,
  'Gate owner-backed batch lifetime must use the shared kernel'
);
assert.match(
  gate,
  /KERNEL\\.touchExpiredAge\\(job,\\s*JOB_TTL_MS\\)/,
  'Gate ownerless batch work must use shared age metadata semantics'
);
assert.match(
  gate,
  /KERNEL\\.refreshLiveAge\\(job,\\s*JOB_TTL_MS,\\s*root,\\s*rootConnected\\)/,
  'Gate deep root liveness and age refresh must use the shared kernel'
);
assert.match(kernel, /Age is liveness metadata, not obsolescence authority/, 'kernel must retain the canonical age/obsolescence invariant');
"""
if text.count(old) != 1:
    raise SystemExit('static-bounded-work TTL contract anchor changed')
sb.write_text(text.replace(old, new))

print('v12 lifetime-kernel migration prepared successfully')
