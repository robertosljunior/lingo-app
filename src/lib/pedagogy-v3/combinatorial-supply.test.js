import { describe, expect, it } from 'vitest'
import {
  COMBINATORIAL_FRAMES_V3,
  COMBINATORIAL_V3_EXPECTED_FRAME_COUNT,
  COMBINATORIAL_V3_MINIMUM_REALIZATIONS,
} from '../../content/pedagogy-v3/combinatorial-catalog.js'
import {
  auditCombinatorialCorpusV3,
  materializeCombinatorialCorpusV3,
  selectUnseenRealizationV3,
} from './combinatorial-supply.js'

const REQUIRED_FOCUSES = [
  'v3.be.location',
  'v3.have.possession',
  'v3.simple_present.frequency',
  'v3.simple_present.question',
  'v3.simple_present.negative',
  'v3.present_continuous.now',
  'v3.simple_past.affirmative',
  'v3.simple_past.question',
  'v3.future.going_to',
  'v3.future.will',
  'v3.polite_request.could_you',
  'v3.directions.how_to_get',
  'v3.quantity.how_many',
  'v3.quantity.how_much',
  'v3.comparative.common',
  'v3.because.cannot_reason',
  'v3.if.first_conditional',
  'v3.present_perfect.experience',
  'v3.present_perfect.duration',
  'v3.present_perfect.ever_question',
]

describe('V3 combinatorial supply — 2,000+ first experiment', () => {
  it('materializes at least 2,000 unique bilingual realizations', () => {
    const rows = materializeCombinatorialCorpusV3()
    expect(rows.length).toBeGreaterThanOrEqual(COMBINATORIAL_V3_MINIMUM_REALIZATIONS)
    expect(rows).toHaveLength(COMBINATORIAL_V3_EXPECTED_FRAME_COUNT * 64)
    expect(new Set(rows.map((row) => row.realization_id)).size).toBe(rows.length)
    expect(new Set(rows.map((row) => row.text_en.toLowerCase())).size).toBe(rows.length)
    for (const row of rows) {
      expect(row.text_en.trim().length).toBeGreaterThan(5)
      expect(row.text_pt.trim().length).toBeGreaterThan(5)
      expect(row.approval_status).toBe('provisional_nonhuman')
      expect(row.naturalness_status).toBe('provisional_curated_slots')
    }
  })

  it('keeps every focus deep enough to support multiple sessions without literal reuse', () => {
    const audit = auditCombinatorialCorpusV3()
    expect(audit.total_realizations).toBeGreaterThanOrEqual(2000)
    expect(audit.distinct_focuses).toBe(COMBINATORIAL_V3_EXPECTED_FRAME_COUNT)
    expect(audit.min_realizations_per_focus).toBeGreaterThanOrEqual(64)
    expect(audit.max_realizations_per_focus).toBe(64)
  })

  it('covers the required everyday grammar/function baseline instead of only the legacy lexemes', () => {
    const ids = new Set(COMBINATORIAL_FRAMES_V3.map((frame) => frame.focus_id))
    for (const focus of REQUIRED_FOCUSES) expect(ids.has(focus), focus).toBe(true)

    const categories = new Set(COMBINATORIAL_FRAMES_V3.map((frame) => frame.category))
    expect(categories.size).toBeGreaterThanOrEqual(15)

    const stages = new Set(COMBINATORIAL_FRAMES_V3.map((frame) => frame.stage))
    expect(stages.has('A1')).toBe(true)
    expect(stages.has('A2')).toBe(true)
    expect(stages.has('B1')).toBe(true)
  })

  it('never repeats inside a focus while any unseen realization remains', () => {
    const rows = materializeCombinatorialCorpusV3()
    for (const focus of COMBINATORIAL_FRAMES_V3.map((frame) => frame.focus_id)) {
      const seen = new Set()
      for (let i = 0; i < 64; i++) {
        const decision = selectUnseenRealizationV3({
          rows,
          focusId: focus,
          seenRealizationIds: seen,
          seed: 'v3-supply-regression',
        })
        expect(decision.status, `${focus} at ${i}`).toBe('realization')
        expect(seen.has(decision.realization.realization_id)).toBe(false)
        seen.add(decision.realization.realization_id)
      }

      const exhausted = selectUnseenRealizationV3({
        rows,
        focusId: focus,
        seenRealizationIds: seen,
        seed: 'v3-supply-regression',
      })
      expect(exhausted.status).toBe('focus_exhausted')
      expect(exhausted.realization).toBeNull()
    }
  })

  it('does not silently re-admit a seen sentence when a focus is exhausted', () => {
    const rows = materializeCombinatorialCorpusV3()
    const focus = 'v3.be.location'
    const focusRows = rows.filter((row) => row.focus_id === focus)
    const result = selectUnseenRealizationV3({
      rows,
      focusId: focus,
      seenRealizationIds: new Set(focusRows.map((row) => row.realization_id)),
      seed: 'never-repeat',
    })
    expect(result).toEqual({
      status: 'focus_exhausted',
      realization: null,
      remaining_unseen: 0,
      total_in_focus: 64,
    })
  })
})
