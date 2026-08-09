import { describe, expect, it } from 'vitest'
import {
  buildConfusabilityReport,
  jaccardPt,
  normalizePt,
} from './audit-authored-confusability-v2.mjs'

const pack = {
  manifest: { pack_id: 'pedagogy_v2_fixture' },
  exemplars: [
    {
      exemplar_id: 'exemplar:fixture.001',
      text_en: 'I still live here.',
      text_pt: 'Eu ainda moro aqui.',
      construction_id: 'construction:fixture.still',
      sense_ids: ['sense:fixture.continuity'],
    },
    {
      exemplar_id: 'exemplar:fixture.002',
      text_en: 'I continue to live here.',
      text_pt: 'Eu continuo morando aqui.',
      construction_id: 'construction:fixture.still',
      sense_ids: ['sense:fixture.continuity'],
    },
    {
      exemplar_id: 'exemplar:fixture.003',
      text_en: 'The train leaves at six.',
      text_pt: 'O trem sai às seis.',
      construction_id: 'construction:fixture.other',
      sense_ids: ['sense:fixture.other'],
    },
  ],
}

const semanticScore = async (a, b) => {
  if (a.includes('live here') && b.includes('live here')) return 0.9
  return 0.1
}

describe('V2.23 authored confusability audit', () => {
  it('normalizes only structural pt-BR differences deterministically', () => {
    expect(normalizePt('  Eu AINDA moro aqui! ')).toBe('eu ainda moro aqui')
    expect(jaccardPt('Eu ainda moro aqui.', 'Eu ainda moro aqui!')).toBe(1)
  })

  it('emits stable pair identities/order for the same corpus and scorer', async () => {
    const a = await buildConfusabilityReport([pack], { semanticScore })
    const b = await buildConfusabilityReport([pack], { semanticScore })
    expect(b).toEqual(a)
    expect(a.candidates.map((x) => x.pair_id)).toEqual([...a.candidates.map((x) => x.pair_id)].sort())
  })

  it('surfaces a same-sense paraphrase as a human-review candidate', async () => {
    const report = await buildConfusabilityReport([pack], { semanticScore })
    expect(report.candidates.some((row) =>
      row.pair_id === 'exemplar:fixture.001::exemplar:fixture.002'
      && row.reasons.includes('same_sense_semantic_near'))).toBe(true)
    expect(report.candidates.every((row) => row.disposition === 'needs_human_review')).toBe(true)
  })
})
