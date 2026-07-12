import { describe, expect, it } from 'vitest'
import { buildAdaptivePracticePlan } from './adaptive-planner.js'
import { parseLesson } from './lesson-parser.js'
import { composeBundledSnapshot } from './content-pack-loader.js'
import { generateLesson, buildGeneratedLessonYaml, buildCollocationGuard, allocateLessonSkills, normalize, LESSON_GENERATOR_VERSION, SUPPORTED_GENERATED_TYPES } from './lesson-generator.js'
import { validateGeneratedLesson } from './generated-lesson-validator.js'

const snapshot = composeBundledSnapshot('workplace', 'B1')

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

describe('snapshot-driven generated lesson (Slice 5)', () => {
  it('collocation guard built from snapshot data rejects known invalid variants', () => {
    const guard = buildCollocationGuard(snapshot.collocations)
    expect(guard.rules.length).toBeGreaterThanOrEqual(8)
    expect(guard.validate('We need to make a decision by Friday.').valid).toBe(true)
    expect(guard.validate('We need to do a decision by Friday.').valid).toBe(false)
  })

  it('refuses to generate without a content snapshot', () => {
    expect(() => generateLesson({ context: requiredContext, questionCount: 30 })).toThrow(/CONTENT_SNAPSHOT_REQUIRED/)
  })

  it('generates deterministic valid 30-question lesson with all exercise contracts', () => {
    const a = generateLesson({ context: requiredContext, contentSnapshot: snapshot, seed: 'slice5-required', questionCount: 30 })
    const b = generateLesson({ context: requiredContext, contentSnapshot: snapshot, seed: 'slice5-required', questionCount: 30 })
    const c = generateLesson({ context: requiredContext, contentSnapshot: snapshot, seed: 'slice5-other', questionCount: 30 })
    expect(LESSON_GENERATOR_VERSION).toBe('1')
    expect(buildGeneratedLessonYaml(a)).toBe(buildGeneratedLessonYaml(b))
    expect(buildGeneratedLessonYaml(a)).not.toBe(buildGeneratedLessonYaml(c))
    expect(a.questions).toHaveLength(30); expect(a.level).toBe('B1')
    const validation = validateGeneratedLesson(a, { expectedCount: 30, collocations: snapshot.collocations })
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
    }
    const yaml = buildGeneratedLessonYaml(a); const parsed = parseLesson(yaml)
    expect(parsed.questions).toHaveLength(30)
    expect(parsed.questions.filter(q => q.type === 'fill_blank').every(q => q.options?.length)).toBe(true)
  })

  it('records content pack identity in the generation metadata', () => {
    const a = generateLesson({ context: requiredContext, contentSnapshot: snapshot, seed: 's', questionCount: 10 })
    expect(a.generation_metadata.content_pack_ids).toEqual(expect.arrayContaining(['core_b1', 'workplace_b1']))
    expect(a.generation_metadata.content_pack_versions.core_b1).toBe(1)
    expect(a.generation_metadata.content_snapshot_checksum).toBeTruthy()
    expect(a.generation_metadata.content_schema_version).toBe('1')
    // Different pack identity → different lesson id (packs participate in
    // the generation key when no explicit seed is passed).
    const auto1 = generateLesson({ context: requiredContext, contentSnapshot: snapshot, questionCount: 10 })
    const other = { ...snapshot, checksum: 'ffffffff', pack_versions: { ...snapshot.pack_versions, core_b1: 2 } }
    const auto2 = generateLesson({ context: requiredContext, contentSnapshot: other, questionCount: 10 })
    expect(auto1.lesson_id).not.toBe(auto2.lesson_id)
  })

  it('allocates skills from the snapshot without missing_auxiliary leakage', () => {
    const plan = allocateLessonSkills({ target_skills: [{ skill_id: 'gerund_after_been' }, { skill_id: 'missing_auxiliary' }], reinforcement_skills: [{ skill_id: 'collocation' }] }, 30, snapshot)
    expect(plan.some(x => x.skill_id === 'missing_auxiliary')).toBe(false)
    const noContext = allocateLessonSkills({}, 30, snapshot)
    const available = new Set(snapshot.template_definitions.map(t => t.primary_skill_id))
    expect(noContext.every(x => available.has(x.skill_id))).toBe(true)
  })

  it('planner consumes persisted generated questions', () => {
    const lesson = generateLesson({ context: requiredContext, contentSnapshot: snapshot, seed: 'planner-index' })
    const questions = lesson.questions.map(q => ({ ...q, lesson_id: lesson.lesson_id, skill_index: { question_index_version: '1', lesson_id: lesson.lesson_id, question_id: String(q.id), skill_ids: q.metadata.skill_ids, primary_skill_id: q.metadata.primary_skill_id, exercise_type: q.type, level: 'B1' } }))
    const before = buildAdaptivePracticePlan({ profile: { profile_id: 'profile_a', level: 'B1' }, skillProfiles: [{ skill_id: 'gerund_after_been', mastery: .3, evidence_level: 'emerging', attempts: 3 }], questions: [], requestedSize: 10, seed: 'p' })
    const after = buildAdaptivePracticePlan({ profile: { profile_id: 'profile_a', level: 'B1' }, skillProfiles: [{ skill_id: 'gerund_after_been', mastery: .3, evidence_level: 'emerging', attempts: 3 }], questions, requestedSize: 10, seed: 'p' })
    expect(before.warnings.some(w => w.code === 'INSUFFICIENT_QUESTIONS')).toBe(true)
    expect(after.selected_questions.length).toBeGreaterThan(0)
  })
})
function countBy(xs, fn) { return xs.reduce((m, x) => { const k = fn(x); m[k] = (m[k] || 0) + 1; return m }, {}) }
