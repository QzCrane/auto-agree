(() => {
  'use strict';
  const VERSION = '10.0.0';
  const MAX_ROW_TEXT = 1400;
  const MAX_CONTEXT_TEXT = 2200;
  const MAX_PENDING_VISIBILITY = 192;
  const CLICK_COOLDOWN_MS = 2200;
  const SYNC_BUDGET_MS = 2.2;
  const BACKGROUND_BUDGET_MS = 4.0;
  const FLUSH_BUDGET_MS = 2.4;
  const CACHE_TTL_MS = 180 * 24 * 60 * 60 * 1000;
  const MAX_BATCH_JOBS = 8;
  const MAX_ROOT_BATCHES = 8;
  const MAX_WALK_JOBS = 12;
  const MAX_SHADOW_JOBS = 8;
  const PROFILE_MAX_FLOWS = 8;
  const PROFILE_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;
  const ROOT_BATCH_TTL_MS = 3000;
  const BATCH_JOB_TTL_MS = 3000;

  const CORE = globalThis.__AUTO_AGREE_SEMANTIC__;
  const RISK = globalThis.__AUTO_AGREE_RISK__;
  if (!CORE || CORE.version !== VERSION || !RISK || RISK.version !== VERSION) return;
  if (globalThis.__AUTO_AGREE_ENGINE__) return;
  globalThis.__AUTO_AGREE_ENGINE__ = VERSION;
  const { normalize, joinNormalized, compactSemantic, hasNonLatin, assessText, fastSemantic } = CORE;
  const { containsNegative, containsAttestation, severityFor, SEVERITY } = RISK;
  const { LEGAL, ASSENT, READ_WORD, REQUIRED, VALIDATION, AUTH, PROCEED, FAST_TEXT, CREDENTIAL, COMPACT_LEGAL, COMPACT_ASSENT } = CORE.patterns;
  const { TRANSACTION_ACTION } = RISK.patterns;

  const CLASS_CHECK = /(?:checkbox|check-box|form-check-input|check_control|check-control)/i;
  const CHECKED_CLASS = /(?:^|\s)(?:is-checked|checked|checkbox-checked|semi-checkbox-checked|ant-checkbox-checked|ant-checkbox-wrapper-checked|arco-checkbox-checked|n-checkbox--checked|Mui-checked|p-highlight)(?:\s|$)/i;
  const CUSTOM_CHECK_TAGS = new Set(['sl-checkbox','ion-checkbox','md-checkbox','mat-checkbox','fluent-checkbox','vaadin-checkbox','ui5-checkbox','calcite-checkbox','lightning-input']);
  const KNOWN_CONTROL_SELECTOR = 'input[type="checkbox"],input[type="radio"],[role="checkbox"],[role="radio"],[role="switch"],[aria-checked],sl-checkbox,ion-checkbox,md-checkbox,mat-checkbox,fluent-checkbox,vaadin-checkbox,ui5-checkbox,calcite-checkbox,[class*="checkbox" i],[class*="check-box" i]';

  let observedRoots = new WeakSet();
  let observedContexts = new WeakSet();
  let observedContextCount = 0;
  let probedShadowHosts = new WeakSet();
  const knownShadowHostEntries = new Set();
  const knownShadowHostEntry = new WeakMap();
  const slotHandlers = new WeakMap();
  let candidateMemo = new WeakMap();
  let clickMemo = new WeakMap();
  const clickVerifiers = new WeakMap();
  const activeVerifiers = new Set();
  const deferredClicks = new WeakSet();
  const oneShotUnknown = new WeakSet();
  // Hidden controls can outlive timers in background/frozen pages. The registry owns only
  // lightweight entry objects; both the pending control and its blocker are WeakRefs, so the
  // extension never keeps detached UI alive merely because a rescue timer has not fired yet.
  const pendingVisibility = new Set();
  const pendingEntryByElement = new WeakMap();
  let pendingRescueTimer = 0;
  let pendingRescuePhase = 0;
  const contextIndex = new WeakMap();
  const indexedRefs = new WeakMap();
  const relevantControls = new WeakSet();
  const fragmentRowsSeen = new WeakSet();
  const parserDeferredAnchors = new WeakSet();
  const contextCache = new WeakMap();
  const contextEpoch = new WeakMap();
  const contextTxnRefs = new Set();
  const contextTxnRefByKey = new WeakMap();
  let contextTxnScheduled = false;
  let contextTxnGeneration = 0;
  const intentState = new WeakMap();
  const dirtyRoots = new Set();
  const urgentRoots = new Set();
  const rootBatches = [];
  const walkJobs = [];
  const shadowJobs = [];
  const batchJobs = [];
  const walkGeneration = new WeakMap();
  const shadowGeneration = new WeakMap();
  let queuedWalkRoots = new WeakSet();
  let queuedShadowRoots = new WeakSet();
  let flushQueued = false;
  let backgroundQueued = false;
  let backgroundEpoch = 0;
  let broadShadowEnabled = false;
  let meaningfulCandidateSeen = false;
  let initialRescueTimer = 0;
  let siteProfile = null;
  let lifecyclePaused = false;
  let lifecycleGeneration = 0;
  let engineEventsAttached = false;
  let lifecycleEventsAttached = false;

  const discoveryObserver = new MutationObserver(records => onMutations(records, false));
  const contextObserver = new MutationObserver(records => onMutations(records, true));
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(entries => {
    for (const resizeEntry of entries) {
      const blocker = resizeEntry.target;
      if (!(resizeEntry.contentRect.width > 0 || resizeEntry.contentRect.height > 0)) continue;
      const targets = [];
      for (const pending of [...pendingVisibility]) {
        if (pending?.blockerRef?.deref?.() !== blocker) continue;
        const el = pending?.targetRef?.deref?.();
        removePendingEntry(pending);
        if (el instanceof Element && el.isConnected) targets.push(el);
      }
      for (const el of targets) {
        processElement(el, true);
        processAgreementAnchor(el, true);
      }
    }
  }) : null;

  function pushPart(parts, value, budget) {
    if (!value || budget.left <= 0) return;
    const s = normalize(value, budget.left);
    if (!s) return;
    parts.push(s);
    budget.left -= Math.min(budget.left, s.length + 1);
  }

  function boundedText(root, maxChars = MAX_ROW_TEXT, maxNodes = 120) {
    if (!root || maxChars <= 0 || maxNodes <= 0) return '';
    const parts = [];
    const budget = { left: maxChars };
    const stack = [root];
    const seen = new WeakSet();
    let nodes = 0;
    while (stack.length && nodes++ < maxNodes && budget.left > 0) {
      const node = stack.pop();
      if (!(node instanceof Node) || seen.has(node)) continue;
      seen.add(node);
      if (node.nodeType === Node.TEXT_NODE) {
        pushPart(parts, node.data, budget);
        continue;
      }
      if (!(node instanceof Element || node instanceof DocumentFragment || node instanceof Document || node instanceof ShadowRoot)) continue;
      if (node instanceof Element) {
        const tag = node.localName;
        if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'template') continue;
        pushPart(parts, node.getAttribute('aria-label'), budget);
        pushPart(parts, node.getAttribute('title'), budget);
        if (tag === 'input' || tag === 'button') {
          pushPart(parts, node.getAttribute('placeholder'), budget);
          if (tag === 'button') pushPart(parts, node.getAttribute('value'), budget);
        }
        if (node instanceof HTMLSlotElement) {
          let assigned = [];
          try { assigned = node.assignedNodes({ flatten: true }); } catch (_) {}
          if (assigned.length) {
            for (let i = Math.min(assigned.length, maxNodes) - 1; i >= 0 && stack.length < maxNodes * 2; i--) stack.push(assigned[i]);
            continue;
          }
        }
      }
      const children = node.childNodes;
      for (let i = children.length - 1; i >= 0 && stack.length < maxNodes * 2; i--) stack.push(children[i]);
    }
    return normalize(parts.join(' '), maxChars);
  }

  function rootQueryById(el, id) {
    if (!id || !(el instanceof Element)) return null;
    const root = el.getRootNode?.() || document;
    try {
      if (root instanceof Document) return root.getElementById(id);
      return root.querySelector?.(`#${CSS.escape(id)}`) || null;
    } catch (_) { return null; }
  }

  function labelFor(input) {
    if (!(input instanceof HTMLInputElement)) return null;
    if (input.labels?.length) return input.labels[0];
    if (input.id) {
      const root = input.getRootNode?.() || document;
      try {
        const label = root.querySelector?.(`label[for="${CSS.escape(input.id)}"]`);
        if (label instanceof HTMLLabelElement) return label;
      } catch (_) {}
    }
    return input.closest?.('label') || null;
  }

  function accessibleText(el, maxChars = MAX_ROW_TEXT) {
    if (!(el instanceof Element)) return '';
    const parts = [];
    const budget = { left: maxChars };
    pushPart(parts, el.getAttribute('aria-label'), budget);
    pushPart(parts, el.getAttribute('title'), budget);
    pushPart(parts, el.getAttribute('placeholder'), budget);

    for (const attr of ['aria-labelledby', 'aria-describedby']) {
      const ids = (el.getAttribute(attr) || '').trim().split(/\s+/).filter(Boolean).slice(0, 6);
      for (const id of ids) {
        const ref = rootQueryById(el, id);
        if (ref) pushPart(parts, boundedText(ref, Math.min(360, budget.left), 48), budget);
      }
    }

    if (el instanceof HTMLInputElement) {
      const label = labelFor(el);
      if (label) pushPart(parts, boundedText(label, Math.min(600, budget.left), 72), budget);
    }
    pushPart(parts, boundedText(el, budget.left, 120), budget);
    return normalize(parts.join(' '), maxChars);
  }

  function composedParent(el) {
    if (!(el instanceof Element)) return null;
    if (el.assignedSlot instanceof Element) return el.assignedSlot;
    if (el.parentElement) return el.parentElement;
    const root = el.getRootNode?.();
    return root instanceof ShadowRoot && root.host instanceof Element ? root.host : null;
  }

  function ancestorList(el, limit = 9) {
    const out = [];
    let p = el;
    for (let i = 0; i < limit && p instanceof Element; i++, p = composedParent(p)) out.push(p);
    return out;
  }

  function isCheckboxLike(el) {
    if (!(el instanceof Element)) return false;
    const tag = el.localName;
    if (tag === 'input') return /^(checkbox|radio)$/i.test(el.getAttribute('type') || '');
    const role = (el.getAttribute('role') || '').toLowerCase();
    if (role === 'checkbox' || role === 'radio' || role === 'switch') return true;
    if (el.hasAttribute('aria-checked')) return true;
    const state = (el.getAttribute('data-state') || '').toLowerCase();
    if (state === 'checked' || state === 'unchecked' || state === 'on' || state === 'off') return true;
    if (CUSTOM_CHECK_TAGS.has(tag)) return true;
    const cls = typeof el.className === 'string' ? el.className : el.getAttribute('class') || '';
    return cls.length <= 500 && CLASS_CHECK.test(cls);
  }

  function semanticRowInfo(el) {
    if (!(el instanceof Element)) return { row: null, text: '', assessment: assessText('') };
    const input = el instanceof HTMLInputElement ? el : null;
    const start = input ? (labelFor(input) || input) : el;
    let best = { row: start, text: accessibleText(start, MAX_ROW_TEXT), assessment: null, rank: -Infinity };
    best.assessment = assessText(best.text);
    best.rank = best.assessment.score;

    let depth = 0;
    for (const p of ancestorList(start, 7)) {
      const text = p === start ? best.text : accessibleText(p, MAX_ROW_TEXT);
      const assessment = assessText(text);
      const semanticBonus = p.matches?.('label,[role="checkbox"],[role="radio"],[role="switch"]') ? 1.5 : 0;
      const rank = assessment.score + semanticBonus - depth * 0.35;
      if (rank > best.rank) best = { row: p, text, assessment, rank };
      if (assessment.eligible && !assessment.blocked) return { row: p, text, assessment };
      depth++;
    }
    return { row: best.row, text: best.text, assessment: best.assessment };
  }

  function findNativeInput(el, row) {
    if (el instanceof HTMLInputElement && /^(checkbox|radio)$/i.test(el.type)) return el;
    if (!(row instanceof Element)) return null;
    const found = row.querySelector?.('input[type="checkbox"],input[type="radio"]');
    return found instanceof HTMLInputElement ? found : null;
  }

  function contextRoot(el) {
    for (const p of ancestorList(el, 11)) {
      if (p.matches?.('form,dialog,[role="dialog"],[aria-modal="true"]')) return p;
      const cls = typeof p.className === 'string' ? p.className : '';
      const id = p.id || '';
      if (/(?:login|signin|sign-in|signup|sign-up|register|auth|verify|verification|modal|dialog)/i.test(`${cls} ${id}`)) return p;
    }
    return null;
  }

  function boundedElementWalk(root, maxNodes, visit) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let count = 0;
    let node;
    while (count++ < maxNodes && (node = walker.nextNode())) {
      if (visit(node) === false) break;
    }
  }

  function contextKey(el) {
    return contextRoot(el) || document;
  }

  function epochOf(key) { return contextEpoch.get(key) || 0; }

  function bumpContext(node) {
    const el = node instanceof Element ? node : node?.parentElement;
    const key = el ? contextKey(el) : document;
    contextEpoch.set(key, epochOf(key) + 1);
    contextCache.delete(key);
    if (key instanceof Element) registerContext(key);
    return key;
  }

  function commitContextTransaction(generation) {
    if (generation !== lifecycleGeneration || lifecyclePaused) { contextTxnScheduled = false; contextTxnRefs.clear(); return; }
    contextTxnScheduled = false;
    for (const ref of [...contextTxnRefs]) {
      contextTxnRefs.delete(ref);
      const key = ref?.deref?.();
      if (!(key instanceof Node) || (key instanceof Element && !key.isConnected)) continue;
      contextEpoch.set(key, epochOf(key) + 1);
      contextCache.delete(key);
      if (key instanceof Element) registerContext(key);
      processIndexedContext(key instanceof Element ? key : null);
    }
  }

  function markContextDirty(node) {
    const el = node instanceof Element ? node : node?.parentElement;
    const key = el ? contextKey(el) : document;
    let ref = contextTxnRefByKey.get(key);
    if (!ref) { ref = new WeakRef(key); contextTxnRefByKey.set(key, ref); }
    contextTxnRefs.add(ref);
    if (contextTxnScheduled) return key;
    contextTxnScheduled = true;
    const generation = lifecycleGeneration;
    contextTxnGeneration = generation;
    const commit = () => commitContextTransaction(generation);
    if (typeof requestAnimationFrame === 'function' && document.visibilityState === 'visible') requestAnimationFrame(commit);
    else queueMicrotask(commit);
    return key;
  }

  function noteIntent(node, kind) {
    const el = node instanceof Element ? node : node?.parentElement;
    const root = el ? contextKey(el) : document;
    const now = performance.now();
    const prev = intentState.get(root) || { score: 0, ts: now };
    const decay = Math.max(0, 1 - Math.max(0, now - prev.ts) / 8000);
    const weights = { focus: 1, input: 2, proceed: 4, enter: 3 };
    const next = { score: prev.score * decay + (weights[kind] || 0), ts: now };
    intentState.set(root, next);
    if (next.score >= 3) {
      processIndexedContext(root instanceof Element ? root : null);
      if (root instanceof Element) queueRoot(root, true);
    }
    return next;
  }

  function registerContext(root) {
    if (!(root instanceof Element) || observedContexts.has(root)) return;
    observedContexts.add(root);
    observedContextCount++;
    contextEpoch.set(root, epochOf(root));
    try {
      contextObserver.observe(root, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['checked','required','disabled','hidden','role','title','type','name','placeholder','autocomplete','aria-checked','aria-required','aria-disabled','aria-hidden','aria-label','aria-labelledby','aria-describedby','data-state','data-checked']
      });
    } catch (_) {}
  }

  function contextSnapshot(el) {
    const root = contextRoot(el);
    const key = root || document;
    if (root) registerContext(root);
    const epoch = epochOf(key);
    const cached = contextCache.get(key);
    if (cached?.epoch === epoch) return cached.value;

    const rootText = root ? boundedText(root, MAX_CONTEXT_TEXT, 220) : '';
    const text = normalize(`${document.title || ''} ${location.hostname || ''} ${location.pathname || ''} ${rootText}`, MAX_CONTEXT_TEXT);
    const auth = AUTH.test(text);
    const transaction = TRANSACTION_ACTION.test(root ? rootText : text);
    let proceedDisabled = false;
    let credentialInvalid = false;

    if (root) {
      boundedElementWalk(root, 260, node => {
        if (node instanceof HTMLInputElement) {
          const hint = normalize(`${node.type || ''} ${node.name || ''} ${node.placeholder || ''} ${node.autocomplete || ''}`, 260);
          if (CREDENTIAL.test(hint) && !/^(checkbox|radio|submit|button|hidden)$/i.test(node.type || '')) {
            const credentialCritical = node.required || /password|tel|email|otp|code|验证码|驗證碼/i.test(hint);
            if (credentialCritical) {
              const empty = !String(node.value || '').trim();
              const nativeInvalid = !!(node.willValidate && node.validity && !node.validity.valid);
              if (empty || nativeInvalid) credentialInvalid = true;
            }
          }
        }
        if (node.matches?.('button,input[type="submit"],[role="button"]')) {
          const label = accessibleText(node, 220);
          if (PROCEED.test(label) && (node.matches?.(':disabled') || node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true')) proceedDisabled = true;
        }
      });
    }

    const gatingScore = proceedDisabled && !credentialInvalid ? 2 : 0;
    const value = { root, text, auth, transaction, proceedDisabled, credentialInvalid, gatingScore };
    contextCache.set(key, { epoch, value });
    return value;
  }

  function linkEvidence(row) {
    if (!(row instanceof Element)) return 0;
    let hits = 0;
    boundedElementWalk(row, 120, node => {
      if (node.localName !== 'a') return;
      const text = joinNormalized([accessibleText(node, 220), node.getAttribute('href')], 420);
      if (LEGAL.test(text)) hits++;
      if (hits >= 2) return false;
    });
    return hits * 2;
  }

  function readStateRaw(el, row, input) {
    if (input) {
      if (input.indeterminate) return { known: true, checked: false, kind: 'mixed' };
      return { known: true, checked: !!input.checked, kind: 'native' };
    }
    const nodes = [el, row];
    const explicit = row?.querySelector?.('[aria-checked],[data-state],[data-checked]');
    if (explicit) nodes.push(explicit);
    for (const n of nodes) {
      if (!(n instanceof Element)) continue;
      const aria = n.getAttribute('aria-checked');
      if (aria === 'true') return { known: true, checked: true, kind: 'aria' };
      if (aria === 'false') return { known: true, checked: false, kind: 'aria' };
      if (aria === 'mixed') return { known: true, checked: false, kind: 'mixed' };
      const state = (n.getAttribute('data-state') || '').toLowerCase();
      if (state === 'checked' || state === 'on') return { known: true, checked: true, kind: 'data' };
      if (state === 'unchecked' || state === 'off') return { known: true, checked: false, kind: 'data' };
      if (state === 'indeterminate' || state === 'mixed') return { known: true, checked: false, kind: 'mixed' };
      const dc = n.getAttribute('data-checked');
      if (dc === '' || dc === 'true') return { known: true, checked: true, kind: 'data' };
      if (dc === 'false') return { known: true, checked: false, kind: 'data' };
      if (dc === 'indeterminate' || dc === 'mixed') return { known: true, checked: false, kind: 'mixed' };
    }
    for (const n of [el, row, row?.parentElement]) {
      if (!(n instanceof Element)) continue;
      const cls = typeof n.className === 'string' ? n.className : n.getAttribute('class') || '';
      if (CHECKED_CLASS.test(cls)) return { known: true, checked: true, kind: 'class' };
    }
    return { known: false, checked: false, kind: 'unknown' };
  }

  function cheapActive(el) {
    if (!(el instanceof Element) || !el.isConnected) return false;
    let p = el;
    for (let i = 0; i < 10 && p instanceof Element; i++, p = composedParent(p)) {
      if (p.hidden || p.getAttribute('aria-hidden') === 'true' || p.hasAttribute('inert')) return false;
      if (p instanceof HTMLDialogElement && !p.open) return false;
      if (p.localName === 'details' && !p.hasAttribute('open')) {
        const summary = el.closest?.('summary');
        if (!summary) return false;
      }
    }
    return true;
  }

  function visualState(el) {
    if (!cheapActive(el)) return { visible: false, blocker: el };
    if (typeof el.checkVisibility === 'function') {
      try {
        const visible = el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true });
        if (visible) return { visible: true, blocker: null };
      } catch (_) {}
    }
    let p = el;
    for (let i = 0; i < 9 && p instanceof Element; i++, p = composedParent(p)) {
      const style = getComputedStyle(p);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || Number(style.opacity || 1) === 0) {
        return { visible: false, blocker: p };
      }
    }
    return { visible: true, blocker: null };
  }

  function visuallyActive(el) { return visualState(el).visible; }

  function schedulePendingRescue() {
    if (pendingRescueTimer || !pendingVisibility.size) return;
    const delays = [140, 520, 1300];
    const phase = Math.min(pendingRescuePhase, delays.length - 1);
    pendingRescueTimer = setTimeout(() => {
      pendingRescueTimer = 0;
      pendingRescuePhase++;
      recheckPending();
      if (pendingVisibility.size && pendingRescuePhase < delays.length) schedulePendingRescue();
      else if (!pendingVisibility.size) pendingRescuePhase = 0;
    }, delays[phase]);
  }

  function blockerStillUsed(blocker, except = null) {
    if (!(blocker instanceof Element)) return false;
    for (const pending of pendingVisibility) {
      if (pending === except) continue;
      const target = pending?.targetRef?.deref?.();
      if (!(target instanceof Element)) continue;
      if (pending?.blockerRef?.deref?.() === blocker) return true;
    }
    return false;
  }

  function removePendingEntry(entry) {
    if (!entry || !pendingVisibility.delete(entry)) return;
    const el = entry.targetRef?.deref?.();
    if (el instanceof Element) pendingEntryByElement.delete(el);
    const blocker = entry.blockerRef?.deref?.();
    if (blocker instanceof Element && !blockerStillUsed(blocker)) {
      try { resizeObserver?.unobserve(blocker); } catch (_) {}
    }
    if (!pendingVisibility.size) pendingRescuePhase = 0;
  }

  function sweepPendingVisibility() {
    for (const entry of [...pendingVisibility]) {
      const el = entry?.targetRef?.deref?.();
      if (!(el instanceof Element) || !el.isConnected) removePendingEntry(entry);
    }
  }

  function pend(el, blocker = el) {
    if (!(el instanceof Element) || pendingEntryByElement.has(el)) return;
    if (pendingVisibility.size >= MAX_PENDING_VISIBILITY) sweepPendingVisibility();
    if (pendingVisibility.size >= MAX_PENDING_VISIBILITY) return;
    const observed = blocker instanceof Element ? blocker : el;
    const entry = { targetRef: new WeakRef(el), blockerRef: new WeakRef(observed) };
    pendingVisibility.add(entry);
    pendingEntryByElement.set(el, entry);
    try { resizeObserver?.observe(observed); } catch (_) {}
    schedulePendingRescue();
  }

  function unpend(el) {
    if (!(el instanceof Element)) return;
    const entry = pendingEntryByElement.get(el);
    if (entry) removePendingEntry(entry);
  }

  function controlConfidence(el, input) {
    if (input) return 5;
    const role = (el.getAttribute?.('role') || '').toLowerCase();
    if (role === 'checkbox' || role === 'radio' || role === 'switch' || el.hasAttribute?.('aria-checked')) return 5;
    if (CUSTOM_CHECK_TAGS.has(el.localName)) return 4;
    const cls = typeof el.className === 'string' ? el.className : el.getAttribute?.('class') || '';
    if (CLASS_CHECK.test(cls)) return 3;
    return 1;
  }

  function consentSeverity(localText, context) {
    return severityFor(localText, context?.text || '', !!context?.transaction);
  }


  function snapshotCandidate(el) {
    const rowInfo = semanticRowInfo(el);
    const row = rowInfo.row || el;
    const input = findNativeInput(el, row);
    const text = normalize(`${rowInfo.text} ${accessibleText(el, 420)}`, MAX_ROW_TEXT);
    const assessment = assessText(text);
    const context = contextSnapshot(row);
    const links = linkEvidence(row);
    const state = readStateRaw(el, row, input);
    const confidence = controlConfidence(el, input);
    const required = !!(input?.required || input?.getAttribute('aria-required') === 'true' || row.getAttribute?.('aria-required') === 'true' || el.getAttribute?.('aria-required') === 'true');
    const disabled = !!(input?.disabled || el.matches?.(':disabled') || el.hasAttribute?.('disabled') || el.getAttribute?.('aria-disabled') === 'true' || row.getAttribute?.('aria-disabled') === 'true');
    const severity = consentSeverity(text, context);
    return { control: el, row, input, text, assessment, context, links, state, confidence, required, disabled, severity, risky: severity.level >= SEVERITY.OPTIONAL };
  }

  function buildSemanticGraph(s) {
    const a = s.assessment;
    const facts = Object.freeze({
      legal: !!a.legal,
      assent: !!a.assent,
      required: !!(a.required || a.validation || s.required),
      auth: !!s.context.auth,
      transaction: !!s.context.transaction,
      actionGated: s.context.gatingScore > 0,
      legalLinks: s.links,
      controlConfidence: s.confidence,
      severity: s.severity.level
    });
    const nodes = [
      { id: 'control', kind: 'control' },
      { id: 'row', kind: 'semantic-row' },
      { id: 'context', kind: 'context' },
      { id: 'action', kind: 'proceed-action' }
    ];
    const edges = [
      ['control', 'described-by', 'row'],
      ['row', 'contained-in', 'context']
    ];
    if (facts.actionGated || facts.required) edges.push(['control', 'gates', 'action']);
    if (facts.legalLinks) edges.push(['row', 'references-legal', 'context']);
    return Object.freeze({ facts, nodes, edges });
  }

  function decisionFor(s) {
    const graph = buildSemanticGraph(s);
    const f = graph.facts;
    if (s.disabled || s.state.kind === 'mixed' || f.severity >= SEVERITY.OPTIONAL || s.assessment.blocked) return { accept: false, score: -100, severity: s.severity, graph };
    const a = s.assessment;
    let score = a.score + f.legalLinks + s.context.gatingScore + (f.auth ? 2 : 0) + Math.min(f.controlConfidence, 5);
    if (f.required) score += 4;

    const explicitLegalAssent = f.legal && f.assent;
    const explicitMandatoryLegal = f.legal && f.required;
    const terseAuthLegal = f.legal && f.auth && f.controlConfidence >= 4 && (f.legalLinks >= 2 || f.required || f.actionGated);
    const assentWithLegalLinks = f.assent && f.legalLinks >= 2 && f.controlConfidence >= 3;
    const relationalGate = f.legal && (f.assent || f.required) && (f.auth || f.actionGated) && f.controlConfidence >= 3;
    const accept = explicitLegalAssent || explicitMandatoryLegal || terseAuthLegal || assentWithLegalLinks || relationalGate || (a.eligible && score >= 12);
    return { accept, score, severity: s.severity, graph };
  }

  function bucketFor(context) {
    const key = context || document;
    let set = contextIndex.get(key);
    if (!set) { set = new Set(); contextIndex.set(key, set); }
    return set;
  }

  function sweepCandidateBucket(set) {
    for (const ref of [...set]) if (!(ref?.deref?.() instanceof Element)) set.delete(ref);
  }

  function indexCandidate(s) {
    const relevant = s.assessment.legal || s.assessment.assent || s.assessment.required || s.assessment.validation || s.links > 0;
    if (!relevant) return;
    meaningfulCandidateSeen = true;
    relevantControls.add(s.control);
    const set = bucketFor(s.context.root);
    let ref = indexedRefs.get(s.control);
    if (!ref) { ref = new WeakRef(s.control); indexedRefs.set(s.control, ref); }
    set.add(ref);
    if (set.size > 96) sweepCandidateBucket(set);
  }

  function stateFingerprint(s) {
    return `${s.state.known ? 1 : 0}:${s.state.checked ? 1 : 0}:${s.state.kind}:${s.required ? 1 : 0}:${s.assessment.score}:${s.severity.level}:${s.text.slice(0, 220)}`;
  }

  function preferredClickTarget(s) {
    if (s.input) return s.input;
    if (s.control instanceof HTMLElement) return s.control;
    return s.row instanceof HTMLElement ? s.row : null;
  }

  function uniqueSelector(el, root) {
    if (!(el instanceof Element) || !root?.querySelectorAll) return null;
    const esc = CSS.escape;
    const id = el.id;
    if (id && id.length <= 72 && !/[0-9a-f]{10,}|\d{8,}/i.test(id)) {
      const selector = `#${esc(id)}`;
      try { if (root.querySelectorAll(selector).length === 1) return selector; } catch (_) {}
    }
    for (const attr of ['data-testid','data-test','name']) {
      const value = el.getAttribute(attr);
      if (!value || value.length > 100) continue;
      const selector = `${el.localName}[${attr}="${esc(value)}"]`;
      try { if (root.querySelectorAll(selector).length === 1) return selector; } catch (_) {}
    }
    const role = el.getAttribute('role');
    const aria = el.getAttribute('aria-label');
    if (role && aria && aria.length <= 120) {
      const selector = `${el.localName}[role="${esc(role)}"][aria-label="${esc(aria)}"]`;
      try { if (root.querySelectorAll(selector).length === 1) return selector; } catch (_) {}
    }
    return null;
  }

  function locatorFor(el) {
    if (!(el instanceof Element)) return null;
    const hosts = [];
    let root = el.getRootNode?.() || document;
    let targetSelector = uniqueSelector(el, root);
    if (!targetSelector) return null;
    while (root instanceof ShadowRoot) {
      const host = root.host;
      if (!(host instanceof Element)) return null;
      const parentRoot = host.getRootNode?.() || document;
      const hostSelector = uniqueSelector(host, parentRoot);
      if (!hostSelector) return null;
      hosts.unshift(hostSelector);
      root = parentRoot;
    }
    if (!(root instanceof Document)) return null;
    return { hosts, selector: targetSelector };
  }

  function resolveLocator(locator) {
    if (!locator?.selector || !Array.isArray(locator.hosts)) return null;
    let root = document;
    for (const selector of locator.hosts) {
      let host = null;
      try { host = root.querySelector(selector); } catch (_) { return null; }
      if (!(host instanceof HTMLElement)) return null;
      let shadow = host.shadowRoot;
      if (!shadow && chrome.dom?.openOrClosedShadowRoot) {
        try { shadow = chrome.dom.openOrClosedShadowRoot(host); } catch (_) {}
      }
      if (!(shadow instanceof ShadowRoot)) return null;
      root = shadow;
    }
    try { return root.querySelector(locator.selector); } catch (_) { return null; }
  }

  function normalizedPath() {
    return (location.pathname || '/').replace(/\b\d{4,}\b/g, ':n').replace(/[0-9a-f]{12,}/ig, ':id').slice(0, 240);
  }

  function flowFingerprint(s) {
    const root = s?.context?.root;
    const sig = root instanceof Element ? joinNormalized([root.localName, root.id, typeof root.className === 'string' ? root.className : '', root.getAttribute('role')], 220) : 'document';
    return `${normalizedPath()}|${sig}`;
  }

  function behaviorDescriptor(s) {
    return {
      kind: s?.state?.kind || 'unknown',
      severity: Number(s?.severity?.level || 0),
      legal: !!s?.assessment?.legal,
      assent: !!s?.assessment?.assent,
      required: !!s?.required,
      auth: !!s?.context?.auth,
      linkBucket: Math.min(2, Math.floor(Number(s?.links || 0) / 2))
    };
  }

  function descriptorCompatible(stored, live) {
    if (!stored || typeof stored !== 'object') return true;
    if (Number(stored.severity || 0) >= SEVERITY.OPTIONAL) return false;
    if (stored.kind && stored.kind !== 'unknown' && live.kind !== stored.kind) return false;
    if (stored.legal && !live.legal) return false;
    if (stored.required && !live.required && !live.assent) return false;
    if (Number(stored.linkBucket || 0) > Number(live.linkBucket || 0) + 1) return false;
    return true;
  }

  function profileMessage(type, profile = null, attempt = 0) {
    return new Promise(resolve => {
      try {
        chrome.runtime.sendMessage({ type, profile }, response => {
          const failed = !!chrome.runtime.lastError || !response?.ok;
          if (!failed) return resolve(response.profile ?? true);
          if (attempt >= 2 || lifecyclePaused) return resolve(null);
          setTimeout(() => resolve(profileMessage(type, profile, attempt + 1)), 60 * (2 ** attempt));
        });
      } catch (_) {
        if (attempt >= 2 || lifecyclePaused) return resolve(null);
        setTimeout(() => resolve(profileMessage(type, profile, attempt + 1)), 60 * (2 ** attempt));
      }
    });
  }

  function recordSuccess(s) {
    if (!location.origin || location.origin === 'null') return;
    const locator = locatorFor(s.input || s.control);
    if (!locator) return;
    const now = Date.now();
    const fingerprint = flowFingerprint(s);
    const profile = siteProfile && typeof siteProfile === 'object' ? siteProfile : { version: VERSION, flows: [] };
    const flows = Array.isArray(profile.flows) ? profile.flows : [];
    let flow = flows.find(f => f?.fingerprint === fingerprint && JSON.stringify(f.locator) === JSON.stringify(locator));
    if (!flow) {
      flow = { fingerprint, locator, descriptor: behaviorDescriptor(s), successes: 0, failures: 0, ts: 0 };
      flows.unshift(flow);
    }
    const previousFailures = Number(flow.failures || 0);
    flow.descriptor = behaviorDescriptor(s);
    flow.successes = Math.min(100000, Number(flow.successes || 0) + 1);
    flow.failures = 0;
    const shouldPersist = previousFailures > 0 || now - Number(flow.ts || 0) >= PROFILE_REFRESH_MS || profile.version !== VERSION;
    flow.ts = now;
    profile.version = VERSION;
    profile.flows = flows.sort((a,b) => Number(b.ts || 0) - Number(a.ts || 0)).slice(0, PROFILE_MAX_FLOWS);
    siteProfile = profile;
    if (shouldPersist) profileMessage('AUTO_AGREE_PROFILE_PUT', profile);
  }

  function recordCacheFailure(flow) {
    if (!flow || !siteProfile || !Array.isArray(siteProfile.flows)) return;
    const now = Date.now();
    flow.failures = Math.min(1000, Number(flow.failures || 0) + 1);
    flow.ts = now;
    siteProfile.version = VERSION;
    if (flow.failures >= 3) {
      siteProfile.flows = siteProfile.flows.filter(item => item !== flow);
      void profileMessage('AUTO_AGREE_PROFILE_INVALIDATE', { fingerprint: flow.fingerprint, locator: flow.locator });
    } else {
      void profileMessage('AUTO_AGREE_PROFILE_PUT', siteProfile);
    }
  }

  function readFreshState(s) {
    return readStateRaw(s.control, s.row, s.input);
  }

  function stopVerifier(control) {
    const old = clickVerifiers.get(control);
    if (!old) return;
    clickVerifiers.delete(control);
    activeVerifiers.delete(old);
    try { old.observer?.disconnect(); } catch (_) {}
    for (const [target, type, fn] of old.listeners || []) {
      try { target.removeEventListener(type, fn, true); } catch (_) {}
    }
    if (old.timer) clearTimeout(old.timer);
  }

  function armVerifier(s, before, attempt = 0) {
    stopVerifier(s.control);
    const verifier = { observer: null, listeners: [], timer: 0, done: false, controlRef: new WeakRef(s.control), generation: lifecycleGeneration };
    clickVerifiers.set(s.control, verifier);
    activeVerifiers.add(verifier);

    const succeed = () => {
      if (verifier.done) return true;
      const state = readFreshState(s);
      if (!(state.known && state.checked)) return false;
      oneShotUnknown.delete(s.control);
      verifier.done = true;
      stopVerifier(s.control);
      clickMemo.set(s.control, { time: performance.now(), succeeded: true });
      const fresh = snapshotCandidate(s.control);
      recordSuccess(fresh);
      return true;
    };

    const check = () => {
      if (verifier.done) return;
      if (lifecyclePaused || verifier.generation !== lifecycleGeneration) { stopVerifier(s.control); return; }
      succeed();
    };
    const targets = [...new Set([s.control, s.row, s.input].filter(x => x instanceof Element))];
    try {
      verifier.observer = new MutationObserver(check);
      for (const target of targets) verifier.observer.observe(target, { attributes: true, subtree: target === s.row, attributeFilter: ['checked','class','aria-checked','data-state','data-checked'] });
    } catch (_) {}
    for (const target of targets) {
      for (const type of ['input','change']) {
        const fn = () => queueMicrotask(check);
        target.addEventListener(type, fn, true);
        verifier.listeners.push([target, type, fn]);
      }
    }

    queueMicrotask(check);
    requestAnimationFrame?.(() => check());
    verifier.timer = setTimeout(() => {
      if (lifecyclePaused || verifier.generation !== lifecycleGeneration) { stopVerifier(s.control); return; }
      if (succeed() || verifier.done) return;
      stopVerifier(s.control);
      const fresh = snapshotCandidate(s.control);
      // UNKNOWN is never retried. Explicit false state may retry once.
      if (attempt === 0 && before.known && !before.checked && ['native','aria','data'].includes(before.kind) && fresh.state.known && !fresh.state.checked) {
        const target = preferredClickTarget(fresh);
        if (target instanceof HTMLElement && performance.now() - (clickMemo.get(s.control)?.time || 0) >= 100) {
          const retryVerifier = armVerifier(fresh, fresh.state, 1);
          authorizeHandoverClick(target);
          try { target.click(); } catch (_) { stopVerifier(fresh.control); return; }
          clickMemo.set(fresh.control, { time: performance.now(), succeeded: false, retry: true });
          retryVerifier();
        }
      }
    }, attempt === 0 ? 140 : 190);
    return check;
  }

  function authorizeHandoverClick(target) {
    try { globalThis.__AUTO_AGREE_HANDOVER_GUARD__?.authorize?.(target); } catch (_) {}
  }

  function commitClick(s, target) {
    if (!(target instanceof HTMLElement) || target.closest?.('a[href]')) return false;
    const before = s.state;
    if (!before.known) oneShotUnknown.add(s.control);
    const check = armVerifier(s, before, 0);
    authorizeHandoverClick(target);
    try { target.click(); } catch (_) { oneShotUnknown.delete(s.control); stopVerifier(s.control); return false; }
    clickMemo.set(s.control, { time: performance.now(), succeeded: false });
    check();
    return true;
  }

  function performClick(s, overrideTarget = null, urgent = false) {
    if (s.state.known && s.state.checked) return true;
    if (!s.state.known && oneShotUnknown.has(s.control)) return false;
    const last = clickMemo.get(s.control);
    if (last && performance.now() - last.time < CLICK_COOLDOWN_MS) return !!last.succeeded;
    if (!cheapActive(s.row) || !cheapActive(s.control)) { pend(s.control, s.row); return false; }

    const target = overrideTarget || preferredClickTarget(s);
    if (!(target instanceof HTMLElement) || target.closest?.('a[href]')) return false;

    // Classless geometry fallbacks must be visually proven before activation. Standard controls
    // are also visibility-checked, but non-urgent checks are moved to the next animation frame so
    // a mutation microtask never forces style/layout immediately after a large DOM update.
    const needsGeometry = !(s.input || s.confidence >= 4) || !!overrideTarget;
    if (needsGeometry || urgent) {
      const visual = visualState(s.row);
      if (!visual.visible) { pend(s.control, visual.blocker || s.row); return false; }
      return commitClick(s, target);
    }

    if (deferredClicks.has(s.control)) return true;
    deferredClicks.add(s.control);
    const generation = lifecycleGeneration;
    const run = () => {
      deferredClicks.delete(s.control);
      if (lifecyclePaused || generation !== lifecycleGeneration) return;
      if (!(s.control instanceof Element) || !s.control.isConnected) return;
      const fresh = snapshotCandidate(s.control);
      const decision = decisionFor(fresh);
      if (!decision.accept || (fresh.state.known && fresh.state.checked)) return;
      const visual = visualState(fresh.row);
      if (!visual.visible) { pend(fresh.control, visual.blocker || fresh.row); return; }
      commitClick(fresh, overrideTarget || preferredClickTarget(fresh));
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    else setTimeout(run, 0);
    return true;
  }

  function candidateMayMatter(el) {
    if (!(el instanceof Element) || !isCheckboxLike(el)) return false;
    if (relevantControls.has(el) || el.hasAttribute('required') || el.getAttribute('aria-required') === 'true') return true;
    const own = ownHint(el);
    if (own && (fastSemantic(own) || REQUIRED.test(own) || ASSENT.test(own))) return true;
    // Do not resolve every native input's HTMLLabelElement during broad discovery. On large
    // settings pages, `input.labels`/label lookup dominates CPU. Legal label text is discovered
    // independently by the bounded text walker and marks its linked control relevant before the
    // full CandidateSnapshot is built. ARIA references remain worth resolving here because they
    // may be the control's only semantic surface.
    if (el instanceof HTMLInputElement) {
      if (!el.hasAttribute('aria-labelledby') && !el.hasAttribute('aria-describedby')) return false;
      const text = accessibleText(el, 460);
      return fastSemantic(text) || REQUIRED.test(text) || ASSENT.test(text);
    }
    const text = accessibleText(el, 460);
    return fastSemantic(text) || REQUIRED.test(text) || ASSENT.test(text);
  }

  function processCandidate(el, urgent = false) {
    if (!(el instanceof Element) || !isCheckboxLike(el) || !candidateMayMatter(el)) return;
    const s = snapshotCandidate(el);
    indexCandidate(s);
    if (s.state.known && s.state.checked) return;
    const decision = decisionFor(s);
    const fp = `${stateFingerprint(s)}:${decision.accept ? 1 : 0}:${Math.round(decision.score)}`;
    if (!urgent && candidateMemo.get(el) === fp) return;
    candidateMemo.set(el, fp);
    if (!decision.accept) return;
    performClick(s, null, urgent);
  }

  function findAgreementRow(anchor) {
    if (!(anchor instanceof Element)) return null;
    let best = null;
    let depth = 0;
    for (const p of ancestorList(anchor, 8)) {
      const text = accessibleText(p, MAX_ROW_TEXT);
      if (!fastSemantic(text)) { depth++; continue; }
      const a = assessText(text);
      const risk = severityFor(text).level >= SEVERITY.CONSEQUENTIAL;
      const rank = a.score - depth * 0.4;
      if (!risk && (!best || rank > best.rank)) best = { row: p, text, assessment: a, rank };
      if (!risk && a.eligible) return { row: p, text, assessment: a };
      depth++;
    }
    return best;
  }

  function expandAgreementContainer(row) {
    if (!(row instanceof Element)) return row;
    let best = row;
    let p = composedParent(row);
    for (let i = 0; i < 3 && p instanceof Element; i++, p = composedParent(p)) {
      if (p.matches?.('form,dialog,[role="dialog"],[aria-modal="true"],body,html')) break;
      const text = accessibleText(p, MAX_ROW_TEXT);
      const assessment = assessText(text);
      if (assessment.blocked || severityFor(text).level >= SEVERITY.CONSEQUENTIAL) break;
      if (assessment.legal || assessment.assent || assessment.required || assessment.validation) best = p;
      if (knownControlIn(p)) return p;
    }
    return best;
  }

  function knownControlIn(row) {
    if (!(row instanceof Element)) return null;
    if (isCheckboxLike(row)) return row;
    try {
      const found = row.querySelector(KNOWN_CONTROL_SELECTOR);
      return found instanceof Element ? found : null;
    } catch (_) { return null; }
  }

  function labelledControlNear(anchor, row) {
    if (!(anchor instanceof Element)) return null;
    const labels = [];
    const closest = anchor.closest?.('label[for]');
    if (closest) labels.push(closest);
    if (row instanceof Element && row.matches?.('label[for]') && row !== closest) labels.push(row);
    for (const label of labels) {
      const id = label.getAttribute('for');
      if (!id) continue;
      const root = label.getRootNode?.() || document;
      let target = null;
      try { target = root.getElementById?.(id) || root.querySelector?.(`#${CSS.escape(id)}`); } catch (_) {}
      if (target instanceof Element && isCheckboxLike(target)) return target;
    }
    return null;
  }

  function preciseGeometryTarget(row, anchor) {
    if (!(row instanceof Element) || !(anchor instanceof Element)) return null;
    const ar = anchor.getBoundingClientRect();
    if (!ar.width && !ar.height) return null;
    const candidates = [];
    const walker = document.createTreeWalker(row, NodeFilter.SHOW_ELEMENT);
    let node;
    let seen = 0;
    while (seen++ < 90 && (node = walker.nextNode())) {
      if (!(node instanceof HTMLElement) || node === anchor || node.closest?.('a[href]')) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width < 7 || rect.height < 7 || rect.width > 52 || rect.height > 52) continue;
      if (rect.right > ar.left + 18 || Math.abs((rect.top + rect.bottom) / 2 - (ar.top + ar.bottom) / 2) > 34) continue;
      const area = rect.width * rect.height;
      candidates.push({ node, rect, score: Math.abs(rect.width - rect.height) + area / 2600 + Math.max(0, ar.left - rect.right) / 35 });
    }
    candidates.sort((a,b) => a.score - b.score);
    for (const c of candidates.slice(0, 6)) {
      const x = Math.max(0, Math.min(innerWidth - 1, (c.rect.left + c.rect.right) / 2));
      const y = Math.max(0, Math.min(innerHeight - 1, (c.rect.top + c.rect.bottom) / 2));
      const stack = document.elementsFromPoint?.(x, y) || [];
      const hit = stack.find(n => n instanceof HTMLElement && row.contains(n) && !n.closest?.('a[href]'));
      if (hit) return hit;
      if (c.node.isConnected) return c.node;
    }
    return null;
  }

  function processAgreementAnchor(anchor, urgent = false) {
    if (!(anchor instanceof Element)) return;
    const info = findAgreementRow(anchor);
    if (!info?.row) return;
    const context = contextSnapshot(info.row);
    if (severityFor(info.text, context.text, context.transaction).level >= SEVERITY.CONSEQUENTIAL || containsNegative(info.text) || containsAttestation(info.text)) return;
    if (info.assessment.legal || context.auth) {
      broadShadowEnabled = broadShadowEnabled || context.auth;
      if (broadShadowEnabled) queueShadowSweep(info.row);
    }

    let activeRow = info.row;
    const control = knownControlIn(activeRow) || labelledControlNear(anchor, activeRow);
    if (control) { relevantControls.add(control); return processCandidate(control, urgent); }
    activeRow = expandAgreementContainer(activeRow);
    const expandedControl = knownControlIn(activeRow) || labelledControlNear(anchor, activeRow);
    if (expandedControl) { relevantControls.add(expandedControl); return processCandidate(expandedControl, urgent); }

    const expandedText = accessibleText(activeRow, MAX_ROW_TEXT);
    const expandedAssessment = assessText(expandedText);
    const linkScore = linkEvidence(activeRow);
    const effective = expandedAssessment.score >= info.assessment.score ? expandedAssessment : info.assessment;
    const effectiveText = effective === expandedAssessment ? expandedText : info.text;
    const enough = (effective.legal && effective.assent) ||
      (effective.legal && (effective.required || effective.validation)) ||
      (effective.legal && context.auth && (linkScore >= 2 || context.gatingScore > 0));
    const vs = visualState(activeRow);
    if (!enough || !cheapActive(activeRow) || !vs.visible) { if (enough) pend(activeRow, vs.blocker || activeRow); return; }
    const visual = preciseGeometryTarget(activeRow, anchor);
    if (!visual) return;

    // A classless control has no observable checked contract, so it is intentionally one-shot.
    // During HTML parsing, however, the page's own trailing scripts may not have attached the
    // click handler yet. Do not spend the one allowed click before DOMContentLoaded; defer the
    // decision (not the click result) and re-evaluate once the parser has finished.
    if (document.readyState === 'loading') {
      if (!parserDeferredAnchors.has(anchor)) {
        parserDeferredAnchors.add(anchor);
        const ref = typeof WeakRef === 'function' ? new WeakRef(anchor) : null;
        addEventListener('DOMContentLoaded', () => {
          const current = ref?.deref?.();
          if (current instanceof Element) parserDeferredAnchors.delete(current);
          if (!lifecyclePaused && current instanceof Element && current.isConnected) processAgreementAnchor(current, true);
        }, { once: true });
      }
      return;
    }

    // Treat classless visual controls as one-shot unknown-state controls; never click the whole agreement row.
    const pseudo = {
      control: visual,
      row: activeRow,
      input: null,
      text: effectiveText,
      assessment: effective,
      context,
      links: linkScore,
      state: readStateRaw(visual, info.row, null),
      confidence: 2,
      required: false,
      disabled: false,
      risky: false
    };
    if (!(pseudo.state.known && pseudo.state.checked)) performClick(pseudo, visual, urgent);
  }

  function ownHint(el) {
    if (!(el instanceof Element)) return '';
    return joinNormalized([el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('placeholder'), el.getAttribute('name'), el.id, el.getAttribute('data-testid')], 520);
  }

  function maybeFragmentedAgreement(el, urgent = false) {
    if (!(el instanceof Element)) return;
    const label = el.localName === 'label' ? el : el.closest?.('label');
    if (!(label instanceof HTMLLabelElement) || fragmentRowsSeen.has(label)) return;

    // Broad settings pages commonly use <label><input>single text/span</label>. Do not aggregate
    // those. Only the structural signature of multiple inline text elements unlocks this fallback.
    let fragments = 0;
    for (const child of label.children) {
      if (isCheckboxLike(child)) continue;
      if (++fragments >= 2) break;
      // A single wrapper can itself contain multiple fragments.
      if (child.children?.length >= 2) { fragments = 2; break; }
    }
    if (fragments < 2) return;
    fragmentRowsSeen.add(label);
    const text = accessibleText(label, MAX_ROW_TEXT);
    if (fastSemantic(text)) processAgreementAnchor(label, urgent);
  }

  function processElement(el, urgent = false) {
    if (!(el instanceof Element)) return;
    if (isCheckboxLike(el)) processCandidate(el, urgent);
    maybeFragmentedAgreement(el, urgent);
    const hint = ownHint(el);
    if (hint && fastSemantic(hint)) processAgreementAnchor(el, urgent);
    if (AUTH.test(hint)) { broadShadowEnabled = true; queueShadowSweep(contextRoot(el) || el.closest?.('form,dialog,[role="dialog"]') || composedParent(el) || el); }
  }

  function processTextNode(node, urgent = false) {
    const data = node?.data;
    if (!data || data.length > 1400) return;
    if (AUTH.test(data)) { broadShadowEnabled = true; if (node.parentElement) queueShadowSweep(contextRoot(node.parentElement) || node.parentElement.closest?.('form,dialog,[role="dialog"]') || composedParent(node.parentElement) || node.parentElement); }
    if (FAST_TEXT.test(data) && node.parentElement) processAgreementAnchor(node.parentElement, urgent);
  }

  function rememberShadowHost(host) {
    if (!(host instanceof HTMLElement) || knownShadowHostEntry.has(host)) return;
    const entry = { ref: new WeakRef(host) };
    knownShadowHostEntry.set(host, entry);
    knownShadowHostEntries.add(entry);
    if (knownShadowHostEntries.size > 256) {
      for (const item of [...knownShadowHostEntries]) {
        if (!item.ref.deref()) knownShadowHostEntries.delete(item);
      }
    }
  }

  function onSlotChange(event) {
    if (lifecyclePaused) return;
    const slot = event.target;
    if (!(slot instanceof HTMLSlotElement)) return;
    bumpContext(slot);
    queueRoot(slot, true);
    let assigned = [];
    try { assigned = slot.assignedNodes({ flatten: true }).slice(0, 48); } catch (_) {}
    for (const node of assigned) {
      if (node.nodeType === Node.TEXT_NODE && node.parentElement) queueRoot(node.parentElement, true);
      else if (node instanceof Element) queueRoot(node, true);
    }
  }

  function attachSlotHandler(root) {
    if (!(root instanceof ShadowRoot)) return;
    let handler = slotHandlers.get(root);
    if (!handler) { handler = onSlotChange; slotHandlers.set(root, handler); }
    try { root.addEventListener('slotchange', handler, true); } catch (_) {}
  }

  function detachSlotHandler(root) {
    if (!(root instanceof ShadowRoot)) return;
    const handler = slotHandlers.get(root);
    if (!handler) return;
    try { root.removeEventListener('slotchange', handler, true); } catch (_) {}
  }

  function probeShadow(host, broad = false) {
    if (!(host instanceof HTMLElement) || probedShadowHosts.has(host)) return;
    const tag = host.localName;
    if (!broad && !host.shadowRoot && !tag.includes('-') && !CUSTOM_CHECK_TAGS.has(tag) && !isCheckboxLike(host)) return;
    probedShadowHosts.add(host);
    let root = host.shadowRoot;
    if (!root && chrome.dom?.openOrClosedShadowRoot) {
      try { root = chrome.dom.openOrClosedShadowRoot(host); } catch (_) {}
    }
    if (root instanceof ShadowRoot) { rememberShadowHost(host); observeRoot(root); }
  }

  function handleNode(node, urgent) {
    if (node.nodeType === Node.TEXT_NODE) return processTextNode(node, urgent);
    if (node instanceof Element) {
      processElement(node, urgent);
      probeShadow(node, false);
    }
  }

  function currentWalkGeneration(root) { return walkGeneration.get(root) || 0; }

  function rootConnected(root) {
    if (!root) return false;
    if (root instanceof Document) return root === document;
    if (root instanceof ShadowRoot) return root.host?.isConnected === true;
    if (root instanceof Element) return root.isConnected;
    if (root instanceof DocumentFragment) return true;
    return false;
  }

  function firstNodeInRoot(root, includeRoot) {
    if (includeRoot && root instanceof Element) return root;
    return root?.firstChild || null;
  }

  function nextNodeInRoot(node, root) {
    if (!(node instanceof Node) || !(root instanceof Node)) return null;
    if (node.firstChild) return node.firstChild;
    let p = node;
    while (p && p !== root) {
      if (p.nextSibling) return p.nextSibling;
      p = p.parentNode;
    }
    return null;
  }

  function nodeWithinRoot(node, root) {
    if (!(node instanceof Node) || !(root instanceof Node)) return false;
    return node === root || root.contains(node);
  }

  function resetWeakCursorJob(job, root) {
    job.started = false;
    job.cursorRef = null;
    job.generation = currentWalkGeneration(root);
  }

  function makeWalkJob(root, urgent) {
    if (!root || !rootConnected(root)) return null;
    return {
      rootRef: new WeakRef(root),
      cursorRef: null,
      started: false,
      urgent,
      generation: currentWalkGeneration(root),
      includeRoot: root instanceof Element
    };
  }

  function runWalkJob(job, budgetMs) {
    const root = job?.rootRef?.deref?.();
    if (!root || !rootConnected(root)) return false;
    if (job.generation !== currentWalkGeneration(root)) resetWeakCursorJob(job, root);
    const start = performance.now();
    let node;
    if (!job.started) {
      job.started = true;
      node = firstNodeInRoot(root, job.includeRoot);
    } else {
      node = job.cursorRef?.deref?.() || null;
      if (node && !nodeWithinRoot(node, root)) {
        // The cursor was moved/removed between slices. Restarting is bounded by generation/click
        // memoization and is safer than silently skipping a newly restructured subtree.
        resetWeakCursorJob(job, root);
        job.started = true;
        node = firstNodeInRoot(root, job.includeRoot);
      }
    }
    let checked = 0;
    while (node) {
      if (job.generation !== currentWalkGeneration(root)) {
        resetWeakCursorJob(job, root);
        return true;
      }
      const next = nextNodeInRoot(node, root);
      job.cursorRef = next instanceof Node ? new WeakRef(next) : null;
      handleNode(node, job.urgent);
      if ((++checked & 3) === 0 && performance.now() - start >= budgetMs) return !!next;
      node = next;
    }
    job.cursorRef = null;
    return false;
  }

  function releaseWalkJob(job) {
    const root = job?.rootRef?.deref?.();
    if (root) queuedWalkRoots.delete(root);
  }

  function processSubtree(root, urgent = false, syncBudget = null) {
    if (!root) return;
    if (!currentWalkGeneration(root)) walkGeneration.set(root, 1);
    const job = makeWalkJob(root, urgent);
    if (!job) return;
    const budget = syncBudget == null ? (urgent ? SYNC_BUDGET_MS : 1.2) : syncBudget;
    if (budget <= 0) {
      if (!queuedWalkRoots.has(root)) {
        queuedWalkRoots.add(root);
        while (walkJobs.length >= MAX_WALK_JOBS) releaseWalkJob(walkJobs.shift());
        walkJobs.push(job);
      }
      scheduleBackground();
    } else {
      const more = runWalkJob(job, budget);
      if (more) {
        if (!queuedWalkRoots.has(root)) {
          queuedWalkRoots.add(root);
          while (walkJobs.length >= MAX_WALK_JOBS) releaseWalkJob(walkJobs.shift());
          walkJobs.push(job);
        }
        scheduleBackground();
      }
    }
    if (broadShadowEnabled) queueShadowSweep(root);
  }

  function enqueueRootBatch(roots, index, urgent) {
    if (!roots || index >= roots.length) return;
    while (rootBatches.length >= MAX_ROOT_BATCHES) rootBatches.shift();
    const refs = roots.map(root => root && typeof root === 'object' ? new WeakRef(root) : null);
    rootBatches.push({ refs, index, urgent, createdAt: performance.now() });
    scheduleBackground();
  }

  function runRootBatch(job, budgetMs) {
    if (performance.now() - job.createdAt > ROOT_BATCH_TTL_MS) return false;
    const start = performance.now();
    while (job.index < job.refs.length && performance.now() - start < budgetMs) {
      const root = job.refs[job.index++]?.deref?.();
      if (!root || (root instanceof Element && !root.isConnected)) continue;
      const remaining = Math.max(0.25, budgetMs - (performance.now() - start));
      processSubtree(root, job.urgent, Math.min(0.8, remaining));
    }
    return job.index < job.refs.length;
  }

  function currentShadowGeneration(root) { return shadowGeneration.get(root) || 0; }

  function queueShadowSweep(root) {
    if (!broadShadowEnabled || !root || !rootConnected(root)) return;
    shadowGeneration.set(root, currentShadowGeneration(root) + 1);
    if (queuedShadowRoots.has(root)) return;
    queuedShadowRoots.add(root);
    while (shadowJobs.length >= MAX_SHADOW_JOBS) {
      const old = shadowJobs.shift();
      const oldRoot = old?.rootRef?.deref?.();
      if (oldRoot) queuedShadowRoots.delete(oldRoot);
    }
    shadowJobs.push({
      rootRef: new WeakRef(root),
      cursorRef: null,
      started: false,
      generation: currentShadowGeneration(root),
      includeRoot: root instanceof HTMLElement
    });
    scheduleBackground();
  }

  function runShadowJob(job, budgetMs) {
    const root = job?.rootRef?.deref?.();
    if (!root || !rootConnected(root)) return false;
    if (job.generation !== currentShadowGeneration(root)) {
      job.started = false;
      job.cursorRef = null;
      job.generation = currentShadowGeneration(root);
    }
    const start = performance.now();
    let node;
    if (!job.started) {
      job.started = true;
      node = firstNodeInRoot(root, job.includeRoot);
    } else {
      node = job.cursorRef?.deref?.() || null;
      if (node && !nodeWithinRoot(node, root)) {
        job.started = true;
        job.cursorRef = null;
        node = firstNodeInRoot(root, job.includeRoot);
      }
    }
    let checked = 0;
    while (node) {
      if (job.generation !== currentShadowGeneration(root)) {
        job.started = false;
        job.cursorRef = null;
        job.generation = currentShadowGeneration(root);
        return true;
      }
      const next = nextNodeInRoot(node, root);
      job.cursorRef = next instanceof Node ? new WeakRef(next) : null;
      if (node instanceof HTMLElement) probeShadow(node, true);
      if ((++checked & 31) === 0 && performance.now() - start >= budgetMs) return !!next;
      node = next;
    }
    job.cursorRef = null;
    return false;
  }

  function batchOwner(job) {
    return job?.owner instanceof Element ? job.owner : job?.ownerRef?.deref?.();
  }

  function enqueueBatchJob(job) {
    while (batchJobs.length >= MAX_BATCH_JOBS) {
      const dropped = batchJobs.shift();
      const owner = batchOwner(dropped);
      if (owner instanceof Element && owner.isConnected) queueRoot(owner, false);
    }
    batchJobs.push(job);
    scheduleBackground();
  }

  function enqueueSiblingRange(nodes, owner) {
    if (!nodes?.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (!(first instanceof Node) || !(last instanceof Node)) {
      if (owner instanceof Element && owner.isConnected) queueRoot(owner, false);
      return;
    }
    // A MutationRecord NodeList retains every inserted subtree while queued. For huge batches,
    // retain only weak range boundaries and advance through live siblings one at a time.
    enqueueBatchJob({
      mode: 'sibling-range',
      ownerRef: owner instanceof Element ? new WeakRef(owner) : null,
      currentRef: new WeakRef(first),
      lastRef: new WeakRef(last),
      reachedLast: false,
      afterCurrentDone: false,
      subjob: null,
      createdAt: performance.now()
    });
  }

  function startBatchNode(job, node) {
    if (node?.nodeType === Node.TEXT_NODE) processTextNode(node, false);
    else if (node?.nodeType === Node.ELEMENT_NODE || node?.nodeType === Node.DOCUMENT_FRAGMENT_NODE) job.subjob = makeWalkJob(node, false);
  }

  function runBatchJob(job, budgetMs) {
    const now = performance.now();
    const owner = batchOwner(job);
    if (now - job.createdAt > BATCH_JOB_TTL_MS || ((job.owner || job.ownerRef) && !(owner instanceof Element))) return false;
    if (owner instanceof Element && !owner.isConnected) return false;
    const start = now;

    if (job.mode === 'sibling-range') {
      while (job.subjob || job.currentRef) {
        if (!job.subjob) {
          const node = job.currentRef?.deref?.();
          const last = job.lastRef?.deref?.();
          if (!(node instanceof Node)) {
            if (!job.reachedLast && owner instanceof Element && owner.isConnected) queueRoot(owner, false);
            return false;
          }
          const isLast = node === last;
          const next = node.nextSibling;
          job.currentRef = next instanceof Node ? new WeakRef(next) : null;
          job.afterCurrentDone = isLast;
          if (isLast) job.reachedLast = true;
          if (!node.isConnected) {
            if (isLast) return false;
            if (!job.currentRef && !job.reachedLast && owner instanceof Element && owner.isConnected) queueRoot(owner, false);
            continue;
          }
          startBatchNode(job, node);
        }
        if (job.subjob) {
          const remaining = Math.max(0.35, budgetMs - (performance.now() - start));
          if (runWalkJob(job.subjob, remaining)) return true;
          job.subjob = null;
        }
        if (job.afterCurrentDone) return false;
        if (performance.now() - start >= budgetMs) return !!job.currentRef;
      }
      if (!job.reachedLast && owner instanceof Element && owner.isConnected) queueRoot(owner, false);
      return false;
    }

    while (job.index < job.nodes.length || job.subjob) {
      if (!job.subjob) {
        const node = job.nodes[job.index++];
        if (node && 'isConnected' in node && !node.isConnected) continue;
        startBatchNode(job, node);
      }
      if (job.subjob) {
        const remaining = Math.max(0.35, budgetMs - (performance.now() - start));
        if (runWalkJob(job.subjob, remaining)) return true;
        job.subjob = null;
      }
      if (performance.now() - start >= budgetMs) return job.index < job.nodes.length;
    }
    return false;
  }

  async function yieldMain() {
    if (globalThis.scheduler?.yield) return scheduler.yield();
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  async function drainBackground(generation = lifecycleGeneration) {
    if (lifecyclePaused || generation !== lifecycleGeneration) { if (backgroundEpoch === generation) backgroundQueued = false; return; }
    try {
      let rounds = 0;
      while (!lifecyclePaused && generation === lifecycleGeneration && (rootBatches.length || walkJobs.length || batchJobs.length || shadowJobs.length) && rounds++ < 24) {
        if (rootBatches.length) {
          const job = rootBatches[0];
          if (!runRootBatch(job, BACKGROUND_BUDGET_MS)) rootBatches.shift();
        } else if (walkJobs.length) {
          const job = walkJobs[0];
          const root = job?.rootRef?.deref?.();
          if (!root || !rootConnected(root)) { releaseWalkJob(job); walkJobs.shift(); }
          else if (job.generation !== currentWalkGeneration(root)) { releaseWalkJob(job); walkJobs.shift(); queueRoot(root, job.urgent); }
          else if (!runWalkJob(job, BACKGROUND_BUDGET_MS)) { releaseWalkJob(job); walkJobs.shift(); }
        } else if (batchJobs.length) {
          const job = batchJobs[0];
          if (!runBatchJob(job, BACKGROUND_BUDGET_MS)) batchJobs.shift();
        } else if (shadowJobs.length) {
          const job = shadowJobs[0];
          const root = job?.rootRef?.deref?.();
          if (!root || !rootConnected(root)) { if (root) queuedShadowRoots.delete(root); shadowJobs.shift(); }
          else if (!runShadowJob(job, BACKGROUND_BUDGET_MS)) { queuedShadowRoots.delete(root); shadowJobs.shift(); }
        }
        if (rootBatches.length || walkJobs.length || batchJobs.length || shadowJobs.length) {
          await yieldMain();
          if (lifecyclePaused || generation !== lifecycleGeneration) break;
        }
      }
    } finally {
      if (backgroundEpoch === generation) backgroundQueued = false;
      if (!lifecyclePaused && generation === lifecycleGeneration && (rootBatches.length || walkJobs.length || batchJobs.length || shadowJobs.length)) scheduleBackground();
    }
  }

  function scheduleBackground() {
    if (backgroundQueued || lifecyclePaused) return;
    backgroundQueued = true;
    const generation = lifecycleGeneration;
    backgroundEpoch = generation;
    if (globalThis.scheduler?.postTask) {
      scheduler.postTask(() => drainBackground(generation), { priority: 'background' }).catch(() => { if (backgroundEpoch === generation) backgroundQueued = false; if (!lifecyclePaused && generation === lifecycleGeneration) setTimeout(scheduleBackground, 16); });
    } else if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => drainBackground(generation), { timeout: 400 });
    } else {
      setTimeout(() => drainBackground(generation), 24);
    }
  }

  function queueRoot(root, urgent = false) {
    if (!root || lifecyclePaused) return;
    walkGeneration.set(root, currentWalkGeneration(root) + 1);
    (urgent ? urgentRoots : dirtyRoots).add(root);
    if (flushQueued) return;
    flushQueued = true;
    queueMicrotask(flushRoots);
  }

  function hasAncestorInSet(node, set) {
    let p = node?.parentNode;
    while (p) {
      if (set.has(p)) return true;
      p = p instanceof ShadowRoot ? p.host : p.parentNode;
    }
    return false;
  }

  function flushRoots() {
    flushQueued = false;
    if (lifecyclePaused) { urgentRoots.clear(); dirtyRoots.clear(); return; }
    const urgent = [...urgentRoots];
    const dirty = [...dirtyRoots];
    const urgentSet = new Set(urgent);
    const dirtySet = new Set(dirty);
    urgentRoots.clear(); dirtyRoots.clear();

    const u = urgent.filter(root => !hasAncestorInSet(root, urgentSet));
    const d = dirty.filter(root => !hasAncestorInSet(root, dirtySet) && !urgentSet.has(root) && !hasAncestorInSet(root, urgentSet));
    const start = performance.now();

    let ui = 0;
    for (; ui < u.length && performance.now() - start < FLUSH_BUDGET_MS; ui++) {
      const remaining = Math.max(0.25, FLUSH_BUDGET_MS - (performance.now() - start));
      processSubtree(u[ui], true, Math.min(0.8, remaining));
    }
    if (ui < u.length) enqueueRootBatch(u, ui, true);

    let di = 0;
    for (; di < d.length && performance.now() - start < FLUSH_BUDGET_MS; di++) {
      const remaining = Math.max(0.2, FLUSH_BUDGET_MS - (performance.now() - start));
      processSubtree(d[di], false, Math.min(0.55, remaining));
    }
    if (di < d.length) enqueueRootBatch(d, di, false);
  }

  function mutationAttributeRelevant(target, attributeName) {
    if (!(target instanceof Element)) return false;
    if (relevantControls.has(target)) return true;
    if (attributeName === 'aria-label' || attributeName === 'title' || attributeName === 'aria-labelledby' || attributeName === 'aria-describedby') {
      const hint = ownHint(target);
      return FAST_TEXT.test(hint) || AUTH.test(hint) || isCheckboxLike(target);
    }
    if (attributeName === 'role' && isCheckboxLike(target)) {
      const hint = ownHint(target);
      return FAST_TEXT.test(hint) || relevantControls.has(target);
    }
    if ((attributeName === 'hidden' || attributeName === 'aria-hidden' || attributeName === 'disabled' || attributeName === 'aria-disabled') && pendingVisibility.size) return true;
    return false;
  }

  function insideObservedContext(node) {
    let p = node instanceof Element ? node : node?.parentElement;
    for (let i = 0; i < 12 && p instanceof Element; i++, p = composedParent(p)) if (observedContexts.has(p)) return true;
    return false;
  }

  function onMutations(records, detailed = false) {
    if (lifecyclePaused) return;
    const added = new Set();
    for (const record of records) {
      if (!detailed && observedContextCount && insideObservedContext(record.target)) continue;
      if (detailed) markContextDirty(record.target);
      else contextCache.delete(document);

      if (record.type === 'childList') {
        const nodes = record.addedNodes;
        if (nodes.length > 96) {
          for (let i = 0; i < Math.min(3, nodes.length); i++) {
            const node = nodes[i];
            if (node?.nodeType === Node.TEXT_NODE) {
              const data = node.data; if (data && data.length <= 1400 && (FAST_TEXT.test(data) || AUTH.test(data)) && node.parentElement) queueRoot(node.parentElement, false);
            } else if (node?.nodeType === Node.ELEMENT_NODE || node?.nodeType === Node.DOCUMENT_FRAGMENT_NODE) queueRoot(node, false);
          }
          for (let i = Math.max(3, nodes.length - 5); i < nodes.length; i++) {
            const node = nodes[i];
            if (node?.nodeType === Node.TEXT_NODE) {
              const data = node.data; if (data && data.length <= 1400 && (FAST_TEXT.test(data) || AUTH.test(data)) && node.parentElement) queueRoot(node.parentElement, false);
            } else if (node?.nodeType === Node.ELEMENT_NODE || node?.nodeType === Node.DOCUMENT_FRAGMENT_NODE) queueRoot(node, false);
          }
          enqueueSiblingRange(nodes, record.target);
          continue;
        }
        for (const node of nodes) {
          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) added.add(node);
          else if (node.nodeType === Node.TEXT_NODE) {
            const data = node.data;
            if (data && data.length <= 1400 && (FAST_TEXT.test(data) || AUTH.test(data)) && node.parentElement) queueRoot(node.parentElement, false);
          }
        }
      } else if (record.type === 'characterData') {
        const data = record.target?.data;
        if (data && data.length <= 1400 && (FAST_TEXT.test(data) || AUTH.test(data)) && record.target.parentElement) queueRoot(record.target.parentElement, true);
      } else if (record.type === 'attributes') {
        if (mutationAttributeRelevant(record.target, record.attributeName)) queueRoot(record.target, true);
      }
    }
    for (const node of added) {
      let p = node.parentNode, covered = false;
      while (p) {
        if (added.has(p)) { covered = true; break; }
        if (p instanceof ShadowRoot) break;
        p = p.parentNode;
      }
      if (!covered) queueRoot(node, false);
    }
  }

  function observeRoot(root) {
    if (!root || lifecyclePaused || observedRoots.has(root)) return;
    observedRoots.add(root);
    if (root instanceof ShadowRoot) attachSlotHandler(root);
    try {
      discoveryObserver.observe(root, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['type','role','title','name','placeholder','autocomplete','aria-label','aria-labelledby','aria-describedby']
      });
    } catch (_) { return; }
    queueRoot(root, false);
  }

  function recheckPending() {
    if (lifecyclePaused) return;
    for (const entry of [...pendingVisibility]) {
      const el = entry?.targetRef?.deref?.();
      if (!(el instanceof Element) || !el.isConnected) { removePendingEntry(entry); continue; }
      if (cheapActive(el) && visuallyActive(el)) { removePendingEntry(entry); processElement(el, true); processAgreementAnchor(el, true); }
    }
  }

  function eventContext(event) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    for (const node of path) if (node instanceof HTMLElement) probeShadow(node, true);
    const target = event.target instanceof Element ? event.target : null;
    return target ? (contextRoot(target) || target.closest?.('form,[role="dialog"],dialog') || null) : null;
  }

  function proceedInteraction(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return false;
    const clickable = target.closest?.('button,input[type="submit"],a,[role="button"],[tabindex]') || target;
    const text = accessibleText(clickable, 360);
    return PROCEED.test(text) || AUTH.test(text);
  }

  function processIndexedContext(root) {
    const contexts = [];
    if (root) contexts.push(root);
    contexts.push(document);
    for (const context of contexts) {
      const set = contextIndex.get(context);
      if (!set) continue;
      for (const ref of [...set]) {
        const el = ref?.deref?.();
        if (!(el instanceof Element) || !el.isConnected) { set.delete(ref); continue; }
        processCandidate(el, true);
      }
    }
  }

  function preflight(event) {
    if (lifecyclePaused) return;
    const root = eventContext(event);
    if (proceedInteraction(event)) noteIntent(event.target, 'proceed');
    recheckPending();
    processIndexedContext(root);
    if (!proceedInteraction(event)) return;
    // No synchronous full-container walk: only already indexed candidates and pending controls.
    queueRoot(root || document.documentElement, true);
    setTimeout(recheckPending, 100);
  }

  async function tryCacheFastPath() {
    if (!location.origin || location.origin === 'null') return;
    const profile = await profileMessage('AUTO_AGREE_PROFILE_GET');
    if (!profile || !Array.isArray(profile.flows)) return;
    siteProfile = profile;
    const now = Date.now();
    const pathPrefix = `${normalizedPath()}|`;
    const flows = [...profile.flows]
      .filter(flow => typeof flow?.fingerprint === 'string' && flow.fingerprint.startsWith(pathPrefix))
      .sort((a,b) => Number(b?.ts || 0) - Number(a?.ts || 0))
      .slice(0, PROFILE_MAX_FLOWS);
    for (const flow of flows) {
      if (!flow?.locator || now - Number(flow.ts || 0) > CACHE_TTL_MS) continue;
      const el = resolveLocator(flow.locator);
      if (!(el instanceof Element) || !isCheckboxLike(el)) continue;
      const snap = snapshotCandidate(el);
      const liveDescriptor = behaviorDescriptor(snap);
      if (!descriptorCompatible(flow.descriptor, liveDescriptor)) { recordCacheFailure(flow); continue; }
      const decision = decisionFor(snap);
      if (decision.accept) processCandidate(el, true);
      else recordCacheFailure(flow);
    }
  }

  function queueSeedShells(seedRoot) {
    if (!(seedRoot instanceof Element)) return;
    let p = composedParent(seedRoot);
    let depth = 0;
    while (p instanceof Element && depth++ < 5) {
      if (p === document.documentElement || p === document.body) break;
      queueRoot(p, false);
      p = composedParent(p);
    }
  }

  let bootstrapSeedRef = null;
  let bootstrapSeedResolved = false;

  function bootstrapSeedElement() {
    if (!bootstrapSeedResolved) {
      bootstrapSeedResolved = true;
      const handoff = globalThis.__AUTO_AGREE_BOOTSTRAP_CONTEXT__;
      const seed = handoff?.seedRef?.deref?.() || handoff?.seed || null;
      try { delete globalThis.__AUTO_AGREE_BOOTSTRAP_CONTEXT__; } catch (_) { globalThis.__AUTO_AGREE_BOOTSTRAP_CONTEXT__ = null; }
      const el = seed instanceof Element ? seed : seed?.parentElement;
      if (el instanceof Element && el.isConnected && typeof WeakRef === 'function') bootstrapSeedRef = new WeakRef(el);
    }
    const el = bootstrapSeedRef?.deref?.();
    return el instanceof Element && el.isConnected ? el : null;
  }

  function bootstrapSeedRoot() {
    const el = bootstrapSeedElement();
    if (!el) return null;
    return contextRoot(el) || el.closest?.('form,dialog,[role="dialog"],[aria-modal="true"]') || composedParent(el) || el;
  }

  function observeBootstrapSeedShadow() {
    const el = bootstrapSeedElement();
    if (!el) return;
    const root = el.getRootNode?.();
    if (!(root instanceof ShadowRoot) || !(root.host instanceof HTMLElement)) return;
    rememberShadowHost(root.host);
    probedShadowHosts.add(root.host);
    observeRoot(root);
  }

  function onKeyDown(event) { if (event.key === 'Enter') { noteIntent(event.target, 'enter'); preflight(event); } }

  function onFocusIn(event) {
    if (lifecyclePaused) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const hint = joinNormalized([target.getAttribute('name'), target.getAttribute('type'), target.getAttribute('placeholder'), target.getAttribute('autocomplete')], 300);
    if (CREDENTIAL.test(hint)) {
      noteIntent(target, 'focus');
      const root = bumpContext(target);
      broadShadowEnabled = true;
      queueShadowSweep(root instanceof Element ? root : document.documentElement);
      processIndexedContext(root instanceof Element ? root : null);
    }
  }

  function invalidateInputContext(event) {
    if (lifecyclePaused) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    noteIntent(target, 'input');
    const root = bumpContext(target);
    // Credential/value changes can flip a terse legal control from ambiguous to mandatory.
    // Re-evaluate only the already indexed legal candidates for this context (O(K)), never
    // rescan the whole form. This also keeps ContextSnapshot cache invalidation and action
    // scheduling coupled, so a fresh epoch cannot sit unused until some unrelated mutation.
    processIndexedContext(root instanceof Element ? root : null);
  }

  function onVisualTransition() { if (!lifecyclePaused && pendingVisibility.size) recheckPending(); }

  function attachEngineEvents() {
    if (engineEventsAttached) return;
    engineEventsAttached = true;
    addEventListener('pointerdown', preflight, true);
    addEventListener('submit', preflight, true);
    addEventListener('keydown', onKeyDown, true);
    addEventListener('focusin', onFocusIn, true);
    addEventListener('input', invalidateInputContext, true);
    addEventListener('change', invalidateInputContext, true);
    addEventListener('transitionend', onVisualTransition, true);
    addEventListener('animationend', onVisualTransition, true);
  }

  function detachEngineEvents() {
    if (!engineEventsAttached) return;
    engineEventsAttached = false;
    removeEventListener('pointerdown', preflight, true);
    removeEventListener('submit', preflight, true);
    removeEventListener('keydown', onKeyDown, true);
    removeEventListener('focusin', onFocusIn, true);
    removeEventListener('input', invalidateInputContext, true);
    removeEventListener('change', invalidateInputContext, true);
    removeEventListener('transitionend', onVisualTransition, true);
    removeEventListener('animationend', onVisualTransition, true);
  }

  function stopAllVerifiers() {
    for (const verifier of [...activeVerifiers]) {
      verifier.done = true;
      try { verifier.observer?.disconnect(); } catch (_) {}
      for (const [target, type, fn] of verifier.listeners || []) {
        try { target.removeEventListener(type, fn, true); } catch (_) {}
      }
      if (verifier.timer) clearTimeout(verifier.timer);
      const control = verifier.controlRef?.deref?.();
      if (control instanceof Element) clickVerifiers.delete(control);
      activeVerifiers.delete(verifier);
    }
  }

  function clearQueuedWork() {
    dirtyRoots.clear();
    urgentRoots.clear();
    rootBatches.length = 0;
    walkJobs.length = 0;
    shadowJobs.length = 0;
    batchJobs.length = 0;
    queuedWalkRoots = new WeakSet();
    queuedShadowRoots = new WeakSet();
    flushQueued = false;
    backgroundQueued = false;
  }

  function restoreKnownShadowRoots() {
    for (const entry of [...knownShadowHostEntries]) {
      const host = entry.ref?.deref?.();
      if (!(host instanceof HTMLElement) || !host.isConnected) {
        if (!host) knownShadowHostEntries.delete(entry);
        continue;
      }
      let root = host.shadowRoot;
      if (!root && chrome.dom?.openOrClosedShadowRoot) {
        try { root = chrome.dom.openOrClosedShadowRoot(host); } catch (_) {}
      }
      if (root instanceof ShadowRoot) {
        probedShadowHosts.add(host);
        observeRoot(root);
      }
    }
  }

  function pauseEngine() {
    if (lifecyclePaused) return;
    lifecyclePaused = true;
    lifecycleGeneration++;
    discoveryObserver.disconnect();
    contextObserver.disconnect();
    resizeObserver?.disconnect();
    detachEngineEvents();
    for (const entry of [...knownShadowHostEntries]) {
      const host = entry.ref?.deref?.();
      if (!(host instanceof HTMLElement)) { if (!host) knownShadowHostEntries.delete(entry); continue; }
      let root = host.shadowRoot;
      if (!root && chrome.dom?.openOrClosedShadowRoot) { try { root = chrome.dom.openOrClosedShadowRoot(host); } catch (_) {} }
      if (root instanceof ShadowRoot) detachSlotHandler(root);
    }
    if (pendingRescueTimer) clearTimeout(pendingRescueTimer);
    pendingRescueTimer = 0;
    pendingRescuePhase = 0;
    if (initialRescueTimer) clearTimeout(initialRescueTimer);
    initialRescueTimer = 0;
    stopAllVerifiers();
    contextTxnRefs.clear();
    contextTxnScheduled = false;
    clearQueuedWork();
  }

  function resumeEngine() {
    if (!lifecyclePaused || document.prerendering || document.visibilityState === 'hidden') return;
    lifecyclePaused = false;
    lifecycleGeneration++;
    candidateMemo = new WeakMap();
    clickMemo = new WeakMap();
    observedRoots = new WeakSet();
    observedContexts = new WeakSet();
    probedShadowHosts = new WeakSet();
    observedContextCount = 0;
    attachEngineEvents();
    observeRoot(document);
    restoreKnownShadowRoots();
    if (resizeObserver) {
      for (const entry of [...pendingVisibility]) {
        const blocker = entry?.blockerRef?.deref?.();
        if (blocker instanceof Element && blocker.isConnected) { try { resizeObserver.observe(blocker); } catch (_) {} }
      }
    }
    recheckPending();
    processIndexedContext(null);
    if (document.documentElement) queueRoot(document.documentElement, false);
    void tryCacheFastPath();
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') pauseEngine();
    else resumeEngine();
  }
  function onPageHide(event) {
    pauseEngine();
    if (!event?.persisted) detachLifecycleEvents();
  }
  function onPageShow(event) { if (event?.persisted) resumeEngine(); }
  function onFreeze() { pauseEngine(); }
  function onResume() { resumeEngine(); }

  function attachLifecycleEvents() {
    if (lifecycleEventsAttached) return;
    lifecycleEventsAttached = true;
    addEventListener('pagehide', onPageHide, true);
    addEventListener('pageshow', onPageShow, true);
    document.addEventListener('freeze', onFreeze, true);
    document.addEventListener('resume', onResume, true);
    document.addEventListener('visibilitychange', onVisibilityChange, true);
    document.addEventListener('prerenderingchange', onResume, true);
  }

  function detachLifecycleEvents() {
    if (!lifecycleEventsAttached) return;
    lifecycleEventsAttached = false;
    removeEventListener('pagehide', onPageHide, true);
    removeEventListener('pageshow', onPageShow, true);
    document.removeEventListener('freeze', onFreeze, true);
    document.removeEventListener('resume', onResume, true);
    document.removeEventListener('visibilitychange', onVisibilityChange, true);
    document.removeEventListener('prerenderingchange', onResume, true);
  }

  function boot() {
    attachEngineEvents();
    observeRoot(document);
    observeBootstrapSeedShadow();
    const seedRoot = bootstrapSeedRoot();
    if (seedRoot) queueRoot(seedRoot, true);
    else if (document.documentElement) queueRoot(document.documentElement, false);
    void tryCacheFastPath();

    // If the bootstrap seed itself has no agreement, expand only through a few surrounding
    // UI shells. Existing far-away document content is not rescanned merely because a login form
    // has no Terms checkbox; later DOM insertions are already covered by discoveryObserver.
    if (seedRoot) {
      const generation = lifecycleGeneration;
      initialRescueTimer = setTimeout(() => {
        initialRescueTimer = 0;
        if (lifecyclePaused || generation !== lifecycleGeneration) return;
        if (!meaningfulCandidateSeen) queueSeedShells(seedRoot);
      }, 420);
    }
  }

  attachLifecycleEvents();
  if (document.visibilityState === 'hidden' || document.prerendering) lifecyclePaused = true;
  else boot();
})();
