export async function extensionWorldSentinels(page) {
  const session = await page.createCDPSession();
  const contexts = [];
  const onContext = event => contexts.push(event.context);
  session.on('Runtime.executionContextCreated', onContext);
  try {
    await session.send('Runtime.enable');
    await new Promise(resolve => setTimeout(resolve, 120));
    const worlds = [];
    for (const context of contexts) {
      try {
        const {result, exceptionDetails} = await session.send('Runtime.evaluate', {
          contextId: context.id,
          returnByValue: true,
          expression: `(() => ({
            lease: globalThis.__AUTO_AGREE_GENERATION_LEASE__?.version || null,
            probe: globalThis.__AUTO_AGREE_PROBE__ || null,
            handover: globalThis.__AUTO_AGREE_HANDOVER_GUARD__?.version || null,
            semantic: globalThis.__AUTO_AGREE_SEMANTIC__?.version || globalThis.__AUTO_AGREE_SEMANTIC__ || null,
            gate: globalThis.__AUTO_AGREE_GATE__ || null,
            risk: globalThis.__AUTO_AGREE_RISK__?.version || globalThis.__AUTO_AGREE_RISK__ || null,
            engine: globalThis.__AUTO_AGREE_ENGINE__ || null,
            bootstrapReason: globalThis.__AUTO_AGREE_BOOTSTRAP_CONTEXT__?.reason || null,
            href: location.href
          }))()`
        });
        if (exceptionDetails) continue;
        const value = result?.value;
        if (value && (value.lease || value.probe || value.handover || value.semantic || value.gate || value.risk || value.engine)) {
          worlds.push({
            id: context.id,
            name: context.name || '',
            origin: context.origin || '',
            auxData: context.auxData || null,
            ...value
          });
        }
      } catch (_) {}
    }
    return worlds;
  } finally {
    session.off('Runtime.executionContextCreated', onContext);
    try { await session.detach(); } catch (_) {}
  }
}

export async function evaluateInExecutionContext(page, contextId, expression) {
  const session = await page.createCDPSession();
  try {
    await session.send('Runtime.enable');
    const {result, exceptionDetails} = await session.send('Runtime.evaluate', {
      contextId,
      returnByValue: true,
      awaitPromise: true,
      expression
    });
    if (exceptionDetails) throw new Error(exceptionDetails.text || 'execution-context evaluation failed');
    return result?.value;
  } finally {
    try { await session.detach(); } catch (_) {}
  }
}
