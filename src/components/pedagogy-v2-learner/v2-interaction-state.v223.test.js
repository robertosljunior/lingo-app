import { describe, expect, it } from 'vitest'
import {
  DISTRACTOR_LEVEL_BY_EXPOSURE_STAGE,
  planLevel,
  wordOrderDistractors,
} from './v2-interaction-state.js'

const STAGES = [
  ['A1', 'A1'],
  ['A1-A2', 'A1'],
  ['A2', 'A2'],
  ['A2-B1', 'A2'],
  ['B1', 'B1'],
  ['B1-B2', 'B1'],
  ['B2', 'B2'],
]

describe('V2.23 — semantic-distractor level mapping', () => {
  it.each(STAGES)('maps V2 exposure_stage %s to conservative fallback %s', (stage, expected) => {
    expect(DISTRACTOR_LEVEL_BY_EXPOSURE_STAGE[stage]).toBe(expected)
    expect(planLevel({ exposure_stage: stage })).toBe(expected)
  })

  it('prefers the V2 exposure stage over obsolete level-shaped fields', () => {
    expect(planLevel({ exposure_stage: 'A1', level: 'B2', cefr_level: 'B2' })).toBe('A1')
  })

  it('keeps legacy fixture compatibility when exposure_stage is absent', () => {
    expect(planLevel({ level: 'A2' })).toBe('A2')
    expect(planLevel({ cefr_level: 'B2' })).toBe('B2')
    expect(planLevel({ difficulty: 'A1' })).toBe('A1')
    expect(planLevel({})).toBe('B1')
    expect(planLevel({ exposure_stage: 'UNKNOWN' })).toBe('B1')
  })
})

describe('V2.23 — existing PR #70 distractor bounds', () => {
  const plan = (stage, text) => ({
    activity_id: `audit:${stage}:${text}`,
    pack_id: 'pedagogy_v2_still',
    exposure_stage: stage,
    text_en: text,
    presentation: { token_source: { semantic_distractors: true } },
  })

  it.each([
    [['I', 'still', 'live', 'here'], 1],
    [['I', 'still', 'have', 'to', 'work', 'from', 'home'], 2],
    [['Even', 'now', 'we', 'still', 'have', 'a', 'lot', 'of', 'work', 'to', 'do'], 3],
  ])('keeps distractors at 1–3 and never above the 30%% ceiling', (tokens, expectedMax) => {
    const distractors = wordOrderDistractors(plan('B1', tokens.join(' ')), tokens)
    expect(distractors.length).toBeGreaterThanOrEqual(1)
    expect(distractors.length).toBeLessThanOrEqual(expectedMax)
    expect(distractors.length).toBeLessThanOrEqual(Math.max(1, Math.ceil(tokens.length * 0.3)))
    expect(new Set(distractors).size).toBe(distractors.length)
    for (const token of distractors) expect(tokens.map((x) => x.toLowerCase())).not.toContain(token)
  })

  it('is deterministic for the same plan and token bank', () => {
    const tokens = ['She', 'still', 'works', 'here']
    const p = plan('A2', tokens.join(' '))
    expect(wordOrderDistractors(p, tokens)).toEqual(wordOrderDistractors(p, tokens))
  })
})
