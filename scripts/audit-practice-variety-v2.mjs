// audit-practice-variety-v2.mjs — Slice V2.19 PART A/O/Q.
//
// Reproduces the repetition problem and measures controlled-variety metrics over
// a fixed learner snapshot and many CONSECUTIVE study sessions with evidence
// persisted between them. Runs the REAL engine twice — diversity OFF (the
// frozen V2.18 behavior = baseline) and diversity ON (V2.19) — and prints a
// before/after table. Advisory only: never fails CI.
//
// Metrics (product/engine diagnostics, NOT learner mastery):
//   eligible_exemplar_count            distinct exemplars the focus can serve
//   immediate_exemplar_repeat_rate     P(this first exemplar == previous session's)
//   exemplar_repeat_rate               1 - unique/total first exemplars
//   rolling_unique_exemplars           distinct first exemplars over the run
//   unique_exemplar_ratio              rolling_unique / sessions
//   recipe_streak_max                  longest run of one recipe across firsts
//   recipe_switch_rate                 fraction of adjacent sessions changing recipe
//   context_repeat_rate                adjacent sessions sharing a context_item
//   option_target_position_distribution index histogram of the correct option

import stillPack from '../src/content/pedagogy-v2/still.json' with { type: 'json' }
import butPack from '../src/content/pedagogy-v2/but.json' with { type: 'json' }
import yetPack from '../src/content/pedagogy-v2/yet.json' with { type: 'json' }
import { buildLearnerEvidenceV2 } from '../src/lib/pedagogy-v2/learner-evidence-contracts.js'
import { aggregateProfileEvidence } from '../src/lib/pedagogy-v2/learner-model.js'
import { createLessonSessionV2, appendActivityToSessionV2 } from '../src/lib/pedagogy-v2/lesson-engine-contracts.js'
import { selectNextActivityV2 } from '../src/lib/pedagogy-v2/lesson-engine.js'

const T0 = Date.UTC(2026, 6, 1, 10, 0, 0)
const iso = (m) => new Date(T0 + m * 60000).toISOString()
let seq = 0
const ev = (target, activity, over = {}) => buildLearnerEvidenceV2({
  evidence_id: `evidence:audit.${String(++seq).padStart(5, '0')}`,
  profile_id: 'p1', interaction_id: `interaction:audit.${seq}`,
  target, exemplar_id: null, activity, attribution: 'direct',
  outcome: 'correct', occurred_at: iso(seq), source: { source_type: 'audit' }, ...over,
})
const EXPO = { activity_kind: 'exposure', capability: 'recognition', modality: 'reading' }
const READ_REC = { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' }

// Advanced learner: everything exposed AND recognition-consolidated.
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

// One persisted interaction (one exemplar, its target rows), appended to the
// cross-session evidence tail between sessions.
let ri = 0
function persistInteraction(plan) {
  ri += 1
  const iid = `interaction:persist.${ri}`
  const rows = [plan.primary_target, ...plan.secondary_targets].map((t, i) => buildLearnerEvidenceV2({
    evidence_id: `evidence:persist.${ri}.${i}`, profile_id: 'p1', interaction_id: iid,
    target: { target_type: t.target_type, target_id: t.target_id }, exemplar_id: plan.exemplar_id,
    activity: { activity_kind: plan.activity_kind, capability: plan.capability, modality: plan.modality },
    attribution: 'indirect', outcome: 'correct', occurred_at: iso(10000 + ri), source: { source_type: 'audit' },
  }))
  return rows
}

// Each session plays several activities (so IN-session recipe-streak control is
// exercised); evidence persists between sessions (so CROSS-session recency is
// exercised). Records the FIRST exemplar/recipe of each session (Part Q) plus
// the max in-session recipe streak (Part D).
function runConsecutiveSessions({ focus, sessions = 30, activitiesPerSession = 6, diversityEnabled }) {
  const states = advancedStates()
  const policy = { diversity: { enabled: diversityEnabled } }
  const recent = []
  const firsts = []
  let eligibleMax = 0
  let inSessionStreakMax = 1
  const optionPositions = {}
  for (let i = 0; i < sessions; i++) {
    let session = createLessonSessionV2({ session_id: `sess.${i}`, profile_id: 'p1', now: iso(20000 + i), seed: `sess.${i}` })
    let firstRecorded = false
    let streak = 1
    let prevRecipe = null
    for (let a = 0; a < activitiesPerSession; a++) {
      const d = selectNextActivityV2({ session, pack: stillPack, learnerStates: states, recentEvidence: recent.slice(-100), policy, focus })
      if (d.status !== 'activity') break
      const eligible = new Set((d.trace.candidates || []).map((c) => c.exemplar_id))
      eligibleMax = Math.max(eligibleMax, eligible.size)
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
  }
  return computeMetrics(firsts, eligibleMax, optionPositions, inSessionStreakMax)
}

function computeMetrics(firsts, eligibleMax, optionPositions, inSessionStreakMax) {
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
  return {
    sessions: valid.length,
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
  }
}
const round = (x) => Math.round(x * 1000) / 1000

const FOCUSES = {
  'comprehension/reading': { capability: 'comprehension', modality: 'reading' },
  'controlled_production/writing': { capability: 'controlled_production', modality: 'writing' },
}

console.log('# audit:practice-variety-v2 — 30 consecutive sessions, evidence persisted between them\n')
for (const [label, focus] of Object.entries(FOCUSES)) {
  const before = runConsecutiveSessions({ focus, diversityEnabled: false })
  const after = runConsecutiveSessions({ focus, diversityEnabled: true })
  console.log(`## focus = ${label}`)
  const keys = ['sessions', 'eligible_exemplar_count', 'immediate_exemplar_repeat_rate', 'exemplar_repeat_rate',
    'rolling_unique_exemplars', 'unique_exemplar_ratio', 'recipe_streak_max_first', 'in_session_recipe_streak_max',
    'recipe_switch_rate', 'context_repeat_rate']
  console.log('metric'.padEnd(34), 'BEFORE (V2.18)'.padEnd(16), 'AFTER (V2.19)')
  for (const k of keys) console.log(k.padEnd(34), String(before[k]).padEnd(16), String(after[k]))
  console.log('option_target_position  BEFORE', JSON.stringify(before.option_target_position_distribution),
    ' AFTER', JSON.stringify(after.option_target_position_distribution))
  console.log('first-5 exemplars       BEFORE', before.first_five_exemplars.map(shortId).join(', '))
  console.log('                        AFTER ', after.first_five_exemplars.map(shortId).join(', '))
  console.log()
}
function shortId(x) { return String(x || '?').replace('exemplar:still.', '#') }

// ---- PART J — content audit (per construction realization variety) ----------
// Not every repetition is the selector's fault: a construction with too few
// INDEPENDENT authored realizations cannot sustain rotation no matter how good
// the engine is. LOW_EXEMPLAR_VARIETY flags those; content is NOT grown here.
const LOW_VARIETY_MIN = 2 // fewer than this many unique realizations = too thin to rotate
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
    const finding = uniqueText < LOW_VARIETY_MIN ? '  ⚠ LOW_EXEMPLAR_VARIETY' : ''
    console.log(`  ${cid.replace(/^construction:/, '')}: exemplars=${exs.length} unique_text=${uniqueText} `
      + `unique_context=${uniqueContext} context_items=${contextItems} senses=${senses}${finding}`)
  }
  console.log()
}

console.log('(advisory audit — informational only, never fails CI)')
