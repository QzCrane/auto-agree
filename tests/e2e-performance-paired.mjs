import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import puppeteer from 'puppeteer';

const ROOT = path.resolve('.');
const args = process.argv.slice(2);
const valueAfter = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const base = valueAfter('--base') || process.env.AUTO_AGREE_PERF_BASE;
const candidate = valueAfter('--candidate') || 'HEAD';
const repetitions = Number(valueAfter('--repetitions') || process.env.AUTO_AGREE_PERF_REPETITIONS || 5);
assert.match(String(base || ''), /^[a-f0-9]{7,40}$/i, '--base must be an exact Git commit');
assert.match(candidate, /^(?:HEAD|[a-f0-9]{7,40})$/i, '--candidate must be HEAD or an exact Git commit');
assert.ok(Number.isInteger(repetitions) && repetitions >= 3 && repetitions <= 9, 'repetitions must be in [3,9]');

function git(parameters, options = {}) {
  const result = spawnSync('git', parameters, {cwd: ROOT, encoding: 'utf8', ...options});
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `git ${parameters.join(' ')} failed`);
  return result.stdout.trim();
}

const exactBase = git(['rev-parse', `${base}^{commit}`]);
const exactCandidate = git(['rev-parse', `${candidate}^{commit}`]);
assert.notEqual(exactBase, exactCandidate, 'paired performance requires distinct base and candidate commits');
assert.equal(git(['status', '--porcelain', '--untracked-files=no']), '', 'candidate tracked worktree must be clean');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-agree-paired-'));
const baseWorktree = path.join(tempRoot, 'base');
const outputPath = path.join(ROOT, 'artifacts', 'e2e-performance-paired.json');

function executableIdentity(file) {
  const version = file.match(/(\d+\.\d+\.\d+\.\d+)/u)?.[1];
  assert.match(String(version || ''), /^\d+\.\d+\.\d+\.\d+$/u, 'Chrome for Testing path must expose its installed version');
  return {
    version,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
  };
}

function quantile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * fraction;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return low === high ? sorted[low] : sorted[low] + ((sorted[high] - sorted[low]) * (position - low));
}

function summary(values) {
  return {median: quantile(values, 0.5), p90: quantile(values, 0.9), max: Math.max(...values)};
}

const ceilings = Object.freeze({
  positiveTailLogin: {wallMs: 1500, taskDurationS: 1.0},
  negativeIdle: {wallMs: 700, taskDurationS: 0.18},
  negativeMutationChurn: {wallMs: 1800, taskDurationS: 0.65},
  hiddenQuiescence: {wallMs: 800, taskDurationS: 0.12},
  multiTabScheduler: {wallMs: 8000, taskDurationS: 2.5}
});
const ratioLimits = Object.freeze({median: 1.6, p90: 2.0});
const noiseFloor = Object.freeze({wallMs: 25, taskDurationS: 0.015});

function runScenario(extensionPath) {
  const result = spawnSync(process.execPath, ['tests/e2e-performance-scenario.mjs', extensionPath], {
    cwd: ROOT,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 45_000
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'performance scenario failed');
  const line = result.stdout.split(/\r?\n/u).find(entry => entry.startsWith('PERF_RESULT='));
  assert.ok(line, `performance scenario did not emit result: ${result.stdout}`);
  return JSON.parse(line.slice('PERF_RESULT='.length));
}

try {
  git(['worktree', 'add', '--detach', baseWorktree, exactBase]);
  const variants = {
    base: path.join(baseWorktree, 'extension'),
    candidate: path.join(ROOT, 'extension')
  };
  const raw = {base: [], candidate: []};
  for (let repetition = 0; repetition < repetitions; repetition++) {
    const order = repetition % 2 === 0 ? ['base', 'candidate'] : ['candidate', 'base'];
    for (const variant of order) {
      const sample = runScenario(variants[variant]);
      raw[variant].push(sample.workloads);
      console.log(`paired-performance ${repetition + 1}/${repetitions} ${variant}: ${JSON.stringify(sample.workloads)}`);
    }
  }

  const workloads = {};
  for (const [workload, ceiling] of Object.entries(ceilings)) {
    const metrics = {};
    for (const metricName of ['wallMs', 'taskDurationS']) {
      const baseSummary = summary(raw.base.map(sample => sample[workload][metricName]));
      const candidateSummary = summary(raw.candidate.map(sample => sample[workload][metricName]));
      const medianRatio = Math.max(candidateSummary.median, noiseFloor[metricName])
        / Math.max(baseSummary.median, noiseFloor[metricName]);
      const p90Ratio = Math.max(candidateSummary.p90, noiseFloor[metricName])
        / Math.max(baseSummary.p90, noiseFloor[metricName]);
      assert.ok(candidateSummary.max <= ceiling[metricName], `${workload}.${metricName} absolute ceiling exceeded`);
      assert.ok(medianRatio <= ratioLimits.median, `${workload}.${metricName} median ratio ${medianRatio} exceeded`);
      assert.ok(p90Ratio <= ratioLimits.p90, `${workload}.${metricName} p90 ratio ${p90Ratio} exceeded`);
      metrics[metricName] = {base: baseSummary, candidate: candidateSummary, medianRatio, p90Ratio};
    }
    workloads[workload] = metrics;
  }

  const chromePath = await puppeteer.executablePath();
  const chrome = executableIdentity(chromePath);
  const evidence = {
    schemaVersion: 1,
    benchmarkId: 'auto-agree-five-workload-paired-v1',
    exactBase,
    exactCandidate,
    repetitions,
    order: 'alternating-base-candidate',
    environment: {
      chrome: `Chrome for Testing ${chrome.version}`,
      chromeExecutableSha256: chrome.sha256,
      puppeteer: JSON.parse(fs.readFileSync('package.json', 'utf8')).devDependencies.puppeteer,
      node: process.version
    },
    ratioLimits,
    ceilings,
    workloads,
    raw
  };
  fs.mkdirSync(path.dirname(outputPath), {recursive: true});
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`e2e-performance-paired: PASS ${JSON.stringify({exactBase, exactCandidate, workloads})}`);
} finally {
  try { git(['worktree', 'remove', baseWorktree]); } catch {}
  fs.rmSync(tempRoot, {recursive: true, force: true});
}
