import assert from 'node:assert/strict';
import fs from 'node:fs';

const policy=JSON.parse(fs.readFileSync('release/closeout-policy.json','utf8'));
const tool=fs.readFileSync('tools/closeout-evidence.mjs','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));

assert.equal(policy.schemaVersion,1);
assert.equal(policy.requiredAttempts,2,'a formal candidate must pass twice at one exact head');
assert.deepEqual(policy.hostedStates,['PASSED_HOSTED','FAILED_PRODUCT','INFRA_UNAVAILABLE','NOT_APPLICABLE']);
assert.equal(new Set(policy.lanes.map(lane=>lane.id)).size,policy.lanes.length,'lane IDs must be unique');
for(const lane of ['core','package','browser-main','engine-context-index-pressure','generation-lease','update-transition','paired-performance']){
  assert.ok(policy.lanes.some(entry=>entry.id===lane),`closeout policy must include ${lane}`);
}
const update=policy.lanes.find(lane=>lane.id==='update-transition');
assert.equal(update.env.AUTO_AGREE_PREVIOUS_REF,'${BASE}','the update transition must bind the exact candidate base');
const performance=policy.lanes.find(lane=>lane.id==='paired-performance');
assert.ok(performance.args.includes('${BASE}'));
assert.ok(performance.args.includes('${HEAD}'));

assert.match(tool,/assert\.equal\(metadata\.headRefOid,verified\.head/,'merge authorization must compare-and-swap the verified PR head');
assert.match(tool,/--match-head-commit',verified\.head/,'GitHub merge must receive the expected head');
assert.equal(/--delete-branch/.test(tool),false,'merge must not ask gh to switch a branch already owned by another worktree');
assert.match(tool,/assert\.equal\(merged\.state,'MERGED'/,'merge completion must be read back from the remote PR');
assert.match(tool,/assert\.equal\(mainRef\.object\?\.sha,merged\.mergeCommit\.oid/,'remote main must be read back at the merge commit');
assert.match(tool,/assert\.equal\(mergeCommit\.tree\?\.sha,verified\.tree/,'the merged tree must equal the verified candidate tree');
assert.match(tool,/ref cleanup refuses a moved head branch/,'remote branch cleanup must refuse a ref that moved after verification');
assert.match(tool,/head-ref absence must be confirmed by remote 404/,'remote branch deletion must be read back');
assert.match(tool,/policySha256/,'receipts must bind the executable closeout policy');
assert.match(tool,/packageManifestSha256/,'receipts must bind the canonical package identity');
assert.match(tool,/source:'operator-declared'/,'local evidence must not self-certify hosted runner state');
assert.equal(pkg.scripts['closeout:evidence'],'node tools/closeout-evidence.mjs record');
assert.equal(pkg.scripts['closeout:verify'],'node tools/closeout-evidence.mjs verify');
assert.equal(pkg.scripts['closeout:merge'],'node tools/closeout-evidence.mjs merge');

console.log(`closeout-governance: PASS (${policy.lanes.length} exact-head lanes x ${policy.requiredAttempts} attempts)`);
