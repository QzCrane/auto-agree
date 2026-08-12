from pathlib import Path


def replace_exact(path, old, new, count=1):
    p=Path(path); text=p.read_text(); actual=text.count(old)
    if actual!=count: raise SystemExit(f'{path}: expected {count}, got {actual}: {old[:180]!r}')
    p.write_text(text.replace(old,new))

replace_exact(
  'extension/engine.js',
  '  const { decideEvidence } = POLICY;\n',
  '  const { decideEvidence, decideClasslessEvidence } = POLICY;\n'
)

replace_exact(
  'extension/engine.js',
  """    const effective = expandedAssessment.score >= info.assessment.score ? expandedAssessment : info.assessment;
    const effectiveText = effective === expandedAssessment ? expandedText : info.text;
    const enough = (effective.legal && effective.assent) ||
      (effective.legal && (effective.required || effective.validation)) ||
      (effective.legal && context.auth && (linkScore >= 2 || context.gatingScore > 0));
    const vs = visualState(activeRow);
    if (!enough || !cheapActive(activeRow) || !vs.visible) { if (enough) pend(activeRow, vs.blocker || activeRow); return; }
    const visual = preciseGeometryTarget(activeRow, anchor);
    if (!visual) return;
""",
  """    const effective = expandedAssessment.score >= info.assessment.score ? expandedAssessment : info.assessment;
    const effectiveText = effective === expandedAssessment ? expandedText : info.text;
    const classlessSeverity = consentSeverity(effectiveText, context);
    const classlessEvidence = {
      disabled: false,
      stateKind: 'unknown',
      blocked: !!effective.blocked,
      severity: classlessSeverity,
      baseScore: Number(effective.score || 0),
      legal: !!effective.legal,
      assent: !!effective.assent,
      required: !!(effective.required || effective.validation),
      auth: !!context.auth,
      transaction: !!context.transaction,
      actionGated: context.gatingScore > 0,
      legalLinks: linkScore,
      controlConfidence: 2,
      eligible: !!effective.eligible,
      gatingScore: Number(context.gatingScore || 0)
    };
    const classlessDecision = decideClasslessEvidence(classlessEvidence);
    const vs = visualState(activeRow);
    if (!classlessDecision.accept || !cheapActive(activeRow) || !vs.visible) {
      if (classlessDecision.accept) pend(activeRow, vs.blocker || activeRow);
      return;
    }
    const visual = preciseGeometryTarget(activeRow, anchor);
    if (!visual) return;
"""
)

replace_exact(
  'extension/engine.js',
  """    const pseudo = {
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
""",
  """    const pseudo = {
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
      severity: classlessSeverity,
      risky: classlessSeverity.level >= SEVERITY.OPTIONAL
    };
    const finalClasslessDecision = decideClasslessEvidence({ ...classlessEvidence, stateKind: pseudo.state.kind });
    if (finalClasslessDecision.accept && !(pseudo.state.known && pseudo.state.checked)) performClick(pseudo, visual, urgent);
"""
)

# Static policy-boundary enforcement.
p=Path('tests/static-contract.mjs'); text=p.read_text()
old="assert.match(decision,/decideEvidence/,'DecisionKernel must own EvidenceIR to Decision policy');"
new=old+"\nassert.match(decision,/decideClasslessEvidence/,'DecisionKernel must own the weaker classless geometry policy path');"
if text.count(old)!=1: raise SystemExit('decision static anchor changed')
text=text.replace(old,new)
old="assert.match(engine,/authorizeHandoverClick/);assert.match(engine,/__AUTO_AGREE_DECISION__/,'Engine must consume the pure decision authority');assert.match(engine,/evidenceForCandidate/,'Engine must map browser snapshots into EvidenceIR before policy');assert.equal(/function\\s+buildSemanticGraph\\s*\\(/.test(engine),false,'Engine must not retain a private policy graph implementation');"
new=old+"\nassert.match(engine,/decideClasslessEvidence\\(classlessEvidence\\)/,'classless geometry must cross the DecisionKernel before layout targeting');\nassert.match(engine,/decideClasslessEvidence\\(\\{ \\.\\.\\.classlessEvidence, stateKind: pseudo\\.state\\.kind \\}\\)/,'classless observable state must be revalidated before action');\nassert.equal(/const\\s+enough\\s*=/.test(engine),false,'Engine must not retain a private classless acceptance formula');"
if text.count(old)!=1: raise SystemExit('engine static anchor changed')
p.write_text(text.replace(old,new))

print('v12 classless policy migration prepared successfully')
