import { describe, expect, it } from 'vitest'
import { buildAdaptivePracticePlan } from './adaptive-planner.js'
import { parseLesson } from './lesson-parser.js'
import { getLessonTemplates, templateFamilies, TEMPLATE_REGISTRY_VERSION, SUPPORTED_GENERATED_TYPES } from './lesson-template-registry.js'
import { LEXICAL_BANK_VERSION, LEXICAL_ITEMS, COLLOCATION_RULES, validateCuratedCollocationAnswer, normalize } from './lexical-bank.js'
import { generateLessonFromContext, buildGeneratedLessonYaml, allocateLessonSkills, LESSON_GENERATOR_VERSION } from './lesson-generator.js'
import { validateGeneratedLesson } from './generated-lesson-validator.js'

const requiredContext = {
  level: 'B1', profile_id: 'profile_a',
  target_skills: [
    { skill_id: 'gerund_after_been', priority: 1.0, mastery: 0.34, evidence: 'emerging' },
    { skill_id: 'question_structure', priority: 0.72, mastery: 0.55, evidence: 'established' },
  ],
  reinforcement_skills: [
    { skill_id: 'workplace_preposition', mastery: 0.68 },
    { skill_id: 'collocation', mastery: 0.74 },
  ],
  recent_sentences: ["I've been working at this company for three years."],
}

describe('deterministic generated lesson slice', () => {
  it('has versioned safe template registry with coverage', () => {
    expect(TEMPLATE_REGISTRY_VERSION).toBe('1')
    const templates = getLessonTemplates()
    expect(templateFamilies().length).toBeGreaterThanOrEqual(24)
    const ids = new Set(templates.map(t => t.template_id))
    expect(ids.size).toBe(templates.length)
    for (const t of templates) {
      expect(t.family_id).toBeTruthy(); expect(t.level).toBe('B1'); expect(t.primary_skill_id).toBeTruthy()
      expect(t.skill_ids.length).toBeGreaterThan(0); expect(t.domain).toBeTruthy(); expect(t.difficulty).toBeTruthy()
      expect(t.constraints.length).toBeGreaterThan(0); expect(typeof t.sentence).toBe('string')
      expect(t.exercise_types.every(x => SUPPORTED_GENERATED_TYPES.includes(x))).toBe(true)
      expect(Object.values(t.slots || {}).every(v => Array.isArray(v))).toBe(true)
    }
    expect([...new Set(templates.flatMap(t => t.skill_ids))]).toEqual(expect.arrayContaining(['present_perfect','present_perfect_continuous','gerund_after_been','question_structure','question_auxiliary','missing_auxiliary','wrong_auxiliary','verb_form','verb_tense','word_order','preposition','workplace_preposition','collocation','vocabulary','apostrophe_usage']))
  })

  it('has curated lexical bank and collocation guard', () => {
    expect(LEXICAL_BANK_VERSION).toBe('1')
    expect(new Set(LEXICAL_ITEMS.map(i => i.id)).size).toBe(LEXICAL_ITEMS.length)
    for (const i of LEXICAL_ITEMS) { expect(i.en).toBeTruthy(); expect(i.pt).toBeTruthy(); expect(i.type).toBeTruthy(); expect(i.level).toBe('B1') }
    expect(COLLOCATION_RULES.length).toBeGreaterThanOrEqual(8)
    expect(validateCuratedCollocationAnswer('We need to make a decision by Friday.').valid).toBe(true)
    expect(validateCuratedCollocationAnswer('We need to do a decision by Friday.').valid).toBe(false)
  })

  it('generates deterministic valid 30-question lesson with all exercise contracts', () => {
    const a = generateLessonFromContext(requiredContext, { seed: 'slice4-required', questionCount: 30 })
    const b = generateLessonFromContext(requiredContext, { seed: 'slice4-required', questionCount: 30 })
    const c = generateLessonFromContext(requiredContext, { seed: 'slice4-other', questionCount: 30 })
    expect(LESSON_GENERATOR_VERSION).toBe('1')
    expect(buildGeneratedLessonYaml(a)).toBe(buildGeneratedLessonYaml(b))
    expect(buildGeneratedLessonYaml(a)).not.toBe(buildGeneratedLessonYaml(c))
    expect(a.questions).toHaveLength(30); expect(a.level).toBe('B1')
    const validation = validateGeneratedLesson(a, { expectedCount: 30 })
    expect(validation.errors).toEqual([]); expect(validation.valid).toBe(true)
    const typeCounts = countBy(a.questions, q => q.type)
    expect(Object.keys(typeCounts).sort()).toEqual(SUPPORTED_GENERATED_TYPES.slice().sort())
    expect(typeCounts).toMatchObject({ translate_natural: 6, fill_blank: 5, build_sentence: 5, choose_best: 4, rewrite_natural: 4, listen_type: 3, speak_sentence: 3 })
    const familyCounts = countBy(a.questions, q => q.metadata.family_id)
    expect(Math.max(...Object.values(familyCounts))).toBeLessThanOrEqual(3)
    expect(a.questions.some(q => normalize(q.expected_answer) === normalize(requiredContext.recent_sentences[0]))).toBe(false)
    for (const q of a.questions) {
      if (q.type === 'fill_blank') { expect(q.options).toContain(q.expected_answer); expect(q.prompt).toContain('____'); expect(new Set(q.options.map(normalize)).size).toBe(q.options.length) }
      if (q.type === 'choose_best') { expect(q.options).toContain(q.expected_answer); expect(new Set(q.options.map(normalize)).size).toBe(q.options.length) }
      if (q.type === 'build_sentence') expect(normalize(q.words.join(' '))).toBe(normalize(q.expected_answer))
      if (q.type === 'rewrite_natural') expect(normalize(q.original)).not.toBe(normalize(q.expected_answer))
      if (q.type === 'listen_type' || q.type === 'speak_sentence') { expect(q.prompt_pt).toBeTruthy(); expect(q.expected_answer).toBeTruthy() }
      expect(validateCuratedCollocationAnswer(q.expected_answer).valid).toBe(true)
    }
    const yaml = buildGeneratedLessonYaml(a); const parsed = parseLesson(yaml)
    expect(parsed.questions).toHaveLength(30)
    expect(parsed.questions.filter(q => q.type === 'fill_blank').every(q => q.options?.length)).toBe(true)
  })

  it('allocates skills without missing_auxiliary legacy leakage and planner consumes persisted generated questions', () => {
    const plan = allocateLessonSkills({ target_skills:[{skill_id:'gerund_after_been'},{skill_id:'missing_auxiliary'}], reinforcement_skills:[{skill_id:'collocation'}] }, 30)
    expect(plan.some(x => x.skill_id === 'missing_auxiliary')).toBe(false)
    const lesson = generateLessonFromContext(requiredContext, { seed: 'planner-index' })
    const questions = lesson.questions.map(q => ({ ...q, lesson_id: lesson.lesson_id, skill_index: { question_index_version: '1', lesson_id: lesson.lesson_id, question_id: String(q.id), skill_ids: q.metadata.skill_ids, primary_skill_id: q.metadata.primary_skill_id, exercise_type: q.type, level: 'B1' } }))
    const before = buildAdaptivePracticePlan({ profile:{profile_id:'profile_a',level:'B1'}, skillProfiles:[{skill_id:'gerund_after_been',mastery:.3,evidence_level:'emerging',attempts:3}], questions:[], requestedSize:10, seed:'p' })
    const after = buildAdaptivePracticePlan({ profile:{profile_id:'profile_a',level:'B1'}, skillProfiles:[{skill_id:'gerund_after_been',mastery:.3,evidence_level:'emerging',attempts:3}], questions, requestedSize:10, seed:'p' })
    expect(before.warnings.some(w => w.code === 'INSUFFICIENT_QUESTIONS')).toBe(true)
    expect(after.selected_questions.length).toBeGreaterThan(0)
  })
})
function countBy(xs, fn){ return xs.reduce((m,x)=>{ const k=fn(x); m[k]=(m[k]||0)+1; return m },{}) }
