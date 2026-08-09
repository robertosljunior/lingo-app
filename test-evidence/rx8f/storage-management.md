# RX-8F — shared-resource storage visibility and cleanup

REC-246 requires one learner-facing place to understand large shared resources and reclaim space without erasing learning history.

## Contract

- V2 Settings reports the browser's origin-level usage/quota when `navigator.storage.estimate()` is available.
- It separately identifies known re-downloadable resources: installed Piper voices, the optional semantic model, installed semantic knowledge packs and managed runtime/audio caches.
- Cleanup never opens or deletes the main learner database.
- Cleanup never deletes profiles, answers, V2 sessions/interactions, evidence, History or Review state.
- Semantic model removal uses the existing transactional model-store API and resets the in-memory encoder.
- Voice removal uses Piper's existing OPFS removal API and clears voice-specific generated audio.
- Extra knowledge packs use the existing pack removal contract; historical feedback remains in the learner DB.
- Managed caches are restricted to `piper-audio-*`, `piper-runtime-*` and `semantic-runtime-*`; the PWA application shell/cache is deliberately preserved so offline boot is not sacrificed to free space.
- The English neural-voice preparation marker is reset after cleanup so future preparation reflects physical storage truth.

## Learner copy

The destructive confirmation explicitly says that downloaded resources can be downloaded again and that history, answers, profiles and progress are preserved.

## Deferred

RX-8F is not the global "erase the entire application" contract from REC-106. It is the safe reclaim-space path for REC-246. Full application wipe remains a separate destructive lifecycle operation if still desired.
