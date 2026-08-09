// audit-practice-variety-v2.mjs — V2.19 variety audit, extended by V2.23.
//
// V2.23 is a BASELINE-CORRECTNESS slice: it does not tune cooldown, planner,
// scoring, corpus or recognition distractors. It measures the real in-session
// phenomenon that the older audit missed because it only recorded the FIRST
// activity of every session.
//
// Metrics are product/engine diagnostics, NOT proof of learner mastery.

import stillPack from '../src/content/pedagogy-v2/still.json' with { type: 'json' }
import butPack from '../src/content/pedagogy-v2/but.json' with { type: 'json' }
import yetPack from '../src/content/pedagogy-v2/yet.json' with { type: 'json' }
import { buildLearnerEvidenceV2 } from '../src/lib/pedagogy-v2/learner-evidence-contracts.js'
import { aggregateProfileEvidence } from '../src/lib/pedagogy-v2/learner-model.js'
import {
  DEFAULT_LESSON_ENGINE_POLICY_V2,
  appendActivityToSessionV2,
  createLessonSessionV2,
  mergeLessonEnginePolicyV2,
} from '../src/lib/pedagogy-v2/lesson-engine-contracts.js'
import { selectNextActivityV2 } from '../src/lib/pedagogy-v2/lesson-engine.js'
import {
  planLevel,
  wordOrderDistractors,
} from '../src/components/pedagogy-v2-learner/v2-interaction-state.js'

const T0 = Date.UTC(2026, 6, 1, 10, 0, 0)
const iso = (m) => new Date(T0 + m * 60000).toISOString()
const round = (x) => Math.round(x * 1000) / 1000
let seq = 0
const ev = (target, activity, over = {}) => buildLearnerEvidenceV2({
  evidence_id: `evidence:audit.${String(++seq).padStart(5, '0')}`,
  profile_id: 'p1', interaction_id: `interaction:audit.${seq}`,
  target, exemplar_id: null, activity, attribution: 'direct',
  outcome: 'correct', occurred_at: iso(seq), source: { source_type: 'audit' }, ...over,
})
const EXPO = { activity_kind: 'exposure', capability: 'recognition', modality: 'reading' }
const READ_REC = { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' }
const PRODUCTION_SESSION_LENGTH = DEFAULT_LESSON_ENGINE_POLICY_V2.max_activities_per_session

function advancedStates() {
  const targets = new Set()
  for (const e of stillPack.exemplars) {
    for (const t of e.pedagogical_targets || []) targets.add(JSON.stringify({ target_type: t.target_type, target_id: t.target_id }))
  }
  const evs = []
  for (const s of targets) {
    const t = JSON.parse(s)
    evs.push(ev(t, EXPO, { attribution: 'exposure', outcome: 'observed' }))
    for (let k = 0; k < 4; k++) evs.push(ev(t, READ_REC))
  }
  return aggregateProfileEvidence(evs)
}

const exemplarById = new Map(stillPack.exemplars.map((e) => [e.exemplar_id, e]))
let ri = 0
function persistInteraction(plan) {
  ri += 1
  const iid = `interaction:persist.${ri}`
  return [plan.primary_target, ...plan.secondary_targets].map((t, i) => buildLearnerEvidenceV2({
    evidence_id: `evidence:persist.${ri}.${i}`, profile_id: 'p1', interaction_id: iid,
    target: { target_type: t.target_type, target_id: t.target_id }, exemplar_id: plan.exemplar_id,
    activity: { activity_kind: plan.activity_kind, capability: plan.capability, modality: plan.modality },
    attribution: 'indirect', outcome: 'correct', occurred_at: iso(10000 + ri), source: { source_type: 'audit' },
  }))
}

function maxCount(rows, key) {
  const counts = new Map()
  for (const row of rows) counts.set(row[key], (counts.get(row[key]) || 0) + 1)
  return counts.size ? Math.max(...counts.values()) : 0
}

function maxConsecutive(rows, key) {
  let best = 0; let streak = 0; let prev = Symbol('none')
  for (const row of rows) {
    if (row[key] === prev) streak += 1
    else { streak = 1; prev = row[key] }
    best = Math.max(best, streak)
  }
  return best
}

function percentile(values, q) {
  if (!values.length) return 0
  const sorted = values.slice().sort((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)]
}

function summarize(values) {
  if (!values.length) return { min: 0, mean: 0, p95: 0, max: 0 }
  return {
    min: Math.min(...values),
    mean: round(values.reduce((a, b) => a + b, 0) / values.length),
    p95: percentile(values, 0.95),
    max: Math.max(...values),
  }
}

function firstPrimaryTargetId(exemplar) {
  return (exemplar?.pedagogical_targets || []).find((t) => t.role === 'primary')?.target_id || null
}

// `trace.candidates` is the broad pre-anchor pool and can contain exemplars for
// several primary targets. The repetition floor must use DISTINCT realizations
// that can serve the selected anchor focus (target/capability/modality/lane),
// otherwise a broad pool makes the lower bound artificially optimistic.
function sameFocusRealizationCount(decision) {
  const selected = decision?.plan
  if (!selected) return 0
  const selectedLane = selected.support?.derived_tier === 'none' ? 'independent' : 'supported'
  const selectedTarget = selected.primary_target?.target_id
  const ids = new Set(
    (decision.trace?.candidates || [])
      .filter((candidate) => candidate.capability === selected.capability
        && candidate.modality === selected.modality
        && candidate.lane === selectedLane
        && firstPrimaryTargetId(exemplarById.get(candidate.exemplar_id)) === selectedTarget)
      .map((candidate) => candidate.exemplar_id),
  )
  return ids.size
}

// Runs real engine sessions and records EVERY emitted activity. The historical
// first-of-session metrics are preserved so V2.19 BEFORE/AFTER remains legible.
function runConsecutiveSessions({
  focus,
  sessions = 30,
  activitiesPerSession = PRODUCTION_SESSION_LENGTH,
  diversityEnabled,
  policyOverrides = {},
}) {
  const states = advancedStates()
  const policy = {
    ...policyOverrides,
    diversity: { ...(policyOverrides.diversity || {}), enabled: diversityEnabled },
  }
  const mergedPolicy = mergeLessonEnginePolicyV2(policy)
  const recent = []
  const firsts = []
  const sessionRows = []
  let eligibleMax = 0
  let inSessionStreakMax = 1
  const optionPositions = {}
  let cooldownBypassCount = 0

  for (let i = 0; i < sessions; i++) {
    let session = createLessonSessionV2({ session_id: `sess.${i}`, profile_id: 'p1', now: iso(20000 + i), seed: `sess.${i}` })
    let firstRecorded = false
    let streak = 1
    let prevRecipe = null
    const activities = []
    let sessionFocusEligibleMax = 0

    for (let a = 0; a < activitiesPerSession; a++) {
      const d = selectNextActivityV2({ session, pack: stillPack, learnerStates: states, recentEvidence: recent.slice(-100), policy, focus })
      if (d.status !== 'activity') break
      const eligible = new Set((d.trace.candidates || []).map((c) => c.exemplar_id))
      const focusEligible = sameFocusRealizationCount(d)
      const sameFocusCandidateRows = d.trace?.experience_diversity?.pool?.same_focus_candidates ?? null
      eligibleMax = Math.max(eligibleMax, eligible.size)
      sessionFocusEligibleMax = Math.max(sessionFocusEligibleMax, focusEligible)

      const recentIdsBeforePick = session.history
        .slice(-mergedPolicy.exemplar_cooldown)
        .map((h) => h.exemplar_id)
      const cooldownBypass = recentIdsBeforePick.includes(d.plan.exemplar_id)
      if (cooldownBypass) cooldownBypassCount += 1

      const row = {
        exemplar_id: d.plan.exemplar_id,
        text_en: String(d.plan.text_en || '').trim(),
        construction_id: d.plan.construction_id,
        recipe: d.plan.recipe,
        capability: d.plan.capability,
        modality: d.plan.modality,
        eligible_exemplars_pre_focus: eligible.size,
        same_focus_candidate_rows: sameFocusCandidateRows,
        eligible_realizations_for_floor: focusEligible,
        cooldown_bypass: cooldownBypass,
      }
      activities.push(row)

      if (!firstRecorded) { firsts.push({ exemplar_id: d.plan.exemplar_id, recipe: d.plan.recipe }); firstRecorded = true }
      if (d.plan.presentation?.options) {
        const idx = d.plan.presentation.options.findIndex((o) => o.is_target)
        optionPositions[idx] = (optionPositions[idx] || 0) + 1
      }
      streak = d.plan.recipe === prevRecipe ? streak + 1 : 1
      inSessionStreakMax = Math.max(inSessionStreakMax, streak)
      prevRecipe = d.plan.recipe
      recent.push(...persistInteraction(d.plan))
      session = appendActivityToSessionV2(session, d)
    }

    if (!firstRecorded) firsts.push(null)
    const floor = sessionFocusEligibleMax > 0 && activities.length > 0
      ? Math.ceil(activities.length / sessionFocusEligibleMax)
      : null
    sessionRows.push({
      session_id: session.session_id,
      activities,
      eligible_realizations: sessionFocusEligibleMax,
      theoretical_floor: floor,
    })
  }

  return computeMetrics({ firsts, sessionRows, eligibleMax, optionPositions, inSessionStreakMax, cooldownBypassCount })
}

function computeMetrics({ firsts, sessionRows, eligibleMax, optionPositions, inSessionStreakMax, cooldownBypassCount }) {
  const valid = firsts.filter(Boolean)
  const ex = valid.map((f) => f.exemplar_id)
  const rc = valid.map((f) => f.recipe)
  let immediateRepeats = 0
  for (let i = 1; i < ex.length; i++) if (ex[i] === ex[i - 1]) immediateRepeats += 1
  let switches = 0
  for (let i = 1; i < rc.length; i++) if (rc[i] !== rc[i - 1]) switches += 1
  let streak = 1; let streakMax = 1
  for (let i = 1; i < rc.length; i++) { streak = rc[i] === rc[i - 1] ? streak + 1 : 1; streakMax = Math.max(streakMax, streak) }
  let ctxRepeat = 0
  for (let i = 1; i < ex.length; i++) {
    const a = new Set(exemplarById.get(ex[i])?.context_items || [])
    const b = exemplarById.get(ex[i - 1])?.context_items || []
    if (b.some((c) => a.has(c))) ctxRepeat += 1
  }
  const unique = new Set(ex).size

  const exemplarMaxima = sessionRows.map((s) => maxCount(s.activities, 'exemplar_id'))
  const textMaxima = sessionRows.map((s) => maxCount(s.activities, 'text_en'))
  const constructionMaxima = sessionRows.map((s) => maxCount(s.activities, 'construction_id'))
  const uniqueTexts = sessionRows.map((s) => new Set(s.activities.map((x) => x.text_en)).size)
  const consecutiveExemplars = sessionRows.map((s) => maxConsecutive(s.activities, 'exemplar_id'))
  const floors = sessionRows.map((s) => s.theoretical_floor).filter(Number.isFinite)
  const focusEligible = sessionRows.map((s) => s.eligible_realizations).filter((v) => Number.isFinite(v) && v > 0)
  const actualLengths = sessionRows.map((s) => s.activities.length)
  const gt = (n) => exemplarMaxima.filter((v) => v > n).length

  return {
    sessions: valid.length,
    session_activity_count: summarize(actualLengths),
    eligible_exemplar_count: eligibleMax,
    immediate_exemplar_repeat_rate: round(ex.length > 1 ? immediateRepeats / (ex.length - 1) : 0),
    exemplar_repeat_rate: round(ex.length ? 1 - unique / ex.length : 0),
    rolling_unique_exemplars: unique,
    unique_exemplar_ratio: round(ex.length ? unique / ex.length : 0),
    recipe_streak_max_first: rc.length ? streakMax : 0,
    in_session_recipe_streak_max: inSessionStreakMax,
    recipe_switch_rate: round(rc.length > 1 ? switches / (rc.length - 1) : 0),
    context_repeat_rate: round(ex.length > 1 ? ctxRepeat / (ex.length - 1) : 0),
    option_target_position_distribution: optionPositions,
    first_five_exemplars: ex.slice(0, 5),

    // V2.23 — the metrics the old first-only audit could not see.
    max_exemplar_occurrences_per_session: exemplarMaxima.length ? Math.max(...exemplarMaxima) : 0,
    p95_exemplar_occurrences_per_session: percentile(exemplarMaxima, 0.95),
    sessions_with_occurrences_gt_2: gt(2),
    sessions_with_occurrences_gt_3: gt(3),
    sessions_with_occurrences_gt_5: gt(5),
    sessions_with_occurrences_gt_8: gt(8),
    unique_text_en_per_session: summarize(uniqueTexts),
    max_text_occurrences_per_session: textMaxima.length ? Math.max(...textMaxima) : 0,
    max_construction_occurrences_per_session: constructionMaxima.length ? Math.max(...constructionMaxima) : 0,
    max_consecutive_same_exemplar: consecutiveExemplars.length ? Math.max(...consecutiveExemplars) : 0,
    eligible_realizations_per_focus: summarize(focusEligible),
    minimum_possible_max_repeat: floors.length ? Math.max(...floors) : null,
    theoretical_floor_per_session: summarize(floors),
    cooldown_bypass_count: cooldownBypassCount,
  }
}

const FOCUSES = {
  'comprehension/reading': { capability: 'comprehension', modality: 'reading' },
  'controlled_production/writing': { capability: 'controlled_production', modality: 'writing' },
}

console.log(`# audit:practice-variety-v2 — 30 consecutive sessions × ${PRODUCTION_SESSION_LENGTH} activities max, evidence persisted\n`)
for (const [label, focus] of Object.entries(FOCUSES)) {
  const before = runConsecutiveSessions({ focus, diversityEnabled: false })
  const after = runConsecutiveSessions({ focus, diversityEnabled: true })
  console.log(`## focus = ${label}`)
  const keys = [
    'sessions', 'eligible_exemplar_count', 'immediate_exemplar_repeat_rate', 'exemplar_repeat_rate',
    'rolling_unique_exemplars', 'unique_exemplar_ratio', 'recipe_streak_max_first', 'in_session_recipe_streak_max',
    'recipe_switch_rate', 'context_repeat_rate',
    'max_exemplar_occurrences_per_session', 'p95_exemplar_occurrences_per_session',
    'sessions_with_occurrences_gt_2', 'sessions_with_occurrences_gt_3',
    'sessions_with_occurrences_gt_5', 'sessions_with_occurrences_gt_8',
    'max_text_occurrences_per_session', 'max_construction_occurrences_per_session',
    'max_consecutive_same_exemplar', 'minimum_possible_max_repeat', 'cooldown_bypass_count',
  ]
  console.log('metric'.padEnd(42), 'BEFORE (V2.18)'.padEnd(18), 'AFTER (current)')
  for (const k of keys) console.log(k.padEnd(42), String(before[k]).padEnd(18), String(after[k]))
  console.log('session_activity_count BEFORE', JSON.stringify(before.session_activity_count),
    ' AFTER', JSON.stringify(after.session_activity_count))
  console.log('unique_text_en_per_session BEFORE', JSON.stringify(before.unique_text_en_per_session),
    ' AFTER', JSON.stringify(after.unique_text_en_per_session))
  console.log('eligible_realizations_per_focus BEFORE', JSON.stringify(before.eligible_realizations_per_focus),
    ' AFTER', JSON.stringify(after.eligible_realizations_per_focus))
  console.log('theoretical_floor_per_session BEFORE', JSON.stringify(before.theoretical_floor_per_session),
    ' AFTER', JSON.stringify(after.theoretical_floor_per_session))
  console.log('option_target_position BEFORE', JSON.stringify(before.option_target_position_distribution),
    ' AFTER', JSON.stringify(after.option_target_position_distribution))
  console.log('first-5 exemplars BEFORE', before.first_five_exemplars.map(shortId).join(', '))
  console.log('                  AFTER ', after.first_five_exemplars.map(shortId).join(', '))
  console.log()
}

// ---- V2.23 TRIAGE — can the default V2 session emit the same exemplar 8x? ---
console.log('\n# V2.23 TRIAGE — literal repetition under controlled V2 scenarios\n')
const targetedConstruction = 'construction:still.subject_still_lexical_verb'
const triage = [
  ['default 12 / broad comprehension focus', { focus: FOCUSES['comprehension/reading'], activitiesPerSession: 12, policyOverrides: {} }],
  ['default 12 / target construction', { focus: { ...FOCUSES['comprehension/reading'], target_id: targetedConstruction }, activitiesPerSession: 12, policyOverrides: {} }],
  // Long-session probe is an explicit policy experiment, not the production default.
  ['max_activities=24 / broad comprehension focus', { focus: FOCUSES['comprehension/reading'], activitiesPerSession: 24, policyOverrides: { max_activities_per_session: 24 } }],
  ['cooldown=1 / 12 activities', { focus: FOCUSES['comprehension/reading'], activitiesPerSession: 12, policyOverrides: { exemplar_cooldown: 1 } }],
]
for (const [label, config] of triage) {
  const m = runConsecutiveSessions({ ...config, sessions: 20, diversityEnabled: true })
  console.log(label)
  console.log(JSON.stringify({
    session_activity_count: m.session_activity_count,
    max_exemplar_occurrences_per_session: m.max_exemplar_occurrences_per_session,
    max_text_occurrences_per_session: m.max_text_occurrences_per_session,
    max_construction_occurrences_per_session: m.max_construction_occurrences_per_session,
    max_consecutive_same_exemplar: m.max_consecutive_same_exemplar,
    eligible_exemplar_count_pre_focus: m.eligible_exemplar_count,
    eligible_realizations_per_focus: m.eligible_realizations_per_focus,
    minimum_possible_max_repeat: m.minimum_possible_max_repeat,
    cooldown_bypass_count: m.cooldown_bypass_count,
  }, null, 2))
}

// ---- V2.23 B2 — measure the PR #70 semantic distractors with stage active ----
console.log('\n# V2.23 B2 — semantic word-order distractors by exposure_stage\n')
const stageRows = new Map()
let distractorViolations = 0
for (const pack of [stillPack, butPack, yetPack]) {
  const packId = pack.manifest?.pack_id || pack.pack_id
  for (const exemplar of pack.exemplars || []) {
    const targetTokens = String(exemplar.text_en || '').trim().split(/\s+/).filter(Boolean)
    const plan = {
      activity_id: `audit:distractor:${exemplar.exemplar_id}`,
      pack_id: packId,
      exposure_stage: exemplar.exposure_stage,
      text_en: exemplar.text_en,
      presentation: { token_source: { semantic_distractors: true } },
    }
    const distractors = wordOrderDistractors(plan, targetTokens)
    const maxAllowed = Math.min(
      targetTokens.length <= 5 ? 1 : targetTokens.length <= 9 ? 2 : 3,
      Math.max(1, Math.ceil(targetTokens.length * 0.3)),
    )
    if (distractors.length < 1 || distractors.length > 3 || distractors.length > maxAllowed) distractorViolations += 1
    const row = stageRows.get(exemplar.exposure_stage) || {
      stage: exemplar.exposure_stage,
      mapped_level: planLevel(plan),
      exemplars: 0,
      counts: [],
      tokens: new Set(),
    }
    row.exemplars += 1
    row.counts.push(distractors.length)
    distractors.forEach((x) => row.tokens.add(x))
    stageRows.set(exemplar.exposure_stage, row)
  }
}
for (const row of [...stageRows.values()].sort((a, b) => a.stage.localeCompare(b.stage))) {
  console.log(JSON.stringify({
    stage: row.stage,
    mapped_level: row.mapped_level,
    exemplars: row.exemplars,
    distractors_per_exemplar: summarize(row.counts),
    unique_distractor_tokens: row.tokens.size,
  }))
}
console.log('distractor_bound_violations =', distractorViolations)

// ---- PART J — content audit -------------------------------------------------
const LOW_VARIETY_MIN = 2
console.log('\n# PART J — content audit (still / but / yet)\n')
for (const pack of [stillPack, butPack, yetPack]) {
  console.log(`## ${pack.manifest?.pack_id || pack.pack_id}`)
  const byConstruction = new Map()
  for (const e of pack.exemplars || []) {
    const cid = e.construction_id || '(none)'
    if (!byConstruction.has(cid)) byConstruction.set(cid, [])
    byConstruction.get(cid).push(e)
  }
  for (const [cid, exs] of [...byConstruction].sort()) {
    const uniqueText = new Set(exs.map((e) => String(e.text_en).trim().toLowerCase())).size
    const uniqueContext = new Set(exs.map((e) => String(e.context).trim().toLowerCase())).size
    const contextItems = new Set(exs.flatMap((e) => e.context_items || [])).size
    const senses = new Set(exs.flatMap((e) => e.sense_ids || [])).size
    const finding = uniqueText < LOW_VARIETY_MIN ? '  LOW_EXEMPLAR_VARIETY' : ''
    console.log(`  ${cid.replace(/^construction:/, '')}: exemplars=${exs.length} unique_text=${uniqueText} `
      + `unique_context=${uniqueContext} context_items=${contextItems} senses=${senses}${finding}`)
  }
  console.log()
}

console.log('(advisory audit — informational only, never fails CI)')
function shortId(x) { return String(x || '?').replace('exemplar:still.', '#') }
