// learner-presentation-v2.js — PURE learner-facing presentation adapter for the
// Slice V2.17 Learner UX. It turns the structured V2 pipeline output (Activity
// PlanV2 + ActivityResponseV2 + AssessmentResultV2 + StudyFocusV2 + transition)
// into the learner-facing shape the new lesson UI renders. It executes NO
// linguistic analysis, NO storage, NO clock and NO randomness.
//
// It sits ON TOP of the honesty guardian `buildV2FeedbackViewModel` (which
// partitions the assessor's OWN reported items into issues / suggestions /
// target-form / notes and never invents a cause). This adapter only adds a
// learner-facing PRESENTATION layer:
//
//   §5  A learner `visual_variant` is DISTINCT from the assessment outcome.
//       `outcome_status` stays the factual outcome the assessor decided; the
//       variant is a presentation bucket derived ONLY from structured data.
//   §6  The variant is derived from structured fields (outcome, diagnosis
//       causes, semantic relation / equivalence) — never from text diffing.
//   §7  VISUAL_VARIANT_MUST_NOT_CHANGE_ASSESSMENT_OUTCOME: this layer never
//       mutates outcome, evidence, diagnosis or semantic relation.
//   §9  NO_UI_INVENTED_LINGUISTIC_CLAIM: positive points, issues and
//       suggestions come only from real structured findings; absence of an
//       error never becomes "your grammar is correct".
//   §10 A semantic mismatch never asserts grammatical correctness.
//   §11 `incorrect_unspecified` (learner error, no cause) and
//       `unable_to_assess` (technical uncertainty — NOT the learner's fault)
//       have distinct copy.
//   §14 New-use is presented ONLY from real structured signals (focus reason
//       codes), never inferred from an ActivityPlan change.

import { buildV2FeedbackViewModel } from './feedback-view-model.js'
import { getLexemeAcrossRegistry, getPedagogyPack } from './registry.js'

export const LEARNER_PRESENTATION_VERSION = 1

// The learner-facing presentation buckets (§5). NONE of these is an assessment
// status — the assessment outcome lives in `feedback.outcome_status`.
export const LEARNER_VISUAL_VARIANTS = [
  'correct',
  'suggestion',
  'partial',
  'linguistic',
  'semantic',
  'incorrect_unspecified',
  'unable_to_assess',
]

// The reason codes that mark a genuine "new use of a word you already know"
// (§14). The learner never sees the codes themselves — only the derived copy.
export const NEW_USE_REASON_CODES = [
  'KNOWN_FUNCTION_NEW_CONSTRUCTION',
  'KNOWN_LEXEME_CONTEXT_EXTENDED',
  'KNOWN_CONSTRUCTION_REUSED_IN_NEW_PACK',
]
// Cross-pack transfer signals — surfaced only as a soft, id-free hint (§18).
export const CROSS_PACK_REASON_CODES = [
  'CROSS_PACK_TRANSFER_OPPORTUNITY',
  'CROSS_PACK_PREREQUISITE_MET',
]

// Learner-facing headlines/tones per visual variant (§6, handoff §05/§12). Copy
// only; the accent COLOR is a design token resolved in the component.
const VARIANT_COPY = {
  correct: { headline: 'Correto', tone: 'correct' },
  suggestion: { headline: 'Muito bom', tone: 'suggestion' },
  partial: { headline: 'Quase lá', tone: 'partial' },
  linguistic: { headline: 'Vamos ajustar', tone: 'linguistic' },
  semantic: { headline: 'Outra ideia', tone: 'semantic' },
  incorrect_unspecified: { headline: 'Ainda não', tone: 'unknown' },
  unable_to_assess: { headline: 'Não deu para confirmar', tone: 'unknown' },
}

// §11 — distinct copy for "no cause" (learner) vs "could not confirm"
// (technical). The second is explicitly NOT framed as the learner's error.
const INCORRECT_UNSPECIFIED_BODY = 'Essa resposta ainda não corresponde completamente ao que a atividade pediu.'
const UNABLE_TO_ASSESS_BODY = 'Não consegui confirmar essa resposta com segurança.'
// §10 — a meaning mismatch describes the IDEA, never grammar correctness.
const SEMANTIC_MISMATCH_BODY = 'A frase expressa uma ideia diferente da atividade.'

const LINGUISTIC_ISSUE_CATEGORIES = new Set(['grammar', 'lexical_choice', 'incomplete_response'])

function isUncertainEquivalence(assessment) {
  return assessment?.semantic_result?.semantic_equivalence?.status === 'uncertain'
}

/**
 * Derive the learner presentation `visual_variant` from STRUCTURED data only
 * (§6). Precedence, high → low:
 *   1. unable_to_assess — technical uncertainty (assessment could not confirm,
 *      or the composite equivalence is `uncertain`). NOT an error.
 *   2. correct / suggestion — an accepted answer, optionally with a naturalness
 *      suggestion. `suggestion` NEVER carries error language (§12).
 *   3. semantic — meaning not aligned (semantic_relation not_aligned or a
 *      structured semantic_context issue).
 *   4. linguistic — a structured grammar / lexical_choice / incomplete issue.
 *   5. partial — a coarse "partial" with no more specific category.
 *   6. incorrect_unspecified — "incorrect" with no structured cause.
 * Returns one of LEARNER_VISUAL_VARIANTS. It reads `vm` (the honesty view
 * model) and the diagnosis; it NEVER inspects raw response text.
 */
export function deriveVisualVariantV2({ vm, assessment }) {
  const status = vm?.status ?? 'not_assessed'
  const diagnosis = assessment?.diagnosis ?? null
  const hasNaturalness = (vm?.suggestions?.length ?? 0) > 0
  const issues = vm?.issues ?? []
  const semanticRelation = diagnosis?.semantic_relation?.status ?? null

  // 1. Technical uncertainty — surfaced honestly, never as a learner error.
  if (assessment?.status === 'unable_to_assess' || isUncertainEquivalence(assessment)) {
    return 'unable_to_assess'
  }

  // 2. Accepted answer.
  if (status === 'correct') {
    return hasNaturalness ? 'suggestion' : 'correct'
  }

  // 3. Meaning mismatch (structured). Checked BEFORE the coarse buckets so a
  //    semantic problem is never flattened into "partial"/"incorrect".
  const hasSemanticIssue = issues.some((i) => i.category === 'semantic_context')
  if (semanticRelation === 'not_aligned' || hasSemanticIssue) return 'semantic'

  // 4. Structured linguistic issue.
  if (issues.some((i) => LINGUISTIC_ISSUE_CATEGORIES.has(i.category))) return 'linguistic'

  // 5/6. Coarse outcomes with no more specific category.
  if (status === 'partial') return 'partial'
  if (status === 'incorrect') return 'incorrect_unspecified'

  // `not_assessed` that was not caught above (e.g. observed) has no feedback
  // panel; callers gate on `feedback === null`. Default to unable_to_assess as
  // the safest non-punitive bucket.
  return 'unable_to_assess'
}

// A single learner-facing issue: a short line plus optional deeper detail
// (progressive disclosure, §8). `span` is intentionally null — the UI must
// never invent a highlight (§14 lists it as a NEW backend field). We only pass
// through what the diagnosis actually authored.
function toLearnerIssue(issue) {
  const hasTitle = !!(issue.title && String(issue.title).trim())
  return {
    // When both a title and a body exist, the title is the visible line and the
    // body becomes the "Entender melhor" detail — real structured content, not
    // invented (§8/§9).
    text: hasTitle ? issue.title : issue.text,
    detail: hasTitle && issue.text && issue.text !== issue.title ? issue.text : null,
    span: null,
    category: issue.category ?? null,
  }
}

/**
 * Build the learner-facing feedback block from the honesty view model + the
 * raw assessment. Returns null when there is no feedback to show (no
 * assessment yet, or an observed exposure — which has no correct/incorrect).
 */
function buildLearnerFeedback({ plan, response, assessment, recordedEvidence }) {
  if (!assessment) return null
  // Exposure is observed, never graded — the UI shows no feedback panel (§20).
  if (plan?.recipe === 'exposure' || assessment.outcome === 'observed') return null

  const vm = buildV2FeedbackViewModel({ plan, response, assessment, recordedEvidence })
  const variant = deriveVisualVariantV2({ vm, assessment })
  const copy = VARIANT_COPY[variant]

  // Body copy: variant-specific, honest. Never asserts grammar correctness for
  // a semantic mismatch (§10); distinct wording for unspecified vs uncertain
  // (§11). A diagnostics note from the honesty VM is preserved as a fallback.
  let body = null
  if (variant === 'unable_to_assess') body = UNABLE_TO_ASSESS_BODY
  else if (variant === 'incorrect_unspecified') body = INCORRECT_UNSPECIFIED_BODY
  else if (variant === 'semantic') {
    // Prefer the assessor's own structured semantic explanation; otherwise the
    // safe idea-mismatch copy. Never a grammar claim.
    const semanticIssue = vm.issues.find((i) => i.category === 'semantic_context')
    body = semanticIssue?.text || SEMANTIC_MISMATCH_BODY
  }

  const issues = variant === 'linguistic'
    ? vm.issues.filter((i) => LINGUISTIC_ISSUE_CATEGORIES.has(i.category)).map(toLearnerIssue)
    : []

  // Naturalness suggestions are ALWAYS suggestions, never errors (§12). The
  // label distinguishes a naturalness alternative from a plain reference form.
  const suggestions = vm.suggestions.map((s) => ({
    text: s.text,
    label: variant === 'suggestion' ? 'Forma mais natural' : 'Uma forma possível',
  }))

  // §13 — the authored reference form is informational ("Uma forma possível"),
  // never "Resposta correta"; a different target form ≠ wrong meaning.
  const target_form = vm.target_form
    ? { text_en: vm.target_form.text_en, text_pt: vm.target_form.text_pt ?? null, label: 'Uma forma possível' }
    : null

  // Progressive disclosure: only real, distinct explanatory content (§8).
  let detail = issues.find((i) => i.detail)?.detail ?? null
  if (!detail && (variant === 'semantic' || variant === 'linguistic')) {
    // A diagnostics note is honest deeper context when present.
    detail = vm.diagnostics.note && vm.diagnostics.note !== body ? vm.diagnostics.note : null
  }

  return {
    // §5 — factual outcome, NEVER changed by the visual layer.
    outcome_status: vm.status,
    // §5 — learner presentation bucket, DISTINCT from the outcome.
    visual_variant: variant,
    tone: copy.tone,
    headline: copy.headline,
    body,
    correct_points: vm.correct_points.map((p) => ({ text: p.text })),
    issues,
    suggestions,
    target_form,
    target_form_note: vm.target_form_note ?? null,
    detail,
    // Provenance kept for the summary/regression tests; never shown raw.
    _provenance: vm.diagnostics.provenance.code,
  }
}

function lemmaForPack(packId, plan, registry) {
  if (plan?.lexeme_lemma) return plan.lexeme_lemma
  if (!registry || !packId) return null
  const pack = getPedagogyPack(packId, registry)
  const lexId = pack?.manifest?.primary_lexeme_id
  return getLexemeAcrossRegistry(lexId, registry)?.lexeme?.lemma ?? lexId ?? null
}

/**
 * Structured proof that THIS lexeme was encountered before (V2.17-R §2). A
 * new-use RELATION reason code proves related knowledge of a function or a
 * construction — it does NOT prove the learner has met the current word. We only
 * claim familiarity when a target of the focus's pack (its own senses /
 * constructions) already has real exposure in the learner state built BEFORE
 * this activity. No learnerStates / registry ⇒ cannot prove ⇒ false.
 */
function lexemeIsFamiliarV2({ focus, registry, learnerStates }) {
  if (!Array.isArray(learnerStates) || !learnerStates.length) return false
  const packId = focus?.pack_id
  if (!packId || !registry) return false
  const pack = getPedagogyPack(packId, registry)
  if (!pack) return false
  const targetIds = new Set()
  for (const s of pack.senses || []) targetIds.add(s.sense_id)
  for (const c of pack.constructions || []) targetIds.add(c.construction_id)
  if (!targetIds.size) return false
  return learnerStates.some((st) => targetIds.has(st?.target?.target_id) && (st?.exposure?.count || 0) > 0)
}

/**
 * New-use presentation (§14/§15/§16 + V2.17-R §2). The affirmation "Você já
 * conhece {word}." requires STRUCTURED evidence that the current lexeme was met
 * before — never inferred from a relation reason code alone. When a useful new-
 * use relation exists but familiarity cannot be proven, a NEUTRAL headline is
 * used (never claiming the learner already knows this word). The previous use is
 * never framed as replaced or wrong (§16 — no strike-through).
 */
function buildNewUse({ focus, plan, registry, learnerStates }) {
  if (!focus) return null
  const codes = focus.reason_codes || []
  const isNewUse = codes.some((c) => NEW_USE_REASON_CODES.includes(c))
  if (!isNewUse) return null
  const word = lemmaForPack(focus.pack_id, plan, registry)
  // Cross-pack hint derives from the CURRENT focus reason codes (correct
  // provenance), and never exposes the code itself (§18/§3).
  const crossHint = codes.some((c) => CROSS_PACK_REASON_CODES.includes(c))
    ? 'Esta ideia se conecta a algo que você já praticou.'
    : null

  if (word && lexemeIsFamiliarV2({ focus, registry, learnerStates })) {
    return {
      known_word: word,
      headline: `Você já conhece “${word}”.`,
      subhead: 'Agora veja outra maneira de usar essa palavra.',
      // The old use stays valid — reassurance, never a correction.
      reassurance: 'O que você já sabia continua valendo.',
      cross_pack_hint: crossHint,
    }
  }
  // Useful relation but no proof of familiarity with the current word (§2).
  return {
    known_word: null,
    headline: 'Veja uma nova forma de expressar esta ideia.',
    subhead: null,
    reassurance: null,
    cross_pack_hint: crossHint,
  }
}

/**
 * Pack-transition presentation (§17 + V2.17-R §3). A pack switch is NOT
 * automatically a new use, so the copy is NEUTRAL — it never claims "a new way
 * to use a word". This is a PRESENTATIONAL interstitial only (no evidence /
 * target / Learner Model change); the old form is never struck through (§16).
 * The cross-pack hint derives from the CURRENT focus reason codes — NOT from
 * `transition.code`, which comes from the PACK_SWITCH_* family and is the wrong
 * provenance (§3).
 */
function buildTransition({ transition, plan, registry, focus }) {
  if (!transition || !transition.to_pack) return null
  const fromLemma = lemmaForPack(transition.from_pack, null, registry)
  const toLemma = lemmaForPack(transition.to_pack, plan, registry)
  const crossPack = (focus?.reason_codes || []).some((c) => CROSS_PACK_REASON_CODES.includes(c))
  return {
    from_label: fromLemma,
    to_label: toLemma,
    // Neutral — a pack switch does not imply a new use (§3).
    headline: toLemma ? `Agora vamos praticar “${toLemma}”.` : 'Vamos continuar',
    subhead: 'Vamos continuar sua prática.',
    cross_pack_hint: crossPack ? 'Esta ideia se conecta a algo que você já praticou.' : null,
  }
}

/**
 * The learner-facing activity payload — ONLY the fields the renderers need,
 * never internal ids, ranks, confidences or diagnosis codes (§37). The renderer
 * still receives the full plan for its response contract; this trimmed object
 * exists for the header/stage and for tests asserting no leakage.
 */
function buildActivityPresentation({ plan }) {
  if (!plan) return null
  return {
    recipe: plan.recipe,
    capability: plan.capability ?? null,
    modality: plan.modality ?? null,
    // Whether this recipe needs an explicit "Verificar" before feedback, or is
    // answered on tap / is a pure exposure (§31). Presentation only.
    needs_check: ['fixed_element_completion', 'word_order_reconstruction', 'guided_production', 'free_production'].includes(plan.recipe),
    is_exposure: plan.recipe === 'exposure',
  }
}

/**
 * buildLearnerPresentationV2 — the single learner-facing adapter (§4). PURE.
 *   buildLearnerPresentationV2({ plan, response, assessment, focus, transition, registry, recordedEvidence })
 * Returns { presentation_version, activity, focus, feedback, new_use,
 * transition, session_summary:null }. `session_summary` is built separately by
 * buildLearnerSessionSummaryV2 at the end of a session.
 */
export function buildLearnerPresentationV2({
  plan = null,
  response = null,
  assessment = null,
  focus = null,
  transition = null,
  registry = null,
  recordedEvidence = null,
  learnerStates = null,
} = {}) {
  const feedback = buildLearnerFeedback({ plan, response, assessment, recordedEvidence })
  const focusLabel = lemmaForPack(focus?.pack_id, plan, registry)
  return {
    presentation_version: LEARNER_PRESENTATION_VERSION,
    activity: buildActivityPresentation({ plan }),
    focus: focus ? { label: focusLabel } : null,
    feedback,
    new_use: buildNewUse({ focus, plan, registry, learnerStates }),
    transition: buildTransition({ transition, plan, registry, focus }),
    session_summary: null,
  }
}

/**
 * Fact-based session summary presentation (§27/§47). Derived ONLY from the
 * session interactions — NEVER mastery %, CEFR or "word mastered". Reuses the
 * factual `summarizeStudySessionV2` core and turns its counts into learner
 * sentences.
 */
export function buildLearnerSessionSummaryV2({ interactions = [], registry = null } = {}) {
  const facts = []

  // Activities practiced — always a verifiable fact.
  const n = interactions.length
  facts.push({ icon: '✎', text: `Você praticou ${n} ${n === 1 ? 'atividade' : 'atividades'}.` })

  // Modalities actually practiced (reading/listening/writing/speaking).
  const MODALITY_PT = { reading: 'leitura', listening: 'escuta', writing: 'escrita', speaking: 'fala' }
  const modalities = [...new Set(interactions.map((it) => it.plan?.modality).filter(Boolean))]
    .map((m) => MODALITY_PT[m] || m)
  if (modalities.length) {
    const list = modalities.length === 1 ? modalities[0]
      : `${modalities.slice(0, -1).join(', ')} e ${modalities[modalities.length - 1]}`
    facts.push({ icon: '↔', text: `Você praticou ${list}.` })
  }

  // NOTE (V2.17-R §4): we intentionally do NOT report "N formas de usar X". Sense
  // and construction are DISTINCT dimensions that can describe the SAME use, so
  // summing them is not a verifiable "usage count". A real learner-facing usage
  // unit must be defined first; until then only provable facts are shown.

  // New use(s) introduced this session — from focus new-target flags.
  const newUseLemmas = [...new Set(interactions
    .filter((it) => (it.focus?.reason_codes || []).some((c) => NEW_USE_REASON_CODES.includes(c)))
    .map((it) => lemmaForPack(it.focus?.pack_id, it.plan, registry))
    .filter(Boolean))]
  for (const lemma of newUseLemmas) {
    facts.push({ icon: '✦', text: `Novo uso encontrado: “${lemma}”.` })
  }

  return { presentation_version: LEARNER_PRESENTATION_VERSION, facts }
}
