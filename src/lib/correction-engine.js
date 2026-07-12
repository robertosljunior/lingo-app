// correction-engine.js — normalization, positional alignment and deterministic
// answer evaluation. The canonical v2 contract is `detected_errors[]`; legacy
// fields such as `possible_mistake_type`, `missing_words` and `extra_words` are
// still derived for older screens/data.

import { inferAssessedSkills } from './skill-profile.js'

export const ENGINE_VERSION = '2'

export const MISTAKE_TYPES = [
  'word_order',
  'missing_auxiliary',
  'wrong_auxiliary',
  'preposition',
  'article',
  'verb_tense',
  'verb_form',
  'naturalness',
  'unnatural_translation',
  'vocabulary',
  'collocation',
  'question_structure',
  'spelling',
  'punctuation',
  'capitalization',
  'incorrect_choice',
]

const AUXILIARIES = new Set([
  'do', 'does', 'did',
  'be', 'been', 'being', 'is', 'are', 'am', 'was', 'were',
  'have', 'has', 'had',
  'will', 'would', 'can', 'could', 'should', 'shall', 'may', 'might', 'must',
])

const HAVE_AUX = new Set(['have', 'has'])
const PREPOSITIONS = new Set([
  'in', 'on', 'at', 'for', 'to', 'with', 'from', 'by', 'about', 'of',
  'into', 'over', 'under', 'since', 'during', 'between', 'through', 'as',
])

const ARTICLES = new Set(['a', 'an', 'the'])
const FUNCTION_WORDS = new Set([...AUXILIARIES, ...PREPOSITIONS, ...ARTICLES])

const SEVERITY_RANK = { critical: 5, high: 4, medium: 3, low: 2, accepted: 1 }
const CATEGORY_RANK = {
  verb_form: 90,
  auxiliary: 85,
  question_structure: 80,
  verb_tense: 75,
  word_order: 65,
  preposition: 45,
  naturalness: 35,
  spelling: 25,
  punctuation: 15,
  capitalization: 15,
  vocabulary: 10,
  incorrect_choice: 5,
}

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

export function tokenObjects(s) {
  return tokenize(s).map((normalized, index) => ({ normalized, source: normalized, index }))
}

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

export function editDistance1(a, b) {
  if (a === b) return 0
  const la = a.length, lb = b.length
  if (Math.abs(la - lb) > 1) return 2
  if (la === lb) {
    let i = 0
    while (i < la && a[i] === b[i]) i++
    if (a.slice(i + 1) === b.slice(i + 1)) return 1
    if (i + 1 < la && a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2)) return 1
    return 2
  }
  const [s, l] = la < lb ? [a, b] : [b, a]
  let i = 0
  while (i < s.length && s[i] === l[i]) i++
  return s.slice(i) === l.slice(i + 1) ? 1 : 2
}

export function isTypoPair(expected, got) {
  if (expected.length < 4 || got.length < 4) return false
  if (FUNCTION_WORDS.has(expected) || FUNCTION_WORDS.has(got)) return false
  if (expected === got + 's' || got === expected + 's') return false
  if (expected === got + 'd' || got === expected + 'd') return false
  return editDistance1(expected, got) === 1
}

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

export function alignTokens(user, expected) {
  const U = Array.isArray(user) ? user : tokenize(user)
  const E = Array.isArray(expected) ? expected : tokenize(expected)
  const m = E.length, n = U.length
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  const back = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(null))

  for (let i = 1; i <= m; i++) { dp[i][0] = i; back[i][0] = 'delete' }
  for (let j = 1; j <= n; j++) { dp[0][j] = j; back[0][j] = 'insert' }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const same = E[i - 1] === U[j - 1]
      const subCost = same ? 0 : 1
      const choices = [
        { op: same ? 'equal' : 'replace', cost: dp[i - 1][j - 1] + subCost },
        { op: 'delete', cost: dp[i - 1][j] + 1 },
        { op: 'insert', cost: dp[i][j - 1] + 1 },
      ]
      choices.sort((a, b) => a.cost - b.cost || opPriority(a.op) - opPriority(b.op))
      dp[i][j] = choices[0].cost
      back[i][j] = choices[0].op
    }
  }

  const out = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    const op = back[i][j]
    if (op === 'equal' || op === 'replace') {
      out.push({
        operation: op,
        expected: E[i - 1],
        actual: U[j - 1],
        expected_token_index: i - 1,
        actual_token_index: j - 1,
      })
      i--; j--
    } else if (op === 'delete') {
      out.push({
        operation: 'delete',
        expected: E[i - 1],
        actual: null,
        expected_token_index: i - 1,
        actual_token_index: null,
      })
      i--
    } else {
      out.push({
        operation: 'insert',
        expected: null,
        actual: U[j - 1],
        expected_token_index: null,
        actual_token_index: j - 1,
      })
      j--
    }
  }
  return out.reverse()
}

function opPriority(op) {
  return op === 'equal' ? 0 : op === 'replace' ? 1 : op === 'delete' ? 2 : 3
}

export function wordDiff(user, expected) {
  const alignment = alignTokens(user, expected)
  const missing = alignment.filter((a) => a.operation === 'delete' || a.operation === 'replace').map((a) => a.expected).filter(Boolean)
  const extra = alignment.filter((a) => a.operation === 'insert' || a.operation === 'replace').map((a) => a.actual).filter(Boolean)
  const paired = pairTypos(missing, extra)
  return {
    missing_words: paired.missing,
    extra_words: paired.extra,
    typos: paired.typos,
    userTokens: tokenize(user),
    expectedTokens: tokenize(expected),
    alignment,
  }
}

// Legacy helper retained for existing tests/callers. It no longer uses the
// lesson focus as a fallback; every returned category comes from evidence.
export function classifyMistake({ user, expected, missing_words, extra_words }) {
  const analysis = analyzeAnswer({ user_answer: user, expected_answer: expected })
  if (analysis.possible_mistake_type) return legacyTypeFor(analysis.possible_mistake_type, analysis.primary_error)
  if (missing_words?.length || extra_words?.length) return 'vocabulary'
  return 'unnatural_translation'
}

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

export function analyzeAnswer({ user_answer, expected_answer, accepted_answers = [], mistake_focus = null, skill_target = null, exercise_type = null }) {
  const candidates = [expected_answer, ...accepted_answers].filter((c) => c != null && c !== '')
  let target = expected_answer
  let best = evaluateAgainst(user_answer, expected_answer)
  for (const c of candidates) {
    const e = evaluateAgainst(user_answer, c)
    if (e.effectiveScore > best.effectiveScore) { best = e; target = c }
  }

  const userTokens = tokenize(user_answer)
  const targetTokens = tokenize(target)
  const alignment = alignTokens(userTokens, targetTokens)
  const normUser = normalize(user_answer)
  const normTarget = normalize(target)
  const exact = [expected_answer, ...accepted_answers].map(normalize).includes(normUser)
  const accepted_differences = exact && normUser !== normalize(expected_answer)
    ? [{ category: 'accepted_variant', subtype: 'accepted_answer', actual: user_answer, expected: target }]
    : []

  let detected_errors = exact ? [] : detectErrors({
    user_answer,
    expected_answer: target,
    userTokens,
    expectedTokens: targetTokens,
    alignment,
    skill_target: skill_target ?? mistake_focus ?? null,
    exercise_type,
  })

  const effectiveScore = exact ? 1 : best.effectiveScore
  const onlyCosmetic = detected_errors.length > 0 && detected_errors.every((e) => ['spelling', 'punctuation', 'capitalization'].includes(e.category))
  const is_probably_correct = exact || (effectiveScore >= 0.92 && (detected_errors.length === 0 || onlyCosmetic))
  if (is_probably_correct) detected_errors = []

  const is_partial = !is_probably_correct && effectiveScore >= 0.7
  const verdict = is_probably_correct ? 'correct' : is_partial ? 'partial' : 'incorrect'
  detected_errors = assignRoles(sortErrors(detected_errors))
  const primary_error = detected_errors.find((e) => e.role === 'primary') || null
  const possible_mistake_type = primary_error ? legacyTypeFor(primary_error.category, primary_error) : null
  const feedback = buildEvaluationFeedback(verdict, primary_error)
  const diff = wordDiff(user_answer, target)

  const baseEvaluation = {
    engine_version: ENGINE_VERSION,
    verdict,
    score: exact ? 1 : effectiveScore,
    similarity_score: exact ? 1 : effectiveScore,
    target_answer: target,
    target,
    normalized_user_answer: normUser,
    normalized_expected_answer: normTarget,
    user_tokens: userTokens,
    target_tokens: targetTokens,
    token_details: {
      user: tokenObjects(user_answer),
      expected: tokenObjects(target),
    },
    alignment,
    detected_errors,
    primary_error,
    accepted_differences,
    possible_mistake_type,
    missing_words: diff.missing_words,
    extra_words: diff.extra_words,
    typos: diff.typos,
    is_probably_correct,
    feedback,
    skill_target: skill_target ?? mistake_focus ?? null,
  }
  return { ...baseEvaluation, assessed_skills: inferAssessedSkills({ evaluation: baseEvaluation, question: { skill_target, mistake_focus, type: exercise_type }, user_answer, expected_answer: target }) }
}

function detectErrors(ctx) {
  const errors = []
  errors.push(...detectApostropheMissing(ctx))
  errors.push(...detectHaveBeenRequiresIng(ctx))
  errors.push(...detectMissingAuxiliary(ctx))
  errors.push(...detectQuestionAuxiliary(ctx))
  errors.push(...detectWorkplacePreposition(ctx))
  errors.push(...detectPrepositionReplacement(ctx, errors))
  errors.push(...detectWordOrder(ctx))
  errors.push(...detectSpelling(ctx))
  errors.push(...detectGenericVocabulary(ctx, errors))
  return dedupeErrors(errors)
}

function detectHaveBeenRequiresIng({ userTokens, expectedTokens, alignment }) {
  const out = []
  for (const step of alignment) {
    if (step.operation !== 'replace') continue
    const i = step.expected_token_index
    const j = step.actual_token_index
    const expected = step.expected
    const actual = step.actual
    if (!isProgressiveVerbCandidate(expected, expectedTokens, i)) continue
    if (isIng(actual)) continue
    const expectedHasHaveBeen = i >= 2 && HAVE_AUX.has(expectedTokens[i - 2]) && expectedTokens[i - 1] === 'been'
    const actualHasHaveBeen = j >= 2 && HAVE_AUX.has(userTokens[j - 2]) && userTokens[j - 1] === 'been'
    if (!expectedHasHaveBeen || !actualHasHaveBeen) continue
    out.push(makeError({
      category: 'verb_form',
      subtype: 'gerund_after_been',
      actual,
      expected,
      severity: 'high',
      confidence: 0.98,
      rule_id: 'verb.have_been_requires_ing',
      actual_token_start: j,
      actual_token_end: j,
      expected_token_start: i,
      expected_token_end: i,
      feedback: 'Depois de "have been", use o verbo com -ing.',
      evidence: {
        auxiliary_have_present: actualHasHaveBeen,
        been_present: actualHasHaveBeen,
        expected_token: expected,
        actual_token: actual,
        expected_is_ing: true,
        actual_is_ing: false,
        expected_form: 'VBG',
        actual_form: likelyPastForm(actual) ? 'VBN_OR_VBD' : 'NON_ING_VERB_FORM',
      },
    }))
  }
  return out
}

function isProgressiveVerbCandidate(token, tokens, index) {
  if (!isIng(token)) return false
  if (!(index >= 2 && HAVE_AUX.has(tokens[index - 2]) && tokens[index - 1] === 'been')) return false
  // Conservative morphology fallback: expected must look verbal, not merely an
  // adjective/location after been. The have+been+V-ing pattern is the evidence;
  // common non-progressive adjectives like "tiring" can be added here if needed.
  return token.length > 4
}

function isIng(token) {
  return typeof token === 'string' && /ing$/.test(token) && token.length > 4
}

function likelyPastForm(token) {
  return /ed$/.test(token) || ['worked', 'done', 'gone', 'seen', 'written', 'spoken'].includes(token)
}

function detectMissingAuxiliary({ userTokens, expectedTokens, alignment }) {
  const errors = []
  for (const step of alignment) {
    if (step.operation !== 'delete') continue
    if (!AUXILIARIES.has(step.expected)) continue
    // Do not call the example missing_auxiliary when have/has and been are
    // present in the user's answer; that is evidence for a following form error.
    if ((step.expected === 'have' || step.expected === 'has') && userTokens.includes(step.expected)) continue
    if ((step.expected === 'have' || step.expected === 'has') && userTokens.includes('ive')) continue
    if (step.expected === 'been' && userTokens.includes('been')) continue
    errors.push(makeError({
      category: 'auxiliary',
      subtype: 'missing_auxiliary',
      actual: '',
      expected: step.expected,
      severity: 'high',
      confidence: 0.9,
      rule_id: 'auxiliary.missing',
      actual_token_start: step.actual_token_index,
      actual_token_end: step.actual_token_index,
      expected_token_start: step.expected_token_index,
      expected_token_end: step.expected_token_index,
      feedback: `Faltou o auxiliar "${step.expected}".`,
      evidence: {
        expected_auxiliary_present: true,
        actual_auxiliary_present: false,
        expected_auxiliary: step.expected,
        actual_tokens_include_have: userTokens.includes('have') || userTokens.includes('has'),
        actual_tokens_include_been: userTokens.includes('been'),
        expected_tokens_include_auxiliary: expectedTokens.some((t) => AUXILIARIES.has(t)),
      },
    }))
  }
  return errors
}

function detectQuestionAuxiliary({ userTokens, expectedTokens, alignment }) {
  const firstExpected = expectedTokens[0]
  const firstActual = userTokens[0]
  if (!AUXILIARIES.has(firstExpected)) return []
  if (firstExpected === firstActual) return []
  if (alignment.some((a) => a.operation === 'delete' && a.expected_token_index === 0 && a.expected === firstExpected)) return []
  if (AUXILIARIES.has(firstActual) && firstActual !== firstExpected) {
    return [makeError({
      category: 'auxiliary',
      subtype: 'wrong_auxiliary',
      actual: firstActual,
      expected: firstExpected,
      severity: 'high',
      confidence: 0.86,
      rule_id: 'auxiliary.wrong_question_auxiliary',
      actual_token_start: 0,
      actual_token_end: 0,
      expected_token_start: 0,
      expected_token_end: 0,
      feedback: `O auxiliar correto aqui é "${firstExpected}".`,
      evidence: { expected_auxiliary: firstExpected, actual_auxiliary: firstActual, question_initial_auxiliary: true },
    })]
  }
  return []
}

function detectWorkplacePreposition({ expectedTokens, alignment }) {
  const out = []
  for (const step of alignment) {
    if (step.operation !== 'replace') continue
    if (step.expected !== 'at' || step.actual !== 'in') continue
    const i = step.expected_token_index
    const nearCompany = expectedTokens.slice(Math.max(0, i + 1), i + 4).includes('company')
    const nearWork = expectedTokens.slice(Math.max(0, i - 4), i).some((t) => /^work/.test(t))
    if (!nearCompany || !nearWork) continue
    out.push(makeError({
      category: 'preposition',
      subtype: 'workplace_preposition',
      actual: 'in',
      expected: 'at',
      severity: 'low',
      confidence: 0.72,
      rule_id: 'preposition.work_at_company',
      actual_token_start: step.actual_token_index,
      actual_token_end: step.actual_token_index,
      expected_token_start: step.expected_token_index,
      expected_token_end: step.expected_token_index,
      feedback: 'Em contexto profissional, "at this company" costuma soar mais natural.',
      evidence: { expected_preposition: 'at', actual_preposition: 'in', workplace_context: true, grammaticality: 'naturalness_preference' },
    }))
  }
  return out
}


function detectPrepositionReplacement({ alignment }, existing) {
  const covered = new Set(existing.map((e) => `${e.expected_token_start}:${e.actual_token_start}`))
  return alignment
    .filter((a) => a.operation === 'replace' && PREPOSITIONS.has(a.expected) && PREPOSITIONS.has(a.actual))
    .filter((a) => !covered.has(`${a.expected_token_index}:${a.actual_token_index}`))
    .map((a) => makeError({
      category: 'preposition',
      subtype: 'preposition_choice',
      actual: a.actual,
      expected: a.expected,
      severity: 'medium',
      confidence: 0.7,
      rule_id: 'preposition.token_replacement',
      actual_token_start: a.actual_token_index,
      actual_token_end: a.actual_token_index,
      expected_token_start: a.expected_token_index,
      expected_token_end: a.expected_token_index,
      feedback: `A preposição esperada aqui é "${a.expected}".`,
      evidence: { expected_preposition: a.expected, actual_preposition: a.actual },
    }))
}

function detectApostropheMissing({ userTokens, expectedTokens, alignment }) {
  // Common mobile typo: "Ive" for "I've". Keep low severity and do not allow it
  // to masquerade as missing have.
  const out = []
  for (let k = 0; k < alignment.length - 1; k++) {
    const a = alignment[k]
    const b = alignment[k + 1]
    const replaceThenDelete = a.operation === 'replace' && a.expected === 'i' && a.actual === 'ive' && b.operation === 'delete' && b.expected === 'have'
    const deleteThenReplace = a.operation === 'delete' && a.expected === 'i' && b.operation === 'replace' && b.expected === 'have' && b.actual === 'ive'
    if (replaceThenDelete || deleteThenReplace) {
      out.push(makeError({
        category: 'punctuation',
        subtype: 'apostrophe_missing',
        actual: 'ive',
        expected: "i've",
        severity: 'low',
        confidence: 0.88,
        rule_id: 'punctuation.apostrophe_missing_contraction',
        actual_token_start: (replaceThenDelete ? a : b).actual_token_index,
        actual_token_end: (replaceThenDelete ? a : b).actual_token_index,
        expected_token_start: Math.min(a.expected_token_index ?? 999, b.expected_token_index ?? 999),
        expected_token_end: Math.max(a.expected_token_index ?? 0, b.expected_token_index ?? 0),
        feedback: 'Atenção ao apóstrofo em "I’ve".',
        evidence: { contraction: "I've", actual_token: 'ive', expected_tokens: ['i', 'have'] },
      }))
    }
  }
  return out
}

function detectWordOrder({ userTokens, expectedTokens, alignment }) {
  if (userTokens.length !== expectedTokens.length) return []
  let comparableUser = [...userTokens]
  const d = pairTypos(
    expectedTokens.filter((w) => !userTokens.includes(w)),
    userTokens.filter((w) => !expectedTokens.includes(w)),
  )
  if (d.typos.length) {
    const fixes = new Map(d.typos.map((t) => [t.got, t.expected]))
    comparableUser = comparableUser.map((w) => fixes.get(w) || w)
  }
  const sortedU = [...comparableUser].sort().join('\u0000')
  const sortedE = [...expectedTokens].sort().join('\u0000')
  if (sortedU !== sortedE || comparableUser.join(' ') === expectedTokens.join(' ')) return []
  const first = alignment.find((a) => a.operation !== 'equal')
  return [makeError({
    category: 'word_order',
    subtype: 'word_order',
    actual: userTokens.join(' '),
    expected: expectedTokens.join(' '),
    severity: 'medium',
    confidence: 0.82,
    rule_id: 'tokens.same_words_different_order',
    actual_token_start: first?.actual_token_index ?? 0,
    actual_token_end: userTokens.length - 1,
    expected_token_start: first?.expected_token_index ?? 0,
    expected_token_end: expectedTokens.length - 1,
    feedback: 'As palavras estão corretas, mas a ordem precisa mudar.',
    evidence: { same_token_multiset: true },
  })]
}

function detectSpelling({ alignment }) {
  return alignment
    .filter((a) => a.operation === 'replace' && a.expected && a.actual && isTypoPair(a.expected, a.actual))
    .map((a) => makeError({
      category: 'spelling',
      subtype: 'spelling',
      actual: a.actual,
      expected: a.expected,
      severity: 'low',
      confidence: 0.83,
      rule_id: 'spelling.edit_distance_one',
      actual_token_start: a.actual_token_index,
      actual_token_end: a.actual_token_index,
      expected_token_start: a.expected_token_index,
      expected_token_end: a.expected_token_index,
      feedback: `Revise a grafia: "${a.actual}" → "${a.expected}".`,
      evidence: { edit_distance_at_most_one: true },
    }))
}

function detectGenericVocabulary(ctx, existing) {
  const covered = new Set(existing.map((e) => `${e.expected_token_start}:${e.actual_token_start}`))
  return ctx.alignment
    .filter((a) => a.operation !== 'equal')
    .filter((a) => !covered.has(`${a.expected_token_index}:${a.actual_token_index}`))
    .filter((a) => !(ctx.userTokens.includes('ive') && (a.expected === 'i' || a.expected === 'have')))
    .filter((a) => !(a.operation === 'delete' && AUXILIARIES.has(a.expected)))
    .map((a) => makeError({
      category: 'vocabulary',
      subtype: a.operation,
      actual: a.actual || '',
      expected: a.expected || '',
      severity: 'medium',
      confidence: 0.55,
      rule_id: `tokens.${a.operation}`,
      actual_token_start: a.actual_token_index,
      actual_token_end: a.actual_token_index,
      expected_token_start: a.expected_token_index,
      expected_token_end: a.expected_token_index,
      feedback: 'Compare este trecho com a resposta esperada.',
      evidence: { operation: a.operation },
    }))
}

function makeError(e) {
  return { role: 'secondary', ...e }
}

function sortErrors(errors) {
  return [...errors].sort((a, b) =>
    (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0)
    || (CATEGORY_RANK[b.category] || 0) - (CATEGORY_RANK[a.category] || 0)
    || (b.confidence || 0) - (a.confidence || 0)
    || (a.expected_token_start ?? 999) - (b.expected_token_start ?? 999),
  )
}

function assignRoles(errors) {
  return errors.map((e, i) => ({ ...e, role: i === 0 ? 'primary' : 'secondary' }))
}

function dedupeErrors(errors) {
  const seen = new Set()
  const out = []
  for (const e of errors) {
    const key = `${e.rule_id}:${e.expected_token_start}:${e.actual_token_start}:${e.category}:${e.subtype}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(e)
  }
  return out
}

function legacyTypeFor(category, error = null) {
  if (category === 'auxiliary' && error?.subtype === 'missing_auxiliary' && error?.expected_token_start === 0) return 'question_structure'
  if (category === 'auxiliary' && error?.subtype === 'missing_auxiliary') return 'missing_auxiliary'
  if (category === 'auxiliary' && error?.subtype === 'wrong_auxiliary') return 'wrong_auxiliary'
  return category
}

function buildEvaluationFeedback(verdict, primaryError) {
  if (verdict === 'correct') return 'Natural! Boa estrutura.'
  return primaryError?.feedback || (verdict === 'partial' ? 'Quase lá — ajuste os trechos destacados.' : 'Compare com a resposta esperada e tente de novo.')
}


export function buildIncorrectChoiceEvaluation({ user_answer = '', expected_answer = '', skill_target = null } = {}) {
  const err = makeError({
    role: 'primary',
    category: 'incorrect_choice',
    subtype: 'incorrect_choice',
    actual: user_answer,
    expected: expected_answer,
    severity: 'medium',
    confidence: 1,
    rule_id: 'choice.exact_match',
    actual_token_start: 0,
    actual_token_end: 0,
    expected_token_start: 0,
    expected_token_end: 0,
    feedback: 'Essa opção não corresponde à resposta esperada.',
    evidence: { closed_exercise: true, exact_match_required: true },
  })
  err.role = 'primary'
  return {
    engine_version: ENGINE_VERSION,
    verdict: 'incorrect',
    score: 0,
    similarity_score: 0,
    target_answer: expected_answer,
    target: expected_answer,
    normalized_user_answer: normalize(user_answer),
    normalized_expected_answer: normalize(expected_answer),
    user_tokens: tokenize(user_answer),
    target_tokens: tokenize(expected_answer),
    alignment: alignTokens(user_answer, expected_answer),
    detected_errors: [err],
    primary_error: err,
    accepted_differences: [],
    possible_mistake_type: 'incorrect_choice',
    missing_words: wordDiff(user_answer, expected_answer).missing_words,
    extra_words: wordDiff(user_answer, expected_answer).extra_words,
    typos: [],
    is_probably_correct: false,
    feedback: err.feedback,
    skill_target,
  }
}

export function buildFeedback(correct, partial, mistake) {
  if (correct) return 'Natural! Boa estrutura.'
  if (partial) return FEEDBACK_BY_TYPE[mistake]?.partial || 'Quase lá — dá pra deixar mais natural.'
  return FEEDBACK_BY_TYPE[mistake]?.wrong || 'Compare com a resposta esperada e tente de novo.'
}

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
  auxiliary: {
    wrong: 'Auxiliar incorreto ou ausente.',
    partial: 'Quase — revise o auxiliar.',
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
  verb_form: {
    wrong: 'Forma verbal incorreta para esta estrutura.',
    partial: 'Quase — ajuste a forma do verbo.',
  },
  naturalness: {
    wrong: 'Dá para soar mais natural neste contexto.',
    partial: 'Quase — há uma forma mais natural.',
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
  punctuation: {
    wrong: 'Atenção à pontuação.',
    partial: 'Quase — só a pontuação precisa de ajuste.',
  },
  capitalization: {
    wrong: 'Atenção às maiúsculas/minúsculas.',
    partial: 'Quase — só a capitalização precisa de ajuste.',
  },
  incorrect_choice: {
    wrong: 'Essa opção não corresponde à resposta esperada.',
    partial: 'Escolha a alternativa que melhor completa a frase.',
  },
}
