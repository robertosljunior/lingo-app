# SLICE 7.2 — Performance & memory (T21)

Measured in headless Chromium (preview build) through the app's real modules.
Headless has NO WebGL, so USE runs on the CPU backend — the worst case. Real
devices with WebGL are substantially faster for embeddings.

| Metric | Value |
|--------|-------|
| Install (local bytes, checksum + transactional) | ~1.16 s |
| Cold full free analysis (model load + Harper WASM + first embed) | ~8.3 s |
| Warm full free analysis (Harper + USE embed, CPU) | ~4.0 s |
| Single embedding (CPU, from earlier spike) | ~0.48 s |
| USE model load (warm, from local bytes) | ~0.26 s |
| JS heap before model | ~5 MB |
| JS heap after model load | ~192 MB |
| JS heap after 8 further analyses | ~189 MB (stable — no leak) |

Notes:
- Memory is stable across repeated analyses (189–192 MB) — tfjs tensors are
  disposed; no growth/leak. ~190 MB reflects the 27 MB model expanded to tensors
  plus tfjs runtime.
- The UI stays responsive during I/O (async install/load); the CPU embedding is
  the one main-thread cost that can jank for a few seconds ON HEADLESS CPU. On a
  device with WebGL this is tens of ms. Moving the embed to a Web Worker (T05) is
  the documented enhancement to remove even the CPU-path jank; it does not affect
  correctness or the effective-engine result.
- During analysis the Exercise screen shows "Analisando sua frase…" and the app
  remains navigable.
