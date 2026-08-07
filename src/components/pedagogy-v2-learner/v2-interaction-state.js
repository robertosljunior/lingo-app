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

const DISTRACTOR_FAMILIES = [
  ['and', 'but', 'yet', 'still', 'because', 'so'],
  ['at', 'in', 'on', 'to', 'from', 'for', 'with', 'of'],
  ['i', 'you', 'he', 'she', 'it', 'we', 'they'],
  ['a', 'an', 'the'],
  ['is', 'are', 'was', 'were', 'has', 'have', 'do', 'does', 'did', 'will', 'can'],
]

const LEVEL_FALLBACKS = {
  A1: ['but', 'and', 'in', 'on', 'at', 'to', 'he', 'she', 'they', 'the', 'a', 'is', 'are', 'have', 'has'],
  A2: ['yet', 'still', 'but', 'because', 'in', 'on', 'at', 'for', 'from', 'with', 'he', 'she', 'they', 'have', 'has', 'do', 'does'],
  B1: ['yet', 'still', 'but', 'because', 'so', 'in', 'on', 'at', 'for', 'from', 'with', 'they', 'we', 'have', 'has', 'did', 'will'],
  B2: ['yet', 'still', 'but', 'because', 'so', 'in', 'on', 'at', 'for', 'from', 'with', 'of', 'they', 'we', 'did', 'will', 'can'],
}

const NOUN_NEIGHBORS = {
  report: ['email', 'project'],
  email: ['report', 'message'],
  office: ['home', 'school'],
  home: ['office', 'work'],
  work: ['office', 'job'],
  meeting: ['call', 'email'],
  train: ['bus', 'flight'],
  bus: ['train', 'car'],
  food: ['drinks', 'meal'],
  drinks: ['food', 'water'],
  restaurant: ['office', 'store'],
  store: ['office', 'home'],
  experience: ['work', 'time'],
  project: ['report', 'meeting'],
  phone: ['computer', 'email'],
  computer: ['phone', 'tablet'],
}

function normalizeBankToken(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '')
}

function hashString(value) {
  let hash = 2166136261
  for (const ch of String(value)) {
    hash ^= ch.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function distractorLimit(targetCount) {
  const desired = targetCount <= 5 ? 1 : targetCount <= 9 ? 2 : 3
  return Math.min(desired, Math.max(1, Math.ceil(targetCount * 0.3)))
}

function planLevel(plan) {
  const level = String(plan?.level || plan?.cefr_level || plan?.difficulty || 'B1').toUpperCase()
  return LEVEL_FALLBACKS[level] ? level : 'B1'
}

function shouldAddWordOrderDistractors(plan) {
  const source = plan?.presentation?.token_source
  if (source?.semantic_distractors === false) return false
  if (source?.semantic_distractors === true) return true
  // Real learner plans always carry pack_id. Keeping fixture-only plans without
  // a pack id unchanged preserves the low-level runtime contract tests while
  // enabling the richer bank on the shipped learner path.
  return !!plan?.pack_id
}

/**
 * Select a tiny deterministic set of plausible alternatives. Candidates are
 * biased toward the grammatical families already present in the target, then
 * toward nearby nouns, then toward level-appropriate fallbacks. Target tokens
 * (punctuation-insensitive) are always excluded.
 */
export function wordOrderDistractors(plan, targetTokens = presentedOrderTokens(plan)) {
  if (!shouldAddWordOrderDistractors(plan) || !targetTokens.length) return []

  const normalizedTargets = targetTokens.map(normalizeBankToken).filter(Boolean)
  const forbidden = new Set(normalizedTargets)
  const candidates = []
  const add = (token) => {
    const normalized = normalizeBankToken(token)
    if (!normalized || forbidden.has(normalized) || candidates.includes(normalized)) return
    candidates.push(normalized)
  }

  for (const family of DISTRACTOR_FAMILIES) {
    if (family.some((token) => forbidden.has(token))) {
      for (const token of family) add(token)
    }
  }
  for (const token of normalizedTargets) {
    for (const neighbor of NOUN_NEIGHBORS[token] || []) add(neighbor)
  }
  for (const token of LEVEL_FALLBACKS[planLevel(plan)]) add(token)

  const seed = `${plan?.activity_id || ''}|${plan?.pack_id || ''}|${plan?.text_en || targetTokens.join(' ')}`
  const ordered = candidates
    .map((token) => ({ token, score: hashString(`${seed}|candidate|${token}`) }))
    .sort((a, b) => a.score - b.score || a.token.localeCompare(b.token))
    .map(({ token }) => token)

  return ordered.slice(0, distractorLimit(targetTokens.length))
}

/**
 * The token bank as the plan presents it, with a bounded number of semantic
 * distractors interleaved on the real learner path. Target relative order is
 * preserved exactly; distractors are inserted deterministically and never alter
 * `text_en` or the canonical answer.
 *
 * IDENTITY IS THE FINAL BANK POSITION, never the text, which keeps repeated
 * words independently usable.
 * @returns {{ i:number, t:string, distractor?:boolean }[]}
 */
export function wordOrderBank(plan) {
  const targetTokens = presentedOrderTokens(plan)
  const distractors = wordOrderDistractors(plan, targetTokens)
  if (!distractors.length) return targetTokens.map((t, i) => ({ i, t }))

  const entries = targetTokens.map((t, order) => ({ t, targetOrder: order, distractor: false }))
  const seed = `${plan?.activity_id || ''}|${plan?.pack_id || ''}|${plan?.text_en || ''}`
  for (const token of distractors) {
    const slot = hashString(`${seed}|slot|${token}`) % (entries.length + 1)
    entries.splice(slot, 0, { t: token, targetOrder: null, distractor: true })
  }
  return entries.map((entry, i) => ({ i, t: entry.t, distractor: entry.distractor }))
}

/** Number of words that belong to the authored target (not distractors). */
export function wordOrderTargetCount(bank) {
  return bank.filter((item) => !item.distractor).length
}

/**
 * Insert bank token `i` into the built sentence at gap `at` (0 = before the
 * first word, picked.length = after the last). `at == null` appends. Returns a
 * NEW array; a token already placed is never duplicated.
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

/**
 * True when the learner has built one sentence-length sequence. Distractors are
 * choices, not extra required words: selecting one necessarily leaves a target
 * token unused and therefore yields an assessable but incorrect sequence.
 */
export function wordOrderComplete(bank, picked) {
  const targetCount = wordOrderTargetCount(bank)
  return targetCount > 0 && picked.length === targetCount
}

/**
 * The submittable payload remains `{ type:'token_sequence', payload:{ tokens } }`.
 * It becomes available after exactly one target-sentence length has been built,
 * regardless of whether the learner chose a distractor. Assessment still owns
 * correctness and compares the whole sequence to the authored target.
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
 * `expected_tokens` — this PR intentionally changes only word-order scramble.
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
