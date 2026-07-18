// lesson-engine.js — lesson engine V2 (Slice V2.3-R): pure, deterministic
// next-activity selection over authored V2 content and the APPROVED learner
// model V2 (per-capability-key lanes, exposure, retention, evidence levels).
//
// Hard guarantees:
//   - never generates language: plans present authored exemplar material only;
//     recognition options come from authored translations (source_exemplar_id);
//   - no Math.random, no Date.now in this module: time arrives via the session
//     (session.now) or context; ties are broken by a seeded deterministic hash
//     so different seeds may only permute EQUAL-score candidates;
//   - every taxonomy is imported from the approved V2.2 contracts;
//   - all pedagogical thresholds live in the versioned policy.

import { EXPOSURE_STAGES, stageIndex } from './contracts.js'
import { deriveSupportTier } from './learner-evidence-contracts.js'
import {
  getPrimaryTargets, getSecondaryTargets, getV2Prerequisites,
  getV1BridgePrerequisites, getIntendedNewItems, getConstruction,
} from './query.js'
import {
  LESSON_ENGINE_V2_VERSION, LESSON_RECIPES,
  DEFAULT_LESSON_ENGINE_POLICY_V2, mergeLessonEnginePolicyV2,
  newItemsIntroducedInSessionV2, ACTIVITY_PLAN_V2_VERSION,
} from './lesson-engine-contracts.js'
import {
  indexStatesByTargetId, getLane, laneMeets, exposureCount,
  assessTargetPrerequisite, bestOverallMastery, independentUnlocked,
  retentionDueRatio, lastAssessedOutcomeByTarget,
} from './lesson-engine-state-queries.js'

export { DEFAULT_LESSON_ENGINE_POLICY_V2, mergeLessonEnginePolicyV2 }

// Recommended initial progression (§ heuristic, NOT a rigid chain): earlier
// rungs with open gaps score higher via the `ladder` component, but nothing
// here hard-blocks a later capability whose gate is open.
const CAPABILITY_LADDER = ['recognition', 'comprehension', 'controlled_production', 'free_production', 'pronunciation']
const RECOGNITION_KEYS = ['reading_recognition', 'listening_recognition', 'multimodal_recognition']
const PRODUCTION_KEYS = ['writing_controlled_production', 'speaking_controlled_production', 'writing_free_production', 'speaking_free_production']

const clamp01 = (x) => Math.max(0, Math.min(1, x))

// FNV-1a — deterministic tie-break hash (seed + candidate identity).
function tieHash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

// Fixed pt-BR instruction copy per recipe (static UI strings, not generated
// language — the learner-facing sentences are always authored exemplars).
const INSTRUCTIONS_PT = {
  exposure: 'Leia a frase com atenção e observe como ela é usada.',
  meaning_recognition: 'Escolha a tradução correta da frase.',
  listening_recognition: 'Ouça a frase e escolha a tradução correta.',
  fixed_element_completion: 'Complete a frase com o que está faltando.',
  word_order_reconstruction: 'Coloque as palavras na ordem correta.',
  guided_production: 'Produza a frase em inglês para esta situação.',
  free_production: 'Responda à situação em inglês, com suas palavras.',
  pronunciation: 'Leia a frase em voz alta.',
}

// ---- multi-pack scope (Slice V2.5) ------------------------------------------
// The engine receives a FORMAL scope { registry, pack_id, lexeme_id } — never
// an informal array of packs. During a normal session only exemplars of the
// active pack are candidates; prerequisites and constructions resolve across
// the whole registry; learner states are consulted for targets of ANY pack.

function buildRegistryEntityIndex(registry) {
  const entities = new Map() // entity id → { pack_id, entity }
  for (const p of registry?.packs || []) {
    const packId = p.manifest?.pack_id
    const add = (id, entity) => { if (id && !entities.has(id)) entities.set(id, { pack_id: packId, entity }) }
    for (const l of p.lexemes || []) add(l.lexeme_id, l)
    for (const s of p.senses || []) add(s.sense_id, s)
    for (const c of p.constructions || []) add(c.construction_id, c)
    for (const f of p.communicative_functions || []) add(f.function_id, f)
    for (const e of p.exemplars || []) add(e.exemplar_id, e)
  }
  return entities
}

// ---- prerequisite assessment (tri-state) ------------------------------------

function assessExemplarPrerequisites(exemplar, statesById, policy, resolveV1Skill, registryIndex = null, activePackId = null) {
  const assessments = []
  for (const pr of getV2Prerequisites(exemplar)) {
    const status = assessTargetPrerequisite(statesById, pr.ref, policy.thresholds.prerequisite)
    const assessment = { kind: 'v2', type: pr.type, ref: pr.ref, status, blocking: status !== 'met' }
    // Trace requirement: record when a prerequisite is OWNED by another pack.
    const ownerPackId = registryIndex?.get(pr.ref)?.pack_id ?? null
    if (ownerPackId && activePackId && ownerPackId !== activePackId) {
      assessment.external = true
      assessment.owner_pack_id = ownerPackId
    }
    assessments.push(assessment)
  }
  for (const pr of getV1BridgePrerequisites(exemplar)) {
    let status = 'unknown'
    if (typeof resolveV1Skill === 'function') {
      const r = resolveV1Skill(pr.ref)
      status = r === true ? 'met' : r === false ? 'unmet' : 'unknown'
    }
    // Never silently assumed met: unknown stays unknown, advisory by default,
    // blocking only under an explicit strict policy.
    assessments.push({
      kind: 'grammar_skill_v1', type: pr.type, ref: pr.ref, status,
      blocking: policy.v1_bridge_mode === 'strict' && status !== 'met',
      advisory: policy.v1_bridge_mode !== 'strict',
    })
  }
  return assessments
}

// ---- recipe gates (soft ladder over the approved capability keys) -----------

function anyKeyMeets(state, keys, threshold) {
  return keys.some((k) => laneMeets(getLane(state, k, 'overall'), threshold))
}

function recipeGateOpen({ recipe, capability, modality, primaries, presented, statesById, policy }) {
  const adv = policy.thresholds.advancement
  const st = (id) => statesById.get(id)
  switch (recipe.recipe) {
    case 'exposure':
      // First contact only: something presented is still unseen.
      return presented.some((id) => exposureCount(st(id)) === 0)
    case 'meaning_recognition':
    case 'listening_recognition':
      if (!primaries.every((id) => exposureCount(st(id)) > 0)) return false
      if (capability === 'comprehension') {
        // Comprehension builds on recognition in the SAME modality.
        return primaries.every((id) => laneMeets(getLane(st(id), `${modality}_recognition`, 'overall'), adv))
      }
      return true
    case 'fixed_element_completion':
    case 'word_order_reconstruction':
    case 'guided_production':
      return primaries.every((id) => anyKeyMeets(st(id), RECOGNITION_KEYS, adv))
    case 'free_production':
      return primaries.every((id) => laneMeets(getLane(st(id), `${modality}_controlled_production`, 'overall'), adv))
    case 'pronunciation':
      return primaries.every((id) => anyKeyMeets(st(id), PRODUCTION_KEYS, adv))
    default:
      return false
  }
}

// ---- recognition options (authored translations only) -----------------------

// Structural normalization for translation comparison: two authored pt-BR
// sentences that differ only in case/punctuation/whitespace are the SAME
// alternative and may never appear together as distinct options. This is a
// structural audit only — no regex attempt at deep synonymy.
export function normalizeTranslationPt(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,;:!?…"'()\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildRecognitionOptionsV2(pack, exemplar, minOptions) {
  return buildRecognitionOptions(pack, exemplar, minOptions)
}

function buildRecognitionOptions(pack, exemplar, minOptions) {
  const targetSenses = new Set(exemplar.sense_ids || [])
  const rows = [{ text_pt: exemplar.text_pt, source_exemplar_id: exemplar.exemplar_id, is_target: true }]
  const seenNormalized = new Set([normalizeTranslationPt(exemplar.text_pt)])
  const others = (pack.exemplars || []).filter((o) =>
    o.exemplar_id !== exemplar.exemplar_id && o.text_pt && o.text_pt !== exemplar.text_pt)
  // Prefer distractors realizing a DIFFERENT sense (meaning contrast), fall
  // back to same-sense exemplars; authored order keeps it deterministic.
  const ordered = [
    ...others.filter((o) => !(o.sense_ids || []).some((sid) => targetSenses.has(sid))),
    ...others.filter((o) => (o.sense_ids || []).some((sid) => targetSenses.has(sid))),
  ]
  for (const o of ordered) {
    if (rows.length >= minOptions) break
    const normalized = normalizeTranslationPt(o.text_pt)
    if (seenNormalized.has(normalized)) continue // identical or near-identical translation
    seenNormalized.add(normalized)
    rows.push({ text_pt: o.text_pt, source_exemplar_id: o.exemplar_id, is_target: false })
  }
  if (rows.length < minOptions) return null
  rows.sort((a, b) => (a.text_pt < b.text_pt ? -1 : a.text_pt > b.text_pt ? 1 : 0))
  return rows.map((r, i) => ({ option_id: `option:${i + 1}`, ...r }))
}

// ---- planned evidence -------------------------------------------------------
// Declares the evidence a future assessment slice COULD record — nothing is
// written here. Attributions are exactly the approved direct/indirect/exposure.

function plannedEvidenceFor(recipe, exemplar, capability, modality) {
  const targets = exemplar.pedagogical_targets || []
  const activity = { activity_kind: recipe.activity_kind, capability, modality }
  const entry = (t, attribution, possible_outcomes, condition = null) => ({
    target: { target_type: t.target_type, target_id: t.target_id },
    attribution,
    activity,
    possible_outcomes,
    ...(condition ? { condition } : {}),
  })
  switch (recipe.attribution_rule) {
    case 'exposure':
      // Only what is actually presented, observed — never assessed.
      return targets.map((t) => entry(t, 'exposure', ['observed']))
    case 'meaning_first':
      return targets.map((t) => entry(
        t,
        ['sense', 'communicative_function'].includes(t.target_type) ? 'direct' : 'indirect',
        ['correct', 'incorrect']))
    case 'form_first':
      return targets.map((t) => entry(
        t,
        ['construction', 'lexeme_usage'].includes(t.target_type) ? 'direct' : 'indirect',
        ['correct', 'partial', 'incorrect']))
    case 'assessed_only':
      // Free production: direct evidence ONLY for targets actually assessed —
      // the plan cannot promise assessment, so every entry is conditional.
      return targets.map((t) => entry(
        t,
        t.role === 'primary' ? 'direct' : 'indirect',
        ['correct', 'partial', 'incorrect'],
        'only_if_target_assessed'))
    default:
      return []
  }
}

// ---- presentation / response contract ---------------------------------------

function buildPresentation({ recipe, exemplar, variant, options }) {
  const base = { instructions_pt: INSTRUCTIONS_PT[recipe.recipe] }
  switch (recipe.recipe) {
    case 'exposure':
      return { ...base, show: ['text_en', 'text_pt', 'context'] }
    case 'meaning_recognition':
      return { ...base, show: ['text_en'], options }
    case 'listening_recognition':
      return {
        ...base, show: [], options,
        audio_reference: { type: 'authored_exemplar_audio', exemplar_id: exemplar.exemplar_id },
      }
    case 'fixed_element_completion':
      return {
        ...base, show: ['text_pt', 'context'],
        masked_text_source: { exemplar_id: exemplar.exemplar_id, mask: 'construction_fixed_elements' },
      }
    case 'word_order_reconstruction':
      return {
        ...base, show: ['text_pt'],
        token_source: { exemplar_id: exemplar.exemplar_id, tokenization: 'text_en_whitespace', presentation_order: 'lexicographic' },
      }
    case 'guided_production':
      return {
        ...base, show: ['context', 'text_pt'],
        model_reference: variant.features.includes('model_sentence') ? { exemplar_id: exemplar.exemplar_id } : null,
      }
    case 'free_production':
      return { ...base, show: ['context'] }
    case 'pronunciation':
      return {
        ...base, show: ['text_en'],
        audio_reference: variant.features.includes('audio_replay')
          ? { type: 'authored_exemplar_audio', exemplar_id: exemplar.exemplar_id } : null,
      }
    default:
      return base
  }
}

function buildResponseContract({ recipe, exemplar, modality, options }) {
  const expected_reference = { exemplar_id: exemplar.exemplar_id, text_en: exemplar.text_en }
  switch (recipe.response_type) {
    case 'acknowledge':
      return { response_type: 'acknowledge', evaluation: 'none' }
    case 'option_select':
      return {
        response_type: 'option_select',
        correct_option_id: options.find((o) => o.is_target).option_id,
        evaluation: 'option_match',
      }
    case 'text_input':
      return { response_type: 'text_input', expected_reference, evaluation: 'reference_match' }
    case 'ordered_tokens':
      return { response_type: 'ordered_tokens', expected_reference, evaluation: 'reference_match' }
    case 'produced_text':
      return {
        response_type: modality === 'speaking' ? 'spoken_text' : 'text_input',
        expected_reference,
        evaluation: 'external_assessment_required',
      }
    case 'spoken_audio':
      return { response_type: 'spoken_audio', expected_reference, evaluation: 'external_assessment_required' }
    default:
      return { response_type: 'acknowledge', evaluation: 'none' }
  }
}

// ---- selection --------------------------------------------------------------

// runtimeAvailability (optional, Slice V2.4): { unavailable: [{ recipe,
// modality|null, reason }] } — technical execution restrictions computed by the
// runtime (runtime-capabilities.js). Not pedagogy: filtered candidates land in
// the trace's `excluded` with the runtime reason code verbatim.
function runtimeUnavailableReason(runtimeAvailability, recipe, modality) {
  const hit = (runtimeAvailability?.unavailable || []).find((u) =>
    u.recipe === recipe && (u.modality == null || u.modality === modality))
  return hit ? hit.reason : null
}

// `focus` (optional, Slice V2.6): a restriction handed down by the Study
// Planner — { target_id, capability, modality }, every field optional. The
// engine keeps FULL authority over exemplar/recipe/support choice within the
// restriction; the planner never picks activities.
export function selectNextActivityV2({ session, scope = null, pack = null, learnerStates, recentEvidence, policy = {}, context = null, resolveV1Skill = null, runtimeAvailability = null, focus = null } = {}) {
  const p = mergeLessonEnginePolicyV2(policy)

  // Resolve the active pack: either through the formal multi-pack scope or the
  // legacy single-pack parameter (kept for single-pack callers/tests).
  let activePack = pack
  let registryIndex = null
  if (scope) {
    if (!scope.registry || !scope.pack_id) throw new Error('SCOPE_INVALID:registry and pack_id are required')
    activePack = (scope.registry.packs || []).find((x) => x.manifest?.pack_id === scope.pack_id) || null
    if (!activePack) throw new Error(`SCOPE_PACK_UNKNOWN:${scope.pack_id}`)
    registryIndex = buildRegistryEntityIndex(scope.registry)
    if (scope.lexeme_id && !registryIndex.has(scope.lexeme_id)) throw new Error(`SCOPE_LEXEME_UNKNOWN:${scope.lexeme_id}`)
  }
  const activePackId = activePack?.manifest?.pack_id || null
  const activeLexemeId = scope?.lexeme_id ?? activePack?.manifest?.primary_lexeme_id ?? null
  const activeLexeme = activeLexemeId
    ? (registryIndex?.get(activeLexemeId)?.entity ?? (activePack?.lexemes || []).find((l) => l.lexeme_id === activeLexemeId) ?? null)
    : null
  // Cross-pack construction resolution (an exemplar may formally reference a
  // construction owned by a dependency pack); in-pack resolution otherwise.
  const resolveConstruction = (id) => registryIndex?.get(id)?.entity ?? getConstruction(activePack, id)

  const states = learnerStates ?? context?.learner_states ?? []
  const recent = recentEvidence ?? context?.recent_evidence ?? []
  const nowIso = session?.now ?? context?.now
  const nowMs = Date.parse(nowIso)
  const statesById = indexStatesByTargetId(states)
  const history = session?.history || []
  const exemplars = activePack?.exemplars || []

  const baseDecision = {
    decision_version: 1,
    engine_version: LESSON_ENGINE_V2_VERSION,
    policy_version: p.policy_version,
    session_id: session?.session_id,
  }

  if (history.length >= p.max_activities_per_session) {
    return { ...baseDecision, status: 'session_complete', plan: null, trace: null }
  }

  const introduced = newItemsIntroducedInSessionV2(session)
  const budgetRemaining = Math.max(0, p.new_item_budget_per_session - introduced.size)
  const recentExemplars = history.slice(-p.exemplar_cooldown).map((h) => h.exemplar_id)
  const lastActivity = history[history.length - 1] || null
  const modalitiesUsed = new Set(history.map((h) => h.modality))
  const lastOutcome = lastAssessedOutcomeByTarget(recent)

  // Curricular frontier: earliest stage whose exemplar still has a primary
  // target NOT consolidated in recognition. Stages steer scoring, never block.
  const maxStageIdx = EXPOSURE_STAGES.length - 1
  let frontierIdx = maxStageIdx
  let frontierFound = false
  for (const e of exemplars) {
    const primaries = getPrimaryTargets(e).map((t) => t.target_id)
    if (!primaries.length) continue
    const consolidated = primaries.every((id) =>
      anyKeyMeets(statesById.get(id), RECOGNITION_KEYS, p.thresholds.advancement))
    if (!consolidated) {
      const idx = stageIndex(e.exposure_stage)
      if (!frontierFound || idx < frontierIdx) { frontierIdx = idx; frontierFound = true }
    }
  }

  const excluded = []
  const prereqByExemplar = new Map()

  const buildCandidates = (skipCooldown) => {
    const out = []
    exemplars.forEach((exemplar, authoredIndex) => {
      const primaryTargets = getPrimaryTargets(exemplar)
      const primaries = primaryTargets.map((t) => t.target_id)
      if (!primaries.length) return
      const presented = (exemplar.pedagogical_targets || []).map((t) => t.target_id)
      const exclude = (reason, recipe = null) => {
        if (!skipCooldown) excluded.push({ exemplar_id: exemplar.exemplar_id, ...(recipe ? { recipe } : {}), reason })
      }

      // Targeted practice: only exemplars declaring the focused target.
      if (p.targeted_practice?.target_id && !presented.includes(p.targeted_practice.target_id)) {
        exclude('not_targeted'); return
      }

      // Study-planner focus target: same semantics as targeted practice.
      if (focus?.target_id && !presented.includes(focus.target_id)) {
        exclude('not_focus_target'); return
      }

      // Tri-state prerequisites (V2 blocking; V1 bridges advisory by default).
      const assessments = assessExemplarPrerequisites(exemplar, statesById, p, resolveV1Skill, registryIndex, activePackId)
      prereqByExemplar.set(exemplar.exemplar_id, assessments)
      const blocking = assessments.find((a) => a.blocking)
      if (blocking) { exclude(`prerequisite_${blocking.status}:${blocking.ref}`); return }

      // New-item budget: only items with NO exposure at all still count as new.
      const newRefs = getIntendedNewItems(exemplar).map((n) => n.ref)
        .filter((ref) => exposureCount(statesById.get(ref)) === 0 && !introduced.has(ref))
      if (newRefs.length > budgetRemaining) { exclude('new_item_budget_exceeded'); return }

      if (!skipCooldown && recentExemplars.includes(exemplar.exemplar_id)) {
        exclude('exemplar_cooldown'); return
      }

      for (const recipe of LESSON_RECIPES) {
        for (const [capability, modality] of recipe.pairs) {
          // Study-planner focus restriction on capability/modality. When the
          // focus names a capability (deepen/review/remediate/independence),
          // the engine must TRAIN that capability — exposure is filtered too,
          // so a review never turns into a first-contact exposure of an
          // un-exposed co-target. Introduction focuses carry no capability and
          // let exposure through (the exposure gate limits it to new material).
          const exposureExempt = recipe.recipe === 'exposure' && !focus?.capability
          if (focus?.capability && capability !== focus.capability && !exposureExempt) {
            exclude('not_focus_capability', recipe.recipe); continue
          }
          if (focus?.modality && modality !== focus.modality && !exposureExempt) {
            exclude('not_focus_modality', recipe.recipe); continue
          }
          const runtimeReason = runtimeUnavailableReason(runtimeAvailability, recipe.recipe, modality)
          if (runtimeReason) { exclude(runtimeReason, recipe.recipe); continue }
          if (!recipeGateOpen({ recipe, capability, modality, primaries, presented, statesById, policy: p })) continue
          let options = null
          if (recipe.needs_options) {
            options = buildRecognitionOptions(activePack, exemplar, p.min_recognition_options)
            if (!options) { exclude('no_safe_options', recipe.recipe); continue }
          }
          const capKey = `${modality}_${capability}`
          for (const variant of recipe.variants) {
            if (variant.lane === 'independent'
              && !primaries.every((id) => independentUnlocked(statesById.get(id), capKey, p.thresholds))) continue
            out.push(scoreCandidate({ exemplar, authoredIndex, primaryTargets, primaries, newRefs, recipe, capability, modality, capKey, variant, options }))
          }
        }
      }
    })
    return out
  }

  const scoreCandidate = ({ exemplar, authoredIndex, primaryTargets, primaries, newRefs, recipe, capability, modality, capKey, variant, options }) => {
    // `need`: how weak the trained lane is for the weakest primary target.
    // Independent variants train (and are scored on) the independent lane.
    const laneName = variant.lane === 'independent' ? 'independent' : 'overall'
    let weakest = 1
    for (const id of primaries) {
      const m = getLane(statesById.get(id), capKey, laneName)?.mastery_estimate
      weakest = Math.min(weakest, m ?? 0)
    }
    const need = clamp01(1 - weakest)

    let retention = 0
    for (const id of primaries) {
      retention = Math.max(retention, clamp01(
        retentionDueRatio(statesById.get(id), capKey, { nowMs, defaultIntervalDays: p.retention.default_interval_days })
        / p.retention.due_cap))
    }

    const progression = clamp01(1 - Math.abs(stageIndex(exemplar.exposure_stage) - frontierIdx) / Math.max(1, maxStageIdx))

    let capability_gap = 0
    for (const id of primaries) {
      const state = statesById.get(id)
      if (!state) continue
      const cur = getLane(state, capKey, 'overall')?.mastery_estimate ?? 0
      capability_gap = Math.max(capability_gap, clamp01(bestOverallMastery(state) - cur))
    }

    const ladder = (CAPABILITY_LADDER.length - 1 - CAPABILITY_LADDER.indexOf(capability)) / (CAPABILITY_LADDER.length - 1)
    const independence = variant.lane === 'independent' ? 1 : 0
    // Novelty credit belongs to FIRST CONTACT: only the exposure recipe scores
    // it. Other recipes presenting a still-new item pay the budget (they do
    // expose the learner) but earn no introduction bonus.
    const novelty = recipe.recipe === 'exposure' && newRefs.length > 0 ? 1 : 0

    let diversity = 0.5
    if (lastActivity && lastActivity.construction_id === exemplar.construction_id) diversity -= 0.5
    if (!modalitiesUsed.has(modality)) diversity += 0.5
    diversity = clamp01(diversity)

    const recentlyMissed = primaries.some((id) => lastOutcome.get(id) === 'incorrect')
    const remediation = recentlyMissed && variant.lane === 'supported' ? 1 : 0

    const components = { need, retention, progression, capability_gap, ladder, independence, novelty, diversity, remediation }
    let score = 0
    for (const [k, v] of Object.entries(components)) score += (p.weights[k] ?? 0) * v
    return {
      exemplar, authoredIndex, primaryTargets, primaries, newRefs,
      recipe, capability, modality, capKey, variant, options,
      components, score: Math.round(score * 1e6) / 1e6,
    }
  }

  let candidates = buildCandidates(false)
  if (!candidates.length && excluded.some((x) => x.reason === 'exemplar_cooldown')) {
    candidates = buildCandidates(true) // repeating beats stalling the session
  }

  const compactCandidates = candidates.map((c) => ({
    exemplar_id: c.exemplar.exemplar_id,
    recipe: c.recipe.recipe,
    capability: c.capability,
    modality: c.modality,
    lane: c.variant.lane,
    score: c.score,
  }))

  const traceBase = {
    trace_version: 1,
    engine_version: LESSON_ENGINE_V2_VERSION,
    policy_version: p.policy_version,
    considered: candidates.length,
    frontier_stage: EXPOSURE_STAGES[frontierIdx],
    budget: { limit: p.new_item_budget_per_session, introduced: [...introduced].sort(), remaining_before: budgetRemaining },
    excluded,
    candidates: compactCandidates,
  }

  if (!candidates.length) {
    return { ...baseDecision, status: 'no_eligible_activity', plan: null, trace: traceBase }
  }

  // Deterministic pick: max score; EXACT ties resolved by seeded hash (a
  // different seed can only permute equal-score candidates), then by canonical
  // generation order.
  const bestScore = candidates.reduce((m, c) => Math.max(m, c.score), -Infinity)
  const tied = candidates.filter((c) => c.score === bestScore)
  const seed = String(session?.seed ?? session?.session_id ?? '')
  let best = tied[0]
  if (tied.length > 1) {
    let bestHash = Infinity
    for (const c of tied) {
      const h = tieHash(`${seed}|${c.exemplar.exemplar_id}|${c.recipe.recipe}|${c.capKey}|${c.variant.lane}`)
      if (h < bestHash) { bestHash = h; best = c }
    }
  }

  const e = best.exemplar
  const sequence_index = history.length
  const support = {
    features: [...best.variant.features],
    derived_tier: deriveSupportTier({ features: best.variant.features, hint_count: 0 }),
  }
  const construction = resolveConstruction(e.construction_id)
  const presentation = buildPresentation({ recipe: best.recipe, exemplar: e, variant: best.variant, options: best.options })
  if (best.recipe.recipe === 'fixed_element_completion' && construction) {
    presentation.masked_text_source.fixed_elements = [...(construction.fixed_elements || [])]
  }

  const trace = {
    ...traceBase,
    budget: { ...traceBase.budget, remaining_after: budgetRemaining - best.newRefs.length },
    tie_break: { tied: tied.length, seed },
    prerequisite_assessments: prereqByExemplar.get(e.exemplar_id) || [],
    score_breakdown: best.components,
    reasons: describeDecision(best, p),
  }

  const plan = {
    plan_version: ACTIVITY_PLAN_V2_VERSION,
    policy_version: p.policy_version,
    activity_id: `activity:${session.session_id}.${sequence_index}`,
    session_id: session.session_id,
    sequence_index,
    recipe: best.recipe.recipe,
    activity_kind: best.recipe.activity_kind,
    capability: best.capability,
    modality: best.modality,
    pack_id: activePackId,
    lexeme_id: activeLexemeId,
    lexeme_lemma: activeLexeme?.lemma ?? null,
    exemplar_id: e.exemplar_id,
    construction_id: e.construction_id,
    sense_ids: [...(e.sense_ids || [])],
    communicative_function_ids: [...(e.communicative_function_ids || [])],
    exposure_stage: e.exposure_stage,
    text_en: e.text_en,
    text_pt: e.text_pt,
    context: e.context,
    primary_target: { target_type: best.primaryTargets[0].target_type, target_id: best.primaryTargets[0].target_id },
    secondary_targets: [
      ...best.primaryTargets.slice(1).map((t) => ({ target_type: t.target_type, target_id: t.target_id, role: 'primary' })),
      ...getSecondaryTargets(e).map((t) => ({ target_type: t.target_type, target_id: t.target_id, role: 'secondary' })),
    ],
    support,
    new_item_refs: best.newRefs,
    presentation,
    response_contract: buildResponseContract({ recipe: best.recipe, exemplar: e, modality: best.modality, options: best.options }),
    planned_evidence: plannedEvidenceFor(best.recipe, e, best.capability, best.modality),
    selection_trace: trace,
  }

  return { ...baseDecision, status: 'activity', plan, trace }
}

// Human-readable (pt-BR) justification: the two heaviest weighted components.
function describeDecision(candidate, policy) {
  const labels = {
    need: 'lacuna no domínio treinado por esta atividade',
    retention: 'revisão de retenção vencida para a capacidade',
    progression: 'próximo passo da progressão curricular do pack',
    capability_gap: 'capacidade defasada em relação ao melhor domínio do alvo',
    ladder: 'degrau mais inicial da progressão recomendada',
    independence: 'pronto para praticar sem apoio',
    novelty: 'introduz item novo dentro do orçamento da sessão',
    diversity: 'variação de construção/modalidade na sessão',
    remediation: 'erro recente pede nova prática com apoio',
  }
  return Object.entries(candidate.components)
    .map(([k, v]) => ({ k, contribution: (policy.weights[k] ?? 0) * v }))
    .filter((x) => x.contribution > 0)
    .sort((a, b) => (b.contribution - a.contribution) || a.k.localeCompare(b.k))
    .slice(0, 2)
    .map((x) => labels[x.k])
}
