// correction-engine.js — normalization, similarity and mistake classification.
//
// This module is pure (no Compromise) so it can run on the main thread as a
// synchronous fallback when the Web Worker is unavailable. The worker
// (nlp-worker.js) imports these helpers and layers Compromise-based structural
// analysis on top to refine the mistake_type.

export const MISTAKE_TYPES = [
  'word_order',
  'missing_auxiliary',
  'wrong_auxiliary',
  'preposition',
  'article',
  'verb_tense',
  'unnatural_translation',
  'vocabulary',
  'collocation',
  'question_structure',
  'spelling',
]

const AUXILIARIES = new Set([
  'do', 'does', 'did',
  'is', 'are', 'am', 'was', 'were',
  'have', 'has', 'had',
  'will', 'would', 'can', 'could', 'should', 'shall', 'may', 'might', 'must',
])

const PREPOSITIONS = new Set([
  'in', 'on', 'at', 'for', 'to', 'with', 'from', 'by', 'about', 'of',
  'into', 'over', 'under', 'since', 'during', 'between', 'through', 'as',
])

const ARTICLES = new Set(['a', 'an', 'the'])

// Words whose one-letter neighbors are usually *grammar* choices, not typos
// (in/on, a/an, is/was…). A pair touching this set is never treated as a typo.
const FUNCTION_WORDS = new Set([...AUXILIARIES, ...PREPOSITIONS, ...ARTICLES])

// Contractions expand to their full forms so "don't" and "do not" grade the
// same. Only unambiguous suffixes are expanded — 's (is/has/possessive) and
// 'd (would/had) are left alone on purpose.
const IRREGULAR_CONTRACTIONS = [
  [/\bwon't\b/g, 'will not'],
  [/\bcan't\b/g, 'can not'],
  [/\bcannot\b/g, 'can not'],
  [/\bshan't\b/g, 'shall not'],
]

function expandContractions(s) {
  let out = s
  for (const [re, to] of IRREGULAR_CONTRACTIONS) out = out.replace(re, to)
  return out
    .replace(/([a-z])n't\b/g, '$1 not')
    .replace(/([a-z])'m\b/g, '$1 am')
    .replace(/([a-z])'re\b/g, '$1 are')
    .replace(/([a-z])'ve\b/g, '$1 have')
    .replace(/([a-z])'ll\b/g, '$1 will')
}

// Case-fold, expand contractions, strip decorative punctuation, collapse
// whitespace, unify quotes.
export function normalize(s) {
  return expandContractions(
    (s || '')
      .toLowerCase()
      .replace(/[‘’′']/g, "'"),
  )
    .replace(/[.,!?;:"“”()\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenize(s) {
  const n = normalize(s)
  return n ? n.split(' ') : []
}

// Jaccard-ish token overlap combined with an order-aware LCS ratio, so both
// "wrong words" and "right words / wrong order" are penalized sensibly.
export function similarity(a, b) {
  const A = tokenize(a)
  const B = tokenize(b)
  if (A.length === 0 && B.length === 0) return 1
  if (A.length === 0 || B.length === 0) return 0

  const setB = new Set(B)
  const overlap = A.filter((w) => setB.has(w)).length / Math.max(A.length, B.length)
  const order = lcs(A, B) / Math.max(A.length, B.length)
  return +(0.5 * overlap + 0.5 * order).toFixed(3)
}

function lcs(A, B) {
  const m = A.length, n = B.length
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = A[i - 1] === B[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp[m][n]
}

// Damerau-Levenshtein distance capped at 1: one substitution, insertion,
// deletion or adjacent transposition. Anything further apart returns 2.
export function editDistance1(a, b) {
  if (a === b) return 0
  const la = a.length, lb = b.length
  if (Math.abs(la - lb) > 1) return 2
  if (la === lb) {
    // One substitution, or one adjacent transposition.
    let i = 0
    while (i < la && a[i] === b[i]) i++
    if (a.slice(i + 1) === b.slice(i + 1)) return 1
    if (i + 1 < la && a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2)) return 1
    return 2
  }
  // One insertion/deletion: align the shorter inside the longer.
  const [s, l] = la < lb ? [a, b] : [b, a]
  let i = 0
  while (i < s.length && s[i] === l[i]) i++
  return s.slice(i) === l.slice(i + 1) ? 1 : 2
}

// A near-miss counts as a typo only when it can't plausibly be a grammar
// choice: both words reasonably long and neither is a function word.
export function isTypoPair(expected, got) {
  if (expected.length < 4 || got.length < 4) return false
  if (FUNCTION_WORDS.has(expected) || FUNCTION_WORDS.has(got)) return false
  // A trailing s/d is inflection (plural, 3rd person, past), not spelling.
  if (expected === got + 's' || got === expected + 's') return false
  if (expected === got + 'd' || got === expected + 'd') return false
  return editDistance1(expected, got) === 1
}

// Greedily pair leftover expected words with leftover user words that are one
// edit apart — those are typos, not vocabulary errors.
function pairTypos(missing, extra) {
  const typos = []
  const remainingExtra = [...extra]
  const remainingMissing = []
  for (const m of missing) {
    const i = remainingExtra.findIndex((x) => isTypoPair(m, x))
    if (i >= 0) {
      typos.push({ expected: m, got: remainingExtra[i] })
      remainingExtra.splice(i, 1)
    } else {
      remainingMissing.push(m)
    }
  }
  return { typos, missing: remainingMissing, extra: remainingExtra }
}

export function wordDiff(user, expected) {
  const U = tokenize(user)
  const E = tokenize(expected)
  const setU = new Set(U)
  const setE = new Set(E)
  const paired = pairTypos(
    E.filter((w) => !setU.has(w)),
    U.filter((w) => !setE.has(w)),
  )
  return {
    missing_words: paired.missing,
    extra_words: paired.extra,
    typos: paired.typos,
    userTokens: U,
    expectedTokens: E,
  }
}

// Heuristic classification. `focusHint` is the lesson's declared mistake_focus
// and acts as a strong prior when the structural signal is ambiguous.
export function classifyMistake({ user, expected, missing_words, extra_words }, focusHint) {
  const U = tokenize(user)
  const E = tokenize(expected)
  const setU = new Set(U)
  const setE = new Set(E)

  // Same multiset of words but different sequence → pure word order.
  const sameBag = U.length === E.length && [...setE].every((w) => setU.has(w)) && [...setU].every((w) => setE.has(w))
  if (sameBag && U.join(' ') !== E.join(' ')) return 'word_order'

  const missingSet = new Set(missing_words)
  const extraSet = new Set(extra_words)

  const missingAux = [...missingSet].some((w) => AUXILIARIES.has(w))
  const extraAux = [...extraSet].some((w) => AUXILIARIES.has(w))
  const expectedIsQuestion = AUXILIARIES.has(E[0]) || /\?$/.test((expected || '').trim())

  if (missingAux && expectedIsQuestion) return 'question_structure'
  if (missingAux) return 'missing_auxiliary'
  if (extraAux && !missingAux) return 'wrong_auxiliary'

  const prepDiff = [...missingSet, ...extraSet].some((w) => PREPOSITIONS.has(w))
  if (prepDiff) return 'preposition'

  const artDiff = [...missingSet, ...extraSet].some((w) => ARTICLES.has(w))
  if (artDiff) return 'article'

  // Fall back to the lesson author's declared focus, then to a generic bucket.
  if (focusHint && MISTAKE_TYPES.includes(focusHint)) return focusHint
  if (missing_words.length || extra_words.length) return 'vocabulary'
  return 'unnatural_translation'
}

// Score a user answer against one candidate, forgiving typos: the effective
// score is the similarity as if the paired typos were spelled right.
function evaluateAgainst(user, candidate) {
  const diff = wordDiff(user, candidate)
  const score = similarity(user, candidate)
  let effectiveScore = score
  if (diff.typos.length) {
    const fixes = new Map(diff.typos.map((t) => [t.got, t.expected]))
    const correctedUser = diff.userTokens.map((w) => fixes.get(w) || w).join(' ')
    effectiveScore = Math.max(score, similarity(correctedUser, candidate))
  }
  return { diff, score, effectiveScore }
}

// Full synchronous analysis (fallback path). Mirrors the worker's return shape.
export function analyzeAnswer({ user_answer, expected_answer, accepted_answers = [], mistake_focus = null }) {
  // Pick the closest of expected + accepted answers, judging each candidate
  // with typo forgiveness so a misspelled match still wins.
  const candidates = [expected_answer, ...accepted_answers].filter((c) => c != null && c !== '')
  let target = expected_answer
  let best = evaluateAgainst(user_answer, expected_answer)
  for (const c of candidates) {
    const e = evaluateAgainst(user_answer, c)
    if (e.effectiveScore > best.effectiveScore) { best = e; target = c }
  }
  const { diff, effectiveScore } = best

  const normUser = normalize(user_answer)
  const normTarget = normalize(target)
  const exact = [expected_answer, ...accepted_answers].map(normalize).includes(normUser)

  const is_probably_correct = exact || effectiveScore >= 0.92
  const is_partial = !is_probably_correct && effectiveScore >= 0.7

  let possible_mistake_type = null
  if (!is_probably_correct) {
    if (diff.typos.length && diff.missing_words.length === 0 && diff.extra_words.length === 0) {
      // Every leftover difference is a typo pair. If fixing them still doesn't
      // reproduce the target sequence, the real problem is word order.
      const fixes = new Map(diff.typos.map((t) => [t.got, t.expected]))
      const corrected = diff.userTokens.map((w) => fixes.get(w) || w).join(' ')
      possible_mistake_type = corrected === diff.expectedTokens.join(' ') ? 'spelling' : 'word_order'
    } else {
      possible_mistake_type = classifyMistake(
        { user: user_answer, expected: target, missing_words: diff.missing_words, extra_words: diff.extra_words },
        mistake_focus,
      )
    }
  }

  return {
    normalized_user_answer: normUser,
    normalized_expected_answer: normTarget,
    similarity_score: exact ? 1 : effectiveScore,
    missing_words: diff.missing_words,
    extra_words: diff.extra_words,
    typos: diff.typos,
    user_tokens: diff.userTokens,
    target_tokens: diff.expectedTokens,
    possible_mistake_type,
    is_probably_correct,
    verdict: is_probably_correct ? 'correct' : is_partial ? 'partial' : 'incorrect',
    target,
    feedback: buildFeedback(is_probably_correct, is_partial, possible_mistake_type),
  }
}

export function buildFeedback(correct, partial, mistake) {
  if (correct) return 'Natural! Boa estrutura.'
  if (partial) return FEEDBACK_BY_TYPE[mistake]?.partial || 'Quase lá — dá pra deixar mais natural.'
  return FEEDBACK_BY_TYPE[mistake]?.wrong || 'Compare com a resposta esperada e tente de novo.'
}

// Short explanations per mistake type (chrome in PT, examples stay in EN).
export const FEEDBACK_BY_TYPE = {
  question_structure: {
    wrong: 'Em perguntas no presente, precisa do Do/Does antes do sujeito.',
    partial: 'Quase — reforce a estrutura de pergunta com o auxiliar certo.',
  },
  missing_auxiliary: {
    wrong: 'Faltou o auxiliar (do/does/is/are). Sem ele, soa como afirmação.',
    partial: 'Quase — o auxiliar ainda precisa aparecer.',
  },
  wrong_auxiliary: {
    wrong: 'O auxiliar usado não combina com o tempo/sujeito.',
    partial: 'Quase — reveja qual auxiliar combina aqui.',
  },
  preposition: {
    wrong: 'Preposição trocada. Ex.: use "at" com empresas, não "in".',
    partial: 'Quase — só a preposição destoa do natural.',
  },
  article: {
    wrong: 'Artigo (a/an/the) fora do lugar.',
    partial: 'Quase — ajuste o artigo.',
  },
  verb_tense: {
    wrong: 'Tempo verbal incorreto para o contexto.',
    partial: 'Quase — reveja o tempo verbal.',
  },
  unnatural_translation: {
    wrong: 'Soa como tradução literal. Pense em como um nativo diria.',
    partial: 'Quase lá — mais natural com um pequeno ajuste.',
  },
  vocabulary: {
    wrong: 'Vocabulário diferente do esperado.',
    partial: 'Quase — palavra próxima, mas não a mais idiomática.',
  },
  collocation: {
    wrong: 'A combinação de palavras não é a mais comum (collocation).',
    partial: 'Quase — a collocation natural é um pouco diferente.',
  },
  word_order: {
    wrong: 'Palavras certas, ordem trocada. Reveja a sequência natural.',
    partial: 'Quase — só a ordem precisa de ajuste.',
  },
  spelling: {
    wrong: 'A frase está certa, mas a grafia de uma palavra escorregou.',
    partial: 'Quase — só a grafia precisa de ajuste.',
  },
}
