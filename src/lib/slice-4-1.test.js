import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { indexedDB, IDBKeyRange } from 'fake-indexeddb'
import { generateLessonFromContext } from './lesson-generator.js'
import { validateGeneratedLesson } from './generated-lesson-validator.js'
import { parseLesson } from './lesson-parser.js'
import { buildGeneratedLessonYaml } from './lesson-generator.js'
import * as storage from './storage.js'
import { canonicalBuildSentence, tokenizeBuildSentence, isProhibitedCorrectAnswer } from './generated-lesson-contracts.js'

globalThis.indexedDB = indexedDB
globalThis.IDBKeyRange = IDBKeyRange

const ctx = (profile_id='profile-a', target='gerund_after_been') => ({ profile_id, level:'B1', target_skills:[{skill_id:target, priority:1}], reinforcement_skills:[{skill_id:'workplace_preposition'}], recent_sentences:[] })
async function reset(){ await storage.__resetDbForTests(); await indexedDB.deleteDatabase('app-idiomas') }
beforeEach(reset)
afterEach(reset)

describe('slice 4.1 generated lesson hardening', () => {
  it('prevents generated lesson id collisions across profiles and is idempotent per profile', () => {
    const a1 = generateLessonFromContext(ctx('profile-a'), { seed:'same-seed', questionCount:30 })
    const a2 = generateLessonFromContext(ctx('profile-a'), { seed:'same-seed', questionCount:30 })
    const b = generateLessonFromContext(ctx('profile-b'), { seed:'same-seed', questionCount:30 })
    expect(a1.lesson_id).toBe(a2.lesson_id)
    expect(a1.lesson_id).not.toBe(b.lesson_id)
    expect(a1.generation_metadata.generation_key).toBe(a2.generation_metadata.generation_key)
    expect(a1.generation_metadata.owner_scope_hash).not.toBe(b.generation_metadata.owner_scope_hash)
  })

  it('persists generated lesson atomically, reopens, scopes direct access, export and delete', async () => {
    const lesson = generateLessonFromContext(ctx('profile-a'), { seed:'persist', questionCount:30 })
    await storage.saveLesson(lesson)
    await storage.__resetDbForTests()
    const own = await storage.getLesson(lesson.lesson_id, 'profile-a')
    expect(own.questions).toHaveLength(30)
    expect(await storage.getLesson(lesson.lesson_id, 'profile-b')).toEqual(storage.LESSON_NOT_ACCESSIBLE)
    expect((await storage.getAllLessons('profile-b')).map(l=>l.lesson_id)).not.toContain(lesson.lesson_id)
    expect((await storage.getAllQuestions('profile-b')).map(q=>q.lesson_id)).not.toContain(lesson.lesson_id)
    expect(await storage.deleteLesson(lesson.lesson_id, 'profile-b')).toEqual(storage.LESSON_NOT_ACCESSIBLE)
    expect(await storage.deleteLesson(lesson.lesson_id, 'profile-a')).toBe(true)
    expect(await storage.getLesson(lesson.lesson_id, 'profile-a')).toBeNull()
  })

  it('saving same generated lesson is idempotent and preserves owner metadata', async () => {
    const lesson = generateLessonFromContext(ctx('profile-a'), { seed:'idem', questionCount:30 })
    await storage.saveLesson(lesson)
    await storage.saveLesson(lesson)
    const own = await storage.getLesson(lesson.lesson_id, 'profile-a')
    expect(own.questions).toHaveLength(30)
    expect(new Set(own.questions.map(q=>q.key)).size).toBe(30)
    expect(own.owner_profile_id).toBe('profile-a')
    expect(own.generation_metadata.generation_key).toBeTruthy()
    expect(own.questions.every(q=>q.skill_index && q.owner_profile_id==='profile-a')).toBe(true)
  })

  it('rejects transaction before partial generated data is saved', async () => {
    const lesson = generateLessonFromContext(ctx('profile-a'), { seed:'bad', questionCount:30 })
    lesson.questions[0].owner_profile_id = 'profile-b'
    await expect(storage.saveLesson(lesson)).rejects.toThrow(/OWNER_MISMATCH/)
    expect(await storage.getAllLessons('profile-a')).toHaveLength(0)
    expect(await storage.getAllQuestions('profile-a')).toHaveLength(0)
  })

  it('quality gate generates 100 lessons and 3000 valid questions in memory', () => {
    const targets=['gerund_after_been','present_perfect_continuous','question_structure','question_auxiliary','workplace_preposition','collocation','verb_tense']
    const report={ lessons_generated:0, questions_generated:0, invalid_lessons:0, invalid_questions:0, duplicate_signatures:0, exercise_type_distribution:{}, skill_distribution:{}, template_family_distribution:{}, warnings:{}, duration_ms:0 }
    const t0=performance.now()
    for(let i=0;i<100;i++){
      const lesson=generateLessonFromContext(ctx(`quality-profile-${i%4}`, targets[i%targets.length]), { seed:`quality-${String(i).padStart(3,'0')}`, questionCount:30 })
      const val=validateGeneratedLesson(lesson,{expectedCount:30})
      report.lessons_generated++; report.questions_generated+=lesson.questions.length
      if(!val.valid) report.invalid_lessons++
      report.invalid_questions += val.question_results.filter(q=>!q.valid).length
      const sigs=lesson.questions.map(q=>q.metadata.question_signature)
      if(new Set(sigs).size!==sigs.length) report.duplicate_signatures++
      for(const q of lesson.questions){ report.exercise_type_distribution[q.type]=(report.exercise_type_distribution[q.type]||0)+1; report.skill_distribution[q.skill_target]=(report.skill_distribution[q.skill_target]||0)+1; report.template_family_distribution[q.metadata.family_id]=(report.template_family_distribution[q.metadata.family_id]||0)+1; expect(isProhibitedCorrectAnswer(q.expected_answer)).toBe(false) }
      expect(parseLesson(buildGeneratedLessonYaml(lesson)).questions).toHaveLength(30)
    }
    report.duration_ms=Math.round(performance.now()-t0)
    console.info('SLICE_4_1_QUALITY_REPORT', JSON.stringify(report))
    expect(report).toMatchObject({lessons_generated:100,questions_generated:3000,invalid_lessons:0,invalid_questions:0,duplicate_signatures:0})
  })

  it('golden lessons are deterministic and parser-valid', () => {
    const goldens=[['golden-1',['gerund_after_been','question_structure']],['golden-2',['collocation','workplace_preposition']],['golden-3',['present_perfect','verb_tense','question_auxiliary']]]
    for (const [seed, skills] of goldens) {
      const context={...ctx('golden-profile', skills[0]), target_skills: skills.map(skill_id=>({skill_id,priority:1}))}
      const a=generateLessonFromContext(context,{seed,questionCount:30})
      const b=generateLessonFromContext(context,{seed,questionCount:30})
      expect(buildGeneratedLessonYaml(a)).toBe(buildGeneratedLessonYaml(b))
      expect(validateGeneratedLesson(a,{expectedCount:30}).valid).toBe(true)
    }
  })

  it('build sentence canonicalization handles contractions punctuation and repeated tokens', () => {
    expect(tokenizeBuildSentence("I've checked it, and I've sent it.")).toEqual(["I've",'checked','it',',','and',"I've",'sent','it','.'])
    expect(canonicalBuildSentence(["I've",'checked','it','.'])).toBe(canonicalBuildSentence("I’ve checked it."))
    expect(canonicalBuildSentence(['Do',"n't",'?'])).not.toBe(canonicalBuildSentence("don't?"))
    expect(canonicalBuildSentence(tokenizeBuildSentence("Don't send it?"))).toBe(canonicalBuildSentence("Don’t send it?"))
  })
})
