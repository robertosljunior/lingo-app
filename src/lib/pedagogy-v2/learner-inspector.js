// learner-inspector.js — pure, read-only inspection of a learner's
// multidimensional V2 state, plus deterministic explainability and an opt-in
// in-memory telemetry collector (Slice V2.7). Nothing here edits data, nothing
// persists, nothing "marks as mastered", and no global mastery is ever
// produced. It only reads learner states / evidence and re-runs the (pure)
// planner to explain eligibility.

import { resolvePedagogyEntity, loadPedagogyV2Registry } from './registry.js'
import { indexStatesByTargetId, getLane } from './lesson-engine-state-queries.js'
import { buildReviewQueueV2, modalityGapCounterpart } from './review-queue.js'
import { buildStudyCandidatesV2, selectNextStudyFocusV2, factualPackProgressV2 } from './study-planner.js'
import { createStudySessionV2 } from './study-planner-contracts.js'
import { computeRecipeRuntimeAvailability } from './runtime-capabilities.js'
import { independenceUnavailabilityReasonV2 } from './training-affordances.js'
import { TELEMETRY_EVENT_TYPES } from './observability-contracts.js'

// Learner-facing phrasing for WHY independence isn't measured yet — framed as a
// property of the ACTIVITY TYPE, never as a learner deficit (Slice V2.8 §25/§26).
const INDEPENDENCE_REASON_LEARNER_TEXT = {
  no_independent_recipe: 'Ainda não é medido por este tipo de atividade.',
  runtime_unavailable: 'Requer um recurso do dispositivo que não está disponível agora.',
  assessment_unavailable: 'Requer uma avaliação que não está disponível agora.',
}
// Internal diagnostic code (never shown to the learner) for the structural case.
const INDEPENDENCE_STRUCTURAL_DIAGNOSTIC = 'INDEPENDENCE_NOT_MEASURABLE_WITH_CURRENT_RECIPES'

/**
 * Whether independent evidence is MEASURABLE for a (capability, modality) with
 * the current recipes + runtime, and — if not — why. This is a property of the
 * measurement instrument, not of the learner (§25). `reason` is null when
 * independence IS available.
 */
export function independenceAvailabilityV2(capability, modality, { runtimeAvailability = null } = {}) {
  const reason = independenceUnavailabilityReasonV2(capability, modality, { runtimeAvailability })
  return {
    available: reason == null,
    reason,
    diagnostic: reason === 'no_independent_recipe' ? INDEPENDENCE_STRUCTURAL_DIAGNOSTIC : null,
    learner_message: reason ? INDEPENDENCE_REASON_LEARNER_TEXT[reason] : null,
  }
}

const CAPABILITY_LABELS = {
  reading_recognition: 'reconhecimento ao ler',
  listening_recognition: 'reconhecimento ao ouvir',
  reading_comprehension: 'compreensão ao ler',
  listening_comprehension: 'compreensão ao ouvir',
  writing_controlled_production: 'produção escrita guiada',
  speaking_controlled_production: 'produção falada guiada',
  writing_free_production: 'produção escrita livre',
  speaking_free_production: 'produção falada livre',
  speaking_pronunciation: 'pronúncia',
}

// ---- per-target inspection --------------------------------------------------

export function inspectTargetV2(targetId, { learnerStates = [], registry = loadPedagogyV2Registry(), runtimeAvailability = null } = {}) {
  const state = indexStatesByTargetId(learnerStates).get(targetId) || null
  const owner = resolvePedagogyEntity(targetId, registry)
  const capabilities = {}
  for (const [capKey, cap] of Object.entries(state?.capabilities || {})) {
    const [capModality, ...capRest] = capKey.split('_')
    capabilities[capKey] = {
      overall: laneView(cap.overall),
      supported: laneView(cap.supported),
      independent: laneView(cap.independent),
      // Slice V2.8: is independence even MEASURABLE here? (Instrument property,
      // never a learner deficit — the UI frames it accordingly.)
      independence_availability: independenceAvailabilityV2(capRest.join('_'), capModality, { runtimeAvailability }),
      retention: state.retention?.[capKey]
        ? {
            last_retrieval_at: state.retention[capKey].last_retrieval_at,
            stability_estimate: state.retention[capKey].stability_estimate,
            successful_delayed_retrievals: state.retention[capKey].successful_delayed_retrievals,
            failed_delayed_retrievals: state.retention[capKey].failed_delayed_retrievals,
          }
        : null,
    }
  }
  return {
    target_id: targetId,
    kind: owner?.kind ?? null,
    owner_pack_id: owner?.pack_id ?? null,
    resolved: !!owner,
    exposure: state?.exposure ? { ...state.exposure } : { count: 0 },
    capabilities,
    last_evidence_at: state?.updated_at ?? null,
  }
}

function laneView(lane) {
  if (!lane) return null
  return {
    assessed_evidence_count: lane.assessed_evidence_count,
    mastery_estimate: lane.mastery_estimate,
    evidence_level: lane.evidence_level,
    trend: lane.trend,
  }
}

// ---- per-lexeme inspection --------------------------------------------------

export function inspectLexemeV2(lexemeId, { learnerStates = [], registry = loadPedagogyV2Registry() } = {}) {
  const pack = registry.packs.find((p) => p.manifest.primary_lexeme_id === lexemeId)
  if (!pack) return null
  const statesById = indexStatesByTargetId(learnerStates)
  const seen = (id) => (statesById.get(id)?.exposure?.count || 0) > 0
  const lastContact = () => {
    let last = null
    for (const s of learnerStates) {
      const owner = resolvePedagogyEntity(s.target.target_id, registry)
      if (owner?.pack_id !== pack.manifest.pack_id) continue
      const at = s.exposure?.last_seen_at
      if (at && (!last || at > last)) last = at
    }
    return last
  }
  return {
    lexeme_id: lexemeId,
    pack_id: pack.manifest.pack_id,
    lemma: (pack.lexemes || []).find((l) => l.lexeme_id === lexemeId)?.lemma ?? lexemeId,
    senses_encountered: (pack.senses || []).filter((s) => seen(s.sense_id)).map((s) => s.sense_id),
    constructions_encountered: (pack.constructions || []).filter((c) => seen(c.construction_id)).map((c) => c.construction_id),
    functions_encountered: (pack.communicative_functions || []).filter((f) => seen(f.function_id)).map((f) => f.function_id),
    last_contact: lastContact(),
    // Facts only — never a global mastery percentage.
    facts: factualPackProgressV2(pack, learnerStates, []),
  }
}

// ---- review needs (human) ---------------------------------------------------

export function inspectReviewNeedsV2({ registry = loadPedagogyV2Registry(), learnerStates = [], recentEvidence = [], now } = {}) {
  const queue = buildReviewQueueV2({ registry, learnerStates, recentEvidence, now })
  return queue.map((item) => {
    const owner = resolvePedagogyEntity(item.target.target_id, registry)
    const pack = owner ? registry.packs.find((p) => p.manifest.pack_id === owner.pack_id) : null
    return {
      target_id: item.target.target_id,
      lemma: pack ? (pack.lexemes || []).find((l) => l.lexeme_id === pack.manifest.primary_lexeme_id)?.lemma : null,
      capability_key: item.capability_key,
      capability_label: CAPABILITY_LABELS[item.capability_key] || item.capability_key,
      reason_codes: item.reason_codes,
      human_reason: reviewReasonHuman(item),
    }
  })
}

function reviewReasonHuman(item) {
  const c = item.reason_codes
  if (c.includes('RECENT_FAILURE')) return 'Você errou este uso recentemente.'
  if (c.includes('DELAYED_RETRIEVAL_FAILED')) return 'Este uso ainda não se manteve entre um encontro e outro.'
  if (c.includes('RETENTION_OVERDUE')) return 'Faz tempo que você não recupera este uso.'
  if (c.includes('DECLINING_TREND')) return 'Os últimos resultados neste uso caíram.'
  if (c.includes('MODALITY_GAP')) return 'Você praticou este uso antes, mas ainda há pouca evidência nesta forma.'
  if (c.includes('SUPPORTED_WITHOUT_INDEPENDENT')) return 'Você praticou com apoio; falta recuperar este uso sem ajuda.'
  return 'Este uso merece uma nova prática.'
}

// ---- planner eligibility ----------------------------------------------------

export function inspectPlannerEligibilityV2({
  registry = loadPedagogyV2Registry(), learnerStates = [], recentEvidence = [],
  mode = 'adaptive', now, seed = 'inspector', runtimeCapabilities = null, studySession = null,
} = {}) {
  const session = studySession || createStudySessionV2({ study_session_id: 'inspect', mode, now, seed })
  const availability = runtimeCapabilities ? computeRecipeRuntimeAvailability(runtimeCapabilities) : null
  const candidates = buildStudyCandidatesV2({ registry, learnerStates, recentEvidence, now })
  const decision = selectNextStudyFocusV2({ registry, learnerStates, recentEvidence, studySession: session, runtimeAvailability: availability })
  return {
    candidate_count: candidates.length,
    selected_focus: decision.focus,
    status: decision.status,
    candidates: (decision.trace?.candidates || []).map((c) => ({
      key: c.key, focus_type: c.focus_type, pack_id: c.pack_id, target_id: c.target_id,
      capability: c.capability, modality: c.modality, score: c.score, adjusted_score: c.adjusted_score, is_pack_switch: c.is_pack_switch,
    })),
    filtered: (decision.trace?.excluded || []).map((x) => ({ key: x.key, target_id: x.target_id, reason: x.reason })),
    score_components: decision.trace?.score_breakdown ?? null,
  }
}

// ---- full snapshot ----------------------------------------------------------

export function buildLearnerInspectorSnapshotV2({
  registry = loadPedagogyV2Registry(), learnerStates = [], recentEvidence = [],
  now, mode = 'adaptive', runtimeCapabilities = null, studySession = null,
  recentFocuses = [], recentActivityPlans = [],
} = {}) {
  const runtimeAvailability = runtimeCapabilities ? computeRecipeRuntimeAvailability(runtimeCapabilities) : null
  return {
    snapshot_version: 1,
    generated_for_now: now ?? null,
    lexemes: registry.packs.map((p) => inspectLexemeV2(p.manifest.primary_lexeme_id, { learnerStates, registry })),
    targets: learnerStates.map((s) => inspectTargetV2(s.target.target_id, { learnerStates, registry, runtimeAvailability })),
    review_queue: now ? inspectReviewNeedsV2({ registry, learnerStates, recentEvidence, now }) : [],
    planner: now ? inspectPlannerEligibilityV2({ registry, learnerStates, recentEvidence, mode, now, runtimeCapabilities, studySession }) : null,
    recent_focuses: recentFocuses,
    recent_activity_plans: recentActivityPlans,
    recent_evidence: recentEvidence.slice(-20).map((e) => ({
      evidence_id: e.evidence_id, target_id: e.target?.target_id, attribution: e.attribution, outcome: e.outcome, occurred_at: e.occurred_at,
    })),
  }
}

// ---- explainability (§18) ---------------------------------------------------
// Deterministic templates per reason code — NEVER an LLM, never free text.

const FOCUS_HEADLINES = {
  introduce: (lemma, capMod) => `Introduzir um novo uso de ${lemma}`,
  deepen: (lemma, capMod) => `Aprofundar ${lemma}${capMod ? ` em ${capMod}` : ''}`,
  review: (lemma, capMod) => `Revisar ${lemma}${capMod ? ` em ${capMod}` : ''}`,
  remediate: (lemma, capMod) => `Retomar ${lemma}${capMod ? ` em ${capMod}` : ''}`,
  independence: (lemma, capMod) => `Praticar ${lemma} sem apoio${capMod ? ` em ${capMod}` : ''}`,
  cross_pack_progression: (lemma, capMod) => `Conectar ${lemma} a um uso que você já conhece`,
}

const REASON_TEMPLATES = {
  NEVER_EXPOSED: 'Este uso ainda não foi apresentado a você.',
  CURRICULUM_FRONTIER: 'É o próximo passo natural da progressão.',
  CAPABILITY_GAP: 'Você domina o passo anterior; este é o próximo.',
  MODALITY_GAP: 'Você já reconhece este uso em outra forma, mas ainda há pouca evidência aqui.',
  SUPPORTED_WITHOUT_INDEPENDENT: 'Você foi bem com apoio; agora sem ajuda.',
  RECENT_FAILURE: 'Uma tentativa recente falhou.',
  DECLINING_TREND: 'Os resultados recentes caíram.',
  RETENTION_OVERDUE: 'Faz tempo que você não recupera este uso.',
  DELAYED_RETRIEVAL_FAILED: 'Este uso não se manteve entre os encontros.',
  LOW_STABILITY: 'Este uso ainda não está estável entre sessões.',
  CROSS_PACK_TRANSFER_OPPORTUNITY: 'Você pode reutilizar algo que já conhece de outra palavra.',
  CROSS_PACK_PREREQUISITE_MET: 'Você já tem a base necessária de outra palavra.',
  KNOWN_FUNCTION_NEW_CONSTRUCTION: 'Mesma função comunicativa que você já conhece, em nova construção.',
  KNOWN_CONSTRUCTION_REUSED_IN_NEW_PACK: 'Reutiliza uma construção que você já pratica.',
  KNOWN_LEXEME_CONTEXT_EXTENDED: 'Estende um contexto de palavra que você já viu.',
}

/**
 * explainStudyFocusV2(focus, context) → { headline, reasons, evidence }.
 * `context` supplies { lemma, learnerStates, registry }. Deterministic: the
 * text comes only from templates keyed by focus_type and reason codes.
 */
export function explainStudyFocusV2(focus, context = {}) {
  if (!focus) return { headline: 'Nenhum foco selecionado.', reasons: [], evidence: [] }
  const registry = context.registry || loadPedagogyV2Registry()
  const pack = registry.packs.find((p) => p.manifest.pack_id === focus.pack_id)
  const lemma = context.lemma
    ?? (pack ? (pack.lexemes || []).find((l) => l.lexeme_id === pack.manifest.primary_lexeme_id)?.lemma : focus.lexeme_id)
    ?? focus.lexeme_id
  const capMod = focus.capability
    ? (CAPABILITY_LABELS[`${focus.modality}_${focus.capability}`] || focus.capability)
    : null
  const headline = (FOCUS_HEADLINES[focus.focus_type] || ((l) => `Estudar ${l}`))(lemma, capMod)
  const reasons = (focus.reason_codes || []).map((c) => REASON_TEMPLATES[c]).filter(Boolean)

  const evidence = []
  if (focus.target && context.learnerStates) {
    const t = inspectTargetV2(focus.target.target_id, { learnerStates: context.learnerStates, registry })
    for (const [capKey, cap] of Object.entries(t.capabilities)) {
      if (cap.overall) evidence.push({ capability_key: capKey, evidence_level: cap.overall.evidence_level, trend: cap.overall.trend })
    }
  }
  return { headline, reasons: reasons.length ? reasons : ['Próximo passo recomendado.'], evidence }
}

// ---- opt-in local telemetry (§19) -------------------------------------------
// In-memory only. NEVER persisted, NEVER sent over the network. Exportable.

export function createTelemetryCollectorV2({ enabled = false } = {}) {
  let on = enabled
  const events = []
  return {
    get enabled() { return on },
    enable() { on = true },
    disable() { on = false },
    record(type, payload = {}) {
      if (!on) return
      if (!TELEMETRY_EVENT_TYPES.includes(type)) throw new Error(`TELEMETRY_EVENT_TYPE_INVALID:${type}`)
      events.push({ type, payload })
    },
    get events() { return events.slice() },
    clear() { events.length = 0 },
    export() { return { telemetry_version: 1, events: events.slice() } },
  }
}

// ---- observability export (§20/§21) -----------------------------------------
// Builds the exportable JSON. Privacy by construction: profile_id is OMITTED by
// default; free-text learner answers and voice transcripts are NEVER included
// (this builder only accepts already-aggregated metrics/trajectory/findings and
// telemetry event metadata). The caller is responsible for not passing raw
// response text — the shape here has no field for it.
export function buildObservabilityExportV2({
  metrics = null, trajectory = null, findings = [], telemetry = null,
  policyVersions = {}, registryVersion = null, includeProfileId = false, profileId = null,
} = {}) {
  const out = {
    export_version: 1,
    registry_version: registryVersion,
    policy_versions: { ...policyVersions },
    metrics,
    trajectory,
    findings,
    telemetry: telemetry
      ? { telemetry_version: telemetry.telemetry_version ?? 1, event_types: telemetry.events.map((e) => e.type) }
      : null,
  }
  if (includeProfileId && profileId) out.profile_id = profileId
  return out
}

export { modalityGapCounterpart }
