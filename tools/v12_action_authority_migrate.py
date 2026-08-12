from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one exact match, found {count}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


# Engine owns evidence/policy/verifier; ActionAuthority owns only the action protocol.
replace_once(
    'extension/engine.js',
    "  const PROFILE = globalThis.__AUTO_AGREE_PROFILE_CORE__;\n  const DOM = globalThis.__AUTO_AGREE_DOM_CORE__;\n  const RISK = globalThis.__AUTO_AGREE_RISK__;\n  if (!CORE || CORE.version !== VERSION || !POLICY || POLICY.version !== VERSION || !PROFILE || !DOM || DOM.version !== VERSION || !RISK || RISK.version !== VERSION) return;",
    "  const PROFILE = globalThis.__AUTO_AGREE_PROFILE_CORE__;\n  const DOM = globalThis.__AUTO_AGREE_DOM_CORE__;\n  const ACTION = globalThis.__AUTO_AGREE_ACTION_AUTHORITY__;\n  const RISK = globalThis.__AUTO_AGREE_RISK__;\n  if (!CORE || CORE.version !== VERSION || !POLICY || POLICY.version !== VERSION || !PROFILE || !DOM || DOM.version !== VERSION || !ACTION || ACTION.version !== VERSION || !RISK || RISK.version !== VERSION) return;"
)
replace_once(
    'extension/engine.js',
    "          const retryVerifier = armVerifier(fresh, fresh.state, 1);\n          authorizeHandoverClick(target);\n          try { target.click(); } catch (_) { stopVerifier(fresh.control); return; }\n          clickMemo.set(fresh.control, { time: performance.now(), succeeded: false, retry: true });",
    "          const retryVerifier = armVerifier(fresh, fresh.state, 1);\n          if (!ACTION.attemptClick(target)) { stopVerifier(fresh.control); return; }\n          clickMemo.set(fresh.control, { time: performance.now(), succeeded: false, retry: true });"
)
replace_once(
    'extension/engine.js',
    "  function authorizeHandoverClick(target) {\n    try { globalThis.__AUTO_AGREE_HANDOVER_GUARD__?.authorize?.(target); } catch (_) {}\n  }\n\n",
    ""
)
replace_once(
    'extension/engine.js',
    "    const check = armVerifier(s, before, 0);\n    authorizeHandoverClick(target);\n    try { target.click(); } catch (_) { oneShotUnknown.delete(s.control); stopVerifier(s.control); return false; }\n    clickMemo.set(s.control, { time: performance.now(), succeeded: false });",
    "    const check = armVerifier(s, before, 0);\n    if (!ACTION.attemptClick(target)) { oneShotUnknown.delete(s.control); stopVerifier(s.control); return false; }\n    clickMemo.set(s.control, { time: performance.now(), succeeded: false });"
)

# Only Engine-capable injections need the action facade; update protection itself remains lease+guard.
replace_once(
    'extension/worker.js',
    "['runtime-kernel.js', 'generation-lease.js', 'semantic-core.js', 'dom-core.js', 'handover-guard.js', 'decision-core.js', 'profile-core.js', 'risk-core.js', 'engine.js']",
    "['runtime-kernel.js', 'generation-lease.js', 'semantic-core.js', 'dom-core.js', 'handover-guard.js', 'action-authority.js', 'decision-core.js', 'profile-core.js', 'risk-core.js', 'engine.js']"
)
replace_once(
    'tests/worker-contract.mjs',
    "['runtime-kernel.js','generation-lease.js','semantic-core.js','dom-core.js','handover-guard.js','decision-core.js','profile-core.js','risk-core.js','engine.js']",
    "['runtime-kernel.js','generation-lease.js','semantic-core.js','dom-core.js','handover-guard.js','action-authority.js','decision-core.js','profile-core.js','risk-core.js','engine.js']"
)

# Runtime generation/package closure includes the new isolated-world module.
replace_once(
    'tests/version-contract.mjs',
    "const isolatedModules = ['bootstrap.js','decision-core.js','dom-core.js','engine.js','gate.js','generation-lease.js','handover-guard.js','risk-core.js','semantic-core.js'];",
    "const isolatedModules = ['action-authority.js','bootstrap.js','decision-core.js','dom-core.js','engine.js','gate.js','generation-lease.js','handover-guard.js','risk-core.js','semantic-core.js'];"
)
replace_once(
    'tests/version-contract.mjs',
    "['bootstrap.js','decision-core.js','dom-core.js','engine.js','gate.js','generation-lease.js','handover-guard.js','profile-core.js','risk-core.js','runtime-kernel.js','scheduler-core.js','semantic-core.js','worker.js']",
    "['action-authority.js','bootstrap.js','decision-core.js','dom-core.js','engine.js','gate.js','generation-lease.js','handover-guard.js','profile-core.js','risk-core.js','runtime-kernel.js','scheduler-core.js','semantic-core.js','worker.js']"
)

# Permanent static contract: one action entry point, two independent security dependencies.
replace_once(
    'tests/static-contract.mjs',
    r"assert.match(worker,/\['runtime-kernel\.js', 'generation-lease\.js', 'semantic-core\.js', 'dom-core\.js', 'handover-guard\.js', 'decision-core\.js', 'profile-core\.js', 'risk-core\.js', 'engine\.js'\]/,'every Engine-capable world must carry lease, DomCore, policy, fresh ProfileCore and handover guard');",
    r"assert.match(worker,/\['runtime-kernel\.js', 'generation-lease\.js', 'semantic-core\.js', 'dom-core\.js', 'handover-guard\.js', 'action-authority\.js', 'decision-core\.js', 'profile-core\.js', 'risk-core\.js', 'engine\.js'\]/,'every Engine-capable world must carry lease, DomCore, handover guard and ActionAuthority before policy/Engine');"
)
replace_once(
    'tests/static-contract.mjs',
    "const decision=fs.readFileSync(path.join(root,'decision-core.js'),'utf8');",
    "const action=fs.readFileSync(path.join(root,'action-authority.js'),'utf8');\nassert.match(action,/__AUTO_AGREE_GENERATION_LEASE__/,'ActionAuthority must consume the generation lease');\nassert.match(action,/__AUTO_AGREE_HANDOVER_GUARD__/,'ActionAuthority must consume the handover guard');\nassert.match(action,/function attemptClick\\s*\\(/,'ActionAuthority must own the one automated click protocol');\nassert.ok(action.indexOf('lease.current()') < action.indexOf('guard.authorize(target)') && action.indexOf('guard.authorize(target)') < action.indexOf('target.click()'),'action protocol order must be generation -> guard -> dispatch');\nassert.equal(/Decision|severityFor|assessText|createTreeWalker|querySelectorAll/.test(action),false,'ActionAuthority must not absorb policy, semantics or discovery');\n\nconst decision=fs.readFileSync(path.join(root,'decision-core.js'),'utf8');"
)
replace_once(
    'tests/static-contract.mjs',
    "assert.match(engine,/authorizeHandoverClick/);assert.match(engine,/__AUTO_AGREE_DECISION__/,'Engine must consume the pure decision authority');",
    "assert.match(engine,/const ACTION = globalThis\\.__AUTO_AGREE_ACTION_AUTHORITY__/,'Engine must consume the one action protocol authority');\nassert.match(engine,/ACTION\\.attemptClick\\(target\\)/,'Engine initial/retry actions must delegate to ActionAuthority');\nassert.equal(/authorizeHandoverClick|target\\.click\\s*\\(/.test(engine),false,'Engine must not retain a second authorization/click protocol');\nassert.match(engine,/__AUTO_AGREE_DECISION__/,'Engine must consume the pure decision authority');"
)
replace_once(
    'tests/static-contract.mjs',
    "const engineDeps = 'if (!CORE || CORE.version !== VERSION || !POLICY || POLICY.version !== VERSION || !PROFILE || !DOM || DOM.version !== VERSION || !RISK || RISK.version !== VERSION) return;';",
    "const engineDeps = 'if (!CORE || CORE.version !== VERSION || !POLICY || POLICY.version !== VERSION || !PROFILE || !DOM || DOM.version !== VERSION || !ACTION || ACTION.version !== VERSION || !RISK || RISK.version !== VERSION) return;';"
)

# Browser world diagnostics expose the facade without making diagnostics a correctness oracle.
replace_once(
    'tests/e2e-isolated-worlds.mjs',
    "            handover: globalThis.__AUTO_AGREE_HANDOVER_GUARD__?.version || null,\n            semantic:",
    "            handover: globalThis.__AUTO_AGREE_HANDOVER_GUARD__?.version || null,\n            action: globalThis.__AUTO_AGREE_ACTION_AUTHORITY__?.version || null,\n            semantic:"
)
replace_once(
    'tests/e2e-isolated-worlds.mjs',
    "if (value && (value.lease || value.probe || value.handover || value.semantic || value.gate || value.risk || value.engine))",
    "if (value && (value.lease || value.probe || value.handover || value.action || value.semantic || value.gate || value.risk || value.engine))"
)
replace_once(
    'tests/e2e-authorize-rejection.mjs',
    "      return worlds.find(w => w.engine === VERSION && w.handover === VERSION) || null;",
    "      return worlds.find(w => w.engine === VERSION && w.handover === VERSION && w.action === VERSION) || null;"
)
replace_once(
    'tests/e2e-authorize-rejection.mjs',
    "    // Replace only the public API object used by Engine. The original handover-guard closure and\n    // capture listener remain installed. This forces Engine's authorize call to return false\n    // without populating the guard's private authorized/rejected sets, so any fail-closed result\n    // must come from the actual event boundary rather than the API return value being inspected.",
    "    // Replace only the public Guard API resolved by ActionAuthority. The original guard capture\n    // listener remains installed, but the facade must now honor authorize=false before dispatching\n    // any click. This proves the explicit protocol while the listener remains defense in depth."
)
replace_once(
    'tests/e2e-authorize-rejection.mjs',
    "    // Allow the verifier's bounded retry window to elapse. Even if Engine retries once, the\n    // original guard listener must cancel every unauthorized synthetic agreement click.",
    "    // Allow the old verifier/retry window to elapse. A rejected ActionAuthority attempt must\n    // not create DOM effect; any later rediscovery must remain equally fail-closed."
)

# Deterministic gate for the facade.
replace_once(
    'package.json',
    'node tests/generation-lease.mjs && node tests/language-parity.mjs',
    'node tests/generation-lease.mjs && node tests/action-authority.mjs && node tests/language-parity.mjs'
)

print('v12-action-authority-migrate: PASS')
