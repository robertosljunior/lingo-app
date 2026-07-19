// simulation-personas.js — deterministic ARTIFICIAL personas for the pedagogy
// V2 simulation harness (Slice V2.7). These are behavioral models, NOT real
// people and NOT learner-model state: each persona is a plain config object of
// base success probabilities per capability (and per capability key when a
// specific asymmetry matters), plus how support, independence, practice and
// forgetting modulate that success. The actual (deterministic) success draw
// lives in simulation-response-model.js.
//
// This module imports nothing from the pedagogical algorithms.

// Base success probability by capability, overridable per capability key.
// Support/independence/learning/forgetting modulate this in the response model.
function persona(cfg) {
  return {
    forgetting: { enabled: false, half_life_days: 7 },
    support_bonus: 0.15,
    independent_penalty: 0.05,
    learning_rate: 0.05,
    max_learning_gain: 0.25,
    learning_rate_by_key: {},
    skill_by_key: {},
    ...cfg,
  }
}

// 4.1 New learner — no prior knowledge; reasonable recognition after exposure,
// weak initial production, gradual improvement.
const NEW_LEARNER = persona({
  id: 'new-learner',
  label: 'Aprendiz novo',
  description: 'Sem conhecimento prévio; reconhecimento razoável após exposição, produção inicial fraca, melhora gradual.',
  skill: { recognition: 0.7, comprehension: 0.6, controlled_production: 0.45, free_production: 0.3, pronunciation: 0.5 },
  learning_rate: 0.06,
  max_learning_gain: 0.25,
})

// 4.2 Strong reader, weak listener — proves the system never fuses modalities.
const STRONG_READER_WEAK_LISTENER = persona({
  id: 'strong-reader-weak-listener',
  label: 'Leitor forte, ouvinte fraco',
  description: 'Leitura forte; listening persistentemente mais fraco (não melhora rápido).',
  skill: { recognition: 0.85, comprehension: 0.8, controlled_production: 0.7, free_production: 0.55, pronunciation: 0.5 },
  skill_by_key: {
    reading_recognition: 0.92, reading_comprehension: 0.88,
    listening_recognition: 0.4, listening_comprehension: 0.35,
  },
  // Listening barely improves — the asymmetry must persist.
  learning_rate_by_key: { listening_recognition: 0.01, listening_comprehension: 0.01 },
  learning_rate: 0.05,
})

// 4.3 Support dependent — high with word bank/multiple choice, low independent.
const SUPPORT_DEPENDENT = persona({
  id: 'support-dependent',
  label: 'Dependente de apoio',
  description: 'Alto desempenho com apoio (word bank/multiple choice), baixo desempenho independente.',
  skill: { recognition: 0.75, comprehension: 0.7, controlled_production: 0.55, free_production: 0.45, pronunciation: 0.5 },
  support_bonus: 0.4,
  independent_penalty: 0.5,
  learning_rate: 0.03,
})

// 4.4 Forgetful — learns initially, then fails after simulated intervals.
const FORGETFUL = persona({
  id: 'forgetful',
  label: 'Esquecido',
  description: 'Aprende inicialmente; apresenta falhas após intervalos simulados (retenção fraca).',
  skill: { recognition: 0.78, comprehension: 0.7, controlled_production: 0.6, free_production: 0.45, pronunciation: 0.5 },
  learning_rate: 0.05,
  forgetting: { enabled: true, half_life_days: 3 },
})

// 4.5 Fast progressing — few failures, strong independent production, advances
// without needing much review.
const FAST_LEARNER = persona({
  id: 'fast-learner',
  label: 'Aprendiz rápido',
  description: 'Poucas falhas; produção independente forte; avança rápido.',
  skill: { recognition: 0.95, comprehension: 0.92, controlled_production: 0.88, free_production: 0.82, pronunciation: 0.6 },
  support_bonus: 0.03,
  independent_penalty: 0,
  learning_rate: 0.08,
  max_learning_gain: 0.15,
})

// 4.6 Struggling — frequent errors, slow improvement; needs remediation without
// being trapped in an infinite loop.
const STRUGGLING = persona({
  id: 'struggling',
  label: 'Com dificuldade',
  description: 'Erros frequentes; melhora lenta; precisa de remediação sem loop infinito.',
  skill: { recognition: 0.45, comprehension: 0.4, controlled_production: 0.3, free_production: 0.22, pronunciation: 0.4 },
  support_bonus: 0.25,
  independent_penalty: 0.08,
  learning_rate: 0.02,
  max_learning_gain: 0.3,
})

// 4.7 Cross-pack transfer — competent; knows but-contrast (seeded via the
// scenario's initial_evidence), learns but...still, then meets although...still.
const CROSS_PACK_TRANSFER = persona({
  id: 'cross-pack-transfer',
  label: 'Transferência entre packs',
  description: 'Conhece contraste com but; aprende but...still; depois encontra although...still.',
  skill: { recognition: 0.82, comprehension: 0.78, controlled_production: 0.65, free_production: 0.5, pronunciation: 0.5 },
  learning_rate: 0.06,
})

export const SIMULATION_PERSONAS = Object.freeze({
  'new-learner': NEW_LEARNER,
  'strong-reader-weak-listener': STRONG_READER_WEAK_LISTENER,
  'support-dependent': SUPPORT_DEPENDENT,
  forgetful: FORGETFUL,
  'fast-learner': FAST_LEARNER,
  struggling: STRUGGLING,
  'cross-pack-transfer': CROSS_PACK_TRANSFER,
})

export const PERSONA_IDS = Object.keys(SIMULATION_PERSONAS)

export function getPersona(idOrObject) {
  if (idOrObject && typeof idOrObject === 'object' && idOrObject.skill) return idOrObject
  const id = typeof idOrObject === 'string' ? idOrObject : idOrObject?.id
  return SIMULATION_PERSONAS[id] || null
}
