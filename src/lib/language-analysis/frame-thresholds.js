// frame-thresholds.js — per-frame semantic decision policy. There is deliberately
// NO single global threshold: USE cosine similarities sit in a narrow high band
// (unrelated pairs still score ~0.85), so one cutoff is meaningless. Each frame
// carries its own acceptance threshold, an ambiguity margin, and an ambiguity
// policy; a frame may override the intent default via `frame.semantic_policy`.
//
// The thresholds gate whether retrieval may CORROBORATE a frame — never whether a
// learner's free production fails. USE is evidence, not authority.

// Defaults keyed by frame intent. `threshold` is the minimum retrieval score for
// a frame to be considered; `minimum_margin` is how far the top frame must lead
// the next competing frame (different intent) before we assert it with certainty.
const INTENT_DEFAULTS = {
  polite_request: { threshold: 0.30, minimum_margin: 0.04, ambiguity_policy: 'conservative' },
  request: { threshold: 0.30, minimum_margin: 0.04, ambiguity_policy: 'conservative' },
  future_plan: { threshold: 0.28, minimum_margin: 0.04, ambiguity_policy: 'conservative' },
  past_experience: { threshold: 0.28, minimum_margin: 0.05, ambiguity_policy: 'conservative' },
  location: { threshold: 0.30, minimum_margin: 0.05, ambiguity_policy: 'conservative' },
  possession: { threshold: 0.30, minimum_margin: 0.05, ambiguity_policy: 'conservative' },
  opinion: { threshold: 0.26, minimum_margin: 0.04, ambiguity_policy: 'conservative' },
  obligation: { threshold: 0.30, minimum_margin: 0.05, ambiguity_policy: 'conservative' },
  question: { threshold: 0.26, minimum_margin: 0.04, ambiguity_policy: 'conservative' },
}
const FALLBACK = { threshold: 0.15, minimum_margin: 0.03, ambiguity_policy: 'conservative' }

/** Resolve the decision policy for a frame: intent default merged with any
 * explicit `frame.semantic_policy` override, plus its negative exemplars. */
export function resolveFrameThresholds(frame) {
  const base = (frame && INTENT_DEFAULTS[frame.intent]) || FALLBACK
  const override = frame?.semantic_policy || {}
  return {
    threshold: override.threshold ?? base.threshold,
    minimum_margin: override.minimum_margin ?? base.minimum_margin,
    ambiguity_policy: override.ambiguity_policy ?? base.ambiguity_policy,
    negative_exemplars: frame?.negative_exemplars || override.negative_exemplars || [],
  }
}

/**
 * Given the ranked exemplar list (desc by score) and the chosen frame, decide
 * whether the choice is confident or ambiguous. Ambiguous = the next competing
 * frame (different intent) is within `minimum_margin` of the chosen score.
 * @returns {{ accepted, ambiguous, margin, threshold }}
 */
export function assessFrameChoice({ chosenFrame, chosenScore, ranked, frameOf }) {
  const policy = resolveFrameThresholds(chosenFrame)
  const accepted = chosenScore >= policy.threshold
  let competitorScore = null
  for (const r of ranked) {
    const f = frameOf(r.candidate.frame_id)
    if (!f) continue
    if (f.frame_id === chosenFrame.frame_id) continue
    if (f.intent === chosenFrame.intent) continue // same intent is not a competitor
    competitorScore = r.score
    break
  }
  const margin = competitorScore == null ? Infinity : chosenScore - competitorScore
  const ambiguous = accepted && margin < policy.minimum_margin
  return { accepted, ambiguous, margin: margin === Infinity ? null : +margin.toFixed(4), threshold: policy.threshold }
}
