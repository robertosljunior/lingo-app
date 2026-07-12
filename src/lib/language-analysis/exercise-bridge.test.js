import { describe, it, expect } from 'vitest'
import { resolveAssessmentMode, usesSemanticPipeline, essentialWords, toExerciseAnalysis } from './exercise-bridge.js'
import { analyzeUserProduction } from './language-analysis-orchestrator.js'
import { KnowledgeBase } from './knowledge-base.js'
import { BUILTIN_KNOWLEDGE_PACKS } from '../../content/knowledge-packs/index.js'
import { ResilientSemanticEncoder } from './semantic-encoder-adapter.js'

const kb = new KnowledgeBase(BUILTIN_KNOWLEDGE_PACKS)
const analyze = (params) => analyzeUserProduction({ ...params, engines: { knowledgeBase: kb } })

describe('assessment mode mapping', () => {
  it('maps question types to modes', () => {
    expect(resolveAssessmentMode({ type: 'fill_blank' })).toBe('exact')
    expect(resolveAssessmentMode({ type: 'choose_best' })).toBe('exact')
    expect(resolveAssessmentMode({ type: 'listen_type' })).toBe('exact')
    expect(resolveAssessmentMode({ type: 'translate_natural' })).toBe('equivalent')
    expect(resolveAssessmentMode({ type: 'rewrite_natural' })).toBe('equivalent')
    expect(resolveAssessmentMode({ type: 'answer_question' })).toBe('free')
    expect(resolveAssessmentMode({ type: 'x', assessment_mode: 'guided' })).toBe('guided')
  })
  it('routes free/guided (and opt-in equivalent) through the pipeline; legacy translate stays on the old engine', () => {
    expect(usesSemanticPipeline({ type: 'answer_question' })).toBe(true)
    expect(usesSemanticPipeline({ type: 'free_write' })).toBe(true)
    expect(usesSemanticPipeline({ type: 'x', assessment_mode: 'guided' })).toBe(true)
    expect(usesSemanticPipeline({ type: 'x', assessment_mode: 'equivalent' })).toBe(true)
    // Legacy translate/rewrite keep the established engine unless opted in.
    expect(usesSemanticPipeline({ type: 'translate_natural' })).toBe(false)
    expect(usesSemanticPipeline({ type: 'fill_blank' })).toBe(false)
  })
  it('essentialWords keeps content words only', () => {
    expect(essentialWords('The dessert is important.')).toEqual(expect.arrayContaining(['dessert', 'important']))
    expect(essentialWords('The dessert is important.')).not.toContain('the')
  })
})

describe('toExerciseAnalysis (free never leaks the model answer)', () => {
  it('free valid answer hides model answer and surfaces alternatives', async () => {
    const result = await analyze({ text: 'Please give me a dessert.', assessmentMode: 'free', level: 'A1' })
    const a = toExerciseAnalysis(result, { question: { expected_answer: 'Could I have a dessert, please?', type: 'free_write' }, mode: 'free' })
    expect(a.verdict).toBe('correct')
    expect(a.semantic_feedback.hide_model_answer).toBe(true)
    expect(a.target).toBeNull() // model answer never exposed as target in free mode
    expect(a.semantic_feedback.natural_alternatives).toContain('Could I have a dessert, please?')
  })

  it('free real error exposes a corrected version, not the model answer', async () => {
    const result = await analyze({ text: 'He go to work every day.', assessmentMode: 'free', level: 'A1' })
    const a = toExerciseAnalysis(result, { question: { expected_answer: 'He goes to work every day.', type: 'free_write' }, mode: 'free' })
    expect(a.verdict).toBe('incorrect')
    expect(a.semantic_feedback.corrected_version).toBe('He goes to work every day.')
    expect(a.target).toBe('He goes to work every day.') // corrected, derived from the user's own sentence
  })
})

describe('engine-effective reporting', () => {
  it('reports hashing fallback honestly when no USE loader is provisioned', async () => {
    const enc = new ResilientSemanticEncoder({}) // no USE loader
    const result = await analyzeUserProduction({ text: 'Please give me a dessert.', assessmentMode: 'free', level: 'A1', engines: { knowledgeBase: kb, semanticEncoder: enc } })
    expect(result.engines.semantic_requested).toBe('hashing')
    expect(result.engines.semantic_effective).toBe('hashing')
  })

  it('reports a USE→hashing fallback with reason when the model fails to load', async () => {
    const enc = new ResilientSemanticEncoder({ useLoader: async () => { throw new Error('boom') } })
    const result = await analyzeUserProduction({ text: 'Please give me a dessert.', assessmentMode: 'free', level: 'A1', engines: { knowledgeBase: kb, semanticEncoder: enc } })
    expect(result.engines.semantic_requested).toBe('use')
    expect(result.engines.semantic_effective).toBe('hashing')
    expect(result.fallback_events.some((e) => e.engine === 'semantic')).toBe(true)
  })

  it('uses real USE when a working loader is provided (test double)', async () => {
    // Minimal USE-like double: embed returns deterministic vectors.
    const model = { embed: async (arr) => arr.map((t) => [t.length, (t.match(/dessert/) ? 1 : 0), t.split(' ').length]) }
    const enc = new ResilientSemanticEncoder({ useLoader: async () => model })
    const result = await analyzeUserProduction({ text: 'Please give me a dessert.', assessmentMode: 'free', level: 'A1', engines: { knowledgeBase: kb, semanticEncoder: enc } })
    expect(result.engines.semantic_effective).toBe('use')
    expect(result.fallback_events).toHaveLength(0)
  })
})

describe('alternative preservation guard', () => {
  it('rejects a topically-related but intent-flipping alternative', async () => {
    const { preservesIntent } = await import('./language-analysis-orchestrator.js')
    const structure = { sentence_type: 'imperative', intent_signals: ['request'], objects: [{ token: 'dessert' }] }
    expect(preservesIntent('Please give me a dessert.', 'Could I have a dessert, please?', structure)).toBe(true)
    expect(preservesIntent('Please give me a dessert.', 'The dessert is important.', structure)).toBe(false)
  })
})
