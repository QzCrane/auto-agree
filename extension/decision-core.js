(() => {
  'use strict';

  const KERNEL = globalThis.__AUTO_AGREE_RUNTIME_KERNEL__;
  const VERSION = KERNEL?.version;
  if (!KERNEL || !VERSION) return;
  if (globalThis.__AUTO_AGREE_DECISION__?.version === VERSION) return;

  const SEVERITY = Object.freeze({
    ROUTINE: 0,
    PRIVACY: 1,
    OPTIONAL: 2,
    CONSEQUENTIAL: 3,
    ATTESTATION: 4
  });

  /**
   * @typedef {{level:number, kind:string}} ConsentSeverity
   * @typedef {{
   *   disabled:boolean,
   *   stateKind:string,
   *   blocked:boolean,
   *   severity:ConsentSeverity,
   *   baseScore:number,
   *   legal:boolean,
   *   assent:boolean,
   *   required:boolean,
   *   auth:boolean,
   *   transaction:boolean,
   *   actionGated:boolean,
   *   legalLinks:number,
   *   controlConfidence:number,
   *   eligible:boolean,
   *   gatingScore:number
   * }} EvidenceIR
   */

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  /** @param {EvidenceIR} evidence */
  function buildSemanticGraph(evidence) {
    const facts = Object.freeze({
      legal: evidence.legal === true,
      assent: evidence.assent === true,
      required: evidence.required === true,
      auth: evidence.auth === true,
      transaction: evidence.transaction === true,
      actionGated: evidence.actionGated === true,
      legalLinks: finiteNumber(evidence.legalLinks),
      controlConfidence: finiteNumber(evidence.controlConfidence),
      severity: finiteNumber(evidence.severity?.level, SEVERITY.CONSEQUENTIAL)
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

  /** @param {EvidenceIR} evidence */
  function decideEvidence(evidence) {
    const graph = buildSemanticGraph(evidence);
    const f = graph.facts;
    const severity = evidence.severity && typeof evidence.severity === 'object'
      ? evidence.severity
      : { level: SEVERITY.CONSEQUENTIAL, kind: 'invalid' };

    if (evidence.disabled || evidence.stateKind === 'mixed' || f.severity >= SEVERITY.OPTIONAL || evidence.blocked) {
      return { accept: false, score: -100, severity, graph };
    }

    let score = finiteNumber(evidence.baseScore) + f.legalLinks + finiteNumber(evidence.gatingScore) + (f.auth ? 2 : 0) + Math.min(f.controlConfidence, 5);
    if (f.required) score += 4;

    const explicitLegalAssent = f.legal && f.assent;
    const explicitMandatoryLegal = f.legal && f.required;
    const terseAuthLegal = f.legal && f.auth && f.controlConfidence >= 4 && (f.legalLinks >= 2 || f.required || f.actionGated);
    const assentWithLegalLinks = f.assent && f.legalLinks >= 2 && f.controlConfidence >= 3;
    const relationalGate = f.legal && (f.assent || f.required) && (f.auth || f.actionGated) && f.controlConfidence >= 3;
    const accept = explicitLegalAssent || explicitMandatoryLegal || terseAuthLegal || assentWithLegalLinks || relationalGate || (evidence.eligible === true && score >= 12);
    return { accept, score, severity, graph };
  }

  globalThis.__AUTO_AGREE_DECISION__ = Object.freeze({
    version: VERSION,
    SEVERITY,
    buildSemanticGraph,
    decideEvidence
  });
})();
