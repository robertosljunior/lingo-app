// semantic-equivalence.test.js — Slice V2.15 golden matrix (§14) + the composite
// evidence invariants (§34). Expected statuses are classified from what the
// LOCAL evidence can PROVE (no test laundering, §15): cases the infrastructure
// cannot decide are honestly `uncertain`. Two engine policies are exercised:
// `hashing` (conservative — token overlap only) and a controlled `use` encoder
// (scripted embedding similarities standing in for a real USE model, §34.14).

import { describe, it, expect } from 'vitest'
import { evaluateSemanticEquivalenceV2, inferPolarityV2, ALIGN_HIGH } from './semantic-equivalence.js'

// One matrix row: response text, measured hashing cosine, a controlled USE
// cosine, and the expected status under each engine.
const STILL = { target: 'The coffee is still hot.', essential: ['coffee'], polarity: 'affirmative', rows: [
  { r: 'The coffee is still hot.', hash: 1.0, use: 1.0, hExp: 'aligned', uExp: 'aligned' },
  { r: 'The coffee remains hot.', hash: 0.504, use: 0.90, hExp: 'uncertain', uExp: 'aligned' },
  { r: 'The coffee is warm.', hash: 0.630, use: 0.55, hExp: 'uncertain', uExp: 'uncertain' },
  { r: 'The coffee is cold.', hash: 0.630, use: 0.30, hExp: 'uncertain', uExp: 'uncertain' }, // antonym unprovable locally
  { r: 'The coffee is not hot anymore.', hash: 0.603, use: 0.60, hExp: 'not_aligned', uExp: 'not_aligned' }, // polarity
  { r: 'I like coffee.', hash: 0.149, use: 0.30, hExp: 'uncertain', uExp: 'uncertain' },
  { r: 'The tea is still hot.', hash: 0.667, use: 0.70, hExp: 'not_aligned', uExp: 'not_aligned' }, // missing coffee
] }

const BUT = { target: 'The plan is simple but effective.', essential: ['plan'], polarity: 'affirmative', rows: [
  { r: 'The plan is simple but effective.', hash: 1.0, use: 1.0, hExp: 'aligned', uExp: 'aligned' },
  { r: 'The plan is simple and effective.', hash: 0.727, use: 0.88, hExp: 'uncertain', uExp: 'aligned' },
  { r: 'The plan works well despite being simple.', hash: 0.467, use: 0.75, hExp: 'uncertain', uExp: 'aligned' },
  { r: 'The plan is terrible.', hash: 0.603, use: 0.40, hExp: 'uncertain', uExp: 'uncertain' }, // sentiment unprovable
  { r: 'The plan was cancelled.', hash: 0.502, use: 0.35, hExp: 'uncertain', uExp: 'uncertain' },
  { r: 'I have a plan.', hash: 0.228, use: 0.40, hExp: 'uncertain', uExp: 'uncertain' },
  { r: 'The idea is simple but effective.', hash: 0.727, use: 0.85, hExp: 'not_aligned', uExp: 'not_aligned' }, // missing plan (synonym FN)
  { r: 'The plan is very good.', hash: 0.502, use: 0.45, hExp: 'uncertain', uExp: 'uncertain' }, // §23 — NOT aligned
] }

const YET = { target: 'She has yet to reply to the invitation.', essential: ['invitation'], polarity: 'negative', rows: [
  { r: 'She has yet to reply to the invitation.', hash: 1.0, use: 1.0, hExp: 'aligned', uExp: 'aligned' },
  { r: "She still hasn't replied to the invitation.", hash: 0.538, use: 0.88, hExp: 'uncertain', uExp: 'aligned' }, // negated==negative, no contradiction
  { r: "She hasn't answered the invitation yet.", hash: 0.404, use: 0.82, hExp: 'uncertain', uExp: 'aligned' },
  { r: 'She replied yesterday.', hash: 0.217, use: 0.30, hExp: 'not_aligned', uExp: 'not_aligned' }, // missing invitation
  { r: "The invitation hasn't arrived.", hash: 0.275, use: 0.40, hExp: 'uncertain', uExp: 'uncertain' },
  { r: 'She likes the invitation.', hash: 0.367, use: 0.30, hExp: 'not_aligned', uExp: 'not_aligned' }, // affirmative vs negative → contradiction
] }

function classify(target, essential, polarity, responseText, similarity, engine) {
  return evaluateSemanticEquivalenceV2({
    targetText: target, responseText, essentialWords: essential, similarity, engine, targetPolarity: polarity,
  }).status
}

for (const set of [STILL, BUT, YET]) {
  describe(`§14 golden matrix — ${set.target}`, () => {
    for (const row of set.rows) {
      it(`hashing: "${row.r}" → ${row.hExp}`, () => {
        expect(classify(set.target, set.essential, set.polarity, row.r, row.hash, 'hashing')).toBe(row.hExp)
      })
      it(`use: "${row.r}" → ${row.uExp}`, () => {
        expect(classify(set.target, set.essential, set.polarity, row.r, row.use, 'use')).toBe(row.uExp)
      })
    }
  })
}

// ---- §34 invariants --------------------------------------------------------

describe('§34/§36 — composite evidence invariants', () => {
  const base = { targetText: 'The plan is simple but effective.', essentialWords: ['plan'], targetPolarity: 'affirmative' }

  it('§36.1 — essential presence alone is NOT alignment', () => {
    expect(evaluateSemanticEquivalenceV2({ ...base, responseText: 'The plan is very good.', similarity: 0.5, engine: 'use' }).status).not.toBe('aligned')
  })
  it('§36.2 — low similarity alone does NOT reject (essential present)', () => {
    const r = evaluateSemanticEquivalenceV2({ ...base, responseText: 'I have a plan.', similarity: 0.1, engine: 'use' })
    expect(r.status).toBe('uncertain')
    expect(r.status).not.toBe('not_aligned')
  })
  it('§36.3/§6 — polarity contradiction never passes', () => {
    const r = evaluateSemanticEquivalenceV2({ targetText: 'The coffee is still hot.', responseText: 'The coffee is not hot anymore.', essentialWords: ['coffee'], targetPolarity: 'affirmative', similarity: 0.6, engine: 'use' })
    expect(r.status).toBe('not_aligned')
    expect(r.reason_codes).toContain('POLARITY_CONTRADICTION')
  })
  it('§36.4 — a legitimate paraphrase can pass under USE', () => {
    expect(evaluateSemanticEquivalenceV2({ targetText: 'The coffee is still hot.', responseText: 'The coffee remains hot.', essentialWords: ['coffee'], targetPolarity: 'affirmative', similarity: 0.9, engine: 'use' }).status).toBe('aligned')
  })
  it('§11/§36.8 — hashing is conservative: the same paraphrase is uncertain', () => {
    expect(evaluateSemanticEquivalenceV2({ targetText: 'The coffee is still hot.', responseText: 'The coffee remains hot.', essentialWords: ['coffee'], targetPolarity: 'affirmative', similarity: 0.504, engine: 'hashing' }).status).toBe('uncertain')
  })
  it('§34.10/11 — missing essential concept / different entity → not_aligned', () => {
    expect(evaluateSemanticEquivalenceV2({ ...base, responseText: 'The idea is great.', similarity: 0.9, engine: 'use' }).status).toBe('not_aligned')
  })
  it('§34.12 — no similarity signal + essential present → uncertain', () => {
    expect(evaluateSemanticEquivalenceV2({ ...base, responseText: 'The plan is grand.', similarity: null, engine: 'hashing' }).status).toBe('uncertain')
  })
  it('§4 — uncertain carries a low confidence and no fabricated cause', () => {
    const r = evaluateSemanticEquivalenceV2({ ...base, responseText: 'The plan is grand.', similarity: 0.5, engine: 'hashing' })
    expect(r.status).toBe('uncertain')
    expect(r.confidence).toBeLessThan(0.5)
  })
  it('inferPolarityV2 detects negation markers and "anymore"', () => {
    expect(inferPolarityV2('The coffee is hot.')).toBe('affirmative')
    expect(inferPolarityV2('The coffee is not hot anymore.')).toBe('negative')
    expect(inferPolarityV2("She hasn't replied.")).toBe('negative')
  })
  it('engine-aware thresholds are distinct', () => {
    expect(ALIGN_HIGH.hashing).toBeGreaterThan(ALIGN_HIGH.use)
  })
  it('deterministic — same input, identical result', () => {
    const args = { ...base, responseText: 'The plan is very good.', similarity: 0.5, engine: 'use' }
    expect(JSON.stringify(evaluateSemanticEquivalenceV2(args))).toBe(JSON.stringify(evaluateSemanticEquivalenceV2(args)))
  })
})
