import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const files=['extension/bootstrap.js','extension/semantic-core.js','extension/risk-core.js','extension/gate.js','extension/engine.js','extension/worker.js'];
for(const file of files){ const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'}); assert.equal(r.status,0,`${file}: ${r.stderr}`); }
console.log('syntax: PASS');
