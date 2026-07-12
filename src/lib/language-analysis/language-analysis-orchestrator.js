// language-analysis-orchestrator.js — canonical pipeline:
//
//   text → safe normalization → grammar lint → structural NLP → deterministic
//   rules → semantic retrieval (USE) → knowledge-pack matching → evidence fusion
//   → technical diagnosis → pedagogical explanation → natural alternatives.
//
// It analyzes the sentence the learner produced. In free mode it NEVER compares
// against a hidden model answer, and semantic distance alone can never create a
// high-severity error.

import { createGrammarChecker } from './grammar-checker-adapter.js'
import { createStructuralNlp } from './structural-nlp-adapter.js'
import { createSemanticEncoder } from './semantic-encoder-adapter.js'
import { KnowledgeBase } from './knowledge-base.js'
import { matchesWhen } from './usage-rule-resolvers.js'
import { applyTransformation } from './transformation-registry.js'

export const ANALYSIS_VERSION = '1'

const VERDICTS = { VALID: 'valid', SUGGEST: 'valid_with_suggestions', REVISE: 'needs_revision', UNABLE: 'unable_to_assess' }

// Safe, meaning-preserving transformations tried on a corrected/base sentence to
// surface additional natural phrasings (register/lexical variants only).
const BUILTIN_ALTERNATIVE_OPS = ['simplify_go_to_work', 'every_to_each_day']

// Built-in deterministic rules that do not depend on any content pack. These are
// pure grammatical facts confirmed by structural evidence — the kind that must
// hold regardless of which packs are installed.
function builtinDeterministicRules(structure) {
  const errors = []
  const subj = structure.subjects?.[0]
  const verb = structure.evidence?.main_verb
  const hasAux = structure.auxiliaries?.length > 0
  // Third-person singular present agreement: "He go" → "He goes".
  if (
    structure.sentence_type === 'statement' &&
    structure.tense_candidates?.includes('simple_present') &&
    subj?.third_singular &&
    verb && verb.base_form && !hasAux
  ) {
    errors.push({
      error_id: 'agreement_third_person_s',
      category: 'verb_form',
      subtype: 'subject_verb_agreement',
      severity: 'high',
      confidence: 0.95,
      original: verb.token,
      message: 'Third-person singular present verbs take "-s".',
      transformation: { operation_id: 'add_third_person_s', ctx: { verb: verb.token } },
      explanation_pt: {
        title: 'Concordância no presente simples',
        summary: 'Com "he", "she" ou "it", o verbo recebe "-s" no presente simples.',
      },
      source: 'builtin_rule',
      evidence: { subject: subj.token, verb: verb.token, third_singular: true },
    })
  }
  return errors
}

function mapGrammarIssue(issue, kb) {
  // Try to map to a pedagogical explanation; otherwise keep technical issue with
  // a conservative generic explanation (never invent a specific rule).
  return {
    error_id: issue.issue_id,
    category: issue.category,
    subtype: issue.source_rule,
    severity: issue.category === 'spelling' || issue.category === 'grammar' ? 'medium' : 'low',
    confidence: issue.confidence,
    original: issue.original,
    span: issue.span,
    suggestions: issue.suggestions,
    message: issue.message,
    explanation_pt: { title: 'Revisão de escrita', summary: genericGrammarExplanation(issue) },
    source: 'grammar',
  }
}

function genericGrammarExplanation(issue) {
  switch (issue.category) {
    case 'spelling': return 'Revise a grafia da palavra destacada.'
    case 'capitalization': return 'Comece a frase com letra maiúscula.'
    case 'punctuation': return 'Ajuste a pontuação destacada.'
    default: return 'Há um pequeno ajuste de escrita a fazer no trecho destacado.'
  }
}

async function retrieveSemantics(encoder, structure, text, kb) {
  const exemplars = kb.exemplarsForRanking()
  if (!exemplars.length) return { intents: structure.intent_signals.map((i) => ({ intent: i, score: 0.5 })), topFrame: null, ranked: [] }
  const ranked = await encoder.rank(text, exemplars)
  const intents = await encoder.classifyIntent(text, exemplars)
  // Prefer a frame supported by BOTH structural intent signals and retrieval.
  const top = ranked[0]
  let topFrame = null
  for (const r of ranked) {
    const frameId = r.candidate.frame_id
    if (!frameId) continue
    const frame = kb.frame(frameId)
    if (!frame) continue
    // Structural evidence must agree — retrieval similarity alone may NOT select
    // a frame, or "I have a car" would inherit "Could I have a dessert" phrasing.
    const intentAgrees = structure.intent_signals.includes(frame.intent) ||
      (frame.intent === 'polite_request' && structure.intent_signals.includes('request'))
    if (r.candidate.polarity !== 'negative' && intentAgrees && r.score >= 0.15) { topFrame = frame; break }
  }
  return { intents, topFrame, ranked, topScore: top?.score ?? 0 }
}

/**
 * @param {object} params
 * @param {string} params.text                learner production
 * @param {'exact'|'equivalent'|'guided'|'free'} params.assessmentMode
 * @param {string} [params.requestedIntent]   guided-mode target frame/intent
 * @param {string} [params.level]             CEFR level for filtering
 * @param {object} [params.equivalentTarget]  { text, essential_words } for equivalent mode
 * @param {object} params.contentSnapshot     { knowledgePacks: [] }
 * @param {object} [params.engines]           { grammarChecker, structuralNlp, semanticEncoder }
 */
export async function analyzeUserProduction(params) {
  const {
    text, assessmentMode = 'free', requestedIntent = null, level = 'A1',
    equivalentTarget = null, contentSnapshot = {}, engines = {},
  } = params

  const grammarChecker = engines.grammarChecker || createGrammarChecker()
  const structuralNlp = engines.structuralNlp || createStructuralNlp()
  const semanticEncoder = engines.semanticEncoder || createSemanticEncoder()
  const kb = engines.knowledgeBase || new KnowledgeBase(contentSnapshot.knowledgePacks || [])

  const evidence = []
  const trimmed = (text || '').trim()
  if (!trimmed) {
    return baseResult({ verdict: VERDICTS.UNABLE, confidence: 0, evidence: [{ type: 'empty_input' }] })
  }

  // 1. Grammar (never blocks; returns unavailable code on failure).
  let grammar = { ok: false }
  try { grammar = await grammarChecker.lint(trimmed) } catch { grammar = { ok: false, code: 'GRAMMAR_ENGINE_UNAVAILABLE' } }
  const grammarIssues = grammar.ok ? grammar.issues : []
  if (!grammar.ok) evidence.push({ type: 'grammar_unavailable', code: grammar.code })

  // 2. Structural NLP.
  const structure = await structuralNlp.analyzeStructure(trimmed)
  evidence.push({ type: 'structure', engine: structure.engine, sentence_type: structure.sentence_type, tense: structure.tense_candidates })

  // 3. Deterministic rules (built-in + pack usage rules).
  const detected_errors = []
  for (const e of builtinDeterministicRules(structure)) { detected_errors.push(e); evidence.push({ type: 'deterministic_rule', rule: e.error_id }) }

  for (const rule of kb.usageRules) {
    if (rule.negative_when && matchesWhen(rule.negative_when, structure)) {
      const expl = kb.explanation(rule.explanation_id)
      detected_errors.push({
        error_id: rule.rule_id, category: 'grammar', subtype: 'usage_rule', severity: rule.severity || 'medium',
        confidence: 0.85, message: expl?.summary || 'Usage rule violation', explanation_pt: expl ? { title: expl.title, summary: expl.summary } : null,
        source: 'pack_rule', pack_id: rule.pack_id,
      })
      evidence.push({ type: 'pack_rule', rule: rule.rule_id })
    }
  }

  // 4. Map grammar issues (skip ones already covered by a deterministic rule).
  for (const issue of grammarIssues) detected_errors.push(mapGrammarIssue(issue, kb))

  // 4b. Pack-driven naturalness hints (low severity, context-dependent — never
  //     an absolute grammar error).
  const naturalness_suggestions = []
  const wordSet = new Set(structure.tokens.map((t) => t.toLowerCase()))
  for (const hint of kb.naturalnessHints) {
    if ((hint.contains_all || []).every((w) => wordSet.has(w.toLowerCase()))) {
      const expl = kb.explanation(hint.explanation_id)
      const suggestion = hint.replace
        ? replaceWord(trimmed, hint.replace.from, hint.replace.to)
        : null
      detected_errors.push({
        error_id: hint.hint_id, category: 'naturalness', subtype: 'context_preference', severity: hint.severity || 'low',
        confidence: 0.6, message: expl?.summary || 'Uma forma mais natural neste contexto.',
        explanation_pt: expl ? { title: expl.title, summary: expl.summary } : { title: 'Forma mais natural', summary: 'Há uma forma que soa mais natural neste contexto.' },
        naturalness_suggestion: suggestion, source: 'pack_naturalness', pack_id: hint.pack_id,
      })
      if (suggestion) naturalness_suggestions.push(suggestion)
      evidence.push({ type: 'naturalness_hint', hint: hint.hint_id })
    }
  }

  // 5. Semantic retrieval (USE / hashing fallback).
  const semantics = await retrieveSemantics(semanticEncoder, structure, trimmed, kb)
  evidence.push({ type: 'semantic_retrieval', top_score: semantics.topScore, top_frame: semantics.topFrame?.frame_id || null })

  const detected_intents = [...new Set([...structure.intent_signals, ...semantics.intents.filter((i) => i.score >= 0.35).map((i) => i.intent)])]
  const matched_concepts = semantics.topFrame ? [semantics.topFrame.frame_id] : []

  // 6. Corrected version + alternatives.
  let corrected_version = null
  const primaryError = detected_errors.slice().sort((a, b) => sev(b.severity) - sev(a.severity) || (b.confidence || 0) - (a.confidence || 0))[0] || null
  if (primaryError?.transformation) {
    corrected_version = applyTransformation(primaryError.transformation.operation_id, trimmed, primaryError.transformation.ctx)
  }

  const natural_alternatives = buildAlternatives({ kb, structure, frame: semantics.topFrame, level, corrected_version, primaryError, text: trimmed })
  for (const s of naturalness_suggestions) if (!natural_alternatives.some((a) => a.text === s)) natural_alternatives.push({ text: s, tone: 'natural', from_naturalness: true })

  // 7. Fusion → verdict, applying the assessment-mode-specific policy and the
  //    hard safety rule that semantics alone cannot fail free production.
  const fusion = fuseVerdict({
    assessmentMode, detected_errors, structure, semantics, requestedIntent,
    equivalentTarget, encoderReady: true, semanticEncoder, evidence, corrected_version,
    natural_alternatives, kb,
  })

  return baseResult({
    grammar, structure, semantics: { top_frame: semantics.topFrame?.frame_id || null, top_score: semantics.topScore, intents: semantics.intents },
    detected_errors: fusion.detected_errors, detected_intents, matched_concepts,
    corrected_version: fusion.corrected_version ?? corrected_version,
    natural_alternatives: fusion.natural_alternatives ?? natural_alternatives,
    verdict: fusion.verdict, confidence: fusion.confidence, evidence,
  })
}

function normSurface(s) { return (s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim() }

function buildAlternatives({ kb, structure, frame, level, corrected_version, primaryError, text }) {
  const out = []
  const inputNorm = normSurface(text)
  // If the learner already used a preferred (positive-exemplar) form, there is
  // nothing more natural to offer — do not surface curated alternatives.
  const inputIsPreferred = frame && (frame.positive_exemplars || []).some((e) => normSurface(e) === inputNorm)
  if (frame && !inputIsPreferred) {
    for (const a of kb.alternativesForFrame(frame.frame_id, { level })) {
      if (normSurface(a.text) === inputNorm) continue
      out.push({ text: a.text, tone: a.tone, context_tags: a.context_tags })
    }
  }
  // Transformation-derived, intent-preserving alternatives from packs.
  for (const t of kb.transformations) {
    if (!frame || t.source_frame === frame.intent || t.source_frame === structure.sentence_type) {
      try {
        const applied = applyTransformation(t.operation_id, corrected_version || text, { verb: structure.evidence?.main_verb?.token })
        if (applied && !out.some((o) => o.text === applied) && applied !== text) out.push({ text: applied, tone: 'natural', from_transformation: t.transformation_id })
      } catch { /* unknown op caught at validation time */ }
    }
  }
  // Builtin intent-preserving variants derived from the corrected/base sentence.
  // These preserve meaning (register/lexical variants only) and never introduce
  // disconnected content.
  const seedBase = corrected_version || text
  for (const opId of BUILTIN_ALTERNATIVE_OPS) {
    try {
      const applied = applyTransformation(opId, seedBase, { verb: structure.evidence?.main_verb?.token })
      if (applied && applied !== seedBase && applied !== text && !out.some((o) => o.text === applied)) {
        out.push({ text: applied, tone: 'natural', from_transformation: opId })
      }
    } catch { /* unknown op — impossible for builtin list */ }
  }
  // De-duplicate against the corrected version.
  return out.filter((o) => o.text && o.text !== corrected_version).slice(0, 4)
}

function fuseVerdict(ctx) {
  const { assessmentMode, detected_errors, structure, semantics, requestedIntent, equivalentTarget } = ctx
  const hasHardError = detected_errors.some((e) => e.severity === 'high' || e.severity === 'critical')
  const hasSoftIssue = detected_errors.some((e) => e.severity === 'medium' || e.severity === 'low')

  // Equivalent mode: meaning must match the target. Combine similarity with
  // essential-word / intent evidence — never on similarity alone.
  if (assessmentMode === 'equivalent' && equivalentTarget) {
    const essential = (equivalentTarget.essential_words || []).map((w) => w.toLowerCase())
    const userLower = structure.tokens.map((t) => t.toLowerCase())
    const missingEssential = essential.filter((w) => !userLower.includes(w))
    const meaningMismatch = missingEssential.length > 0
    if (hasHardError) return { ...ctx, verdict: 'needs_revision', confidence: 0.9 }
    if (meaningMismatch) {
      return {
        ...ctx,
        verdict: 'needs_revision',
        confidence: 0.8,
        detected_errors: [
          ...detected_errors,
          {
            error_id: 'meaning_mismatch', category: 'meaning', subtype: 'equivalent_meaning', severity: 'high', confidence: 0.8,
            message: 'A frase está gramaticalmente correta, mas o significado não corresponde ao pedido.',
            explanation_pt: { title: 'Significado diferente', summary: `A frase esperada fala sobre: "${equivalentTarget.text}". Sua frase tem outro sentido.` },
            source: 'semantic_equivalence',
          },
        ],
      }
    }
    return { ...ctx, verdict: hasSoftIssue ? 'valid_with_suggestions' : 'valid', confidence: 0.7 }
  }

  // Guided mode: confirm the requested frame/intent is present (structure is the
  // authority; USE only corroborates).
  if (assessmentMode === 'guided' && requestedIntent) {
    if (hasHardError) return { ...ctx, verdict: 'needs_revision', confidence: 0.85 }
    const intentPresent = structure.intent_signals.includes(requestedIntent) || (semantics.topFrame && semantics.topFrame.intent === requestedIntent)
    if (!intentPresent) {
      return {
        ...ctx, verdict: 'needs_revision', confidence: 0.6,
        detected_errors: [...detected_errors, {
          error_id: 'intent_not_met', category: 'task', subtype: 'requested_intent', severity: 'medium', confidence: 0.6,
          message: `A tarefa pedia: ${requestedIntent}.`, explanation_pt: { title: 'Reveja a tarefa', summary: 'A frase não usa a estrutura solicitada no enunciado.' }, source: 'guided_intent',
        }],
      }
    }
    return { ...ctx, verdict: hasSoftIssue ? 'valid_with_suggestions' : 'valid', confidence: 0.8 }
  }

  // Free mode: grammar/structure decide. Low similarity NEVER fails.
  if (hasHardError) return { ...ctx, verdict: 'needs_revision', confidence: 0.85 }
  if (hasSoftIssue || (ctx.natural_alternatives && ctx.natural_alternatives.length)) return { ...ctx, verdict: 'valid_with_suggestions', confidence: 0.7 }
  return { ...ctx, verdict: 'valid', confidence: 0.75 }
}

function replaceWord(text, from, to) {
  const re = new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
  if (!re.test(text)) return null
  return text.replace(re, to)
}

function sev(s) { return { critical: 5, high: 4, medium: 3, low: 2 }[s] || 1 }

function baseResult(overrides) {
  return {
    analysis_version: ANALYSIS_VERSION,
    grammar: {}, structure: {}, semantics: {},
    detected_errors: [], detected_intents: [], matched_concepts: [],
    corrected_version: null, natural_alternatives: [],
    verdict: 'unable_to_assess', confidence: 0, evidence: [],
    ...overrides,
  }
}
