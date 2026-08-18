# Extension runtime

This directory is the only load-unpacked production root.

Load it from `chrome://extensions` → Developer mode → Load unpacked.

Runtime order for the current 12.2 generation:

1. The manifest installs `runtime-kernel.js` → `generation-lease.js` → `bootstrap.js` at `document_start` in every matching frame. RuntimeKernel owns the isolated-world birth generation and bounded lifecycle/work primitives; Generation Lease revokes stale Auto Agree `.click()` authority; Probe only decides whether richer analysis is worth loading.
2. Probe activation is deliberately broader than click authority but remains bounded. It may escalate explicit native-label/ARIA legal relationships, sampled long legal text, credential evidence, or an explicit proceed interaction. Generic deep geometry remains narrow and cannot by itself create a rich-runtime handoff.
3. Worker validates the sender/document lifecycle and injects `runtime-kernel.js` → `generation-lease.js` → `semantic-core.js` → `gate.js`. Gate performs bounded evidence/co-occurrence analysis and still cannot click.
4. If Gate activates Engine, Worker injects the Engine closure in dependency order: RuntimeKernel, Generation Lease, Semantic Core, DomCore, Handover Guard, ActionAuthority, DecisionKernel, ProfileCore, Risk Core, then Engine.
5. DecisionKernel is the sole severity/acceptance policy. Risk Core classifies optional/consequential/attestation semantics. ProfileCore is acceleration only. Engine extracts current browser evidence and may reach ActionAuthority only after policy accepts the live candidate.
6. ActionAuthority is the sole automated-action protocol: current Generation Lease → current Handover Guard authorization → one `.click()` attempt. Engine independently verifies observable success; a dispatched attempt is not treated as success by itself.
7. On extension update/reload, Worker persists unresolved rehydration work and installs current RuntimeKernel/Lease/Semantic Core/DomCore/Handover Guard protection into accessible surviving pages before reintroducing Probe. Terminal inaccessible browser pages are retired; transient failures remain durable.
8. Probe/Gate/Engine queues keep hard representation caps. Connected correctness work survives pressure through FIFO/liveness semantics or weak final-state recovery; no repair falls back to an unbounded synchronous document scan.
9. Site-learning persistence remains bounded: 256 origins, 8 flows/origin, 180-day TTL, 32-entry Worker hot LRU, session/local storage layers, exact flow identity, serialized writes, and propagated persistence errors. Cached evidence never becomes click authority.
10. `tests/version-contract.mjs` binds manifest/package/package-lock/RuntimeKernel to one runtime generation. Real Chrome release gates separately exercise activation recall, lifecycle/pressure, stale-generation revocation, update transition, action authority, structural fuzz, and paired performance.

The deterministic package tool derives its JavaScript payload from the complete production `extension/*.js` set, canonicalizes text to UTF-8/LF with fixed ZIP metadata, and includes this README. Package identity is therefore a function of the actual load-unpacked runtime closure rather than a hand-maintained subset.

Do not add historical implementations to this directory. Historical evidence belongs in `docs/verification/`; obsolete source remains available through Git history.
