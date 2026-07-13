import { describe, it, expect } from 'vitest'
import { planExerciseDistribution, pedagogicalJustification, TYPE_TO_FAMILY } from './lesson-generator.js'

function families(dist) {
  const f = {}
  for (const [t, n] of Object.entries(dist)) f[TYPE_TO_FAMILY[t]] = (f[TYPE_TO_FAMILY[t]] || 0) + n
  return f
}

describe('exercise family balancing', () => {
  it('neutral 10-question lesson: 4+ distinct types, every family present, no type over 40%', () => {
    const { actual_distribution: d, constraints } = planExerciseDistribution({ questionCount: 10 })
    expect(Object.keys(d).length).toBeGreaterThanOrEqual(4)
    const fams = families(d)
    for (const fam of ['production', 'listening', 'ordering', 'recognition']) expect(fams[fam]).toBeGreaterThanOrEqual(1)
    expect(Math.max(...Object.values(d))).toBeLessThanOrEqual(4)
    expect(constraints).toEqual([])
  })

  it('writing-weak profile boosts production but keeps every other family', () => {
    const { actual_distribution: d } = planExerciseDistribution({ questionCount: 10, priorityFamily: 'production' })
    const fams = families(d)
    expect(fams.production).toBeGreaterThanOrEqual(4)
    expect(fams.production).toBeLessThanOrEqual(4) // adaptive cap for priority type family at 10q
    expect(fams.listening).toBeGreaterThanOrEqual(1)
    expect(fams.ordering).toBeGreaterThanOrEqual(1)
    expect(fams.recognition).toBeGreaterThanOrEqual(1)
  })

  it('listening-weak profile boosts listening without eliminating other families', () => {
    const fams = families(planExerciseDistribution({ questionCount: 10, priorityFamily: 'listening' }).actual_distribution)
    expect(fams.listening).toBeGreaterThanOrEqual(3)
    expect(fams.production).toBeGreaterThanOrEqual(1)
    expect(fams.ordering).toBeGreaterThanOrEqual(1)
    expect(fams.recognition).toBeGreaterThanOrEqual(1)
  })

  it('20-question lesson: >=5 distinct types, no type above 40%', () => {
    const { actual_distribution: d } = planExerciseDistribution({ questionCount: 20 })
    expect(Object.keys(d).length).toBeGreaterThanOrEqual(5)
    expect(Math.max(...Object.values(d))).toBeLessThanOrEqual(Math.floor(20 * 0.4))
  })

  it('30-question lesson: >=6 distinct types, no type above 35%', () => {
    const { actual_distribution: d } = planExerciseDistribution({ questionCount: 30 })
    expect(Object.keys(d).length).toBeGreaterThanOrEqual(6)
    expect(Math.max(...Object.values(d))).toBeLessThanOrEqual(Math.floor(30 * 0.35))
  })

  it('insufficient templates: uses best distribution and records a constraint', () => {
    // Only recognition templates available — cannot meet family minimums.
    const plan = planExerciseDistribution({ questionCount: 10, availableTypes: ['fill_blank', 'choose_best'] })
    expect(plan.actual_distribution.fill_blank + plan.actual_distribution.choose_best).toBe(10)
    expect(plan.constraints.some((c) => c.startsWith('no_templates_for_family'))).toBe(true)
    expect(pedagogicalJustification(plan)).toMatch(/melhor distribuição possível/)
  })

  it('is deterministic for the same inputs', () => {
    const a = planExerciseDistribution({ questionCount: 10, priorityFamily: 'production' })
    const b = planExerciseDistribution({ questionCount: 10, priorityFamily: 'production' })
    expect(a.sequence).toEqual(b.sequence)
  })

  it('justification never leaks scores, mastery, weights, or skill ids', () => {
    const j = pedagogicalJustification({ priorityFamily: 'production', actual_distribution: { translate_natural: 4 }, constraints: [] })
    expect(j).not.toMatch(/\d/) // no numbers
    expect(j).not.toMatch(/mastery|weight|skill_id|0\.\d/)
  })
})
