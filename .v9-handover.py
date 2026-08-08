from pathlib import Path


def load(path):
    return Path(path).read_text(encoding='utf-8')


def save(path, text):
    Path(path).write_text(text, encoding='utf-8')


def rep(path, old, new, count=1):
    text = load(path)
    actual = text.count(old)
    if actual != count:
        raise SystemExit(f'{path}: anchor count {actual} != {count}: {old[:120]!r}')
    save(path, text.replace(old, new, count))


Path('extension/handover-guard.js').write_text(r"""(() => {
  'use strict';
  const VERSION = '9.0.0';
  if (globalThis.__AUTO_AGREE_HANDOVER_GUARD__?.version === VERSION) return;

  // This guard exists only on pages that survive an extension update. Old isolated worlds can
  // remain observable and executable after the new extension generation is installed. Current
  // Engine clicks receive a synchronous one-shot authorization; stale generations do not.
  const authorized = new WeakSet();
  const LEGAL = /(?:terms?(?:\s+of\s+(?:service|use))?|privacy|agreement|eula|协议|協議|条款|條款|隐私|隱私|利用規約|プライバシー|약관|개인정보|услов|конфиденц|الشروط|الخصوصية)/iu;
  const ASSENT = /(?:agree|accept|consent|同意|接受|동의|同意する|соглас|أوافق)/iu;
  const REQUIRED = /(?:required|mandatory|must\s+(?:agree|accept)|please\s+(?:agree|accept)|必须|必須|需(?:要)?同意|请先(?:阅读|閱讀)?(?:并|並)?同意)/iu;
  const CONTROL = 'input[type="checkbox"],input[type="radio"],[role="checkbox"],[role="radio"],[role="switch"],[aria-checked]';
  const CUSTOM = new Set(['sl-checkbox','ion-checkbox','md-checkbox','mat-checkbox','fluent-checkbox','vaadin-checkbox','ui5-checkbox','calcite-checkbox','lightning-input']);

  function composedParent(el) {
    if (!(el instanceof Element)) return null;
    if (el.assignedSlot instanceof Element) return el.assignedSlot;
    if (el.parentElement) return el.parentElement;
    const root = el.getRootNode?.();
    return root instanceof ShadowRoot && root.host instanceof Element ? root.host : null;
  }

  function boundedText(root, maxNodes = 48, maxChars = 900) {
    if (!root) return '';
    const parts = [];
    let chars = 0, nodes = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node;
    while (nodes++ < maxNodes && chars < maxChars && (node = walker.nextNode())) {
      let value = '';
      if (node.nodeType === Node.TEXT_NODE) value = node.data || '';
      else if (node instanceof Element) {
        if (/^(?:script|style|noscript|template)$/i.test(node.localName)) continue;
        value = `${node.getAttribute('aria-label') || ''} ${node.getAttribute('title') || ''}`;
      }
      value = String(value).replace(/\s+/gu, ' ').trim();
      if (!value) continue;
      const left = maxChars - chars;
      const part = value.slice(0, left);
      parts.push(part);
      chars += part.length + 1;
    }
    return parts.join(' ').slice(0, maxChars);
  }

  function ownText(el) {
    if (!(el instanceof Element)) return '';
    return `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''} ${el.getAttribute('name') || ''}`.slice(0, 360);
  }

  function isControl(el) {
    if (!(el instanceof Element)) return false;
    try { if (el.matches(CONTROL)) return true; } catch (_) {}
    if (CUSTOM.has(el.localName)) return true;
    const cls = typeof el.className === 'string' ? el.className : el.getAttribute('class') || '';
    return cls.length <= 500 && /(?:checkbox|check-box|form-check-input|check_control|check-control)/i.test(cls);
  }

  function shadowText(host) {
    if (!(host instanceof HTMLElement)) return '';
    let root = host.shadowRoot;
    if (!root && chrome.dom?.openOrClosedShadowRoot) {
      try { root = chrome.dom.openOrClosedShadowRoot(host); } catch (_) {}
    }
    return root instanceof ShadowRoot ? boundedText(root, 40, 640) : '';
  }

  function candidateNodes(event) {
    const out = [];
    const seen = new WeakSet();
    const add = node => {
      if (!(node instanceof Element) || seen.has(node)) return;
      seen.add(node);
      out.push(node);
    };
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    for (const node of path.slice(0, 10)) add(node);
    let p = out[0] || (event.target instanceof Element ? event.target : null);
    for (let i = 0; i < 7 && p instanceof Element; i++, p = composedParent(p)) add(p);
    return out;
  }

  function consumeAuthorization(nodes) {
    let allowed = false;
    for (const node of nodes) if (authorized.has(node)) allowed = true;
    if (!allowed) return false;
    for (const node of nodes) authorized.delete(node);
    return true;
  }

  function agreementLike(nodes) {
    let hasControl = false;
    const parts = [];
    let chars = 0;
    for (const node of nodes.slice(0, 10)) {
      hasControl ||= isControl(node);
      const values = [ownText(node), boundedText(node, 18, 260), shadowText(node)];
      for (const value of values) {
        if (!value || chars >= 1200) continue;
        const part = value.slice(0, 1200 - chars);
        parts.push(part);
        chars += part.length + 1;
      }
      if (chars >= 1200) break;
    }
    const text = parts.join(' ');
    return LEGAL.test(text) && (hasControl || ASSENT.test(text) || REQUIRED.test(text));
  }

  function authorize(el) {
    let node = el;
    for (let i = 0; i < 10 && node instanceof Element; i++, node = composedParent(node)) authorized.add(node);
  }

  function onClick(event) {
    if (event.isTrusted) return;
    const nodes = candidateNodes(event);
    if (!nodes.length) return;
    if (consumeAuthorization(nodes)) return;
    if (!agreementLike(nodes)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
  }

  addEventListener('click', onClick, true);
  globalThis.__AUTO_AGREE_HANDOVER_GUARD__ = Object.freeze({ version: VERSION, authorize });
})();
""", encoding='utf-8')

# Install the current-generation firewall before the Probe in every surviving update frame, at a
# higher scheduling priority than ordinary Gate/Engine work.
rep(
    'extension/worker.js',
    "        scheduleInjection({ tabId, allFrames: true }, ['bootstrap.js'], 0)",
    "        scheduleInjection({ tabId, allFrames: true }, ['handover-guard.js', 'bootstrap.js'], 3)"
)

# Every current Engine click must be explicitly authorized. Authorization is synchronous and
# consumed by the capture-phase guard before page handlers/default actions run.
rep(
    'extension/engine.js',
    "  function commitClick(s, target) {\n    if (!(target instanceof HTMLElement) || target.closest?.('a[href]')) return false;",
    "  function authorizeHandoverClick(target) {\n    try { globalThis.__AUTO_AGREE_HANDOVER_GUARD__?.authorize?.(target); } catch (_) {}\n  }\n\n  function commitClick(s, target) {\n    if (!(target instanceof HTMLElement) || target.closest?.('a[href]')) return false;"
)
rep(
    'extension/engine.js',
    "    const check = armVerifier(s, before, 0);\n    try { target.click(); } catch (_) { oneShotUnknown.delete(s.control); stopVerifier(s.control); return false; }",
    "    const check = armVerifier(s, before, 0);\n    authorizeHandoverClick(target);\n    try { target.click(); } catch (_) { oneShotUnknown.delete(s.control); stopVerifier(s.control); return false; }"
)
rep(
    'extension/engine.js',
    "          const retryVerifier = armVerifier(fresh, fresh.state, 1);\n          try { target.click(); } catch (_) { stopVerifier(fresh.control); return; }",
    "          const retryVerifier = armVerifier(fresh, fresh.state, 1);\n          authorizeHandoverClick(target);\n          try { target.click(); } catch (_) { stopVerifier(fresh.control); return; }"
)

# Make the real-browser world diagnostic expose the handover generation separately from Engine.
rep(
    'tests/e2e-isolated-worlds.mjs',
    "            probe: globalThis.__AUTO_AGREE_PROBE__ || null,\n            semantic:",
    "            probe: globalThis.__AUTO_AGREE_PROBE__ || null,\n            handover: globalThis.__AUTO_AGREE_HANDOVER_GUARD__?.version || null,\n            semantic:"
)
rep(
    'tests/e2e-isolated-worlds.mjs',
    "        if (value && (value.probe || value.semantic || value.gate || value.risk || value.engine)) {",
    "        if (value && (value.probe || value.handover || value.semantic || value.gate || value.risk || value.engine)) {"
)

# Update transition must prove the firewall is physically installed before exercising post-update
# behavior, then prove that legacy v8 mixed-state clicks are blocked while v9-authorized routine
# clicks still pass.
rep(
    'tests/e2e-update.mjs',
    "    assert.equal(await bounded(worker.evaluate(()=>chrome.runtime.getManifest().version),800,'final v9 manifest read'),'9.0.0');\n\n    await dormantPage.bringToFront();",
    "    assert.equal(await bounded(worker.evaluate(()=>chrome.runtime.getManifest().version),800,'final v9 manifest read'),'9.0.0');\n\n    const dormantHandover=await poll(async()=>{\n      const worlds=await extensionWorldSentinels(dormantPage);\n      return worlds.some(world=>world.handover==='9.0.0')?worlds:null;\n    },5000,60);\n    const activeHandover=await poll(async()=>{\n      const worlds=await extensionWorldSentinels(activePage);\n      return worlds.some(world=>world.handover==='9.0.0')?worlds:null;\n    },5000,60);\n    assert.ok(dormantHandover.some(world=>world.handover==='9.0.0'));\n    assert.ok(activeHandover.some(world=>world.handover==='9.0.0'));\n\n    await dormantPage.bringToFront();"
)
rep(
    'tests/e2e-update.mjs',
    "      activeOldSentinelVisible:oldSentinelVisible,\n      activeCurrentSentinelVisible:currentSentinelVisible,",
    "      handoverGuard:'9.0.0',\n      activeOldSentinelVisible:oldSentinelVisible,\n      activeCurrentSentinelVisible:currentSentinelVisible,"
)

# Deterministic contracts: the handover guard is production code, update rehydration must inject it
# first, and current Engine must authorize both first and retry clicks.
rep(
    'tests/static-contract.mjs',
    "const files=['bootstrap.js','semantic-core.js','risk-core.js','gate.js','engine.js','worker.js'];",
    "const files=['bootstrap.js','handover-guard.js','semantic-core.js','risk-core.js','gate.js','engine.js','worker.js'];"
)
rep(
    'tests/static-contract.mjs',
    "assert.match(worker,/profileOriginForSender/);",
    "assert.match(worker,/profileOriginForSender/);\nassert.match(worker,/handover-guard\\.js/);\nassert.match(engine,/authorizeHandoverClick/);"
)
rep(
    'tests/worker-restart.mjs',
    "assert.ok(c.calls.some(x=>x.files?.[0]==='bootstrap.js'&&x.target?.allFrames===true));",
    "assert.ok(c.calls.some(x=>JSON.stringify(x.files)===JSON.stringify(['handover-guard.js','bootstrap.js'])&&x.target?.allFrames===true));"
)

# Current docs must reflect the actual cross-generation mechanism rather than the disproven
# assumption that an old Engine disappears or remains the sole authority by itself.
rep(
    'docs/architecture.md',
    "The bootstrap sentinel prevents a second Probe authority in the same document. A dormant old Probe can still talk to the new Worker; Engine activation refreshes the current semantic dependency before loading current Risk/Engine code. If an old Engine was already active before update, v9 deliberately does not install a competing Engine beside it; the old closure remains authoritative until page replacement.",
    "The bootstrap sentinel prevents duplicate current-generation Probe initialization. Real Chrome testing showed that an old isolated-world Engine can remain both observable and executable after extension update while a new isolated world is also created. v9 therefore injects `handover-guard.js` before the Probe into every surviving update frame. The guard blocks untrusted agreement-like clicks unless the current Engine synchronously authorizes that exact DOM target/ancestor chain for one click. Old generations cannot access the new isolated world's authorization set, so stale automatic clicks are vetoed without blocking trusted user clicks."
)
rep(
    'docs/architecture.md',
    "Probe/Gate handoff messages and profile writes are idempotently replayable after unexpected worker loss. Profile storage identity is derived from Chrome `MessageSender.origin`/`url`, not from message payload text.",
    "Probe/Gate handoff messages and profile writes are idempotently replayable after unexpected worker loss. Profile storage identity is derived from Chrome `MessageSender.origin`/`url`, not from message payload text. Update handover injections run at elevated scheduler priority so the cross-generation click firewall is established before ordinary post-update tier work whenever the update rehydration sweep reaches that frame."
)
rep(
    'docs/testing.md',
    "- v8 → v9 unpacked update with a dormant v8 Probe handing into v9 tiers and an already-active v8 Engine continuing as the sole click authority, without reloading either page;",
    "- v8 → v9 unpacked update with a dormant v8 Probe handing into v9 tiers and an already-active v8 Engine world surviving beside v9, with the v9 handover firewall required to block legacy mixed-state clicks while allowing exactly one current-authorized routine click, without reloading either page;"
)
rep(
    'docs/testing.md',
    "An extension update can replace the Worker while already-open pages still exist. v8 introduced update rehydration; v9 explicitly tests both safe modes: a dormant old Probe may hand off into current Gate/Engine dependencies, while an already-active old Engine remains the sole click authority until page replacement. New code must never create a competing blind toggler in the same document.",
    "An extension update can replace the Worker while already-open pages still exist. v8 introduced update rehydration. Real v8→v9 testing proved that Chrome can retain an executable old Engine isolated world while creating the new generation. v9 therefore establishes a generation handover firewall first: trusted user clicks always pass, current Engine clicks require one-shot authorization, and stale-generation synthetic agreement clicks are blocked. The update gate uses a mixed-state discriminator that v8 would click and v9 must refuse, so sentinel coexistence cannot be mistaken for safety."
)
rep(
    'docs/security-model.md',
    "On update/reload, the Worker rehydrates `bootstrap.js` into already-open tabs with bounded scheduling. Dormant old Probes may hand off to current dependencies; already-active old Engines are left as the sole click authority rather than hot-installing a competing Engine. The extension does not request the `tabs` permission: Chrome's Tabs API is available without it for basic tab operations, and the existing `<all_urls>` host permission supplies the host access needed for injection.",
    "On update/reload, the Worker rehydrates `handover-guard.js` + `bootstrap.js` into already-open tabs with bounded high-priority scheduling. Dormant old Probes may hand off to current dependencies. If an old Engine isolated world survives, it cannot obtain the new generation's one-shot click authorization; untrusted agreement-like clicks from that stale world are canceled by the handover guard, while trusted user clicks remain untouched. The extension does not request the `tabs` permission: Chrome's Tabs API is available without it for basic tab operations, and the existing `<all_urls>` host permission supplies the host access needed for injection."
)
rep(
    'extension/README.md',
    "5. On extension update/reload, Worker uses a persisted session marker and bounded `tabs.query()` + `scripting.executeScript()` bootstrap rehydration for already-open tabs. No `tabs` permission is requested because `<all_urls>` host access already covers the required tab interaction.",
    "5. On extension update/reload, Worker uses a persisted session marker and high-priority bounded `tabs.query()` + `scripting.executeScript()` rehydration to inject `handover-guard.js` before `bootstrap.js` in already-open tabs. Current Engine clicks receive one-shot authorization; stale-generation synthetic agreement clicks are vetoed. No `tabs` permission is requested because `<all_urls>` host access already covers the required tab interaction."
)

print('v9 handover firewall patch applied')
