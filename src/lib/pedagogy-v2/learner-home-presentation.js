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
import { loadPracticeCollectionsV2 } from './practice-collections.js'

// 2 = V2.22-UX2: the contextual catalogue replaces the per-pack category list.
export const LEARNER_HOME_PRESENTATION_VERSION = 2

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
  // V2.22-UX2 §5/§6 — a contextual collection is NOT a new mode: it rides on the
  // existing one as an optional scope, and the advisory format preference rides
  // beside it. Both are validated by the scope builder / the recipe table, not
  // here, so an unknown value can never silently become "no scope".
  const collectionId = params?.collection || null
  const format = params?.format || null
  return {
    mode,
    focusedPackId: mode === 'focused' ? pack : null,
    collectionId,
    recipePreference: recipeForPracticeFormatV2(format),
  }
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
/**
 * DEV/diagnostic ONLY (V2.22-UX2 §22). This used to build the learner-facing
 * "Escolher prática" list — one entry per authored pack, which is exactly the
 * model UX2 removes: a learner never decides to study `still`, `but` or `yet`.
 * The packs still organise the curriculum internally and focused mode still
 * exists as a diagnostic, so the function stays — but nothing learner-facing may
 * import it. The production Home uses buildPracticeCollectionCatalogV2.
 */
export function buildPracticeCategoriesV2DevOnly(registry) {
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

// ---- V2.22-UX2: contextual practice presentation ----------------------------
// Everything the new Home renders comes from HERE. React never writes a
// linguistic label, never counts targets and never decides which context a
// sentence belongs to (§4/§21).

/**
 * The learner-facing catalogue. Copy is the AUTHORED collection copy; the
 * internal packs a collection happens to span are deliberately NOT part of the
 * returned shape, so no screen can render a pack id even by accident (§28.6).
 */
// §10 — how many contexts are shown before progressive expansion. It lives HERE
// rather than in the component so the catalogue reads the same at 4, 8, 12 and
// 20 collections and the rule can be regression-tested: a short scannable list
// plus one honest "show the rest" control, never a wall of identical cards and
// never a mandatory carousel.
export const CATALOG_INITIAL_VISIBLE = 6

export function buildPracticeCollectionCatalogV2(doc = loadPracticeCollectionsV2(), { expanded = false } = {}) {
  const collections = doc.collections.map((c) => ({
    collection_id: c.collection_id,
    title: c.title_pt,
    description: c.description_pt,
    icon_role: c.icon_role ?? 'context',
  }))
  const visible = expanded ? collections : collections.slice(0, CATALOG_INITIAL_VISIBLE)
  return {
    presentation_version: LEARNER_HOME_PRESENTATION_VERSION,
    collections,
    visible,
    hidden_count: collections.length - visible.length,
    // The expansion control is the adapter's decision, not the component's.
    more_label: collections.length - visible.length > 0 ? 'Ver mais contextos' : null,
  }
}

/**
 * Practice FORMATS (§12) — a secondary control, never the main navigation. Each
 * maps to a real engine recipe; `mixed` is the absence of a preference, which is
 * the default and the honest one.
 */
// The `recipe` values MUST be real engine recipe ids — they are compared against
// `recipe.recipe` in the engine's scorer, so a name that does not exist in
// LESSON_RECIPES_V2 silently scores zero forever and leaves a dead chip on the
// Home, which is exactly what §13 forbids. `recipeForPracticeFormatV2` is
// regression-tested against the engine's own recipe table for that reason.
export const PRACTICE_FORMATS = Object.freeze([
  Object.freeze({ format: 'mixed', label: 'Praticar misturado', recipe: null }),
  Object.freeze({ format: 'scramble', label: 'Montar frases', recipe: 'word_order_reconstruction' }),
  Object.freeze({ format: 'completion', label: 'Completar', recipe: 'fixed_element_completion' }),
  Object.freeze({ format: 'writing', label: 'Escrever', recipe: 'guided_production' }),
])

export function recipeForPracticeFormatV2(format) {
  return PRACTICE_FORMATS.find((f) => f.format === format)?.recipe ?? null
}

export function buildRecipePreferenceOptionsV2() {
  return {
    presentation_version: LEARNER_HOME_PRESENTATION_VERSION,
    // The lead-in is deliberately tentative: a preference is advisory, so the
    // copy must not promise the format will be served (§13).
    lead_in: 'Também posso:',
    options: PRACTICE_FORMATS.map((f) => ({ format: f.format, label: f.label })),
  }
}

/**
 * The brief, factual entry state shown when a context is chosen (§17): the
 * authored title, no modal, no playlist, no promised activity count, no pack.
 */
export function buildContextualSessionEntryV2({ collectionTitle = null, format = 'mixed' } = {}) {
  const chosen = PRACTICE_FORMATS.find((f) => f.format === format) ?? PRACTICE_FORMATS[0]
  return {
    presentation_version: LEARNER_HOME_PRESENTATION_VERSION,
    context_title: collectionTitle,
    format_label: chosen.format === 'mixed' ? null : chosen.label,
  }
}

/**
 * §13 — the honest answer when a requested format has not materialized. It is
 * NOT an error and NOT a dead end: the session is real and running in the same
 * context, so the copy says what is happening and offers the preparatory work
 * that is actually being served. It never claims the activity was delivered.
 */
export function buildRecipePreferenceNoticeV2({ format = 'mixed', collectionTitle = null } = {}) {
  const chosen = PRACTICE_FORMATS.find((f) => f.format === format)
  if (!chosen || !chosen.recipe) return null
  return {
    presentation_version: LEARNER_HOME_PRESENTATION_VERSION,
    headline: `${chosen.label} ainda não está disponível aqui.`,
    body: collectionTitle
      ? `Vamos praticar o que prepara esse passo em "${collectionTitle}".`
      : 'Vamos praticar o que prepara esse passo.',
  }
}

/**
 * Contextual empty state (§19/§20). Honest: it never says the learner forgot
 * anything, and never promises new material the Planner cannot materialize.
 */
export function buildContextualEmptyStateV2({ mode = 'adaptive', collectionTitle = null } = {}) {
  const base = MODE_EMPTY_STATES[STUDY_MODES.includes(mode) ? mode : 'adaptive'] || MODE_EMPTY_STATES.adaptive
  return {
    presentation_version: LEARNER_HOME_PRESENTATION_VERSION,
    headline: collectionTitle ? `Nada para praticar em "${collectionTitle}" agora.` : base.headline,
    body: base.body,
    actions: base.actions,
  }
}
