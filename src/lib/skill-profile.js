// skill-profile.js — derives assessed skills from v2 evaluations and maintains
// deterministic, auditable learning-profile aggregates.

import { getRuleSkill, getSkill, normalizeSkillId, SKILL_REGISTRY_VERSION } from './skill-registry.js'
import { rankSkillsForReview as rankAdaptiveSkillsForReview, skillPriority as adaptiveSkillPriority } from './adaptive-planner.js'

export const PROFILE_ENGINE_VERSION = '1'

export const OUTCOME_SCORE = { correct: 1, partial: 0.5, incorrect: 0, observed: 0, not_assessed: 0 }
export const SEVERITY_WEIGHT = { critical: 1.25, high: 1, medium: 0.7, low: 0.35, accepted: 0 }
const SEVERITY_VALUE = { critical: 1.25, high: 1, medium: 0.7, low: 0.35, accepted: 0 }
const OUTCOME_RANK = { incorrect: 4, partial: 3, correct: 2, observed: 1, not_assessed: 0 }
const RECENT_LIMIT = 10
const EXAMPLE_LIMIT = 5

export function inferAssessedSkills({ evaluation, question = {}, user_answer = '', expected_answer = '' }) {
  const assessed = new Map()
  const errors = evaluation?.detected_errors || []
  const target = normalizeSkillId(evaluation?.skill_target || question.skill_target || question.lesson_focus || question.mistake_focus)

  const add = (raw) => {
    const skill = getSkill(raw.skill_id)
    if (!skill) return
    const id = skill.skill_id
    const next = {
      skill_id: id,
      parent_skill_id: raw.parent_skill_id ?? skill.parent_skill_id ?? null,
      category: raw.category ?? skill.category,
      source: raw.source,
      sources: raw.sources || [raw.source].filter(Boolean),
      outcome: raw.outcome,
      score: raw.score ?? OUTCOME_SCORE[raw.outcome] ?? 0,
      confidence: raw.confidence ?? 1,
      severity: raw.severity || skill.default_severity || 'medium',
      rule_id: raw.rule_id || null,
      related_error_id: raw.related_error_id || raw.rule_id || null,
      error_category: raw.error_category || null,
      error_subtype: raw.error_subtype || null,
      actual: raw.actual || '',
      expected: raw.expected || '',
      evidence: raw.evidence || {},
    }
    const cur = assessed.get(id)
    if (!cur) { assessed.set(id, next); return }
    cur.sources = [...new Set([...(cur.sources || []), ...next.sources])]
    cur.source = cur.sources[0]
    cur.confidence = Math.max(cur.confidence || 0, next.confidence || 0)
    cur.severity = strongerSeverity(cur.severity, next.severity)
    cur.evidence = { ...(cur.evidence || {}), ...(next.evidence || {}) }
    if (OUTCOME_RANK[next.outcome] > OUTCOME_RANK[cur.outcome]) {
      assessed.set(id, { ...cur, ...next, sources: cur.sources, evidence: cur.evidence })
    }
  }

  if (target) {
    add({
      skill_id: target,
      source: 'lesson_target',
      outcome: lessonTargetOutcome(target, errors, evaluation),
      score: lessonTargetOutcome(target, errors, evaluation) === 'correct' ? 1 : lessonTargetOutcome(target, errors, evaluation) === 'partial' ? 0.5 : 0,
      confidence: 1,
      evidence: { lesson_target: true },
    })
  }

  for (const error of errors) {
    const ruleSkill = getRuleSkill(error.rule_id)
    const fallbackSkill = skillForError(error)
    const skill_id = ruleSkill?.skill_id || fallbackSkill
    if (!skill_id) continue
    add({
      skill_id,
      parent_skill_id: ruleSkill?.parent_skill_id,
      source: 'grammar_rule',
      outcome: 'incorrect',
      score: 0,
      confidence: error.confidence ?? 1,
      severity: error.severity || getSkill(skill_id)?.default_severity || 'medium',
      rule_id: error.rule_id,
      related_error_id: error.rule_id,
      error_category: error.category,
      error_subtype: error.subtype,
      actual: error.actual || '',
      expected: error.expected || '',
      evidence: { detected_error: true, ...(error.evidence || {}) },
    })
  }

  for (const pattern of inferExpectedPatternSkills({ evaluation, question, user_answer, expected_answer })) {
    add(pattern)
  }

  return [...assessed.values()].map((a) => ({ ...a, score: OUTCOME_SCORE[a.outcome] ?? a.score ?? 0 }))
}

function lessonTargetOutcome(target, errors, evaluation) {
  if (evaluation?.verdict === 'correct') return 'correct'
  const structural = errors.some((e) => ['high', 'critical'].includes(e.severity) && ['verb_form', 'verb_tense', 'auxiliary', 'question_structure'].includes(e.category))
  if (target === 'present_perfect_continuous') return structural ? 'incorrect' : 'correct'
  if (target === 'question_structure') return errors.some((e) => e.category === 'auxiliary' || e.category === 'question_structure') ? 'incorrect' : evaluation?.verdict || 'partial'
  if (errors.some((e) => (e.subtype === target || e.category === target) && e.severity !== 'low')) return 'incorrect'
  if (evaluation?.verdict === 'partial' && errors.every((e) => e.severity === 'low')) return 'correct'
  return evaluation?.verdict === 'incorrect' ? 'incorrect' : 'partial'
}

function inferExpectedPatternSkills({ evaluation, question, user_answer, expected_answer }) {
  const expected = evaluation?.target_tokens || []
  const user = evaluation?.user_tokens || []
  const errors = evaluation?.detected_errors || []
  const out = []
  for (let i = 2; i < expected.length; i++) {
    if ((expected[i - 2] === 'have' || expected[i - 2] === 'has') && expected[i - 1] === 'been' && /ing$/.test(expected[i] || '')) {
      const hasVerbError = errors.some((e) => e.rule_id === 'verb.have_been_requires_ing')
      const userHasPattern = user[i - 2] && (user[i - 2] === 'have' || user[i - 2] === 'has') && user[i - 1] === 'been' && user[i] === expected[i]
      out.push({
        skill_id: 'gerund_after_been',
        source: 'expected_pattern',
        outcome: hasVerbError ? 'incorrect' : userHasPattern || evaluation?.verdict === 'correct' ? 'correct' : 'partial',
        score: hasVerbError ? 0 : userHasPattern || evaluation?.verdict === 'correct' ? 1 : 0.5,
        confidence: hasVerbError ? 0.98 : 0.92,
        severity: 'high',
        rule_id: hasVerbError ? 'verb.have_been_requires_ing' : 'expected.have_been_ing_observed',
        expected: expected[i],
        actual: user[i] || '',
        evidence: { expected_pattern: 'have_been_ing', expected_token: expected[i], user_answer, expected_answer: expected_answer || question.expected_answer },
      })
    }
  }
  return out
}

function skillForError(error) {
  if (error.category === 'punctuation' && error.subtype === 'apostrophe_missing') return 'apostrophe_usage'
  if (error.category === 'auxiliary' && error.subtype === 'missing_auxiliary') return 'missing_auxiliary'
  if (error.category === 'auxiliary' && error.subtype === 'wrong_auxiliary') return 'wrong_auxiliary'
  if (error.category === 'word_order') return 'word_order'
  if (error.category === 'spelling') return 'spelling'
  if (error.category === 'punctuation') return 'punctuation'
  if (error.category === 'capitalization') return 'capitalization'
  if (error.category === 'incorrect_choice') return 'incorrect_choice'
  if (error.category === 'vocabulary') return 'vocabulary'
  return normalizeSkillId(error.subtype || error.category)
}

function strongerSeverity(a = 'medium', b = 'medium') {
  return (SEVERITY_WEIGHT[b] || 0) > (SEVERITY_WEIGHT[a] || 0) ? b : a
}

export function retryMultiplier(attemptNumber) {
  if (attemptNumber <= 1) return 1
  if (attemptNumber === 2) return 0.5
  return 0.25
}

export function outcomeScore(outcome) {
  return OUTCOME_SCORE[outcome] ?? 0
}

export function severityWeight(severity, outcome) {
  if (outcome === 'correct') return 1
  return SEVERITY_WEIGHT[severity] ?? 0.7
}

export function buildSkillEvents({ answer, answer_id, assessed_skills = null, attempt_number = 1, created_at = Date.now() }) {
  const skills = assessed_skills || answer.evaluation?.assessed_skills || []
  return skills.map((s) => {
    const skill = getSkill(s.skill_id)
    const retry_multiplier = retryMultiplier(attempt_number)
    const effective_weight = +(severityWeight(s.severity, s.outcome) * (s.confidence ?? 1) * retry_multiplier).toFixed(4)
    const event_id = `${answer.profile_id}:${answer_id ?? answer.key}:${skill.skill_id}`
    return {
      key: event_id,
      event_id,
      profile_id: answer.profile_id,
      answer_id: answer_id ?? answer.key,
      lesson_id: answer.lesson_id,
      question_id: answer.question_id,
      session_id: answer.session_id,
      skill_id: skill.skill_id,
      parent_skill_id: s.parent_skill_id ?? skill.parent_skill_id ?? null,
      category: skill.category,
      outcome: s.outcome,
      outcome_score: outcomeScore(s.outcome),
      effective_weight,
      severity: s.severity || skill.default_severity,
      confidence: s.confidence ?? 1,
      source: s.source || s.sources?.[0] || 'detected_error',
      sources: s.sources || [s.source || 'detected_error'],
      rule_id: s.rule_id || null,
      error_category: s.error_category || null,
      error_subtype: s.error_subtype || null,
      actual: s.actual || '',
      expected: s.expected || '',
      attempt_number,
      retry_multiplier,
      created_at,
      engine_version: answer.evaluation?.engine_version || '2',
      profile_engine_version: PROFILE_ENGINE_VERSION,
      registry_version: SKILL_REGISTRY_VERSION,
    }
  })
}

export function aggregateSkillProfile(events, { profile_id, skill_id } = {}) {
  const sorted = [...events].sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
  const first = sorted[0]
  const skill = getSkill(skill_id || first?.skill_id)
  const p = {
    key: `${profile_id || first?.profile_id}:${skill.skill_id}`,
    profile_id: profile_id || first?.profile_id,
    skill_id: skill.skill_id,
    parent_skill_id: skill.parent_skill_id,
    category: skill.category,
    label_pt: skill.label_pt,
    attempts: 0,
    correct: 0,
    partial: 0,
    incorrect: 0,
    weighted_attempts: 0,
    weighted_success: 0,
    mastery: 0.5,
    evidence_level: 'insufficient',
    current_correct_streak: 0,
    longest_correct_streak: 0,
    last_seen_at: null,
    last_correct_at: null,
    last_error_at: null,
    high_errors: 0,
    medium_errors: 0,
    low_errors: 0,
    average_confidence: 0,
    average_error_severity: 0,
    trend: 'insufficient_data',
    recent_outcomes: [],
    recent_examples: [],
    profile_engine_version: PROFILE_ENGINE_VERSION,
    registry_version: SKILL_REGISTRY_VERSION,
    updated_at: Date.now(),
  }
  let confidenceSum = 0
  let errorSeveritySum = 0
  let errorCount = 0
  for (const e of sorted) {
    p.attempts += 1
    p[e.outcome] = (p[e.outcome] || 0) + 1
    p.weighted_attempts += e.effective_weight
    p.weighted_success += e.outcome_score * e.effective_weight
    p.last_seen_at = e.created_at
    confidenceSum += e.confidence || 0
    if (e.outcome === 'correct') {
      p.last_correct_at = e.created_at
      p.current_correct_streak += 1
      p.longest_correct_streak = Math.max(p.longest_correct_streak, p.current_correct_streak)
    } else if (e.outcome === 'incorrect' || e.outcome === 'partial') {
      p.current_correct_streak = 0
      p.last_error_at = e.created_at
      if (e.severity === 'high' || e.severity === 'critical') p.high_errors += 1
      else if (e.severity === 'medium') p.medium_errors += 1
      else if (e.severity === 'low') p.low_errors += 1
      errorSeveritySum += SEVERITY_VALUE[e.severity] ?? 0
      errorCount += 1
      if (e.actual || e.expected) {
        p.recent_examples = [{ actual: e.actual, expected: e.expected, severity: e.severity, rule_id: e.rule_id, created_at: e.created_at }, ...p.recent_examples].slice(0, EXAMPLE_LIMIT)
      }
    }
    p.recent_outcomes = [...p.recent_outcomes, { outcome: e.outcome, score: e.outcome_score, created_at: e.created_at, weight: e.effective_weight }].slice(-RECENT_LIMIT)
  }
  p.weighted_attempts = +p.weighted_attempts.toFixed(4)
  p.weighted_success = +p.weighted_success.toFixed(4)
  p.mastery = +((p.weighted_success + 1) / (p.weighted_attempts + 2)).toFixed(4)
  p.evidence_level = p.weighted_attempts < 2 ? 'insufficient' : p.weighted_attempts < 5 ? 'emerging' : 'established'
  p.average_confidence = p.attempts ? +(confidenceSum / p.attempts).toFixed(4) : 0
  p.average_error_severity = errorCount ? +(errorSeveritySum / errorCount).toFixed(4) : 0
  p.trend = trendFromOutcomes(p.recent_outcomes)
  return p
}

export function trendFromOutcomes(outcomes) {
  if (!outcomes || outcomes.length < 6) return 'insufficient_data'
  const prev = outcomes.slice(-6, -3)
  const recent = outcomes.slice(-3)
  const avg = (xs) => xs.reduce((a, x) => a + x.score, 0) / xs.length
  const diff = avg(recent) - avg(prev)
  if (diff >= 0.15) return 'improving'
  if (diff <= -0.15) return 'declining'
  return 'stable'
}

export function rankSkillsForReview(profiles, now = Date.now()) {
  return rankAdaptiveSkillsForReview(profiles, now)
}

export function skillPriority(p, now = Date.now()) {
  return adaptiveSkillPriority(p, now)
}

export function summarizeLearningProfile(profiles) {
  const ranked = rankSkillsForReview(profiles)
  return {
    needs_review: ranked.filter((p) => p.incorrect + p.partial > 0 && p.mastery < 0.75).slice(0, 8),
    strengths: [...profiles].filter((p) => p.mastery >= 0.75 && p.correct > 0).sort((a, b) => b.mastery - a.mastery).slice(0, 5),
  }
}
