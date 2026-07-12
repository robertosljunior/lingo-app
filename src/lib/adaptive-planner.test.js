import { describe, it, expect } from 'vitest'
import { inferQuestionSkills, rankSkillsForReview, buildAdaptivePracticePlan, buildLessonGenerationContext } from './adaptive-planner.js'

const now = Date.UTC(2026, 6, 12)
const profiles = [
  { profile_id:'p1', skill_id:'gerund_after_been', category:'verb_form', mastery:0.34, evidence_level:'emerging', attempts:4, high_errors:3, medium_errors:0, low_errors:0, last_error_at:now-3600, trend:'stable', current_correct_streak:0, recent_examples:[{actual:'worked', expected:'working', severity:'high'}] },
  { profile_id:'p1', skill_id:'workplace_preposition', category:'preposition', mastery:0.42, evidence_level:'insufficient', attempts:1, high_errors:0, medium_errors:0, low_errors:1, last_error_at:now-3600, trend:'insufficient_data', current_correct_streak:0 },
  { profile_id:'p1', skill_id:'question_structure', category:'question_structure', mastery:0.82, evidence_level:'established', attempts:10, high_errors:0, medium_errors:0, low_errors:0, trend:'improving', current_correct_streak:3 },
]
const questions = Array.from({length:12}, (_,i)=>({ lesson_id:'l1', id:i+1, type:i%3===0?'translate_natural':i%3===1?'fill_blank':'choose_option', skill_target: i<6?'present_perfect_continuous':i<8?'workplace_preposition':'question_structure', expected_answer: i<6?`I have been working at this company for ${i+1} years.`:i<8?'I work at this company.':'Do you work here?' }))

describe('adaptive planner', () => {
  it('infere skills por metadata, alias e padrões sem duplicar missing_auxiliary', () => {
    const r = inferQuestionSkills({ skill_target:'have been ing', expected_answer:"I've been working at this company for three years." })
    expect(r.primary_skill_id).toBe('gerund_after_been')
    expect(r.skill_ids).toContain('present_perfect_continuous')
    expect(r.skill_ids).toContain('gerund_after_been')
    expect(r.skill_ids).toContain('workplace_preposition')
    expect(r.skill_ids).not.toContain('missing_auxiliary')
    expect(new Set(r.skill_ids).size).toBe(r.skill_ids.length)
  })
  it('ranking modera evidência insuficiente e low severity', () => {
    const ranked = rankSkillsForReview(profiles, now)
    expect(ranked[0].skill_id).toBe('gerund_after_been')
    expect(ranked.find(p=>p.skill_id==='workplace_preposition').priority).toBeLessThan(ranked[0].priority)
    expect(ranked.find(p=>p.skill_id==='question_structure').priority).toBeLessThan(ranked[0].priority)
  })
  it('seleciona sem duplicar, determinístico e com razões auditáveis', () => {
    const a = buildAdaptivePracticePlan({ profile:{profile_id:'p1'}, skillProfiles:profiles, questions, answerHistory:[], srsState:[], requestedSize:10, seed:'same', now })
    const b = buildAdaptivePracticePlan({ profile:{profile_id:'p1'}, skillProfiles:profiles, questions, answerHistory:[], srsState:[], requestedSize:10, seed:'same', now })
    expect(a).toEqual(b)
    expect(a.actual_size).toBeLessThanOrEqual(10)
    expect(new Set(a.selected_questions.map(q=>`${q.lesson_id}:${q.question_id}`)).size).toBe(a.selected_questions.length)
    expect(a.selected_questions[0].reasons.length).toBeGreaterThan(0)
  })
  it('prática direcionada favorece skill alvo e não fabrica perguntas', () => {
    const p = buildAdaptivePracticePlan({ profile:{profile_id:'p1'}, skillProfiles:profiles, questions:questions.slice(0,3), requestedSize:10, targetSkillId:'gerund_after_been', seed:'x', now })
    expect(p.actual_size).toBe(3)
    expect(p.warnings.some(w=>w.code==='INSUFFICIENT_QUESTIONS')).toBe(true)
    expect(p.selected_questions.every(q=>q.skill_ids.includes('gerund_after_been') || q.skill_ids.includes('present_perfect_continuous'))).toBe(true)
  })
  it('SRS vencido sobe e correto recente desce', () => {
    const due = buildAdaptivePracticePlan({ profile:{profile_id:'p1'}, skillProfiles:profiles, questions:questions.slice(0,2), srsState:[{lesson_id:'l1',question_id:2,due_at:now-1}], answerHistory:[{profile_id:'p1',lesson_id:'l1',question_id:1,verdict:'correct',answered_at:now-1000}], requestedSize:5, seed:'srs', now })
    expect(due.selected_questions[0].question_id).toBe('2')
  })
  it('contexto de geração é compacto', () => {
    const ctx = buildLessonGenerationContext({ profileId:'p1', skillProfiles:profiles, answers:Array.from({length:40},(_,i)=>({profile_id:'p1',lesson_id:'l',question_id:i,expected_answer:`s${i}`,answered_at:now-i})) })
    expect(ctx.target_skills.length).toBeLessThanOrEqual(8)
    expect(ctx.recent_question_ids.length).toBe(30)
  })
})
