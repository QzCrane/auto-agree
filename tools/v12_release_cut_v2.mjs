import fs from 'node:fs';
import assert from 'node:assert/strict';

const OLD='11.0.0';
const NEXT='12.0.0';
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function writeJson(file,value){fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');}

const manifest=readJson('extension/manifest.json');
assert.equal(manifest.version,OLD,'manifest must start from the verified v11 generation');
manifest.version=NEXT;
writeJson('extension/manifest.json',manifest);

const pkg=readJson('package.json');
assert.equal(pkg.version,OLD,'package must start from the verified v11 generation');
pkg.version=NEXT;
writeJson('package.json',pkg);

const lock=readJson('package-lock.json');
assert.equal(lock.version,OLD,'package-lock top-level generation must start at v11');
assert.equal(lock.packages?.['']?.version,OLD,'package-lock root package generation must start at v11');
lock.version=NEXT;
lock.packages[''].version=NEXT;
writeJson('package-lock.json',lock);

const kernelFile='extension/runtime-kernel.js';
let kernel=fs.readFileSync(kernelFile,'utf8');
const oldLiteral=`const VERSION = '${OLD}';`;
assert.equal(kernel.split(oldLiteral).length-1,1,'RuntimeKernel must contain exactly one v11 birth-generation literal');
kernel=kernel.replace(oldLiteral,`const VERSION = '${NEXT}';`);
fs.writeFileSync(kernelFile,kernel);

console.log(`v12-release-cut-v2: PASS ${OLD} -> ${NEXT}`);
