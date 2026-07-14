import { describe, it, expect } from 'vitest'
import { isCompatible, structuralSignature, FRAMES, framesFor } from '../../scripts/content-packs/semantic-frames.mjs'

// T20.15/T20.16 — the build-time semantic gate must FAIL on artificial
// regressions and PASS on authored, compatible content.
describe('verb–argument compatibility', () => {
  it('rejects the known regression "update the train station"', () => {
    expect(isCompatible('update', 'train_station').ok).toBe(false)
  })
  it('rejects other forbidden/incompatible combos', () => {
    expect(isCompatible('review', 'dish').ok).toBe(false)      // review + food_item
    expect(isCompatible('call', 'meeting_room').ok).toBe(false) // call needs a person
    expect(isCompatible('leave', 'report').ok).toBe(false)      // leave needs a vehicle
  })
  it('accepts natural, compatible combos', () => {
    expect(isCompatible('buy', 'ticket').ok).toBe(true)
    expect(isCompatible('send', 'report').ok).toBe(true)
    expect(isCompatible('book', 'table').ok).toBe(true)
    expect(isCompatible('be', 'restaurant').ok).toBe(true)
  })
})

describe('structural signature collapses noun-swaps', () => {
  it('same structure + verb → same signature regardless of noun', () => {
    expect(structuralSignature('We check the hotel every day.'))
      .toBe(structuralSignature('We check the station every day.'))
  })
  it('different structures → different signatures', () => {
    expect(structuralSignature('Where is the train station?'))
      .not.toBe(structuralSignature('I want to buy a ticket.'))
  })
})

describe('authored frame sets meet the T20 diversity minimums', () => {
  for (const [theme, levels] of Object.entries(FRAMES)) {
    for (const [level, frames] of Object.entries(levels)) {
      it(`${theme} ${level}: ≥8 pairs, ≥6 structures, ≥5 verbs, ≥4 intents, no noun-swap, all compatible`, () => {
        expect(frames.length).toBeGreaterThanOrEqual(8)
        const sigs = new Set(frames.map((f) => structuralSignature(f.en)))
        const verbs = new Set(frames.map((f) => f.verb).filter((v) => v !== 'be'))
        const intents = new Set(frames.map((f) => f.intent))
        expect(sigs.size, 'structures').toBeGreaterThanOrEqual(6)
        expect(verbs.size, 'lexical verbs').toBeGreaterThanOrEqual(5)
        expect(intents.size, 'intents').toBeGreaterThanOrEqual(4)
        // every pair is a compatible verb+noun combination
        for (const f of frames) expect(isCompatible(f.verb, f.noun).ok, `${f.frame_id}`).toBe(true)
        // no two pairs share signature AND verb (noun-swap defect)
        const seen = new Set()
        for (const f of frames) {
          const k = structuralSignature(f.en) + '|' + f.verb
          expect(seen.has(k), `noun-swap ${f.frame_id}`).toBe(false)
          seen.add(k)
        }
      })
    }
  }
})
