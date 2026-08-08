# ADR 0003 — Do not ship an untrained local ML classifier

**Status:** rejected pending evidence

A tiny local classifier would add model bytes, inference/runtime complexity and a harder-to-audit error surface. The project currently lacks a sufficiently large independently labelled real-world consent corpus to calibrate such a model against the false-positive cost.

Decision: keep deterministic rules plus fuzz/property tests. A model is reconsidered only after a real corpus can demonstrate statistically meaningful improvement at an equal or lower consequential-consent false-positive rate.
