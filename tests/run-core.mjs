import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const DIR=path.resolve('tests');
const SELF=path.basename(new URL(import.meta.url).pathname);
const tests=fs.readdirSync(DIR,{withFileTypes:true})
  .filter(entry=>entry.isFile()&&entry.name.endsWith('.mjs'))
  .map(entry=>entry.name)
  .filter(name=>name!==SELF&&!name.startsWith('e2e-'))
  .sort();

if(!tests.length) throw new Error('no deterministic core tests discovered');

for(const name of tests){
  const file=path.join(DIR,name);
  const result=spawnSync(process.execPath,[file],{stdio:'inherit',env:process.env});
  if(result.error) throw result.error;
  if(result.status!==0){
    console.error(`core-test-runner: FAIL ${name} (exit ${result.status})`);
    process.exit(result.status??1);
  }
}

console.log(`core-test-runner: PASS (${tests.length} auto-discovered deterministic gates)`);
