// v2-interaction-state.js — Slice V2.22-UX1. PURE presentation state for the
// interactive exercises (word order rail + completion slots).
//
// WHY THIS MODULE EXISTS
// The V2.22-UX0 handoff recommends two richer interactions (a magnetic rail for
// word order, one slot per gap for completion). Both are pure state machines
// over data the ENGINE already decided. Keeping them here — outside the
// components — means the rules can be proven in node without a DOM, and it keeps
// the renderers thin (§28 of the slice brief).
//
// WHAT IT MUST NEVER DO (§4/§9/§30)
//   • never choose a pack, target, capability, modality, recipe or exemplar;
//   • never re-shuffle a token order the Engine already fixed (§43);
//   • never decide, or even guess, which token/gap is CORRECT — the Assessment
//     does not expose per-token correctness, so no function here may return it;
//   • never build Evidence, never touch the Learner Model, never call the
//     Planner/Engine/Assessment.
//
// It reuses `presentedOrderTokens` and `buildMaskedCompletion` verbatim — the
// same helpers the assessment adapter consumes, so what the learner sees and
// what is graded can never diverge.

import { buildMaskedCompletion, presentedOrderTokens } from '../../lib/pedagogy-v2/activity-runtime-contracts.js'

// ---- word order -------------------------------------------------------------

/**
 * The token bank exactly as the plan presents it. IDENTITY IS THE POSITION in
 * that order, never the text — which is what makes repeated words ("to … to")
 * independently usable (handoff §3.6).
 * @returns {{ i:number, t:string }[]}
 */
export function wordOrderBank(plan) {
  return presentedOrderTokens(plan).map((t, i) => ({ i, t }))
}

/**
 * Insert bank token `i` into the built sentence at gap `at` (0 = before the
 * first word, bank.length = after the last). `at == null` appends. Returns a NEW
 * array; a token already placed is never duplicated.
 */
export function wordOrderPlace(picked, i, at = null) {
  if (picked.includes(i)) return picked
  const next = picked.slice()
  const pos = at == null || at < 0 || at > next.length ? next.length : at
  next.splice(pos, 0, i)
  return next
}

/** Remove a placed token, returning it to the bank. Reversible, no penalty. */
export function wordOrderRemove(picked, i) {
  return picked.filter((x) => x !== i)
}

/** Move a placed token one position left (-1) or right (+1). Keyboard reorder. */
export function wordOrderMove(picked, i, dir) {
  const at = picked.indexOf(i)
  const to = at + dir
  if (at < 0 || to < 0 || to >= picked.length) return picked
  const next = picked.slice()
  next.splice(at, 1)
  next.splice(to, 0, i)
  return next
}

/** True when every bank token has been placed (the CTA gate, §7). */
export function wordOrderComplete(bank, picked) {
  return bank.length > 0 && picked.length === bank.length
}

/**
 * The submittable payload — IDENTICAL to the pre-V2.22 contract:
 * `{ type:'token_sequence', payload:{ tokens } }` with the tokens in the order
 * the learner built. `null` until the sentence is complete.
 */
export function wordOrderPayload(bank, picked) {
  if (!wordOrderComplete(bank, picked)) return null
  return { type: 'token_sequence', payload: { tokens: picked.map((i) => bank[i].t) } }
}

/**
 * The rail, flattened for rendering: gap, token, gap, token, …, gap. Gaps are
 * REAL targets ("Inserir na posição N"), never invisible hit areas (handoff §3).
 * Labels are accessibility copy only — no correctness is expressed anywhere.
 */
export function wordOrderRailItems(bank, picked, selected = null) {
  const items = []
  const gap = (at) => items.push({
    kind: 'gap', at, key: `g${at}`, active: selected === at,
    label: `Inserir na posição ${at + 1}`,
  })
  gap(0)
  picked.forEach((i, idx) => {
    items.push({
      kind: 'token', i, at: idx, key: `t${i}`, text: bank[i]?.t ?? '',
      // The position disambiguates repeated words for a screen reader (§10).
      label: `${bank[i]?.t ?? ''}, posição ${idx + 1}. Toque para remover.`,
      canMoveLeft: idx > 0, canMoveRight: idx < picked.length - 1,
    })
    gap(idx + 1)
  })
  return items
}

/** The bank, annotated with what is already in use. Never disabled silently. */
export function wordOrderBankItems(bank, picked) {
  return bank.map((b) => ({
    ...b, key: `b${b.i}`, used: picked.includes(b.i),
    label: picked.includes(b.i) ? `${b.t}, já usada` : `${b.t}, toque para colocar`,
  }))
}

// ---- completion -------------------------------------------------------------

/**
 * The masked view of a completion plan, split into renderable pieces.
 *
 * THE AUDITED DEFECT (handoff §4, brief §14): `buildMaskedCompletion` can return
 * SEVERAL `expected_tokens` — 24 authored exemplars across the shipped packs do.
 * The pre-V2.22 renderer drew exactly ONE slot and re-joined the remaining gaps
 * as a literal `_____`, so those gaps could not be filled at all and the
 * assessment scored the activity `partial` (0.5) for an answer the UI never let
 * the learner give. This returns one slot per gap so the UI represents the
 * contract honestly.
 *
 * @returns {{ maskedText, expectedTokens, chunks, gapCount }}
 */
export function completionView(plan) {
  const { masked_text, expected_tokens } = buildMaskedCompletion(plan)
  const chunks = masked_text.split(/_{3,}/)
  return {
    maskedText: masked_text,
    expectedTokens: expected_tokens,
    chunks,
    gapCount: Math.max(0, chunks.length - 1),
  }
}

/** True when every gap holds a non-empty value (the CTA gate, §11). */
export function completionComplete(gapCount, fills) {
  if (gapCount <= 0) return false
  for (let i = 0; i < gapCount; i++) if (!String(fills[i] ?? '').trim()) return false
  return true
}

/**
 * The submittable payload — `{ type:'text', payload:{ text } }`, unchanged.
 *
 * The text is the GAP FILLS in gap order, single-space separated. That is what
 * `activity-assessment.js` consumes: it splits `payload.text` on whitespace and
 * compares position-by-position against `expected_tokens`. With one gap this is
 * byte-identical to the pre-V2.22 payload.
 *
 * NOTE — the handoff (§4) describes the payload as "the reconstituted
 * masked_text". That is not what the assessor accepts: sending the full sentence
 * makes `given` the whole word list and every completion is scored `incorrect`.
 * Real contract wins over the handoff (slice brief §2 priority 1); proven in
 * v2-interaction-state.test.js.
 */
export function completionPayload(gapCount, fills) {
  if (!completionComplete(gapCount, fills)) return null
  const parts = []
  for (let i = 0; i < gapCount; i++) parts.push(String(fills[i]).trim())
  return { type: 'text', payload: { text: parts.join(' ') } }
}

/**
 * Split the punctuation that immediately FOLLOWS a gap from the rest of the
 * chunk after it: `", but I will"` → `[',', ' but I will']`.
 *
 * The slot and that punctuation must render inside one non-wrapping box,
 * otherwise a line break can leave a comma stranded at the start of the next
 * line, detached from the word it belongs to (handoff §4, callout 5).
 */
export function splitTrailingPunctuation(chunk) {
  const m = String(chunk ?? '').match(/^([^\s\w]+)([\s\S]*)$/)
  return m ? [m[1], m[2]] : ['', String(chunk ?? '')]
}

/** Clear one gap (tapping a filled slot returns its chip to the bank). */
export function completionClear(fills, gapIndex) {
  const next = { ...fills }
  delete next[gapIndex]
  return next
}

/**
 * Fill a gap. When no gap is explicitly targeted, the first EMPTY gap is used so
 * a single tap on a bank chip always does something predictable.
 */
export function completionFill(fills, gapCount, token, targetGap = null) {
  let gi = targetGap
  if (gi == null || gi < 0 || gi >= gapCount) {
    gi = -1
    for (let i = 0; i < gapCount; i++) if (!String(fills[i] ?? '').trim()) { gi = i; break }
  }
  if (gi < 0) return fills
  return { ...fills, [gi]: token }
}

/**
 * The word bank for completion. The chips are EXACTLY the plan's
 * `expected_tokens` — the UI never invents a distractor (§12). A chip counts as
 * used once as many gaps hold that text as the bank offers copies of it, so a
 * sentence masking the same word twice keeps both chips usable.
 */
export function completionBankItems(expectedTokens, fills, gapCount) {
  const usedCounts = new Map()
  for (let i = 0; i < gapCount; i++) {
    const v = String(fills[i] ?? '').trim()
    if (v) usedCounts.set(v, (usedCounts.get(v) || 0) + 1)
  }
  const seen = new Map()
  return expectedTokens.map((t, i) => {
    const nth = (seen.get(t) || 0) + 1
    seen.set(t, nth)
    const used = nth <= (usedCounts.get(t) || 0)
    return { key: `wb${i}`, t, i, used, label: used ? `${t}, já usada` : `${t}, toque para preencher` }
  })
}
