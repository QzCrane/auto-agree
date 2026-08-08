# RootBatch overflow finding

A fixed-seed 300-case structural fuzz corpus was run against a real unpacked Auto Agree extension in Chrome after first activating Engine with a normal seed agreement. The corpus dynamically inserted batches spanning nested/external labels, ARIA IDREFs, role/data controls, wrapper depth, multilingual text, arbitrary 2–5 fragment splitting, routine positives, consequential/optional/attestation negatives, already-checked, disabled, and mixed states.

The corrected experiment still produced a characteristic failure: the first dynamically discovered case succeeded while large later portions remained unprocessed.

Source audit found a direct loss mechanism in `extension/engine.js`:

```js
while (rootBatches.length >= MAX_ROOT_BATCHES) rootBatches.shift();
```

with `MAX_ROOT_BATCHES = 8`.

This is not merely resource throttling. The evicted RootBatch can contain the only discovery path to a routine agreement, so eviction can create a permanent false negative. A safe fix must preserve a hard resource bound without silently forgetting final DOM state—for example by coalescing sibling roots to a live parent recovery path or preserving overflow only through weak references in an existing bounded batch.

This research branch is intentionally not mergeable until the source repair is represented as ordinary code, temporary CI transport artifacts are removed, and a clean exact-head real-Chrome run passes the complete corpus.