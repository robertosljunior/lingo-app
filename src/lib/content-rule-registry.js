// content-rule-registry.js — the safe, code-only registries the declarative
// content packs are allowed to reference. Packs (JSON / IndexedDB) never carry
// executable code: they point at these IDs and the engine resolves them here.
//
//   PATTERNS              sentence-structure patterns (required slots, levels)
//   CONSTRAINTS           declarative agreement/level rules a pack may cite
//   DISTRACTOR_STRATEGIES plausible-wrong-answer builders for choice exercises
//
// An unknown pattern/constraint/strategy ID invalidates the referencing
// template or pack (see content-pack-validator.js).

export const CONTENT_RULE_REGISTRY_VERSION = '1'

// ---------- patterns ----------
// Each pattern declares which slots a template must fill, which CEFR levels it
// may appear in, and which transformations the engine may apply to its
// variants. The surface realizations live in the pack data (declarative
// strings); the resolver here only validates and extracts, never executes
// pack-provided code.
function pattern(pattern_id, required_slots, levels, transformations = ['blank', 'scramble', 'corrupt']) {
  return { pattern_id, required_slots, levels, transformations }
}

export const PATTERNS = {
  subject_be_complement: pattern('subject_be_complement', ['subject', 'complement'], ['A1', 'A2', 'B1', 'B2']),
  subject_simple_present_object: pattern('subject_simple_present_object', ['subject', 'verb', 'object'], ['A1', 'A2', 'B1', 'B2']),
  there_is_are_noun: pattern('there_is_are_noun', ['noun'], ['A1', 'A2', 'B1']),
  subject_can_base_verb: pattern('subject_can_base_verb', ['subject', 'verb'], ['A1', 'A2', 'B1']),
  wh_do_subject_base_verb: pattern('wh_do_subject_base_verb', ['wh', 'subject', 'verb'], ['A1', 'A2', 'B1', 'B2']),
  imperative_polite_request: pattern('imperative_polite_request', ['verb', 'object'], ['A1', 'A2', 'B1', 'B2']),
  subject_present_continuous_object: pattern('subject_present_continuous_object', ['subject', 'verb', 'object'], ['A2', 'B1', 'B2']),
  subject_past_simple_object_time: pattern('subject_past_simple_object_time', ['subject', 'verb', 'object'], ['A2', 'B1', 'B2']),
  subject_be_going_to_verb_time: pattern('subject_be_going_to_verb_time', ['subject', 'verb'], ['A2', 'B1', 'B2']),
  comparative_than: pattern('comparative_than', ['subject', 'adjective', 'object'], ['A2', 'B1', 'B2']),
  subject_have_past_participle_yet: pattern('subject_have_past_participle_yet', ['subject', 'verb', 'object'], ['B1', 'B2']),
  subject_have_been_ving_object_duration: pattern('subject_have_been_ving_object_duration', ['subject', 'verb', 'object', 'duration'], ['B1', 'B2']),
  if_present_will_future: pattern('if_present_will_future', ['condition', 'result'], ['B1', 'B2']),
  subject_modal_base_verb: pattern('subject_modal_base_verb', ['subject', 'modal', 'verb'], ['B1', 'B2']),
  relative_clause_basic: pattern('relative_clause_basic', ['subject', 'clause'], ['B1', 'B2']),
  collocation_in_context: pattern('collocation_in_context', ['collocation'], ['A1', 'A2', 'B1', 'B2']),
  passive_be_past_participle: pattern('passive_be_past_participle', ['subject', 'verb'], ['B2']),
  reported_speech_statement: pattern('reported_speech_statement', ['reporter', 'statement'], ['B2']),
  second_conditional: pattern('second_conditional', ['condition', 'result'], ['B2']),
  modal_deduction_statement: pattern('modal_deduction_statement', ['subject', 'modal', 'verb'], ['B2']),
}

export function getPattern(patternId) {
  return PATTERNS[patternId] || null
}

// ---------- constraints ----------
// Constraints are declarative rule IDs a pack may attach to items/templates.
// The engine understands them; the pack only names them.
const CONSTRAINT_IDS = [
  'subject_auxiliary_agreement',
  'verb_requires_ving',
  'verb_requires_base_form',
  'verb_requires_past_participle',
  'duration_compatible_with_present_perfect',
  'workplace_requires_at',
  'countable_article_required',
  'plural_subject_requires_have',
  'third_person_requires_has',
  'question_requires_do',
  'question_requires_does',
  'level_allows_present_perfect',
  'level_allows_present_perfect_continuous',
  'level_allows_passive',
  'level_allows_reported_speech',
  'curated_sentence',
]

export const CONSTRAINTS = Object.fromEntries(CONSTRAINT_IDS.map((id) => [id, { constraint_id: id }]))

export function isKnownConstraint(id) {
  return Object.prototype.hasOwnProperty.call(CONSTRAINTS, id)
}

// Level gates: which grammar the CEFR level allows as primary content.
const LEVEL_ORDER = { A1: 0, A2: 1, B1: 2, B2: 3 }
const SKILL_MIN_LEVEL = {
  past_simple: 'A2',
  present_continuous: 'A2',
  future_going_to: 'A2',
  comparatives: 'A2',
  countable_uncountable: 'A2',
  present_perfect: 'B1',
  present_perfect_continuous: 'B1',
  gerund_after_been: 'B1',
  first_conditional: 'B1',
  modal_deduction: 'B2',
  passive_voice: 'B2',
  reported_speech: 'B2',
  second_conditional: 'B2',
}

export function skillAllowedAtLevel(skillId, level) {
  const min = SKILL_MIN_LEVEL[skillId]
  if (!min) return true
  return (LEVEL_ORDER[level] ?? 0) >= LEVEL_ORDER[min]
}

export function patternAllowedAtLevel(patternId, level) {
  const p = PATTERNS[patternId]
  return !!p && p.levels.includes(level)
}

// ---------- distractor strategies ----------
// Each strategy takes the correct answer + declarative template data and
// returns plausible wrong options with error metadata. Deterministic, no rng.
function strat(strategy_id, error_id, build) {
  return { strategy_id, error_id, build }
}

export const DISTRACTOR_STRATEGIES = {
  verb_form_after_have_been: strat('verb_form_after_have_been', 'wrong_participle', (correct) =>
    correct.endsWith('ing') ? [correct.replace(/ing$/, 'ed'), correct.replace(/ing$/, '')] : [`${correct}ing`, `${correct}ed`]),
  wrong_question_auxiliary: strat('wrong_question_auxiliary', 'wrong_auxiliary', (correct) => {
    const map = { Do: ['Does', 'Are'], Does: ['Do', 'Is'], Have: ['Has', 'Do'], Has: ['Have', 'Does'], Did: ['Do', 'Does'], Are: ['Is', 'Do'], Is: ['Are', 'Does'], Could: ['Can you to', 'Do can'], Can: ['Do can', 'Could to'], have: ['has', 'do'], has: ['have', 'does'] }
    return map[correct] || ['Do', 'Is'].filter((x) => x !== correct)
  }),
  wrong_preposition: strat('wrong_preposition', 'wrong_preposition', (correct) => {
    const map = { at: ['in', 'on'], in: ['at', 'on'], on: ['in', 'at'], for: ['of', 'to'], of: ['for', 'about'], to: ['for', 'at'], by: ['until', 'at'], with: ['to', 'at'], from: ['of', 'at'] }
    return map[correct] || ['in', 'at'].filter((x) => x !== correct)
  }),
  wrong_article: strat('wrong_article', 'wrong_article', (correct) => {
    const map = { a: ['an', 'the'], an: ['a', 'the'], the: ['a', 'an'], some: ['a', 'any'], any: ['some', 'a'] }
    return map[correct] || ['a', 'the'].filter((x) => x !== correct)
  }),
  wrong_collocation: strat('wrong_collocation', 'wrong_collocation', (correct, tpl) => {
    const invalid = (tpl?.invalid_blanks || []).filter(Boolean)
    if (invalid.length >= 2) return invalid.slice(0, 2)
    const map = { make: ['do', 'take'], do: ['make', 'take'], take: ['make', 'get'], meet: ['do', 'make'], schedule: ['make', 'program'], provide: ['make', 'do'], have: ['do', 'make'], get: ['take', 'make'], give: ['make', 'do'], catch: ['take', 'get'], book: ['make', 'do'], pay: ['do', 'make'], go: ['make', 'do'] }
    return [...invalid, ...(map[correct] || ['do', 'make'].filter((x) => x !== correct))].slice(0, 2)
  }),
  wrong_word_order: strat('wrong_word_order', 'word_order', (correct) => {
    const words = correct.split(' ')
    if (words.length < 2) return [`${correct} ${correct}`]
    return [[...words].reverse().join(' '), [words[words.length - 1], ...words.slice(0, -1)].join(' ')]
  }),
  wrong_tense: strat('wrong_tense', 'wrong_tense', (correct) => {
    if (/ed$/.test(correct)) return [correct.replace(/ed$/, ''), `${correct.replace(/ed$/, '')}ing`]
    if (/ing$/.test(correct)) return [correct.replace(/ing$/, ''), correct.replace(/ing$/, 'ed')]
    if (/^(has|have)$/.test(correct)) return [correct === 'has' ? 'have' : 'has', 'had']
    return [`${correct}ed`, `${correct}ing`]
  }),
  wrong_modal_form: strat('wrong_modal_form', 'wrong_modal', (correct) => {
    const map = { should: ['should to', 'must to'], must: ['must to', 'have'], can: ['can to', 'could to'], could: ['could to', 'can to'], might: ['might to', 'may to'], would: ['would to', 'will'], "can't": ['must not can', "don't can"] }
    return map[correct.toLowerCase()] || [`${correct} to`, 'must to']
  }),
  wrong_plural: strat('wrong_plural', 'wrong_plural', (correct) => {
    if (/ies$/.test(correct)) return [correct.replace(/ies$/, 'ys'), correct.replace(/ies$/, 'y')]
    if (/s$/.test(correct)) return [correct.replace(/s$/, ''), `${correct}es`]
    return [`${correct}s`, `${correct}es`]
  }),
  wrong_participle: strat('wrong_participle', 'wrong_participle', (correct) => {
    const map = { been: ['being', 'be'], done: ['did', 'doed'], made: ['maked', 'did'], sent: ['sended', 'send'], written: ['wrote', 'writed'], taken: ['took', 'taked'], finished: ['finish', 'finishing'], gone: ['went', 'goed'], seen: ['saw', 'seed'], told: ['telled', 'tell'] }
    return map[correct.toLowerCase()] || [`${correct.replace(/e?d$/, '')}`, `${correct}ing`]
  }),
}

export function getDistractorStrategy(strategyId) {
  return DISTRACTOR_STRATEGIES[strategyId] || null
}

export function isKnownStrategy(id) {
  return Object.prototype.hasOwnProperty.call(DISTRACTOR_STRATEGIES, id)
}

// Builds unique, plausible fill-blank options for a template using its
// declared strategies; guarantees the correct answer is present and unique.
export function buildDistractorOptions(correct, template, max = 3) {
  const out = [correct]
  const seen = new Set([norm(correct)])
  for (const id of template.distractor_strategy_ids || []) {
    const s = DISTRACTOR_STRATEGIES[id]
    if (!s) continue
    for (const cand of s.build(correct, template) || []) {
      const n = norm(cand)
      if (!n || seen.has(n)) continue
      seen.add(n)
      out.push(cand)
      if (out.length >= max) return out
    }
  }
  // Pad with generic corruptions when strategies yield too few options.
  for (const cand of [correct.toLowerCase() === correct ? correct.toUpperCase()[0] + correct.slice(1) + 's' : `${correct} to`, `${correct} the`]) {
    if (out.length >= max) break
    const n = norm(cand)
    if (!seen.has(n)) { seen.add(n); out.push(cand) }
  }
  return out.slice(0, max)
}

function norm(s) { return String(s || '').toLowerCase().trim() }
