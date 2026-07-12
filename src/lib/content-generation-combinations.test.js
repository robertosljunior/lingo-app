// PARTE 26 — every theme × level combination generates a valid 30-question
// lesson from core_<level> + <theme>_<level>.
import { describe, expect, it } from 'vitest'
import { composeBundledSnapshot } from './content-pack-loader.js'
import { generateLesson, buildGeneratedLessonYaml, normalize, SUPPORTED_GENERATED_TYPES } from './lesson-generator.js'
import { validateGeneratedLesson } from './generated-lesson-validator.js'
import { parseLesson } from './lesson-parser.js'
import { skillAllowedAtLevel } from './content-rule-registry.js'

const THEMES = ['daily_life', 'workplace', 'travel', 'food_and_restaurants', 'shopping_and_services', 'technology_and_communication']
const LEVELS = ['A1', 'A2', 'B1', 'B2']

describe('24 theme × level generation combinations', () => {
  for (const theme of THEMES) {
    for (const level of LEVELS) {
      it(`${theme} ${level}: 30 valid questions, seven types, CEFR-compatible`, () => {
        const snapshot = composeBundledSnapshot(theme, level)
        expect(snapshot.pack_ids).toEqual(expect.arrayContaining([`core_${level.toLowerCase()}`, `${theme}_${level.toLowerCase()}`]))
        const lesson = generateLesson({ context: { profile_id: 'combo' }, contentSnapshot: snapshot, seed: `combo-${theme}-${level}`, questionCount: 30 })
        expect(lesson.questions).toHaveLength(30)
        expect(lesson.level).toBe(level)
        expect(lesson.generation_metadata.content_pack_ids).toEqual(snapshot.pack_ids)
        const v = validateGeneratedLesson(lesson, { expectedCount: 30, collocations: snapshot.collocations })
        expect(v.errors, `${theme}/${level}: ${v.errors.join(',')}`).toEqual([])
        // All seven exercise types are used (all templates support them).
        const types = new Set(lesson.questions.map((q) => q.type))
        for (const t of SUPPORTED_GENERATED_TYPES) expect(types.has(t), `${theme}/${level} missing ${t}`).toBe(true)
        // No duplicate content signatures within the lesson.
        const sigs = lesson.questions.map((q) => q.metadata.question_signature)
        expect(new Set(sigs).size).toBe(sigs.length)
        // Primary skills respect the CEFR gate for the level.
        for (const q of lesson.questions) {
          expect(skillAllowedAtLevel(q.metadata.primary_skill_id, level), `${q.metadata.primary_skill_id}@${level}`).toBe(true)
        }
        // YAML round-trip through the real parser.
        const parsed = parseLesson(buildGeneratedLessonYaml(lesson))
        expect(parsed.questions).toHaveLength(30)
        // Answers are non-empty natural sentences/blanks.
        for (const q of lesson.questions) expect(normalize(q.expected_answer).length).toBeGreaterThan(0)
      })
    }
  }
})
