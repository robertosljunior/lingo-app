// bilingual-content.js — Slice 7.5. Deterministic (no LLM, no network) checks
// over the authored bilingual content packs: placeholder detection, per-pack
// coverage report + minimum enforcement, and a lightweight PT↔EN semantic
// equivalence check (negation and quantity are preserved). Everything here is
// pure and structural so it runs in unit tests and the content validator.

import { TYPE_TO_FAMILY } from './lesson-generator.js'

const PLACEHOLDER_PATTERNS = [
  /frase sobre/i,
  /^diga em inglês/i,
  /contexto base/i,
  /contexto [A-Z][a-z]+ [AB][12]\b/, // "Contexto Trabalho B1"
]

export function isPortuguesePlaceholder(text) {
  const s = String(text || '')
  if (!s.trim()) return true
  return PLACEHOLDER_PATTERNS.some((re) => re.test(s))
}

// A template counts as a real translation source when it carries an explicit
// Portuguese source that is not a placeholder and is not just English.
export function hasRealTranslationSource(t = {}) {
  const src = t.source_text_pt || t.pt || ''
  if (isPortuguesePlaceholder(src)) return false
  // reject a "source" that is actually the English answer
  const en = (t.expected_answers_en || [t.sentence]).filter(Boolean).map((x) => String(x).toLowerCase())
  if (en.includes(String(src).toLowerCase())) return false
  return String(src).trim().length > 0
}

// ---- quantity / negation extraction ----
const PT_NUM = { um: 1, uma: 1, dois: 2, duas: 2, três: 3, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10 }
const EN_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 }
const PT_NEG = /\b(não|nao|nunca|jamais|nenhum|nenhuma|nem)\b/i
const EN_NEG = /\b(not|never|no|none|nobody|nothing)\b|n't/i

function cardinals(text, map) {
  const out = []
  for (const w of String(text || '').toLowerCase().match(/[\wáàâãéêíóôõúç]+|\d+/g) || []) {
    if (/^\d+$/.test(w)) { if (+w >= 2) out.push(+w) }
    else if (map[w] != null && map[w] >= 2) out.push(map[w])
  }
  return out.sort((a, b) => a - b)
}

// Returns a list of equivalence violations between a Portuguese source and its
// English answer. Empty means the pair is structurally consistent.
export function semanticEquivalenceIssues(sourcePt, expectedEn) {
  const issues = []
  const ptNeg = PT_NEG.test(sourcePt || '')
  const enNeg = EN_NEG.test(expectedEn || '')
  if (ptNeg !== enNeg) issues.push('NEGATION_MISMATCH')
  const ptN = cardinals(sourcePt, PT_NUM)
  const enN = cardinals(expectedEn, EN_NUM)
  if (ptN.join(',') !== enN.join(',')) issues.push('QUANTITY_MISMATCH')
  return issues
}

// ---- per-pack coverage report + validation ----
const MIN = { translation_real: 5, ordering: 4, listening: 4, production: 4, recognition: 4 }
const TYPE_FAMILY = TYPE_TO_FAMILY

export function bilingualPackReport(pack) {
  const templates = pack?.template_definitions || []
  const by_type = {}
  const by_family = {}
  let translation_real_count = 0
  let placeholder_count = 0
  for (const t of templates) {
    for (const type of t.exercise_types || []) {
      by_type[type] = (by_type[type] || 0) + 1
      const fam = TYPE_FAMILY[type]
      if (fam) by_family[fam] = (by_family[fam] || 0) + 1
    }
    if (hasRealTranslationSource(t)) translation_real_count++
    if (isPortuguesePlaceholder(t.source_text_pt || t.pt)) placeholder_count++
  }
  // "translation" coverage counts templates that both offer translate_natural
  // and carry a real Portuguese source.
  const translationCoverage = templates.filter((t) => (t.exercise_types || []).includes('translate_natural') && hasRealTranslationSource(t)).length
  const coverage = {
    translation: translationCoverage,
    ordering: templates.filter((t) => (t.exercise_types || []).some((x) => TYPE_FAMILY[x] === 'ordering')).length,
    listening: templates.filter((t) => (t.exercise_types || []).some((x) => TYPE_FAMILY[x] === 'listening')).length,
    production: templates.filter((t) => (t.exercise_types || []).some((x) => TYPE_FAMILY[x] === 'production')).length,
    recognition: templates.filter((t) => (t.exercise_types || []).some((x) => TYPE_FAMILY[x] === 'recognition')).length,
  }
  const missing_types = ['translate_natural', 'build_sentence', 'listen_type', 'speak_sentence', 'fill_blank', 'choose_best']
    .filter((type) => !(by_type[type] > 0))
  return { pack_id: pack?.manifest?.pack_id, total_templates: templates.length, by_type, by_family, missing_types, translation_real_count, placeholder_count, coverage }
}

export function validateBilingualPack(pack) {
  const errors = []
  const r = bilingualPackReport(pack)
  if (r.placeholder_count > 0) errors.push(`PLACEHOLDER_PORTUGUESE:${r.placeholder_count}`)
  if (r.coverage.translation < MIN.translation_real) errors.push(`TRANSLATION_COVERAGE_BELOW_MIN:${r.coverage.translation}/${MIN.translation_real}`)
  if (r.coverage.ordering < MIN.ordering) errors.push(`ORDERING_COVERAGE_BELOW_MIN:${r.coverage.ordering}/${MIN.ordering}`)
  if (r.coverage.listening < MIN.listening) errors.push(`LISTENING_COVERAGE_BELOW_MIN:${r.coverage.listening}/${MIN.listening}`)
  if (r.coverage.production < MIN.production) errors.push(`PRODUCTION_COVERAGE_BELOW_MIN:${r.coverage.production}/${MIN.production}`)
  if (r.coverage.recognition < MIN.recognition) errors.push(`RECOGNITION_COVERAGE_BELOW_MIN:${r.coverage.recognition}/${MIN.recognition}`)
  // every template that offers translation must have a consistent PT↔EN pair
  for (const t of pack?.template_definitions || []) {
    if (!(t.exercise_types || []).includes('translate_natural')) continue
    if (!hasRealTranslationSource(t)) { errors.push(`TRANSLATION_SOURCE_MISSING:${t.template_id}`); continue }
    const eq = semanticEquivalenceIssues(t.source_text_pt || t.pt, (t.expected_answers_en || [t.sentence])[0])
    if (eq.length) errors.push(`SEMANTIC_${eq[0]}:${t.template_id}`)
  }
  return { valid: errors.length === 0, errors, report: r }
}

export { MIN as BILINGUAL_MINIMUMS }
