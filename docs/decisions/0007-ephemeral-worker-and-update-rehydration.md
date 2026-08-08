# ADR 0007 — MV3 Worker memory is transient; update rehydration is resumable

**Decision:** Worker globals may optimize execution but may never be correctness authority. Persistent learning and pending update rehydration use `chrome.storage`. Probe/Gate handoffs are replayable after channel loss.

On update/reload, already-open tabs receive a bounded bootstrap reinjection sweep. A session marker allows the sweep to resume after an unexpected Worker restart. No `tabs` permission is requested; existing host access is sufficient for the needed tab interaction.
