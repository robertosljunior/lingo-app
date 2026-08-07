import { describe, expect, it } from 'vitest'
import {
  wordOrderBank,
  wordOrderComplete,
  wordOrderDistractors,
  wordOrderPayload,
  wordOrderPlace,
  wordOrderRemove,
  wordOrderTargetCount,
} from './v2-interaction-state.js'

function plan(text, presented, extra = {}) {
  return {
    activity_id: extra.activity_id || 'activity:scramble:1',
    session_id: 'session:1',
    pack_id: extra.pack_id || 'still',
    level: extra.level || 'B1',
    recipe: 'word_order_reconstruction',
    text_en: text,
    presentation: {
      instructions_pt: 'Monte a frase',
      token_source: {
        presentation_order: 'seeded_shuffle',
        presented_tokens: presented,
        ...extra.token_source,
      },
    },
    support: { features: [] },
    response_contract: {},
    planned_evidence: [],
  }
}

function normalized(token) {
  return String(token).toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '')
}

function targetIndicesInCanonicalOrder(bank, canonical) {
  const used = new Set()
  return canonical.map((token) => {
    const index = bank.findIndex((item) => !item.distractor && !used.has(item.i) && item.t === token)
    expect(index).toBeGreaterThanOrEqual(0)
    used.add(bank[index].i)
    return bank[index].i
  })
}

describe('word-order semantic distractors', () => {
  it('adds 1, 2 and at most 3 distractors according to sentence length', () => {
    const short = plan('She works here', ['works', 'here', 'She'])
    const medium = plan('She has not finished the report yet', ['report', 'has', 'yet', 'She', 'finished', 'not', 'the'])
    const long = plan(
      'She has not finished the report yet but she will send it today',
      ['report', 'will', 'She', 'today', 'not', 'send', 'has', 'but', 'it', 'finished', 'yet', 'she', 'the'],
    )

    expect(wordOrderDistractors(short)).toHaveLength(1)
    expect(wordOrderDistractors(medium)).toHaveLength(2)
    expect(wordOrderDistractors(long)).toHaveLength(3)
  })

  it('never exceeds the roughly 30% extra-token guardrail', () => {
    for (const [text, presented] of [
      ['I work here', ['work', 'I', 'here']],
      ['She works at home now', ['home', 'works', 'now', 'She', 'at']],
      ['She has not finished the report yet', ['report', 'has', 'yet', 'She', 'finished', 'not', 'the']],
      ['I will finish the report at the office tomorrow morning', ['office', 'the', 'I', 'report', 'tomorrow', 'finish', 'at', 'morning', 'will', 'the']],
    ]) {
      const extras = wordOrderDistractors(plan(text, presented)).length
      expect(extras).toBeLessThanOrEqual(Math.ceil(presented.length * 0.3))
      expect(extras).toBeLessThanOrEqual(3)
    }
  })

  it('is deterministic for the same authored activity and seed data', () => {
    const p = plan('She has not finished the report yet', ['report', 'has', 'yet', 'She', 'finished', 'not', 'the'])
    const first = wordOrderBank(p)
    expect(wordOrderBank(p)).toEqual(first)
    expect(wordOrderBank({ ...p })).toEqual(first)
  })

  it('keeps target relative order and only interleaves extra choices', () => {
    const presented = ['report', 'has', 'yet', 'She', 'finished', 'not', 'the']
    const bank = wordOrderBank(plan('She has not finished the report yet', presented))
    expect(bank.filter((item) => !item.distractor).map((item) => item.t)).toEqual(presented)
    expect(bank.filter((item) => item.distractor)).toHaveLength(2)
  })

  it('never adds a distractor already present in the target, ignoring punctuation', () => {
    const p = plan("She hasn't finished the report yet.", ['report', 'yet.', 'finished', "hasn't", 'She', 'the'])
    const target = new Set(p.presentation.token_source.presented_tokens.map(normalized))
    const distractors = wordOrderDistractors(p)
    expect(distractors.length).toBeGreaterThan(0)
    for (const token of distractors) expect(target.has(normalized(token))).toBe(false)
  })

  it('prefers plausible grammatical/lexical contrasts instead of random noise', () => {
    const p = plan('She has not finished the report yet', ['report', 'has', 'yet', 'She', 'finished', 'not', 'the'])
    const allowed = new Set([
      'and', 'but', 'still', 'because', 'so',
      'i', 'you', 'he', 'it', 'we', 'they',
      'a', 'an', 'is', 'are', 'was', 'were', 'have', 'do', 'does', 'did', 'will', 'can',
      'email', 'project', 'in', 'on', 'at', 'to', 'from', 'for', 'with', 'of',
    ])
    for (const token of wordOrderDistractors(p)) expect(allowed.has(token)).toBe(true)
  })

  it('keeps the correct target fully buildable without selecting any distractor', () => {
    const canonical = ['She', 'has', 'not', 'finished', 'the', 'report', 'yet']
    const p = plan(canonical.join(' '), ['report', 'has', 'yet', 'She', 'finished', 'not', 'the'])
    const bank = wordOrderBank(p)
    const picked = targetIndicesInCanonicalOrder(bank, canonical)

    expect(wordOrderTargetCount(bank)).toBe(canonical.length)
    expect(wordOrderComplete(bank, picked)).toBe(true)
    expect(wordOrderPayload(bank, picked)).toEqual({
      type: 'token_sequence',
      payload: { tokens: canonical },
    })
  })

  it('allows a distractor choice to be submitted as a sentence-length wrong attempt', () => {
    const canonical = ['She', 'has', 'not', 'finished', 'the', 'report', 'yet']
    const p = plan(canonical.join(' '), ['report', 'has', 'yet', 'She', 'finished', 'not', 'the'])
    const bank = wordOrderBank(p)
    const correct = targetIndicesInCanonicalOrder(bank, canonical)
    const fake = bank.find((item) => item.distractor)
    expect(fake).toBeTruthy()

    const picked = [...correct.slice(0, -1), fake.i]
    expect(wordOrderComplete(bank, picked)).toBe(true)
    const payload = wordOrderPayload(bank, picked)
    expect(payload.payload.tokens).toHaveLength(canonical.length)
    expect(payload.payload.tokens).not.toEqual(canonical)
  })

  it('a selected distractor is reversible through the same place/remove state machine', () => {
    const p = plan('She has not finished the report yet', ['report', 'has', 'yet', 'She', 'finished', 'not', 'the'])
    const bank = wordOrderBank(p)
    const fake = bank.find((item) => item.distractor)
    expect(fake).toBeTruthy()

    const placed = wordOrderPlace([], fake.i)
    expect(placed).toEqual([fake.i])
    expect(wordOrderRemove(placed, fake.i)).toEqual([])
  })

  it('can be explicitly disabled by the plan without changing the target contract', () => {
    const presented = ['report', 'has', 'yet', 'She', 'finished', 'not', 'the']
    const p = plan('She has not finished the report yet', presented, { token_source: { semantic_distractors: false } })
    expect(wordOrderDistractors(p)).toEqual([])
    expect(wordOrderBank(p).map((item) => item.t)).toEqual(presented)
  })
})
