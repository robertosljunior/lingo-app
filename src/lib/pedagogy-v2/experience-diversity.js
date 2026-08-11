// experience-diversity.js — Slice V2.19: CONTROLLED practice variety.
//
// Pedagogy decides the focus; this module only decides which VALID realization
// of that focus to present, so successive sessions stop feeling like the same
// exercise. Everything here is pure and deterministic: the only entropy is the
// caller-supplied seed, so the same (state, evidence, seed) always yields the
// same ordering. No Math.random, no Date.now.
//
// It provides three primitives shared by the lesson engine and the audit:
//   buildRecentExemplarUsageV2 — cross-session exemplar recency from evidence
//   seededShuffle              — deterministic option-order shuffle
//   seededTokenShuffle         — deterministic word-order shuffle (non-canonical)

// FNV-1a — same hash the engine uses for tie-breaks, kept identical so seeded
// behavior is one family across the module.
export function fnv1a(str) {
  let h = 2166136261
  const s = String(str)
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

// mulberry32 — tiny deterministic PRNG seeded from a string. Used ONLY to
// reorder already-valid, already-authored alternatives (never to choose WHAT
// to train). Seed identical → sequence identical.
export function seededRng(seedStr) {
  let a = fnv1a(seedStr) || 1
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Deterministic Fisher–Yates over a COPY. Preserves element identity.
export function seededShuffle(items, seedStr) {
  const out = items.slice()
  const rng = seededRng(seedStr)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = out[i]; out[i] = out[j]; out[j] = tmp
  }
  return out
}

// ---- cross-session exemplar recency -----------------------------------------
//
// V2 evidence already carries exemplar_id and interaction_id, and a single
// INTERACTION emits several evidence events (one per assessed target). Recency
// must be counted per interaction, never per event — otherwise a 4-target
// exemplar would look 4× more "recent" than a 1-target one.
//
// P0 anti-loop hardening: learner-facing evidence also carries `session_id`.
// Interaction-only distance is not enough for a 12-activity session: the opener
// is already 11 interactions old when the next session begins and therefore
// used to become "fresh" again under a small interaction window. We keep the
// interaction metric, but also protect every exemplar used in the most recent
// persisted lesson session. If all equivalent exemplars were used there, the
// session opener is deliberately treated as MOST recent so least-recent fallback
// does not start the next session with the same sentence again.
//
// recentEvidence is expected in chronological order (as storage returns it:
// sorted by occurred_at, then evidence_id). Returns:
//   Map<exemplar_id, { last_seen_index, interactions_since_seen,
//                      recent_interaction_count, in_latest_session,
//                      is_latest_session_opener }>
// plus map metadata:
//   total_interactions, latest_session_id,
//   latest_session_opener_exemplar_id, latest_session_exemplar_ids.
// where indices count DISTINCT interactions (0 = oldest interaction seen).
export function buildRecentExemplarUsageV2(recentEvidence, { window = Infinity } = {}) {
  const usage = new Map()
  const seenInteractions = new Set()
  const interactionExemplar = [] // ordered list of exemplar_id per distinct interaction
  const sessionOrder = []
  const sessionInteractions = new Map()

  for (const ev of recentEvidence || []) {
    const iid = ev?.interaction_id
    const xid = ev?.exemplar_id
    if (!iid || !xid) continue
    if (seenInteractions.has(iid)) continue // same interaction: already counted
    seenInteractions.add(iid)
    interactionExemplar.push(xid)

    const sid = typeof ev?.session_id === 'string' && ev.session_id ? ev.session_id : null
    if (sid) {
      if (!sessionInteractions.has(sid)) {
        sessionInteractions.set(sid, [])
        sessionOrder.push(sid)
      }
      sessionInteractions.get(sid).push({ interaction_id: iid, exemplar_id: xid })
    }
  }

  const total = interactionExemplar.length
  interactionExemplar.forEach((xid, idx) => {
    const prev = usage.get(xid)
    const entry = prev || { last_seen_index: -1, interactions_since_seen: Infinity, recent_interaction_count: 0 }
    entry.last_seen_index = idx
    entry.recent_interaction_count += 1
    usage.set(xid, entry)
  })
  // interactions_since_seen: how many DISTINCT interactions happened after the
  // last time this exemplar appeared. 0 = it was the most recent interaction.
  for (const entry of usage.values()) {
    entry.interactions_since_seen = total - 1 - entry.last_seen_index
  }

  const latestSessionId = sessionOrder.length ? sessionOrder[sessionOrder.length - 1] : null
  const latestSessionRows = latestSessionId ? (sessionInteractions.get(latestSessionId) || []) : []
  const latestSessionExemplars = new Set(latestSessionRows.map((row) => row.exemplar_id))
  const latestSessionOpener = latestSessionRows[0]?.exemplar_id ?? null

  // Session-aware membership is additive to the existing interaction window.
  // Evidence produced before session_id was introduced remains byte-compatible:
  // latestSessionId is null and only the original interaction rule applies.
  usage.forEach((entry, xid) => {
    entry.in_latest_session = latestSessionExemplars.has(xid)
    entry.is_latest_session_opener = latestSessionOpener === xid
    entry.within_window = entry.interactions_since_seen < window || entry.in_latest_session
    usage.set(xid, entry)
  })
  usage.total_interactions = total
  usage.latest_session_id = latestSessionId
  usage.latest_session_opener_exemplar_id = latestSessionOpener
  usage.latest_session_exemplar_ids = [...latestSessionExemplars]
  return usage
}

// Recency tier for a single exemplar id given usage + window. Lower is fresher
// to present: 0 = never seen (or beyond window), otherwise the number of
// interactions since it was last seen is used so LEAST-RECENT wins the fallback.
//
// Session-aware correction: an exemplar from the latest persisted lesson
// session remains recent even when it is outside the interaction window. The
// opener gets a synthetic rank of -1 only for fallback ordering: that makes it
// the LAST recently-seen exemplar to be replayed, preventing deterministic
// same-opener loops without making any valid activity ineligible.
export function exemplarRecencyRank(usage, exemplarId, window) {
  const entry = usage?.get?.(exemplarId)
  if (!entry) return { within_window: false, interactions_since_seen: Infinity }
  const sessionProtected = entry.in_latest_session === true
  const openerProtected = entry.is_latest_session_opener === true
  return {
    within_window: sessionProtected || entry.interactions_since_seen < window,
    interactions_since_seen: openerProtected ? -1 : entry.interactions_since_seen,
    session_protected: sessionProtected,
    session_opener_protected: openerProtected,
  }
}

// ---- word-order token shuffle -----------------------------------------------
//
// Presents the token bank in a deterministic seeded order INSTEAD of always
// lexicographic, so the same sentence stops producing the same bank. Never
// touches canonicalOrderTokens (the correct answer). Guards against a shuffle
// that accidentally reproduces the correct sentence: when it does and more than
// one distinct permutation exists, it advances to the next seeded permutation.
export function seededTokenShuffle(tokens, seedStr) {
  const canonical = tokens.join('\u0001')
  const distinct = new Set(tokens)
  // A single distinct token, or fewer than 2 tokens: only one meaningful
  // presentation exists — return canonical, documented safe behavior.
  if (tokens.length < 2 || distinct.size < 2) return tokens.slice()

  let attempt = 0
  // Try successive deterministic permutations until one differs from canonical.
  // Bounded: with ≥2 distinct tokens a non-canonical arrangement always exists,
  // and each attempt uses a distinct seed so the walk is deterministic.
  while (attempt < tokens.length + 8) {
    const shuffled = seededShuffle(tokens, `${seedStr}#${attempt}`)
    if (shuffled.join('\u0001') !== canonical) return shuffled
    attempt += 1
  }
  // Extremely short/ambiguous fallback: reverse (guaranteed non-canonical for
  // ≥2 distinct tokens, and deterministic).
  return tokens.slice().reverse()
}
