// runtime-capabilities.js — explicit snapshot of the TECHNICAL capabilities the
// current browser/runtime offers to the V2 pilot, and the mapping from missing
// capabilities to recipes the engine must not select.
//
// This is a runtime concern, never a pedagogical one: the pedagogy (gates,
// scoring, planned evidence) stays entirely in the lesson engine. The runtime
// only tells the engine "these recipes cannot be EXECUTED here", with a
// machine-readable reason code that lands in the selection trace.
//
// Documented decision (Slice V2.4): there is NO acoustic pronunciation assessor
// in this codebase. The V1 `speak_sentence` flow scores pronunciation by
// comparing the STT transcript with the expected sentence (word-level
// similarity), which measures content recognition, not phonetic quality — see
// docs/pedagogy-v2-pilot-runtime.md. Therefore `pronunciation_assessment` is
// ALWAYS false in this slice, the pronunciation recipe is filtered from
// selection, and the renderer (kept for completeness/tests) can only produce
// observed / not_assessed outcomes — never `correct`.

export const RUNTIME_CAPABILITY_NAMES = [
  'text_input',
  'audio_output',
  'speech_input',
  'pronunciation_assessment',
  'semantic_assessment',
]

export const RUNTIME_REASON_CODES = {
  audio_output: 'RUNTIME_AUDIO_OUTPUT_UNAVAILABLE',
  speech_input: 'RUNTIME_SPEECH_INPUT_UNAVAILABLE',
  semantic_assessment: 'RUNTIME_SEMANTIC_ASSESSMENT_UNAVAILABLE',
  pronunciation_assessment: 'RUNTIME_PRONUNCIATION_ASSESSMENT_UNAVAILABLE',
  text_input: 'RUNTIME_TEXT_INPUT_UNAVAILABLE',
}

/**
 * Detect the technical capabilities of this runtime. All detectors are
 * injectable for tests; defaults probe the real browser environment lazily.
 * Pure data out: { text_input, audio_output, speech_input,
 * pronunciation_assessment, semantic_assessment }.
 */
export function detectRuntimeCapabilitiesV2({
  ttsSupported = null,
  sttSupported = null,
  semanticAvailable = null,
  pronunciationAssessorAvailable = false, // none exists in this slice (see header)
} = {}) {
  const hasWindow = typeof window !== 'undefined'
  return {
    text_input: true,
    audio_output: ttsSupported ?? (hasWindow && 'speechSynthesis' in window),
    speech_input: sttSupported
      ?? (hasWindow && !!(window.SpeechRecognition || window.webkitSpeechRecognition)),
    // The semantic pipeline always has a deterministic hashing fallback for its
    // encoder, so the public analyzeProduction API is available whenever the
    // module graph is — default true, injectable false for degraded tests.
    semantic_assessment: semanticAvailable ?? true,
    pronunciation_assessment: pronunciationAssessorAvailable === true,
  }
}

// Which technical capabilities each recipe needs to be EXECUTABLE, optionally
// per modality. This table encodes execution requirements only — it never
// restates pedagogical gates.
const RECIPE_RUNTIME_REQUIREMENTS = [
  { recipe: 'listening_recognition', modality: null, needs: ['audio_output'] },
  { recipe: 'guided_production', modality: 'speaking', needs: ['speech_input', 'semantic_assessment'] },
  { recipe: 'guided_production', modality: 'writing', needs: ['text_input', 'semantic_assessment'] },
  { recipe: 'free_production', modality: 'speaking', needs: ['speech_input', 'semantic_assessment'] },
  { recipe: 'free_production', modality: 'writing', needs: ['text_input', 'semantic_assessment'] },
  { recipe: 'pronunciation', modality: null, needs: ['speech_input', 'pronunciation_assessment'] },
  { recipe: 'fixed_element_completion', modality: null, needs: ['text_input'] },
  { recipe: 'word_order_reconstruction', modality: null, needs: ['text_input'] },
]

/**
 * Compute the runtime availability restrictions to hand to the engine:
 * a list of { recipe, modality (null = every modality), reason } for every
 * recipe/modality this runtime cannot execute. Reason codes are the
 * RUNTIME_*_UNAVAILABLE constants and end up verbatim in the selection trace.
 */
export function computeRecipeRuntimeAvailability(capabilities) {
  const unavailable = []
  for (const req of RECIPE_RUNTIME_REQUIREMENTS) {
    const missing = req.needs.find((c) => !capabilities?.[c])
    if (missing) unavailable.push({ recipe: req.recipe, modality: req.modality, reason: RUNTIME_REASON_CODES[missing] })
  }
  return { unavailable }
}

/** True when this runtime can execute the given (recipe, modality) pair. */
export function isRecipeExecutable(availability, recipe, modality) {
  return !(availability?.unavailable || []).some((u) =>
    u.recipe === recipe && (u.modality == null || u.modality === modality))
}
