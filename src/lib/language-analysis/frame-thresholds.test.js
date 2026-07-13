import { describe, it, expect } from 'vitest'
import { resolveFrameThresholds, assessFrameChoice } from './frame-thresholds.js'

describe('frame-thresholds', () => {
  it('uses per-intent defaults, not a single global cutoff', () => {
    const req = resolveFrameThresholds({ intent: 'polite_request' })
    const opin = resolveFrameThresholds({ intent: 'opinion' })
    expect(req.threshold).not.toBe(opin.threshold) // thresholds differ by frame
    expect(req.threshold).toBeGreaterThan(0)
  })

  it('lets a frame override its intent default', () => {
    const p = resolveFrameThresholds({ intent: 'opinion', semantic_policy: { threshold: 0.5, minimum_margin: 0.1 } })
    expect(p.threshold).toBe(0.5)
    expect(p.minimum_margin).toBe(0.1)
  })

  it('falls back for an unknown intent', () => {
    const p = resolveFrameThresholds({ intent: 'nonexistent' })
    expect(p.threshold).toBe(0.15)
  })

  it('accepts a confident, well-separated choice', () => {
    const chosen = { frame_id: 'f_req', intent: 'polite_request' }
    const ranked = [
      { candidate: { frame_id: 'f_req' }, score: 0.9 },
      { candidate: { frame_id: 'f_poss' }, score: 0.6 },
    ]
    const frameOf = (id) => ({ f_req: chosen, f_poss: { frame_id: 'f_poss', intent: 'possession' } }[id] || null)
    const r = assessFrameChoice({ chosenFrame: chosen, chosenScore: 0.9, ranked, frameOf })
    expect(r.accepted).toBe(true)
    expect(r.ambiguous).toBe(false)
  })

  it('flags ambiguity when a different-intent frame is within the margin', () => {
    const chosen = { frame_id: 'f_req', intent: 'polite_request' }
    const ranked = [
      { candidate: { frame_id: 'f_req' }, score: 0.90 },
      { candidate: { frame_id: 'f_poss' }, score: 0.89 }, // within margin (0.04)
    ]
    const frameOf = (id) => ({ f_req: chosen, f_poss: { frame_id: 'f_poss', intent: 'possession' } }[id] || null)
    const r = assessFrameChoice({ chosenFrame: chosen, chosenScore: 0.90, ranked, frameOf })
    expect(r.accepted).toBe(true)
    expect(r.ambiguous).toBe(true)
  })

  it('does not treat a same-intent frame as a competitor', () => {
    const chosen = { frame_id: 'f_req1', intent: 'polite_request' }
    const ranked = [
      { candidate: { frame_id: 'f_req1' }, score: 0.90 },
      { candidate: { frame_id: 'f_req2' }, score: 0.895 },
    ]
    const frameOf = (id) => ({ f_req1: chosen, f_req2: { frame_id: 'f_req2', intent: 'polite_request' } }[id] || null)
    const r = assessFrameChoice({ chosenFrame: chosen, chosenScore: 0.90, ranked, frameOf })
    expect(r.ambiguous).toBe(false) // same intent → not competing
  })
})
