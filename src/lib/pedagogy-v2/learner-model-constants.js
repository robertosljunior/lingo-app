// learner-model-constants.js — taxonomies and tuning constants of the learner
// model V2. Every number here is a VERSIONED PEDAGOGICAL HEURISTIC (see
// LEARNER_MODEL_VERSION / AGGREGATION_VERSION), not a scientifically validated
// parameter. Changing any value requires bumping AGGREGATION_VERSION so stored
// aggregates can be rebuilt from evidence.
//
// Core principle encoded by these tables: "knowing a word" is not one state —
// recognition ≠ production, reading ≠ listening, supported ≠ independent, and
// exposure ≠ mastery.

export const LEARNER_EVIDENCE_SCHEMA_VERSION = 1
export const LEARNER_MODEL_VERSION = 1
export const AGGREGATION_VERSION = 1

// ---- activities ------------------------------------------------------------
// V2-native taxonomy. Deliberately NOT the V1 exercise families — a future
// bridge may map V1 exercise types onto these, never the other way around.
export const ACTIVITY_KINDS = [
  'exposure',
  'meaning_recognition',
  'form_recognition',
  'listening_recognition',
  'controlled_completion',
  'controlled_transformation',
  'guided_production',
  'free_production',
  'pronunciation',
]

// ---- capabilities and modalities -------------------------------------------
export const CAPABILITIES = ['recognition', 'comprehension', 'controlled_production', 'free_production', 'pronunciation']
export const MODALITIES = ['reading', 'listening', 'writing', 'speaking', 'multimodal']

// Compatibility matrix: which modalities can carry evidence for a capability.
// Receptive capabilities pair with receptive modalities; productive with
// productive; pronunciation is speaking-only. `multimodal` covers activities
// mixing text+audio on the receptive side.
export const CAPABILITY_MODALITIES = {
  recognition: ['reading', 'listening', 'multimodal'],
  comprehension: ['reading', 'listening', 'multimodal'],
  controlled_production: ['writing', 'speaking'],
  free_production: ['writing', 'speaking'],
  pronunciation: ['speaking'],
}

// Which capabilities (and modalities) each activity kind may legitimately
// assess. Coherence guard: a "free_production" activity can never emit
// recognition evidence by accident.
export const ACTIVITY_KIND_RULES = {
  exposure: { capabilities: ['recognition', 'comprehension'], modalities: ['reading', 'listening', 'multimodal'] },
  meaning_recognition: { capabilities: ['recognition', 'comprehension'], modalities: ['reading', 'listening', 'multimodal'] },
  form_recognition: { capabilities: ['recognition'], modalities: ['reading', 'listening', 'multimodal'] },
  listening_recognition: { capabilities: ['recognition', 'comprehension'], modalities: ['listening'] },
  controlled_completion: { capabilities: ['controlled_production'], modalities: ['writing', 'speaking'] },
  controlled_transformation: { capabilities: ['controlled_production'], modalities: ['writing', 'speaking'] },
  guided_production: { capabilities: ['controlled_production', 'free_production'], modalities: ['writing', 'speaking'] },
  free_production: { capabilities: ['free_production'], modalities: ['writing', 'speaking'] },
  pronunciation: { capabilities: ['pronunciation'], modalities: ['speaking'] },
}

// ---- attribution ------------------------------------------------------------
// direct   — the activity assessed this target as its focus.
// indirect — the target occurred and yielded secondary evidence.
// exposure — the learner merely encountered the target (no active retrieval);
//            updates exposure counters ONLY, never mastery.
export const ATTRIBUTIONS = ['direct', 'indirect', 'exposure']
export const ATTRIBUTION_WEIGHT = { direct: 1, indirect: 0.5, exposure: 0 }

// ---- outcomes ---------------------------------------------------------------
export const OUTCOMES = ['correct', 'partial', 'incorrect', 'observed', 'not_assessed']
// Outcomes that update mastery lanes. `observed`/`not_assessed` are stored for
// history and exposure but never behave like assessed answers.
export const ASSESSED_OUTCOMES = ['correct', 'partial', 'incorrect']

// ---- support ----------------------------------------------------------------
export const SUPPORT_FEATURES = [
  'translation', 'image', 'word_bank', 'multiple_choice', 'hint',
  'model_sentence', 'audio_replay', 'answer_reveal',
]

export const SUPPORT_TIERS = ['none', 'low', 'medium', 'high', 'answer_revealed']

// Feature → tier table used by deriveSupportTier (highest tier wins; hints
// escalate: 1 hint = medium, 2+ hints = high). Rationale:
//   low    — playback aids that do not hand over content (audio_replay)
//   medium — meaning scaffolds (translation, image, a single hint)
//   high   — form scaffolds that constrain the answer space
//            (word_bank, multiple_choice, model_sentence, 2+ hints)
//   answer_revealed — the answer was shown; what follows is accompanied
//            practice, never independent retrieval.
export const SUPPORT_FEATURE_TIER = {
  audio_replay: 'low',
  translation: 'medium',
  image: 'medium',
  hint: 'medium',
  word_bank: 'high',
  multiple_choice: 'high',
  model_sentence: 'high',
  answer_reveal: 'answer_revealed',
}

// Weight multiplier per tier. Ordering is a hard requirement proven by tests:
// none > high (e.g. word_bank) > answer_revealed > exposure(=0).
export const SUPPORT_TIER_WEIGHT = { none: 1, low: 0.85, medium: 0.6, high: 0.4, answer_revealed: 0.15 }

// Independence policy (documented decision): ONLY tier 'none' counts toward the
// `independent` lane. low/medium/high count toward `supported`;
// 'answer_revealed' counts toward `supported` with its (very low) weight and
// can never reach `independent`.
export const INDEPENDENT_TIERS = ['none']

// ---- attempts ---------------------------------------------------------------
// Later attempts weigh less (mirrors the V1 retry heuristic, restated for V2):
// 1st = 1, 2nd = 0.5, 3rd+ = 0.25.
export function attemptFactor(attemptNumber) {
  if (attemptNumber <= 1) return 1
  if (attemptNumber === 2) return 0.5
  return 0.25
}

// ---- mastery smoothing --------------------------------------------------------
// Bayesian-style smoothing (Laplace prior of 1 success / 2 observations ≙ prior
// estimate 0.5) so one correct answer can never read as 100% mastery:
// mastery = (weighted_success + 1) / (effective_weight + 2).
export const MASTERY_PRIOR_SUCCESS = 1
export const MASTERY_PRIOR_TOTAL = 2

// Evidence levels depend on effective (weighted) evidence, not on the mastery
// value: a single unassisted correct answer (weight 1) stays 'insufficient'.
export const EVIDENCE_LEVEL_THRESHOLDS = { emerging: 2, established: 5 }

// Trend: over the last TREND_WINDOW assessed events of a lane (chronological),
// require ≥ TREND_MIN_EVENTS, then compare the mean score of the last 3 against
// the previous 3; |diff| ≥ TREND_DELTA decides improving/declining.
export const TREND_WINDOW = 10
export const TREND_MIN_EVENTS = 6
export const TREND_DELTA = 0.15

// ---- retention ----------------------------------------------------------------
// A retrieval is an ASSESSED, DIRECT, non-answer_revealed event. It counts as
// "delayed" when at least DELAYED_RETRIEVAL_MS elapsed since the previous
// retrieval of the same capability key (per target, per profile).
export const DELAYED_RETRIEVAL_MS = 24 * 60 * 60 * 1000

// Stability heuristic v1 (documented, versioned, NOT scientifically validated):
//   - no stability until the first successful delayed retrieval;
//   - successful delayed retrieval over interval I (days):
//       stability = I                          when there was none
//       stability = max(prev * STABILITY_GROWTH, (prev + I) / 2)   otherwise
//     (strictly increases on success);
//   - failed delayed retrieval: stability = prev * STABILITY_DECAY;
//   - short-interval events never move stability;
//   - capped at STABILITY_MAX_DAYS.
export const STABILITY_GROWTH = 1.2
export const STABILITY_DECAY = 0.5
export const STABILITY_MAX_DAYS = 365

// Source types accepted on evidence records. `legacy_answer_bridge` reserves a
// name for a FUTURE V1-answer import — its existence does not migrate anything.
export const SOURCE_TYPES = ['v2_activity', 'legacy_answer_bridge', 'manual_import', 'test']
