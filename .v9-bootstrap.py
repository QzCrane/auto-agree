from pathlib import Path


def load(path):
    return Path(path).read_text(encoding='utf-8')


def save(path, text):
    Path(path).write_text(text, encoding='utf-8')


def replace_once(path, old, new):
    text = load(path)
    if old not in text:
        raise SystemExit(f'missing anchor in {path}: {old[:120]!r}')
    if text.count(old) != 1:
        raise SystemExit(f'non-unique anchor in {path}: {text.count(old)} matches')
    save(path, text.replace(old, new, 1))


def replace_all(path, old, new, minimum=1):
    text = load(path)
    count = text.count(old)
    if count < minimum:
        raise SystemExit(f'missing replacement in {path}: {old!r}')
    save(path, text.replace(old, new))


# Version the live runtime and direct current-version tests. Historical reports remain immutable.
for path in [
    'extension/manifest.json',
    'extension/bootstrap.js',
    'extension/semantic-core.js',
    'extension/risk-core.js',
    'extension/gate.js',
    'extension/engine.js',
    'extension/worker.js',
    'package.json',
    'tests/static-contract.mjs',
    'tests/e2e-extension.mjs',
]:
    replace_all(path, '8.0.0', '9.0.0')

# Shared cores may be refreshed across extension versions without invalidating old closures that
# already captured the prior core. Active Gate/Engine tiers remain single-instance to avoid two
# independent auto-clickers in one document.
replace_once(
    'extension/semantic-core.js',
    "  if (globalThis.__AUTO_AGREE_SEMANTIC__) return;\n\n  const VERSION = '9.0.0';",
    "  const VERSION = '9.0.0';\n  if (globalThis.__AUTO_AGREE_SEMANTIC__?.version === VERSION) return;"
)
replace_once(
    'extension/risk-core.js',
    "  if (globalThis.__AUTO_AGREE_RISK__) return;\n  const BASE = globalThis.__AUTO_AGREE_SEMANTIC__;\n  if (!BASE || BASE.version !== '9.0.0') return;",
    "  const VERSION = '9.0.0';\n  if (globalThis.__AUTO_AGREE_RISK__?.version === VERSION) return;\n  const BASE = globalThis.__AUTO_AGREE_SEMANTIC__;\n  if (!BASE || BASE.version !== VERSION) return;"
)
replace_once(
    'extension/risk-core.js',
    "globalThis.__AUTO_AGREE_RISK__=Object.freeze({version:'9.0.0',SEVERITY",
    "globalThis.__AUTO_AGREE_RISK__=Object.freeze({version:VERSION,SEVERITY"
)

# Never poison a tier sentinel before its dependencies have actually loaded.
replace_once(
    'extension/gate.js',
    "  if (globalThis.__AUTO_AGREE_GATE__) return;\n  globalThis.__AUTO_AGREE_GATE__ = '9.0.0';\n\n\n  const VERSION = '9.0.0';\n  const CORE = globalThis.__AUTO_AGREE_SEMANTIC__;\n  if (!CORE || CORE.version !== VERSION) return;",
    "  const VERSION = '9.0.0';\n  const CORE = globalThis.__AUTO_AGREE_SEMANTIC__;\n  if (!CORE || CORE.version !== VERSION) return;\n  if (globalThis.__AUTO_AGREE_GATE__) return;\n  globalThis.__AUTO_AGREE_GATE__ = VERSION;"
)
replace_once(
    'extension/engine.js',
    "  if (globalThis.__AUTO_AGREE_ENGINE__) return;\n  globalThis.__AUTO_AGREE_ENGINE__ = '9.0.0';\n\n  const VERSION = '9.0.0';",
    "  const VERSION = '9.0.0';"
)
replace_once(
    'extension/engine.js',
    "  const CORE = globalThis.__AUTO_AGREE_SEMANTIC__;\n  const RISK = globalThis.__AUTO_AGREE_RISK__;\n  if (!CORE || CORE.version !== VERSION || !RISK || RISK.version !== VERSION) return;",
    "  const CORE = globalThis.__AUTO_AGREE_SEMANTIC__;\n  const RISK = globalThis.__AUTO_AGREE_RISK__;\n  if (!CORE || CORE.version !== VERSION || !RISK || RISK.version !== VERSION) return;\n  if (globalThis.__AUTO_AGREE_ENGINE__) return;\n  globalThis.__AUTO_AGREE_ENGINE__ = VERSION;"
)

# Preserve the v1.1/v5 safety invariant: truly unobservable controls are one-shot for the lifetime
# of that DOM element. If a click produces a real observable checked state, normal verified logic
# resumes and the one-shot guard is released.
replace_once(
    'extension/engine.js',
    "  const deferredClicks = new WeakSet();",
    "  const deferredClicks = new WeakSet();\n  const oneShotUnknown = new WeakSet();"
)
replace_once(
    'extension/engine.js',
    "  function readStateRaw(el, row, input) {\n    if (input) return { known: true, checked: !!input.checked, kind: 'native' };",
    "  function readStateRaw(el, row, input) {\n    if (input) {\n      if (input.indeterminate) return { known: true, checked: false, kind: 'mixed' };\n      return { known: true, checked: !!input.checked, kind: 'native' };\n    }"
)
replace_once(
    'extension/engine.js',
    "      if (aria === 'true') return { known: true, checked: true, kind: 'aria' };\n      if (aria === 'false' || aria === 'mixed') return { known: true, checked: false, kind: 'aria' };",
    "      if (aria === 'true') return { known: true, checked: true, kind: 'aria' };\n      if (aria === 'false') return { known: true, checked: false, kind: 'aria' };\n      if (aria === 'mixed') return { known: true, checked: false, kind: 'mixed' };"
)
replace_once(
    'extension/engine.js',
    "    if (s.disabled || f.severity >= SEVERITY.OPTIONAL || s.assessment.blocked) return { accept: false, score: -100, severity: s.severity, graph };",
    "    if (s.disabled || s.state.kind === 'mixed' || f.severity >= SEVERITY.OPTIONAL || s.assessment.blocked) return { accept: false, score: -100, severity: s.severity, graph };"
)
replace_once(
    'extension/engine.js',
    "      if (!(state.known && state.checked)) return false;\n      verifier.done = true;",
    "      if (!(state.known && state.checked)) return false;\n      oneShotUnknown.delete(s.control);\n      verifier.done = true;"
)
replace_once(
    'extension/engine.js',
    "    const before = s.state;\n    const check = armVerifier(s, before, 0);",
    "    const before = s.state;\n    if (!before.known) oneShotUnknown.add(s.control);\n    const check = armVerifier(s, before, 0);"
)
replace_once(
    'extension/engine.js',
    "  function performClick(s, overrideTarget = null, urgent = false) {\n    if (s.state.known && s.state.checked) return true;",
    "  function performClick(s, overrideTarget = null, urgent = false) {\n    if (s.state.known && s.state.checked) return true;\n    if (!s.state.known && oneShotUnknown.has(s.control)) return false;"
)

# Consume Gate→Engine handoff exactly once, but retain a weakly-owned seed that both seed-shadow
# observation and scoped bootstrap can read. v8 deleted the global on the first helper call, so the
# immediately following bootstrapSeedRoot() always saw null.
replace_once(
    'extension/engine.js',
    "  function bootstrapSeedElement() {\n    const handoff = globalThis.__AUTO_AGREE_BOOTSTRAP_CONTEXT__;\n    const seed = handoff?.seedRef?.deref?.() || handoff?.seed || null;\n    try { delete globalThis.__AUTO_AGREE_BOOTSTRAP_CONTEXT__; } catch (_) { globalThis.__AUTO_AGREE_BOOTSTRAP_CONTEXT__ = null; }\n    const el = seed instanceof Element ? seed : seed?.parentElement;\n    return el instanceof Element && el.isConnected ? el : null;\n  }",
    "  let bootstrapSeedRef = null;\n  let bootstrapSeedResolved = false;\n\n  function bootstrapSeedElement() {\n    if (!bootstrapSeedResolved) {\n      bootstrapSeedResolved = true;\n      const handoff = globalThis.__AUTO_AGREE_BOOTSTRAP_CONTEXT__;\n      const seed = handoff?.seedRef?.deref?.() || handoff?.seed || null;\n      try { delete globalThis.__AUTO_AGREE_BOOTSTRAP_CONTEXT__; } catch (_) { globalThis.__AUTO_AGREE_BOOTSTRAP_CONTEXT__ = null; }\n      const el = seed instanceof Element ? seed : seed?.parentElement;\n      if (el instanceof Element && el.isConnected && typeof WeakRef === 'function') bootstrapSeedRef = new WeakRef(el);\n    }\n    const el = bootstrapSeedRef?.deref?.();\n    return el instanceof Element && el.isConnected ? el : null;\n  }"
)

# Worker-side profile identity is derived from Chrome's MessageSender, not untrusted message data.
replace_once(
    'extension/worker.js',
    "function senderLifecycleAllowed(sender) {\n  const state = sender?.documentLifecycle;\n  return !state || state === 'active';\n}",
    "function senderLifecycleAllowed(sender) {\n  const state = sender?.documentLifecycle;\n  return !state || state === 'active';\n}\n\nfunction profileOriginForSender(sender) {\n  for (const raw of [sender?.origin, sender?.url]) {\n    if (typeof raw !== 'string' || !raw || raw === 'null') continue;\n    try {\n      const parsed = new URL(raw);\n      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.origin;\n    } catch (_) {}\n  }\n  return null;\n}"
)
replace_once(
    'extension/worker.js',
    "  if (message.type === 'AUTO_AGREE_PROFILE_GET') {\n    getProfile(message.origin).then(",
    "  const profileOrigin = profileOriginForSender(sender);\n\n  if (message.type === 'AUTO_AGREE_PROFILE_GET') {\n    getProfile(profileOrigin).then("
)
replace_all('extension/worker.js', 'putProfile(message.origin, message.profile)', 'putProfile(profileOrigin, message.profile)')
replace_all('extension/worker.js', 'invalidateProfileFlow(message.origin, message.profile)', 'invalidateProfileFlow(profileOrigin, message.profile)')
replace_once(
    'extension/worker.js',
    "  const files = isGate ? ['semantic-core.js', 'gate.js'] : ['risk-core.js', 'engine.js'];",
    "  const files = isGate ? ['semantic-core.js', 'gate.js'] : ['semantic-core.js', 'risk-core.js', 'engine.js'];"
)

# Static contracts make the newly recovered historical invariants permanent.
replace_once(
    'tests/static-contract.mjs',
    "assert.match(worker,/semantic-core\\.js/);assert.match(worker,/documentLifecycle/);assert.match(worker,/INJECTION_AGING_MS/);assert.match(worker,/INJECTION_STALE_MS/);assert.match(worker,/onInstalled/);assert.match(worker,/allFrames:\\s*true/);\nassert.match(fs.readFileSync(path.join(root,'gate.js'),'utf8'),/__AUTO_AGREE_SEMANTIC__/);\nconst engine=fs.readFileSync(path.join(root,'engine.js'),'utf8');",
    "assert.match(worker,/semantic-core\\.js/);assert.match(worker,/documentLifecycle/);assert.match(worker,/INJECTION_AGING_MS/);assert.match(worker,/INJECTION_STALE_MS/);assert.match(worker,/onInstalled/);assert.match(worker,/allFrames:\\s*true/);\nassert.match(worker,/profileOriginForSender/);\nassert.equal(/\\bmessage\\.origin\\b/.test(worker),false,'profile storage identity must come from MessageSender, not message.origin');\nassert.match(worker,/\\['semantic-core\\.js', 'risk-core\\.js', 'engine\\.js'\\]/,'Engine injection must refresh the shared semantic dependency across extension updates');\nconst semantic=fs.readFileSync(path.join(root,'semantic-core.js'),'utf8');\nassert.match(semantic,/__AUTO_AGREE_SEMANTIC__\\?\\.version === VERSION/);\nconst gate=fs.readFileSync(path.join(root,'gate.js'),'utf8');\nassert.match(gate,/__AUTO_AGREE_SEMANTIC__/);\nassert.ok(gate.indexOf('if (!CORE || CORE.version !== VERSION) return;') < gate.indexOf('globalThis.__AUTO_AGREE_GATE__ = VERSION;'),'Gate sentinel must be assigned only after dependencies are valid');\nconst engine=fs.readFileSync(path.join(root,'engine.js'),'utf8');\nassert.ok(engine.indexOf('if (!CORE || CORE.version !== VERSION || !RISK || RISK.version !== VERSION) return;') < engine.indexOf('globalThis.__AUTO_AGREE_ENGINE__ = VERSION;'),'Engine sentinel must be assigned only after dependencies are valid');"
)
replace_once(
    'tests/static-contract.mjs',
    "assert.match(engine,/credentialInvalid/);",
    "assert.match(engine,/credentialInvalid/);\nassert.match(engine,/oneShotUnknown/);\nassert.match(engine,/kind: 'mixed'/);\nassert.match(engine,/bootstrapSeedRef/);"
)

# Worker contract: prove a content script cannot redirect profile writes by spoofing message.origin.
replace_once(
    'tests/worker-contract.mjs',
    "vm.runInNewContext(fs.readFileSync('extension/worker.js','utf8'),{chrome,console,Promise,Map,Set,Date,Error,Number,String,Array,Object,JSON,Math,setTimeout,clearTimeout});",
    "vm.runInNewContext(fs.readFileSync('extension/worker.js','utf8'),{chrome,console,Promise,Map,Set,Date,Error,Number,String,Array,Object,JSON,Math,URL,setTimeout,clearTimeout});"
)
replace_once(
    'tests/worker-contract.mjs',
    "const sender={tab:{id:7},frameId:3,documentId:'doc-1',documentLifecycle:'active'};",
    "const sender={tab:{id:7},frameId:3,documentId:'doc-1',documentLifecycle:'active',origin:'https://trusted.example',url:'https://trusted.example/login'};"
)
replace_once(
    'tests/worker-contract.mjs',
    "assert.equal(JSON.stringify(calls[1].files),JSON.stringify(['risk-core.js','engine.js']));",
    "assert.equal(JSON.stringify(calls[1].files),JSON.stringify(['semantic-core.js','risk-core.js','engine.js']));"
)
replace_once(
    'tests/worker-contract.mjs',
    "assert.equal(calls.length,before,'inactive documents must never be injected');\nconsole.log('worker-contract: PASS');",
    "assert.equal(calls.length,before,'inactive documents must never be injected');\n\nconst profile={version:'9.0.0',flows:[{fingerprint:'/login|form',locator:{hosts:[],selector:'#agree'},descriptor:{kind:'native',severity:0,legal:true,assent:true,required:true,auth:true,linkBucket:1},successes:1,failures:0,ts:Date.now()}]};\nawait message({type:'AUTO_AGREE_PROFILE_PUT',origin:'https://spoofed.example',profile},sender);\nassert.equal(local.has('site:https://trusted.example'),true,'sender origin must own the stored profile');\nassert.equal(local.has('site:https://spoofed.example'),false,'message.origin must not select a storage namespace');\nconst profileResponse=await message({type:'AUTO_AGREE_PROFILE_GET',origin:'https://spoofed.example'},sender);\nassert.equal(profileResponse?.profile?.flows?.[0]?.fingerprint,'/login|form');\nconsole.log('worker-contract: PASS');"
)

# Real-browser regressions for mixed/indeterminate controls and the historical UNKNOWN one-shot rule.
Path('tests/fixtures/regressions/mixed-control.html').write_text("""<!doctype html><meta charset=\"utf-8\"><title>Mixed consent control must not toggle</title>\n<form><input type=\"email\" value=\"valid@example.com\"><div id=\"agree\" role=\"checkbox\" aria-checked=\"mixed\" aria-label=\"I agree to the Terms of Service\" data-clicks=\"0\"></div><button type=\"button\">Login</button></form>\n<script>document.querySelector('#agree').addEventListener('click',e=>{e.currentTarget.dataset.clicks=String(Number(e.currentTarget.dataset.clicks||0)+1);e.currentTarget.setAttribute('aria-checked','false');});</script>\n""",encoding='utf-8')
Path('tests/fixtures/regressions/classless-unknown-one-shot.html').write_text("""<!doctype html><meta charset=\"utf-8\"><title>Classless unknown one-shot</title>\n<style>#row{display:flex;gap:8px;align-items:center;margin-top:8px}#box{display:inline-block;width:16px;height:16px;border:1px solid #333;cursor:pointer}</style>\n<form><input type=\"email\" value=\"valid@example.com\"><div id=\"row\"><span id=\"box\" data-clicks=\"0\"></span><span id=\"legal\">I agree to the Terms of Service</span></div><button type=\"button\">Login</button></form>\n<script>document.querySelector('#box').addEventListener('click',e=>{e.currentTarget.dataset.clicks=String(Number(e.currentTarget.dataset.clicks||0)+1);});</script>\n""",encoding='utf-8')

replace_once(
    'tests/e2e-extension.mjs',
    "      '/positive-login.html':'positive-login.html','/terse-validity.html':'terse-validity.html','/marketing-negative.html':'marketing-negative.html','/fragmented-risk.html':'fragmented-risk.html','/footer-noise.html':'footer-noise.html','/trae-classless.html':'trae-classless.html','/dynamic.html':'dynamic.html','/iframe-parent.html':'iframe-parent.html','/iframe-child.html':'iframe-child.html','/closed-shadow.html':'closed-shadow.html'",
    "      '/positive-login.html':'positive-login.html','/terse-validity.html':'terse-validity.html','/marketing-negative.html':'marketing-negative.html','/fragmented-risk.html':'fragmented-risk.html','/footer-noise.html':'footer-noise.html','/trae-classless.html':'trae-classless.html','/mixed-control.html':'mixed-control.html','/classless-unknown-one-shot.html':'classless-unknown-one-shot.html','/dynamic.html':'dynamic.html','/iframe-parent.html':'iframe-parent.html','/iframe-child.html':'iframe-child.html','/closed-shadow.html':'closed-shadow.html'"
)
replace_once(
    'tests/e2e-extension.mjs',
    "  await gotoActive(page,`${base}/terse-validity.html`); await waitUnchecked(page,'#agree',300);",
    "  await gotoActive(page,`${base}/mixed-control.html`);\n  await new Promise(resolve=>setTimeout(resolve,450));\n  assert.deepEqual(await page.$eval('#agree',el=>({state:el.getAttribute('aria-checked'),clicks:Number(el.dataset.clicks||0)})),{state:'mixed',clicks:0});\n\n  await gotoActive(page,`${base}/classless-unknown-one-shot.html`);\n  await page.waitForFunction(()=>Number(document.querySelector('#box')?.dataset.clicks||0)===1,{timeout:3000});\n  await new Promise(resolve=>setTimeout(resolve,2350));\n  await page.$eval('#legal',el=>{el.textContent='I have read and agree to the Terms of Service';});\n  await new Promise(resolve=>setTimeout(resolve,450));\n  assert.equal(await page.$eval('#box',el=>Number(el.dataset.clicks||0)),1,'unknown-state classless control must remain one-shot after cooldown');\n\n  await gotoActive(page,`${base}/terse-validity.html`); await waitUnchecked(page,'#agree',300);"
)

# v8 -> v9 real update transition expectations.
replace_once('tests/e2e-update.mjs', "assert.equal(JSON.parse(fs.readFileSync(path.join(active,'manifest.json'),'utf8')).version,'7.0.0');", "assert.equal(JSON.parse(fs.readFileSync(path.join(active,'manifest.json'),'utf8')).version,'8.0.0');")
replace_all('tests/e2e-update.mjs', 'install v7 unpacked', 'install v8 unpacked')
replace_once('tests/e2e-update.mjs', "assert.equal(ext.version,'7.0.0');", "assert.equal(ext.version,'8.0.0');")
replace_once('tests/e2e-update.mjs', "assert.equal(JSON.parse(fs.readFileSync(path.join(active,'manifest.json'),'utf8')).version,'8.0.0');", "assert.equal(JSON.parse(fs.readFileSync(path.join(active,'manifest.json'),'utf8')).version,'9.0.0');")
replace_all('tests/e2e-update.mjs', 'reload same unpacked path as v8', 'reload same unpacked path as v9')
replace_all('tests/e2e-update.mjs', "version==='8.0.0'", "version==='9.0.0'")
replace_all('tests/e2e-update.mjs', "'final v8 manifest read'),'8.0.0'", "'final v9 manifest read'),'9.0.0'")
replace_all('tests/e2e-update.mjs', "workerVersion:'8.0.0'", "workerVersion:'9.0.0'")

# CI label and current-version docs.
replace_all('.github/workflows/ci.yml', 'Run real unpacked v7-to-v8 update transition', 'Run real unpacked v8-to-v9 update transition')
replace_once(
    'CHANGELOG.md',
    '# Changelog\n\n',
    "# Changelog\n\n## 9.0.0 — 2026-08-08\n\n- Restored the historical UNKNOWN-state invariant: a classless control with no observable checked contract is one-shot for that DOM element, even after the normal click cooldown expires.\n- Treat native `indeterminate` and ARIA `mixed` states as non-authoritative tri-state controls and never auto-toggle them.\n- Fixed Gate→Engine seed consumption so Shadow probing and scoped Engine bootstrap can both reuse the same weakly-owned handoff without retaining detached DOM.\n- Moved Gate/Engine sentinels behind dependency validation so a partial or out-of-order injection cannot permanently poison later retries.\n- Made semantic/risk cores version-refreshable and included `semantic-core.js` in Engine injection dependency closure for safer cross-version worker/content-tier transitions.\n- Bound site-learning identity to Chrome `MessageSender.origin`/`url` rather than a content-provided `message.origin`.\n- Added real unpacked-Chrome regressions for tri-state controls and classless UNKNOWN one-shot behavior, plus static/worker contracts for the recovered invariants.\n\n"
)
replace_once(
    'docs/history.md',
    "| v8 | current | real unpacked-extension E2E, real worker-termination/update recovery, document-lifecycle defense, fair/stale-aware scheduling, native-validity causality, real-world-derived regression corpus, profile-driven Probe optimization |",
    "| v8 | `c273dcd` | real unpacked-extension E2E, real worker-termination/update recovery, document-lifecycle defense, fair/stale-aware scheduling, native-validity causality, real-world-derived regression corpus, profile-driven Probe optimization |\n| v9 | current | recovered historical safety invariants, tri-state refusal, durable one-shot UNKNOWN semantics, seed handoff repair, dependency-safe tier initialization, sender-bound profile identity, cross-version dependency closure |"
)
replace_once(
    'docs/verification/README.md',
    "| v8.0.0 | [v8.md](v8.md) | first release with real unpacked-extension Chrome E2E as a merge gate |",
    "| v8.0.0 | [v8.md](v8.md) | first release with real unpacked-extension Chrome E2E as a merge gate |\n| v9.0.0 | [v9.md](v9.md) | recovered invariant hardening; candidate evidence finalized after release-gating CI |"
)
replace_all('README.md', 'v8 verification includes:', 'v9 verification includes:')
replace_all('README.md', '[v8 verification report](docs/verification/v8.md)', '[v9 verification report](docs/verification/v9.md)')

# Draft report: CI evidence is intentionally left as pending until the PR head is actually green.
Path('docs/verification/v9.md').write_text("""# Auto Agree v9.0.0 — Verification Report\n\nGenerated: 2026-08-08\n\n## Scope\n\nv9 is an invariant-recovery release derived by reconciling the complete v1→v8 engineering record against the live v8 runtime. It targets cases where historical safety/ownership requirements were only partially preserved in v8, plus one Worker trust-boundary issue found during the same adversarial audit.\n\n## Recovered invariants\n\n- UNKNOWN-state classless controls are one-shot for the lifetime of the unresolved DOM element; cooldown expiry alone can never authorize a second toggle.\n- Native indeterminate and `aria-checked=\"mixed\"` controls are tri-state/aggregate state and are not auto-confirmable.\n- Gate→Engine seed handoff is consumed from the global exactly once but remains weakly readable by both Shadow bootstrap and scoped Engine bootstrap.\n- Gate/Engine sentinels are published only after their dependencies are valid, so a partial injection cannot make a later retry a permanent no-op.\n- Engine injection includes the current semantic core, and shared semantic/risk globals may refresh across extension versions while already-running old closures keep their captured prior objects.\n- Profile storage origin is derived from Chrome `MessageSender.origin`/`url`; content-provided origin text is not an authority boundary.\n\n## New regression gates\n\n- real unpacked Chrome: `aria-checked=\"mixed\"` routine Terms control remains untouched;\n- real unpacked Chrome: a classless UNKNOWN control is clicked once, then remains one-shot after the 2.2-second normal cooldown and a later semantic mutation;\n- static contracts: tier sentinel ordering, seed weak handoff, one-shot/mixed state, sender-bound profile identity, cross-version Engine dependency closure;\n- Worker contract: spoofed `message.origin` cannot redirect the persistent profile namespace.\n\n## Release-gating evidence\n\nPending the v9 pull-request CI head. This report must be updated with the exact head SHA, core result, real unpacked-extension E2E result, v8→v9 update-transition result, and final CPU profile before merge.\n\n## Remaining boundary\n\nAn already-open page whose full older Engine tier was activated before an extension update may continue running that old closure until the page lifecycle naturally replaces it. v9 improves dependency refresh for later tier activation and does not inject a second competing Engine into the same document merely to force a hot upgrade. A future live-tier replacement protocol would need an explicit cooperative teardown contract installed by the prior version; it cannot be retroactively imposed on v8 closures without risking duplicate click authorities.\n""",encoding='utf-8')

print('v9 bootstrap patch applied')
