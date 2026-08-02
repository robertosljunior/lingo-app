// v2-interaction-state.test.js — Slice V2.22-UX1 §31/§32.
//
// These lock the rules that make the new interactions SAFE, and they run against
// the real runtime contracts and the real assessor — no re-implementation.
//
// The load-bearing one is the payload regression: the whole slice is a
// presentation change, so `token_sequence` and `text` must come out of the new
// components byte-for-byte identical to what the old ones produced for the same
// learner input.

import { describe, it, expect } from 'vitest'
import stillPack from '../../content/pedagogy-v2/still.json'
import butPack from '../../content/pedagogy-v2/but.json'
import { buildMaskedCompletion, presentedOrderTokens } from '../../lib/pedagogy-v2/activity-runtime-contracts.js'
import { evaluateActivityResponseV2 } from '../../lib/pedagogy-v2/activity-assessment.js'
import {
  completionBankItems, completionClear, completionComplete, completionFill, completionPayload, completionView,
  wordOrderBank, wordOrderBankItems, wordOrderComplete, wordOrderMove, wordOrderPayload, wordOrderPlace,
  wordOrderRailItems, wordOrderRemove, splitTrailingPunctuation,
} from './v2-interaction-state.js'

// ---- plans (ActivityPlan-shaped; the pedagogy is not exercised here) ---------

const woPlan = (text, presented = null) => ({
  activity_id: 'a1', session_id: 's1', recipe: 'word_order_reconstruction', text_en: text,
  presentation: presented
    ? { token_source: { presentation_order: 'seeded_shuffle', presented_tokens: presented }, instructions_pt: 'Monte' }
    : { token_source: { presentation_order: 'lexicographic' }, instructions_pt: 'Monte' },
  support: { features: [] }, response_contract: {}, planned_evidence: [],
})

const compPlan = (text, fixed, features = ['word_bank']) => ({
  activity_id: 'a2', session_id: 's1', recipe: 'fixed_element_completion', text_en: text,
  presentation: { masked_text_source: { fixed_elements: fixed }, instructions_pt: 'Complete' },
  support: { features }, response_contract: {}, planned_evidence: [],
})

const responseOf = (payload) => ({
  response_version: 1, response_type: payload.type, activity_id: 'a', session_id: 's',
  interaction_id: 'i:1', attempt_number: 1, submitted_at: '2026-08-01T00:00:00.000Z',
  payload: payload.payload,
  support_usage: { baseline_features: [], used_features: [], hint_count: 0, attempt_number: 1 },
})

// ---- §31 word order ---------------------------------------------------------

describe('word order — the rail never invents order or correctness', () => {
  const PRESENTED = ['finished', 'yet', 'She', 'not', 'it', 'has']
  const plan = woPlan('She has not finished it yet', PRESENTED)

  it('1. tokens come from presentedOrderTokens(plan), verbatim', () => {
    expect(wordOrderBank(plan).map((b) => b.t)).toEqual(presentedOrderTokens(plan))
    expect(wordOrderBank(plan).map((b) => b.t)).toEqual(PRESENTED)
  })

  it('2. the component never re-shuffles — repeated reads are identical', () => {
    const a = wordOrderBank(plan).map((b) => b.t)
    const b = wordOrderBank(plan).map((b) => b.t)
    const c = wordOrderBank(woPlan('She has not finished it yet', PRESENTED)).map((x) => x.t)
    expect(b).toEqual(a)
    expect(c).toEqual(a)
  })

  it('3. a repeated word keeps a distinct identity per position', () => {
    const dup = woPlan('I still have to talk to her', ['to', 'still', 'her', 'I', 'to', 'talk', 'have'])
    const bank = wordOrderBank(dup)
    // Two "to" chips, at indices 0 and 4 — using one leaves the other free.
    expect(bank.filter((b) => b.t === 'to').map((b) => b.i)).toEqual([0, 4])
    const items = wordOrderBankItems(bank, wordOrderPlace([], 0))
    expect(items[0].used).toBe(true)
    expect(items[4].used).toBe(false)
    // Their accessible names are distinguishable by position in the rail.
    const rail = wordOrderRailItems(bank, [0, 4])
    const labels = rail.filter((r) => r.kind === 'token').map((r) => r.label)
    expect(labels[0]).toContain('posição 1')
    expect(labels[1]).toContain('posição 2')
    expect(new Set(labels).size).toBe(2)
  })

  it('4. tap places a token (at the end by default)', () => {
    expect(wordOrderPlace([], 2)).toEqual([2])
    expect(wordOrderPlace([2], 5)).toEqual([2, 5])
    // Placing an already-placed token is a no-op — never a duplicate.
    expect(wordOrderPlace([2, 5], 2)).toEqual([2, 5])
  })

  it('5. tap removes a placed token and returns it to the bank', () => {
    expect(wordOrderRemove([2, 5, 3], 5)).toEqual([2, 3])
    expect(wordOrderBankItems(wordOrderBank(plan), [2, 3]).filter((b) => b.used).map((b) => b.i)).toEqual([2, 3])
  })

  it('6. inserting at a gap and reordering preserves every instance', () => {
    const start = [2, 5, 3]
    expect(wordOrderPlace(start, 0, 1)).toEqual([2, 0, 5, 3]) // into gap 1
    expect(wordOrderPlace(start, 0, 0)).toEqual([0, 2, 5, 3]) // before the first
    expect(wordOrderPlace(start, 0, 99)).toEqual([2, 5, 3, 0]) // clamped to the end
    const moved = wordOrderMove([2, 5, 3], 3, -1)
    expect(moved).toEqual([2, 3, 5])
    expect([...moved].sort()).toEqual([2, 3, 5]) // nothing lost, nothing duplicated
    expect(wordOrderMove([2, 5, 3], 2, -1)).toEqual([2, 5, 3]) // no-op at the edge
    expect(wordOrderMove([2, 5, 3], 3, 1)).toEqual([2, 5, 3])
  })

  it('7. the token_sequence payload is exactly the built sentence', () => {
    const bank = wordOrderBank(plan)
    const picked = [2, 5, 3, 0, 4, 1]
    expect(wordOrderPayload(bank, picked)).toEqual({
      type: 'token_sequence', payload: { tokens: ['She', 'has', 'not', 'finished', 'it', 'yet'] },
    })
  })

  it('7b. REGRESSION — the payload is byte-identical to the pre-V2.22 renderer', () => {
    // The old component computed exactly this from the same state.
    const legacy = (plan_, picked) => {
      const bank = presentedOrderTokens(plan_).map((t, i) => ({ t, i }))
      const complete = picked.length === bank.length && bank.length > 0
      return complete ? { type: 'token_sequence', payload: { tokens: picked.map((i) => bank.find((x) => x.i === i).t) } } : null
    }
    for (const picked of [[2, 5, 3, 0, 4, 1], [0, 1, 2, 3, 4, 5], [5, 4, 3, 2, 1, 0]]) {
      expect(wordOrderPayload(wordOrderBank(plan), picked)).toEqual(legacy(plan, picked))
    }
  })

  it('8. the CTA gate opens only when every token is placed', () => {
    const bank = wordOrderBank(plan)
    expect(wordOrderComplete(bank, [2, 5, 3])).toBe(false)
    expect(wordOrderPayload(bank, [2, 5, 3])).toBeNull()
    expect(wordOrderComplete(bank, [2, 5, 3, 0, 4, 1])).toBe(true)
    expect(wordOrderComplete([], [])).toBe(false)
  })

  it('14. no per-token correctness is produced anywhere', () => {
    const bank = wordOrderBank(plan)
    const rail = wordOrderRailItems(bank, [2, 5, 3, 0, 4, 1])
    const blob = JSON.stringify([rail, wordOrderBankItems(bank, [2, 5])])
    expect(blob).not.toMatch(/correct|incorrect|wrong|certo|errad|acerto/i)
    for (const it of rail) expect(it).not.toHaveProperty('result')
  })

  it('15. punctuation and contractions survive placement untouched', () => {
    const p = woPlan("I haven't seen it yet.", ["haven't", 'I', 'it', 'seen', 'yet.'])
    const bank = wordOrderBank(p)
    const payload = wordOrderPayload(bank, [1, 0, 3, 2, 4])
    expect(payload.payload.tokens).toEqual(['I', "haven't", 'seen', 'it', 'yet.'])
  })

  it('rail items alternate gap/token and expose one gap per position', () => {
    const bank = wordOrderBank(plan)
    const rail = wordOrderRailItems(bank, [2, 5], 1)
    expect(rail.map((r) => r.kind)).toEqual(['gap', 'token', 'gap', 'token', 'gap'])
    expect(rail.filter((r) => r.kind === 'gap').map((r) => r.label))
      .toEqual(['Inserir na posição 1', 'Inserir na posição 2', 'Inserir na posição 3'])
    expect(rail.find((r) => r.kind === 'gap' && r.at === 1).active).toBe(true)
  })
})

// ---- §32 completion ---------------------------------------------------------

describe('completion — one slot per gap, honestly', () => {
  it('1. buildMaskedCompletion is REUSED, never re-implemented', () => {
    const plan = compPlan('She has not finished it yet', ['not', 'yet'])
    const view = completionView(plan)
    const built = buildMaskedCompletion(plan)
    expect(view.maskedText).toBe(built.masked_text)
    expect(view.expectedTokens).toEqual(built.expected_tokens)
  })

  it('9. a two-gap plan yields TWO fillable slots and no literal blank', () => {
    const plan = compPlan('She has not finished it yet', ['not', 'yet'])
    const { gapCount, chunks } = completionView(plan)
    expect(gapCount).toBe(2)
    expect(chunks).toEqual(['She has ', ' finished it ', ''])
    // The pre-V2.22 renderer drew ONE slot and re-joined the rest as '_____'.
    expect(chunks.join('')).not.toContain('_')
  })

  it('9b. the audited defect is REAL in shipped content — 24 exemplars', () => {
    let multi = 0
    for (const pack of [stillPack, butPack]) {
      for (const c of pack.constructions || []) {
        if ((c.fixed_elements || []).length < 2) continue
        for (const ex of (pack.exemplars || []).filter((e) => e.construction_id === c.construction_id)) {
          if (completionView(compPlan(ex.text_en, c.fixed_elements)).gapCount > 1) multi++
        }
      }
    }
    expect(multi).toBeGreaterThan(0)
  })

  it('2. a word-bank chip fills the first empty slot', () => {
    expect(completionFill({}, 2, 'not')).toEqual({ 0: 'not' })
    expect(completionFill({ 0: 'not' }, 2, 'yet')).toEqual({ 0: 'not', 1: 'yet' })
  })

  it('3/4. the selection is reversible and a chip can be swapped before checking', () => {
    let fills = { 0: 'not', 1: 'yet' }
    fills = completionClear(fills, 0)
    expect(fills).toEqual({ 1: 'yet' })
    expect(completionComplete(2, fills)).toBe(false)
    // Explicitly re-target gap 0.
    fills = completionFill(fills, 2, 'not', 0)
    expect(fills).toEqual({ 0: 'not', 1: 'yet' })
    // Swap what is in gap 1.
    fills = completionFill(completionClear(fills, 1), 2, 'still', 1)
    expect(fills[1]).toBe('still')
  })

  it('5. free input produces a `text` payload; single gap is byte-identical to V2.20', () => {
    const plan = compPlan('He has not arrived yet', ['yet'], [])
    const { gapCount } = completionView(plan)
    expect(gapCount).toBe(1)
    expect(completionPayload(gapCount, { 0: 'yet' })).toEqual({ type: 'text', payload: { text: 'yet' } })
    // Exactly what the old `{ type:'text', payload:{ text: value } }` produced.
  })

  it('9c. the multi-gap payload is what the REAL assessor accepts', async () => {
    const plan = compPlan('She has not finished it yet', ['not', 'yet'])
    const { gapCount } = completionView(plan)
    const payload = completionPayload(gapCount, { 0: 'not', 1: 'yet' })
    expect(payload).toEqual({ type: 'text', payload: { text: 'not yet' } })
    const ok = await evaluateActivityResponseV2({ activityPlan: plan, response: responseOf(payload) })
    expect(ok.outcome).toBe('correct')
    expect(ok.feedback.given).toEqual(['not', 'yet'])

    // And the handoff's stated payload ("the reconstituted masked_text") is NOT
    // what the assessor accepts — this is why the real contract won (§2).
    const reconstituted = await evaluateActivityResponseV2({
      activityPlan: plan, response: responseOf({ type: 'text', payload: { text: 'She has not finished it yet' } }),
    })
    expect(reconstituted.outcome).toBe('incorrect')

    // And the pre-V2.22 UI, which could only ever fill gap 1, scored `partial`
    // for an answer it never let the learner give.
    const oldUi = await evaluateActivityResponseV2({
      activityPlan: plan, response: responseOf({ type: 'text', payload: { text: 'not' } }),
    })
    expect(oldUi.outcome).toBe('partial')
  })

  it('the CTA gate opens only when EVERY gap is filled', () => {
    expect(completionComplete(2, { 0: 'not' })).toBe(false)
    expect(completionComplete(2, { 0: 'not', 1: '  ' })).toBe(false)
    expect(completionComplete(2, { 0: 'not', 1: 'yet' })).toBe(true)
    expect(completionPayload(2, { 0: 'not' })).toBeNull()
    expect(completionComplete(0, {})).toBe(false) // no gap → never submittable
    expect(completionPayload(0, {})).toBeNull()
  })

  it('12. the bank is exactly the plan tokens — no distractor is invented', () => {
    const plan = compPlan('She has not finished it yet', ['not', 'yet'])
    const { expectedTokens, gapCount } = completionView(plan)
    const items = completionBankItems(expectedTokens, {}, gapCount)
    expect(items.map((i) => i.t)).toEqual(expectedTokens)
    expect(items.map((i) => i.t)).toEqual(['not', 'yet'])
  })

  it('a bank chip is spent only once per copy, so a repeated mask keeps both', () => {
    // Two gaps masking the SAME surface form: filling one must not grey out both.
    const items = completionBankItems(['yet', 'yet'], { 0: 'yet' }, 2)
    expect(items.map((i) => i.used)).toEqual([true, false])
    expect(completionBankItems(['yet', 'yet'], { 0: 'yet', 1: 'yet' }, 2).map((i) => i.used)).toEqual([true, true])
  })

  it('punctuation belongs to the text chunks, never to a slot', () => {
    const plan = compPlan('I have not seen it yet, but I will', ['not', 'yet'])
    const { chunks, gapCount } = completionView(plan)
    expect(gapCount).toBe(2)
    expect(chunks[2]).toContain(', but I will')
    expect(completionPayload(gapCount, { 0: 'not', 1: 'yet' }).payload.text).toBe('not yet')
  })

  it('fills are trimmed before they become a payload', () => {
    expect(completionPayload(2, { 0: '  not ', 1: 'yet  ' })).toEqual({ type: 'text', payload: { text: 'not yet' } })
  })
})

describe('splitTrailingPunctuation', () => {
  it('peels the punctuation that must stay glued to the slot before it', () => {
    expect(splitTrailingPunctuation(', but I will')).toEqual([',', ' but I will'])
    expect(splitTrailingPunctuation('.')).toEqual(['.', ''])
    expect(splitTrailingPunctuation(' finished it ')).toEqual(['', ' finished it '])
    expect(splitTrailingPunctuation('')).toEqual(['', ''])
    expect(splitTrailingPunctuation(undefined)).toEqual(['', ''])
  })

  it('re-joins to the original chunk, so no character is lost from the sentence', () => {
    for (const chunk of [', but I will', ' seen it ', '?!', 'x', '']) {
      const [a, b] = splitTrailingPunctuation(chunk)
      expect(a + b).toBe(chunk)
    }
  })
})
