import { describe, it, expect } from 'vitest'
import { questionLanguageContract, questionLanguageIssues } from './generated-lesson-contracts.js'
import { generateLessonFromContext } from './lesson-generator.js'

const THEMES = ['daily_life', 'workplace', 'travel', 'food_and_restaurants', 'shopping_and_services', 'technology_and_communication']
const LEVELS = ['A1', 'A2', 'B1', 'B2']

describe('question language contract', () => {
  it('marks translation source as Portuguese and answer English', () => {
    const c = questionLanguageContract({ type: 'translate_natural', prompt_pt: 'Eu trabalho aqui todos os dias.', prompt: 'Traduza...', expected_answer: 'I work here every day.' })
    expect(c.source_locale).toBe('pt-BR')
    expect(c.answer_locale).toBe('en')
    expect(c.hide_answer).toBe(true)
  })

  it('flags a translation whose prompt leaks the English answer', () => {
    const bad = { type: 'translate_natural', prompt_pt: 'I work here every day.', prompt: 'Traduza', expected_answer: 'I work here every day.' }
    expect(questionLanguageIssues(bad)).toContain('PROMPT_LEAKS_ANSWER')
  })

  it('flags a listen question that exposes the transcript', () => {
    const bad = { type: 'listen_type', prompt: 'He goes to work every day.', prompt_pt: 'He goes to work every day.', expected_answer: 'He goes to work every day.' }
    expect(questionLanguageIssues(bad)).toContain('TRANSCRIPT_EXPOSED')
  })

  it('allows rewrite to show the English source with a clear instruction', () => {
    const c = questionLanguageContract({ type: 'rewrite_natural', prompt: 'Reescreva a frase corrigindo a ordem das palavras.', original: 'Work I every day here.', expected_answer: 'I work here every day.' })
    expect(c.source_locale).toBe('en')
    expect(questionLanguageIssues({ type: 'rewrite_natural', prompt: 'Reescreva a frase corrigindo a ordem das palavras.', original: 'Work I every day here.', expected_answer: 'I work here every day.' })).toEqual([])
  })

  it('every generated question across all 24 combos satisfies the contract', () => {
    for (const theme of THEMES) for (const level of LEVELS) {
      for (const questionCount of [10, 30]) {
        const lesson = generateLessonFromContext({ theme, level, profile_id: 'p1', target_skills: [] }, { questionCount, profileId: 'p1' })
        for (const q of lesson.questions) {
          const issues = questionLanguageIssues(q)
          expect(issues, `${theme}/${level} q${q.id} (${q.type}) → ${issues.join(',')}`).toEqual([])
          const c = questionLanguageContract(q)
          expect(c.instruction_pt.length).toBeGreaterThan(0)
        }
      }
    }
  })
})
