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

// Case-fold, strip decorative punctuation, collapse whitespace, unify quotes.
export function normalize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[‘’′']/g, "'")
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

export function wordDiff(user, expected) {
  const U = tokenize(user)
  const E = tokenize(expected)
  const setU = new Set(U)
  const setE = new Set(E)
  return {
    missing_words: E.filter((w) => !setU.has(w)),
    extra_words: U.filter((w) => !setE.has(w)),
    userTokens: U,
    expectedTokens: E,
  }
}

// Pick the closest of expected + accepted answers.
export function bestTarget(user, expected, accepted = []) {
  const candidates = [expected, ...accepted].filter((c) => c != null && c !== '')
  if (candidates.length === 0) return { target: expected, score: 0 }
  let best = candidates[0]
  let bestScore = -1
  for (const c of candidates) {
    const s = similarity(user, c)
    if (s > bestScore) { bestScore = s; best = c }
  }
  return { target: best, score: bestScore }
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

// Full synchronous analysis (fallback path). Mirrors the worker's return shape.
export function analyzeAnswer({ user_answer, expected_answer, accepted_answers = [], mistake_focus = null }) {
  const { target, score } = bestTarget(user_answer, expected_answer, accepted_answers)
  const diff = wordDiff(user_answer, target)
  const normUser = normalize(user_answer)
  const normTarget = normalize(target)
  const exact = [expected_answer, ...accepted_answers].map(normalize).includes(normUser)

  const is_probably_correct = exact || score >= 0.92
  const is_partial = !is_probably_correct && score >= 0.7

  let possible_mistake_type = null
  if (!is_probably_correct) {
    possible_mistake_type = classifyMistake(
      { user: user_answer, expected: target, missing_words: diff.missing_words, extra_words: diff.extra_words },
      mistake_focus,
    )
  }

  return {
    normalized_user_answer: normUser,
    normalized_expected_answer: normTarget,
    similarity_score: exact ? 1 : score,
    missing_words: diff.missing_words,
    extra_words: diff.extra_words,
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
}
