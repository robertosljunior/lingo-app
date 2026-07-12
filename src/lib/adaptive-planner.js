import { getSkill, listSkills, normalizeSkillId, SKILL_REGISTRY_VERSION } from './skill-registry.js'

export const PLANNER_VERSION = '1'
export const QUESTION_SKILL_INDEX_VERSION = '1'
const DAY = 86400000
const STRUCTURAL = new Set(['verb_form', 'verb_tense', 'question_structure', 'auxiliary'])

export function seededRandom(seed = '') {
  let h = 2166136261
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) }
  return () => {
    h += 0x6D2B79F5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function inferQuestionSkills(question = {}) {
  const sources = {}
  const weights = {}
  const add = (id, source, weight = 1) => {
    const skill = getSkill(normalizeSkillId(id))
    if (!skill) return
    const sid = skill.skill_id
    if (!sources[sid]) sources[sid] = []
    if (!sources[sid].includes(source)) sources[sid].push(source)
    weights[sid] = Math.max(weights[sid] || 0, weight)
  }
  add(question.skill_target, 'skill_target', 1)
  add(question.lesson_focus, 'lesson_focus', 0.95)
  add(question.metadata?.skill_target || question.metadata?.skill || question.payload?.skill_target, 'metadata', 0.9)
  for (const id of question.skill_ids || question.metadata?.skill_ids || question.payload?.skill_ids || []) add(id, 'metadata', 0.85)
  const expected = String(question.expected_answer || question.answer || question.a || question.payload?.expected_answer || '').toLowerCase()
  if (/\b(?:i|you|we|they|he|she|it)?\s*(?:have|has|'ve|'s)\s+been\s+\w+ing\b/.test(expected) || /\b(?:have|has)\s+been\s+\w+ing\b/.test(expected)) {
    add('present_perfect_continuous', 'expected_pattern', 0.9)
    add('gerund_after_been', 'expected_pattern', 0.85)
  }
  if (/\b(?:work|working|worked)\s+at\s+(?:this\s+)?(?:company|office|startup|firm|agency)\b/.test(expected)) add('workplace_preposition', 'expected_pattern', 0.45)
  const ids = Object.keys(sources)
  const primary = normalizeSkillId(question.skill_target) || normalizeSkillId(question.lesson_focus) || ids.sort((a, b) => (weights[b] || 0) - (weights[a] || 0) || a.localeCompare(b))[0] || null
  return { primary_skill_id: primary && ids.includes(primary) ? primary : ids[0] || null, skill_ids: ids.sort(), sources, weights }
}

export function indexQuestionSkills(question, lesson = {}) {
  const inferred = inferQuestionSkills({ ...question, lesson_focus: question.lesson_focus || lesson.focus, level: question.level || lesson.level })
  return {
    question_id: String(question.id ?? question.question_id), lesson_id: question.lesson_id || lesson.lesson_id,
    primary_skill_id: inferred.primary_skill_id, skill_ids: inferred.skill_ids, sources: inferred.sources, weights: inferred.weights,
    exercise_type: question.type || question.exercise_type || 'unknown', level: question.level || lesson.level || 'B1', difficulty: question.difficulty || 'medium',
    indexed_at: new Date(0).toISOString(), registry_version: SKILL_REGISTRY_VERSION, question_index_version: QUESTION_SKILL_INDEX_VERSION,
  }
}

export function skillPriority(p, now = Date.now()) {
  const weakness = 1 - clamp(p.mastery ?? 0.5, 0, 1)
  const evidenceFactor = p.evidence_level === 'established' ? 1 : p.evidence_level === 'emerging' ? 0.85 : 0.55
  const attempts = Math.max(1, p.attempts || 0)
  const severityFactor = 1 + ((p.high_errors || 0) / attempts) * 0.4 + ((p.medium_errors || 0) / attempts) * 0.15
  const age = p.last_error_at ? now - p.last_error_at : Infinity
  const recencyFactor = age <= 3 * DAY ? 1.25 : age <= 7 * DAY ? 1.15 : age <= 30 * DAY ? 1 : p.last_error_at ? 0.8 : 0.65
  const trendFactor = p.trend === 'declining' ? 1.15 : p.trend === 'improving' ? 0.9 : 1
  const streak = p.current_correct_streak || 0
  const streakFactor = streak <= 0 ? 1.1 : streak === 1 ? 1 : streak === 2 ? 0.9 : 0.75
  const lowOnlyPenalty = (p.low_errors || 0) > 0 && !(p.high_errors || 0) && !(p.medium_errors || 0) ? 0.75 : 1
  return +clamp(weakness * evidenceFactor * severityFactor * recencyFactor * trendFactor * streakFactor * lowOnlyPenalty, 0, 1.5).toFixed(4)
}

export function classifySkillForReview(p, now = Date.now()) {
  if (p.evidence_level === 'insufficient') return 'insufficient_evidence'
  const recentHighStructural = p.last_error_at && now - p.last_error_at <= 7 * DAY && (p.high_errors || 0) > 0 && STRUCTURAL.has(p.category)
  if ((p.mastery < 0.45 && p.evidence_level !== 'insufficient') || recentHighStructural) return 'urgent_review'
  if (p.mastery < 0.65) return 'needs_review'
  if (p.mastery < 0.8) return 'reinforcement'
  return 'maintenance'
}

export function rankSkillsForReview(profiles = [], now = Date.now()) {
  return [...profiles].map((p) => ({ ...p, priority: skillPriority(p, now), review_group: classifySkillForReview(p, now) }))
    .sort((a, b) => b.priority - a.priority || String(a.skill_id).localeCompare(String(b.skill_id)))
}

export function skillRelation(target, candidate) {
  if (!target || !candidate) return 0
  if (target === candidate) return 1
  const t = getSkill(target), c = getSkill(candidate)
  if (!t || !c) return 0
  if (c.parent_skill_id === target) return 0.85
  if (t.parent_skill_id === candidate) return 0.7
  if (t.category && t.category === c.category) return 0.35
  return 0
}

export function buildAdaptivePracticePlan({ profile = {}, skillProfiles = [], questions = [], answerHistory = [], srsState = [], requestedSize = 10, seed, targetSkillId = null, now = Date.now() } = {}) {
  const requested = clamp(Math.round(requestedSize || 10), 5, 30)
  const profileId = profile.profile_id || profile.id || 'default'
  const actualSeed = seed || `${profileId}:${new Date(now).toISOString().slice(0, 10)}:${PLANNER_VERSION}:${targetSkillId || 'general'}`
  const rng = seededRandom(actualSeed)
  const ranked = rankSkillsForReview(skillProfiles, now)
  const priorityBySkill = Object.fromEntries(ranked.map((p) => [p.skill_id, p.priority]))
  const groupBySkill = Object.fromEntries(ranked.map((p) => [p.skill_id, p.review_group]))
  const srsByQ = new Map(srsState.map((s) => [`${s.lesson_id}:${s.question_id}`, s]))
  const histByQ = new Map()
  for (const a of answerHistory.filter((a) => (a.profile_id || profileId) === profileId)) histByQ.set(`${a.lesson_id}:${a.question_id}`, a)
  const warnings = []
  const candidates = []
  for (const q of questions) {
    const idx = q.skill_index || indexQuestionSkills(q, q)
    if (!idx.question_id || !idx.lesson_id) continue
    const key = `${idx.lesson_id}:${idx.question_id}`
    const score = scoreCandidate({ idx, q, ranked, priorityBySkill, srs: srsByQ.get(key), history: histByQ.get(key), selected: [], targetSkillId, now })
    if (score.total <= 0 && ranked.length) continue
    candidates.push({ q, idx, ...score, tie: rng() })
  }
  if (targetSkillId && !candidates.some((c) => c.idx.skill_ids.some((id) => skillRelation(targetSkillId, id) > 0))) warnings.push({ code: 'NO_QUESTION_FOR_TARGET_SKILL', skill_id: targetSkillId })
  const selected = []
  const content = new Set()
  const maxLow = targetSkillId ? requested : Math.max(1, Math.floor(requested * 0.2))
  const maxInsufficient = targetSkillId ? requested : Math.ceil(requested * 0.25)
  for (let pass = 0; pass < requested * 4 && selected.length < requested; pass++) {
    let best = null
    for (const c of candidates) {
      const key = `${c.idx.lesson_id}:${c.idx.question_id}`
      if (selected.some((s) => `${s.idx.lesson_id}:${s.idx.question_id}` === key)) continue
      const textKey = String(c.q.expected_answer || c.q.prompt || '').toLowerCase().trim()
      if (textKey && content.has(textKey)) continue
      const lowOnly = c.idx.skill_ids.every((id) => getSkill(id)?.default_severity === 'low')
      if (lowOnly && selected.filter((s) => s.lowOnly).length >= maxLow) continue
      const insufficient = c.idx.skill_ids.some((id) => groupBySkill[id] === 'insufficient_evidence')
      if (insufficient && selected.filter((s) => s.insufficient).length >= maxInsufficient) continue
      const adjusted = scoreCandidate({ idx: c.idx, q: c.q, ranked, priorityBySkill, srs: srsByQ.get(key), history: histByQ.get(key), selected, targetSkillId, now })
      const cand = { ...c, ...adjusted, lowOnly, insufficient }
      if (!best || cand.total > best.total || (cand.total === best.total && cand.tie < best.tie)) best = cand
    }
    if (!best) break
    selected.push(best)
    const textKey = String(best.q.expected_answer || best.q.prompt || '').toLowerCase().trim()
    if (textKey) content.add(textKey)
  }
  if (selected.length < requested) warnings.push({ code: 'INSUFFICIENT_QUESTIONS', requested_size: requested, actual_size: selected.length })
  const selected_questions = selected.map((s) => ({
    question_id: s.idx.question_id, lesson_id: s.idx.lesson_id, skill_ids: s.idx.skill_ids, primary_skill_id: s.primarySkill,
    exercise_type: s.idx.exercise_type, selection_score: +s.total.toFixed(4), selection_reason: Object.fromEntries(s.reasons.map((r) => [r, true])), reasons: s.reasons,
  }))
  const counts = {}
  for (const sq of selected_questions) counts[sq.primary_skill_id] = (counts[sq.primary_skill_id] || 0) + 1
  return {
    planner_version: PLANNER_VERSION, profile_id: profileId, mode: 'adaptive_review', created_at: new Date(now).toISOString(), seed: actualSeed,
    requested_size: requested, actual_size: selected_questions.length,
    target_skills: ranked.slice(0, 8).map((p) => ({ skill_id: p.skill_id, priority: p.priority, requested_questions: counts[p.skill_id] || 0, selected_questions: counts[p.skill_id] || 0, reason: reasonForSkill(p) })),
    selected_questions, warnings,
  }
}

function scoreCandidate({ idx, priorityBySkill, srs, history, selected, targetSkillId, now }) {
  const primarySkill = idx.skill_ids.slice().sort((a, b) => (priorityBySkill[b] || 0) - (priorityBySkill[a] || 0))[0] || idx.primary_skill_id
  let skillP = Math.max(...idx.skill_ids.map((id) => priorityBySkill[id] || 0), 0.25)
  const reasons = []
  if (targetSkillId) {
    const rel = Math.max(...idx.skill_ids.map((id) => skillRelation(targetSkillId, id)), 0)
    if (rel > 0) { skillP = Math.max(skillP, rel); reasons.push(rel === 1 ? 'target_skill_match' : rel >= 0.7 ? 'parent_skill_match' : 'category_match') }
    else skillP *= 0.35
  }
  const age = history?.answered_at ? now - history.answered_at : Infinity
  const srsDue = !srs ? 0.3 : srs.due_at <= now ? 1 : srs.due_at - now <= DAY ? 0.7 : (srs.last_result === 'correct' && age <= DAY ? 0 : 0.2)
  if (srsDue >= 0.7) reasons.push('srs_due')
  const qNeed = !history ? 0.75 : history.verdict !== 'correct' ? 1 : age <= DAY ? 0 : 0.35
  if (!history) reasons.push('not_seen_before')
  if (history?.verdict && history.verdict !== 'correct') reasons.push('previously_incorrect')
  const last2 = selected.slice(-2)
  const typePenalty = last2.length === 2 && last2.every((s) => s.idx.exercise_type === idx.exercise_type) ? 0.15 : 1
  const skillPenalty = last2.length === 2 && last2.every((s) => s.primarySkill === primarySkill) ? 0.15 : 1
  const typeDiversity = Math.min(typePenalty, skillPenalty)
  if (typeDiversity === 1) reasons.push('exercise_type_balance')
  const novelty = !history ? 1 : age > 14 * DAY ? 0.8 : age > DAY ? 0.45 : 0
  if (skillP > 0.55) reasons.push('low_mastery')
  const total = (skillP * 0.45 + srsDue * 0.20 + qNeed * 0.15 + typeDiversity * 0.10 + novelty * 0.10)
  return { total, primarySkill, reasons: [...new Set(reasons)] }
}

function reasonForSkill(p) {
  if (p.evidence_level === 'insufficient') return 'collect_more_evidence'
  if ((p.high_errors || 0) > 0 && p.mastery < 0.5) return 'low_mastery_recurrent_high_severity'
  if (p.mastery >= 0.8) return 'maintenance'
  return 'low_mastery'
}

export function buildLessonGenerationContext({ profileId = 'default', skillProfiles = [], answers = [], questions = [], level = 'B1', now = Date.now() } = {}) {
  const ranked = rankSkillsForReview(skillProfiles, now)
  const scoped = answers.filter((a) => (a.profile_id || profileId) === profileId).sort((a, b) => (b.answered_at || 0) - (a.answered_at || 0))
  return {
    level,
    target_skills: ranked.filter((p) => p.mastery < 0.8 || p.evidence_level === 'insufficient').slice(0, 8).map((p) => ({ skill_id: p.skill_id, priority: p.priority, mastery: p.mastery, evidence: p.evidence_level, attempts: p.attempts, recent_errors: (p.recent_examples || []).slice(0, 3).map(({ actual, expected, severity }) => ({ actual, expected, severity })) })),
    reinforcement_skills: ranked.filter((p) => p.mastery >= 0.65 && p.mastery < 0.85).slice(0, 5).map((p) => ({ skill_id: p.skill_id, mastery: p.mastery })),
    avoid_overtraining_skills: ranked.filter((p) => p.mastery >= 0.85 && (p.current_correct_streak || 0) >= 3).slice(0, 5).map((p) => p.skill_id),
    preferred_exercise_types: top(scoped.map((a) => a.question?.type || a.exercise_type).filter(Boolean), 5),
    recent_question_ids: scoped.map((a) => `${a.lesson_id}:${a.question_id}`).slice(0, 30),
    recent_sentences: scoped.map((a) => a.expected_answer).filter(Boolean).slice(0, 30),
  }
}

function top(xs, n) { const m = {}; for (const x of xs) m[x] = (m[x] || 0) + 1; return Object.entries(m).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,n).map(([k])=>k) }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)) }
