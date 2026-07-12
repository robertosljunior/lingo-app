import { describe, it, expect } from 'vitest'
import { buildFeedbackPresentation } from './feedback-presentation.js'

describe('feedback presentation', () => {
  it('hides technical codes from normal presentation', () => {
    const p = buildFeedbackPresentation({ evaluation:{ verdict:'incorrect', primary_error:{ category:'incorrect_choice', subtype:'incorrect_choice', severity:'medium', confidence:.72, rule_id:'choice.exact_match' }, detected_errors:[] }, question:{ expected_answer:'Do' }, userAnswer:'make', expectedAnswer:'Do' })
    const text = JSON.stringify({ title:p.title, explanation_pt:p.explanation_pt, secondary:p.secondary_suggestions })
    expect(text).not.toContain('incorrect_choice/incorrect_choice')
    expect(text).not.toContain('medium')
    expect(text).not.toContain('confidence')
    expect(text).not.toContain('rule_id')
  })
  it('uses incorrect choice distractor metadata for collocation', () => {
    const p = buildFeedbackPresentation({ evaluation:{ verdict:'incorrect', primary_error:{ category:'incorrect_choice', subtype:'incorrect_choice', rule_id:'choice.exact_match', actual:'make', expected:'do' } }, question:{ expected_answer:'do', metadata:{ distractors:{ make:{ invalid_rule_id:'wrong_collocation' } } } }, userAnswer:'make', selectedOption:'make', expectedAnswer:'do' })
    expect(p.title).toMatch(/do/i)
    expect(p.explanation_pt).toMatch(/make/i)
    expect(p.explanation_pt).toMatch(/collocation|combinação|natural/i)
  })
  it('groups word order derived insert/delete details', () => {
    const p = buildFeedbackPresentation({ evaluation:{ verdict:'incorrect', detected_errors:[{ category:'word_order', subtype:'word_order', rule_id:'tokens.same_words_different_order' }, { category:'vocabulary', subtype:'delete' }, { category:'vocabulary', subtype:'insert' }] }, question:{ expected_answer:'Have you finished the report yet?' }, userAnswer:'Report you have finished the yet', expectedAnswer:'Have you finished the report yet?', skillTarget:'question_structure' })
    expect(p.title).toMatch(/ordem/i)
    expect(p.explanation_pt).toMatch(/have/i)
    expect(p.secondary_suggestions.length).toBe(0)
  })
  it('explains gerund after been', () => {
    const p = buildFeedbackPresentation({ evaluation:{ verdict:'incorrect', primary_error:{ category:'verb_form', subtype:'gerund_after_been', actual:'worked', expected:'working' } }, expectedAnswer:'I have been working.' })
    expect(p.title).toMatch(/ing/i)
    expect(p.explanation_pt).toMatch(/have\/has been/i)
  })
})
