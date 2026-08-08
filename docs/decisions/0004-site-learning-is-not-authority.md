# ADR 0004 — Site learning is acceleration, never authority

**Status:** accepted

Selectors and behavior descriptors may become stale after a site redesign. Learned state therefore chooses what to inspect first but cannot authorize activation. Every cached hit must pass live state, semantic graph and severity validation. Repeated mismatch invalidates the exact learned flow.
