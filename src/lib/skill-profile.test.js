import { describe, it, expect } from 'vitest'
import yaml from 'js-yaml'
import { analyzeAnswer } from './correction-engine.js'
import { getSkill, normalizeSkillId, getRuleSkill } from './skill-registry.js'
import { buildSkillEvents, aggregateSkillProfile, retryMultiplier, summarizeLearningProfile } from './skill-profile.js'
import { buildResultYaml } from './export-engine.js'

const expected = "I've been working at this company for three years."

describe('skill registry', () => {
  it('retorna metadata de skill conhecida', () => {
    const s = getSkill('gerund_after_been')
    expect(s.label_pt).toBe('Verbo com -ing depois de have been')
    expect(s.parent_skill_id).toBe('present_perfect_continuous')
  })
  it('normaliza aliases e cria fallback amigável', () => {
    expect(normalizeSkillId('verb_ing_after_been')).toBe('gerund_after_been')
    const s = getSkill('client_meeting_vocabulary')
    expect(s.custom).toBe(true)
    expect(s.label_pt).toBe('Client Meeting Vocabulary')
  })
  it('mapeia regras para skills explicitamente', () => {
    expect(getRuleSkill('verb.have_been_requires_ing').skill_id).toBe('gerund_after_been')
  })
})

describe('assessed_skills', () => {
  it('gera skill ampla e específicas no caso incorreto sem missing_auxiliary', () => {
    const r = analyzeAnswer({ user_answer: "I've been worked in this company for three years.", expected_answer: expected, skill_target: 'present_perfect_continuous' })
    const ids = r.assessed_skills.map((s) => s.skill_id)
    expect(ids).toContain('present_perfect_continuous')
    expect(ids).toContain('gerund_after_been')
    expect(ids).toContain('workplace_preposition')
    expect(ids).not.toContain('missing_auxiliary')
    expect(r.assessed_skills.find((s) => s.skill_id === 'gerund_after_been')).toMatchObject({ outcome: 'incorrect', score: 0 })
  })
  it('gera sinais positivos para estrutura granular correta', () => {
    const r = analyzeAnswer({ user_answer: 'I have been working at this company for three years.', expected_answer: expected, skill_target: 'present_perfect_continuous' })
    expect(r.verdict).toBe('correct')
    expect(r.assessed_skills.find((s) => s.skill_id === 'present_perfect_continuous')).toMatchObject({ outcome: 'correct', score: 1 })
    expect(r.assessed_skills.find((s) => s.skill_id === 'gerund_after_been')).toMatchObject({ outcome: 'correct', score: 1 })
  })
  it('não derruba present perfect continuous por naturalidade de baixa severidade', () => {
    const r = analyzeAnswer({ user_answer: "I've been working in this company for three years.", expected_answer: expected, skill_target: 'present_perfect_continuous' })
    expect(r.assessed_skills.find((s) => s.skill_id === 'present_perfect_continuous').outcome).toBe('correct')
    expect(r.assessed_skills.find((s) => s.skill_id === 'workplace_preposition').outcome).toBe('incorrect')
  })
  it('apóstrofo ausente vira skill low sem afetar estrutura principal', () => {
    const r = analyzeAnswer({ user_answer: 'Ive been working at this company for three years.', expected_answer: expected, skill_target: 'present_perfect_continuous' })
    expect(r.assessed_skills.find((s) => s.skill_id === 'apostrophe_usage')).toMatchObject({ outcome: 'incorrect', severity: 'low' })
    expect(r.assessed_skills.find((s) => s.skill_id === 'present_perfect_continuous').outcome).toBe('correct')
  })
})

describe('skill events and mastery', () => {
  function answerFrom(r, key = 1, session = 's1') {
    return { key, profile_id: 'p1', lesson_id: 'l1', question_id: 1, session_id: session, user_answer: 'u', expected_answer: 'e', answered_at: key, evaluation: r }
  }
  it('mastery é suavizado e muda com acertos/erros', () => {
    const bad = analyzeAnswer({ user_answer: "I've been worked at this company for three years.", expected_answer: expected, skill_target: 'present_perfect_continuous' })
    const good = analyzeAnswer({ user_answer: 'I have been working at this company for three years.', expected_answer: expected, skill_target: 'present_perfect_continuous' })
    const e1 = buildSkillEvents({ answer: answerFrom(bad, 1), answer_id: 1, attempt_number: 1 }).find((e) => e.skill_id === 'gerund_after_been')
    const p1 = aggregateSkillProfile([e1], { profile_id: 'p1', skill_id: 'gerund_after_been' })
    expect(p1.mastery).toBeGreaterThan(0)
    expect(p1.mastery).toBeLessThan(0.5)
    const e2 = buildSkillEvents({ answer: answerFrom(good, 2, 's2'), answer_id: 2, attempt_number: 1 }).find((e) => e.skill_id === 'gerund_after_been')
    const p2 = aggregateSkillProfile([e1, e2], { profile_id: 'p1', skill_id: 'gerund_after_been' })
    expect(p2.mastery).toBeGreaterThan(p1.mastery)
    expect(p2.mastery).toBeLessThan(1)
  })
  it('low severity e confidence reduzem peso; retry reduz peso', () => {
    const low = analyzeAnswer({ user_answer: "I've been working in this company for three years.", expected_answer: expected, skill_target: 'present_perfect_continuous' })
    const ev = buildSkillEvents({ answer: answerFrom(low), answer_id: 1, attempt_number: 1 }).find((e) => e.skill_id === 'workplace_preposition')
    expect(ev.effective_weight).toBeCloseTo(0.252, 3)
    expect(retryMultiplier(1)).toBe(1)
    expect(retryMultiplier(2)).toBe(0.5)
    expect(retryMultiplier(3)).toBe(0.25)
  })
  it('event_id é estável por profile + answer + skill', () => {
    const r = analyzeAnswer({ user_answer: "I've been worked at this company for three years.", expected_answer: expected, skill_target: 'present_perfect_continuous' })
    const a = answerFrom(r, 7)
    const e1 = buildSkillEvents({ answer: a, answer_id: 7 })
    const e2 = buildSkillEvents({ answer: a, answer_id: 7 })
    expect(e1.map((e) => e.event_id)).toEqual(e2.map((e) => e.event_id))
  })
})

describe('export learning_profile', () => {
  it('gera YAML válido e compacto sem alignment', () => {
    const profiles = [
      aggregateSkillProfile([{ key: 'k', event_id: 'k', profile_id: 'p1', skill_id: 'gerund_after_been', outcome: 'incorrect', outcome_score: 0, effective_weight: 1, severity: 'high', confidence: .98, created_at: 1, actual: 'worked', expected: 'working' }], { profile_id: 'p1', skill_id: 'gerund_after_been' }),
    ]
    const text = buildResultYaml({ lesson: { lesson_id: 'l1', level: 'B1' }, answers: [], skillProfiles: profiles })
    const doc = yaml.load(text)
    expect(doc.result.learning_profile.needs_review[0].skill).toBe('gerund_after_been')
    expect(text).not.toContain('alignment:')
  })
})
