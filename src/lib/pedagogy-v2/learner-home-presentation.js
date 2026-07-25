// learner-home-presentation.js — PURE learner-facing presentation for the Slice
// V2.18 V2 Learner Home. It turns the minimal, factual inputs (a profile name)
// into the Home's learner-facing shape. It runs NO Planner, chooses NO target /
// pack / capability / modality, computes NO mastery, and reads NO clock or
// randomness. The Home only PRESENTS the real study modes; the V2 pipeline
// decides what to study once a mode session starts.
//
// It also owns the mode-aware SESSION RESULT presentation: an ended session with
// real interactions is a factual summary (reusing V2.17-R), while a session that
// produced ZERO activities is an honest EMPTY state — never "you practiced 0
// activities" (§18).

import { STUDY_MODES } from './study-planner-contracts.js'
import { buildLearnerSessionSummaryV2 } from './learner-presentation-v2.js'

export const LEARNER_HOME_PRESENTATION_VERSION = 1

/**
 * Resolve the requested Study mode from navigation params (§11/§29). Explicit
 * `mode` wins; a bare `pack` is treated as focused for backwards compatibility.
 * Invalid modes and a focused mode without a pack are STRUCTURAL errors — never
 * a silent fallback to adaptive. Pure — this is the exact value handed to
 * createStudySessionControllerV2.
 */
export function resolveLessonModeV2(params = {}) {
  const pack = params?.pack || null
  const mode = params?.mode || (pack ? 'focused' : 'adaptive')
  if (!STUDY_MODES.includes(mode)) return { error: 'MODE_INVALID' }
  if (mode === 'focused' && !pack) return { error: 'FOCUSED_REQUIRES_PACK' }
  return { mode, focusedPackId: mode === 'focused' ? pack : null }
}

// The placeholder profile name seeded on first run — treat it as "no name" so
// the greeting never reads "Bom te ver, Você." (§24).
const PLACEHOLDER_NAMES = new Set(['você', 'voce'])

// Learner-facing context label per study mode (§13). Presentation only — the
// technical mode name is never shown to the learner.
export const SESSION_CONTEXT_LABELS = Object.freeze({
  adaptive: 'Prática',
  explore: 'Explorar',
  review: 'Revisão',
  focused: 'Prática',
})

// The three study entries the Home offers. `mode` is the REAL Study Planner mode
// handed to createStudySessionControllerV2 — never a cosmetic label (§9/§10).
const PRIMARY_ACTION = Object.freeze({
  mode: 'adaptive',
  label: 'Praticar agora',
  // Factual: the next exercise starts from the accumulated Learner Model — NOT a
  // promise to resume a persisted session (§7).
  description: 'O próximo exercício parte do que você já praticou.',
})
const SECONDARY_ACTIONS = Object.freeze([
  Object.freeze({ mode: 'explore', label: 'Explorar', description: 'Descubra novos usos e conexões.' }),
  // Review copy is non-punitive — never "fix your mistakes" / "you forgot" (§10).
  Object.freeze({ mode: 'review', label: 'Revisão', description: 'Recupere algo que você já encontrou.' }),
])

function greetingFor(profileName) {
  const name = typeof profileName === 'string' ? profileName.trim() : ''
  if (name && !PLACEHOLDER_NAMES.has(name.toLowerCase())) return `Bom te ver, ${name}.`
  return 'Bom te ver de novo.'
}

/**
 * V2.21-R2 §19/§20 — the learner-facing "Escolher prática" entries, one per
 * authored pack. Copy comes STRAIGHT from the authored manifest
 * (`title.pt` / `short_description_pt`); React never infers a linguistic
 * description, and no technical id ever reaches the screen.
 *
 * Each entry carries the REAL focused-mode arguments, so tapping it starts the
 * same createStudySessionControllerV2 in `focused` mode for that pack. Choosing
 * a category picks the PACK, never a sentence: the Planner and the Engine keep
 * deciding target, recipe and exemplar inside it (§22).
 */
export function buildPracticeCategoriesV2(registry) {
  return (registry?.packs || [])
    .map((pack) => {
      const m = pack?.manifest
      if (!m?.pack_id) return null
      // "still — usos progressivos" → "Still": the learner sees the word, not
      // the authoring title.
      const lemma = String(m.title?.pt ?? '').split('—')[0].trim()
      if (!lemma) return null
      return {
        pack_id: m.pack_id,
        label: lemma.charAt(0).toUpperCase() + lemma.slice(1),
        description: m.short_description_pt ?? '',
        mode: 'focused',
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.pack_id.localeCompare(b.pack_id))
}

/**
 * buildLearnerHomePresentationV2 — the pure Home adapter (§15). Deterministic.
 *   buildLearnerHomePresentationV2({ profileName })
 * Returns { presentation_version, greeting, subhead, primary_action, actions,
 * facts }. No Planner is run; `facts` stays empty unless an OBJECTIVELY derivable
 * fact is supplied by the caller (none in this slice — the Home stays lean, §23).
 */
export function buildLearnerHomePresentationV2({ profileName = null, facts = [] } = {}) {
  return {
    presentation_version: LEARNER_HOME_PRESENTATION_VERSION,
    greeting: greetingFor(profileName),
    subhead: 'Vamos praticar hoje?',
    primary_action: PRIMARY_ACTION,
    actions: SECONDARY_ACTIONS,
    // Only verifiable facts belong here; never mastery %, CEFR or skill scores
    // (§20/§21). Callers may pass derived facts, but the Home invents none.
    facts: Array.isArray(facts) ? facts : [],
  }
}

// Mode-aware learner-facing EMPTY states (§17). Headlines/bodies are neutral and
// never claim "course finished" / "mastered everything" / "100%".
const MODE_EMPTY_STATES = Object.freeze({
  review: {
    headline: 'Nada para revisar agora.',
    body: 'Você pode continuar praticando ou explorar algo novo.',
    actions: [{ mode: 'adaptive', label: 'Praticar agora' }, { mode: 'explore', label: 'Explorar' }],
  },
  explore: {
    headline: 'Nada novo disponível agora.',
    body: 'Você pode continuar praticando o que já encontrou.',
    actions: [{ mode: 'adaptive', label: 'Praticar agora' }],
  },
  adaptive: {
    headline: 'Não há uma prática disponível agora.',
    body: 'Volte mais tarde para continuar aprendendo.',
    actions: [{ mode: 'adaptive', label: 'Tentar de novo' }],
  },
  focused: {
    headline: 'Não há uma prática disponível agora.',
    body: 'Volte mais tarde para continuar aprendendo.',
    actions: [{ mode: 'adaptive', label: 'Praticar agora' }],
  },
})

/**
 * Mode-aware session-result presentation (§18/§19). A session with real
 * interactions is a factual `completed` summary (reusing V2.17-R); a session
 * that produced NO activity is an honest `empty` state — it must NEVER pretend a
 * session happened ("Você praticou 0 atividades.").
 */
export function buildLearnerSessionResultV2({ interactions = [], mode = 'adaptive', registry = null } = {}) {
  const safeMode = STUDY_MODES.includes(mode) ? mode : 'adaptive'
  if (!Array.isArray(interactions) || interactions.length === 0) {
    const e = MODE_EMPTY_STATES[safeMode] || MODE_EMPTY_STATES.adaptive
    return { presentation_version: LEARNER_HOME_PRESENTATION_VERSION, kind: 'empty', mode: safeMode, headline: e.headline, body: e.body, actions: e.actions }
  }
  return {
    presentation_version: LEARNER_HOME_PRESENTATION_VERSION,
    kind: 'completed',
    mode: safeMode,
    summary: buildLearnerSessionSummaryV2({ interactions, registry }),
  }
}
