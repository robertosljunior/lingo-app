import { describe, it, expect } from 'vitest'
import { analyzeUserProduction } from './language-analysis-orchestrator.js'
import { KnowledgeBase } from './knowledge-base.js'
import { BUILTIN_KNOWLEDGE_PACKS } from '../../content/knowledge-packs/index.js'
import { validateKnowledgePacks } from './knowledge-pack-validator.js'
import { HeuristicStructuralNlpAdapter } from './structural-nlp-adapter.js'
import { InternalGrammarChecker, HarperGrammarCheckerAdapter, createGrammarChecker } from './grammar-checker-adapter.js'
import { HashingSemanticEncoder } from './semantic-encoder-adapter.js'
import { applyTransformation, isKnownOperation, thirdPersonSingular } from './transformation-registry.js'
import { verifyDownloadedPack, isAllowlistedUrl, verifyChecksum } from './pack-catalog.js'

const kb = new KnowledgeBase(BUILTIN_KNOWLEDGE_PACKS)
const snapshot = { knowledgePacks: BUILTIN_KNOWLEDGE_PACKS }
const analyze = (params) => analyzeUserProduction({ ...params, engines: { knowledgeBase: kb } })

describe('knowledge packs', () => {
  it('all builtin packs validate', () => {
    const r = validateKnowledgePacks(BUILTIN_KNOWLEDGE_PACKS)
    expect(r.errors).toEqual([])
    expect(r.valid).toBe(true)
  })

  it('rejects packs carrying executable content', async () => {
    const { validateKnowledgePack } = await import('./knowledge-pack-validator.js')
    const bad = { ...BUILTIN_KNOWLEDGE_PACKS[0], explanations_pt: [{ explanation_id: 'x', title: 'x', summary: 'eval(alert(1))' }] }
    const r = validateKnowledgePack(bad)
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.startsWith('EXECUTABLE_CONTENT'))).toBe(true)
  })

  it('rejects unknown transformation operation_id', async () => {
    const { validateKnowledgePack } = await import('./knowledge-pack-validator.js')
    const bad = { ...BUILTIN_KNOWLEDGE_PACKS[0], transformations: [{ transformation_id: 't', operation_id: 'not_real' }] }
    const r = validateKnowledgePack(bad)
    expect(r.errors).toContain('UNKNOWN_OPERATION:not_real')
  })
})

describe('free production goldens', () => {
  it('"Please give me a dessert." is valid with polite suggestions, no correction', async () => {
    const r = await analyze({ text: 'Please give me a dessert.', assessmentMode: 'free', level: 'A1', contentSnapshot: snapshot })
    expect(r.verdict).toBe('valid_with_suggestions')
    expect(r.corrected_version).toBeNull()
    expect(r.detected_intents).toContain('request')
    expect(r.natural_alternatives.map((a) => a.text)).toContain('Could I have a dessert, please?')
    // No hidden model answer used; no high-severity invented error.
    expect(r.detected_errors.some((e) => e.severity === 'high')).toBe(false)
  })

  it('"He go to work every day." is corrected with agreement explanation', async () => {
    const r = await analyze({ text: 'He go to work every day.', assessmentMode: 'free', level: 'A1', contentSnapshot: snapshot })
    expect(r.verdict).toBe('needs_revision')
    expect(r.corrected_version).toBe('He goes to work every day.')
    const primary = r.detected_errors[0]
    expect(primary.category).toBe('verb_form')
    expect(primary.explanation_pt.summary).toMatch(/-s/)
    expect(r.natural_alternatives.map((a) => a.text)).toContain('He works every day.')
  })

  it('"I work in this company." is not a hard error, suggests "at"', async () => {
    const r = await analyze({ text: 'I work in this company.', assessmentMode: 'free', level: 'A2', contentSnapshot: snapshot })
    expect(['valid', 'valid_with_suggestions']).toContain(r.verdict)
    expect(r.detected_errors.some((e) => e.severity === 'high' || e.severity === 'critical')).toBe(false)
    expect(r.natural_alternatives.map((a) => a.text)).toContain('I work at this company.')
  })

  it('low semantic similarity never fails free production', async () => {
    const r = await analyze({ text: 'The weather is nice today.', assessmentMode: 'free', level: 'A1', contentSnapshot: snapshot })
    expect(['valid', 'valid_with_suggestions']).toContain(r.verdict)
  })
})

describe('guided mode', () => {
  it('confirms will/future_plan intent', async () => {
    const r = await analyze({ text: "I'll play with my dad tomorrow.", assessmentMode: 'guided', requestedIntent: 'future_plan', level: 'A1', contentSnapshot: snapshot })
    expect(r.verdict).toBe('valid')
    expect(r.detected_intents).toContain('future_plan')
  })

  it('flags a sentence that ignores the requested structure', async () => {
    const r = await analyze({ text: 'I played with my dad yesterday.', assessmentMode: 'guided', requestedIntent: 'future_plan', level: 'A1', contentSnapshot: snapshot })
    expect(r.verdict).toBe('needs_revision')
  })
})

describe('equivalent mode', () => {
  it('rejects a grammatically-valid but semantically-wrong translation', async () => {
    const r = await analyze({
      text: 'Please give me a dessert.', assessmentMode: 'equivalent',
      equivalentTarget: { text: 'The dessert is important.', essential_words: ['important'] },
      level: 'A1', contentSnapshot: snapshot,
    })
    expect(r.verdict).toBe('needs_revision')
    const meaning = r.detected_errors.find((e) => e.category === 'meaning')
    expect(meaning).toBeTruthy()
    // It is a meaning problem, not a grammar problem.
    expect(r.detected_errors.some((e) => e.category === 'verb_form')).toBe(false)
  })
})

describe('adapters', () => {
  it('heuristic structural adapter extracts subject/verb/intent', () => {
    const s = new HeuristicStructuralNlpAdapter().analyzeStructure('He goes to work every day.')
    expect(s.subjects[0].third_singular).toBe(true)
    expect(s.sentence_type).toBe('statement')
  })

  it('internal grammar checker is safe and non-throwing', async () => {
    const r = await new InternalGrammarChecker().lint('the the cat')
    expect(r.ok).toBe(true)
    expect(r.issues.some((i) => i.source_rule === 'grammar.repeated_word')).toBe(true)
  })

  it('Harper adapter returns GRAMMAR_ENGINE_UNAVAILABLE on load failure without throwing', async () => {
    const harper = new HarperGrammarCheckerAdapter({ loadLinter: async () => { throw new Error('no wasm') } })
    const r = await harper.lint('Hello world')
    expect(r.ok).toBe(false)
    expect(r.code).toBe('GRAMMAR_ENGINE_UNAVAILABLE')
  })

  it('createGrammarChecker degrades to internal rules when Harper fails', async () => {
    const checker = createGrammarChecker({ harperLoader: async () => { throw new Error('offline') } })
    const r = await checker.lint('the the cat')
    expect(r.ok).toBe(true)
    expect(r.degraded_from).toBe('harper')
  })

  it('hashing encoder ranks lexically-similar candidates higher (never decides grammar)', async () => {
    const enc = new HashingSemanticEncoder()
    const ranked = await enc.rank('Could I have a dessert', ['Could I have a dessert, please?', 'The bus is late'])
    expect(ranked[0].candidate).toMatch(/dessert/)
  })

  it('the app never imports wink or compromise outside the adapter layer', async () => {
    const { readdirSync, readFileSync } = await import('node:fs')
    const dir = new URL('..', import.meta.url).pathname
    const offenders = []
    const scan = (d) => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const p = d + entry.name
        if (entry.isDirectory()) { if (entry.name !== 'language-analysis') scan(p + '/') ; continue }
        if (!/\.jsx?$/.test(entry.name)) continue
        const src = readFileSync(p, 'utf8')
        if (/from ['"]compromise['"]|from ['"]wink-nlp['"]/.test(src)) offenders.push(p)
      }
    }
    scan(dir)
    // nlp-worker.js is the legacy worker being superseded; document remaining ones.
    expect(offenders.every((o) => o.endsWith('nlp-worker.js'))).toBe(true)
  })
})

describe('transformations', () => {
  it('preserves the requested item when making a request polite', () => {
    expect(applyTransformation('request_to_could_i_have', 'Please give me a dessert.')).toBe('Could I have a dessert, please?')
  })
  it('third-person -s handles irregulars', () => {
    expect(thirdPersonSingular('go')).toBe('goes')
    expect(thirdPersonSingular('watch')).toBe('watches')
    expect(thirdPersonSingular('study')).toBe('studies')
  })
  it('unknown operation ids are known-bad', () => {
    expect(isKnownOperation('request_to_could_i_have')).toBe(true)
    expect(isKnownOperation('drop_database')).toBe(false)
  })
})

describe('remote pack security', () => {
  const enc = new TextEncoder()
  it('only allowlisted https urls are accepted', () => {
    expect(isAllowlistedUrl('https://objects.githubusercontent.com/pack.json')).toBe(true)
    expect(isAllowlistedUrl('http://objects.githubusercontent.com/pack.json')).toBe(false)
    expect(isAllowlistedUrl('https://evil.example.com/pack.json')).toBe(false)
  })

  it('rejects a checksum mismatch', async () => {
    const bytes = enc.encode(JSON.stringify(BUILTIN_KNOWLEDGE_PACKS[0]))
    const r = await verifyDownloadedPack({ bytes, catalogEntry: { pack_id: 'semantic_do', sha256: 'deadbeef' } })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('CHECKSUM_MISMATCH')
  })

  it('accepts a valid pack with a correct checksum', async () => {
    const bytes = enc.encode(JSON.stringify(BUILTIN_KNOWLEDGE_PACKS[0]))
    const { actual } = await verifyChecksum(bytes, '')
    const r = await verifyDownloadedPack({ bytes, catalogEntry: { pack_id: 'semantic_do', sha256: actual } })
    expect(r.ok).toBe(true)
    expect(r.pack.manifest.pack_id).toBe('semantic_do')
  })

  it('rejects invalid json (never executed)', async () => {
    const bytes = enc.encode('{ not json')
    const { actual } = await verifyChecksum(bytes, '')
    const r = await verifyDownloadedPack({ bytes, catalogEntry: { sha256: actual } })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('INVALID_JSON')
  })
})
