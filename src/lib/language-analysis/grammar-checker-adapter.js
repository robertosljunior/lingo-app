// grammar-checker-adapter.js — stable grammar/spelling contract for the language
// analysis pipeline. The canonical adapter is Harper.js (WASM, local, lazy). When
// Harper is unavailable the app must keep working with internal deterministic
// rules, so this module also ships a dependency-free `InternalGrammarChecker`
// that answers the same contract conservatively.
//
// Contract:
//   lint(text, options) => {
//     ok, engine, engine_version,
//     issues: [{ issue_id, category, message, span, original,
//                suggestions, confidence, source_rule }]
//   }
//
// A failed engine returns `{ ok: false, code: 'GRAMMAR_ENGINE_UNAVAILABLE' }`
// and callers fall back to structural NLP + internal rules. It must never throw
// and never open an error boundary.

export const GRAMMAR_CONTRACT_VERSION = '1'

/** Base class documenting the stable contract. */
export class GrammarCheckerAdapter {
  // eslint-disable-next-line no-unused-vars
  async lint(_text, _options = {}) {
    throw new Error('not_implemented')
  }
}

function issue({ issue_id, category, message, span, original, suggestions = [], confidence = 0.5, source_rule }) {
  return { issue_id, category, message, span, original, suggestions, confidence, source_rule }
}

// ---------------------------------------------------------------------------
// InternalGrammarChecker — conservative, offline, zero-dependency fallback.
// It only reports issues it can prove positionally; it never invents grammar.
// ---------------------------------------------------------------------------
const DOUBLE_SPACE = /\s{2,}/g

export class InternalGrammarChecker extends GrammarCheckerAdapter {
  constructor() {
    super()
    this.engine = 'internal'
    this.engine_version = GRAMMAR_CONTRACT_VERSION
  }

  async lint(text, _options = {}) {
    const src = typeof text === 'string' ? text : ''
    const issues = []

    // Sentence-initial capitalization (only for clearly alphabetic starts).
    const firstAlpha = src.search(/[A-Za-z]/)
    if (firstAlpha >= 0 && /[a-z]/.test(src[firstAlpha])) {
      issues.push(issue({
        issue_id: 'internal.capitalization.sentence_start',
        category: 'capitalization',
        message: 'Sentence should start with a capital letter.',
        span: { start: firstAlpha, end: firstAlpha + 1 },
        original: src[firstAlpha],
        suggestions: [src[firstAlpha].toUpperCase()],
        confidence: 0.6,
        source_rule: 'capitalization.sentence_start',
      }))
    }

    // Repeated whitespace.
    let m
    DOUBLE_SPACE.lastIndex = 0
    while ((m = DOUBLE_SPACE.exec(src))) {
      issues.push(issue({
        issue_id: `internal.spacing.${m.index}`,
        category: 'punctuation',
        message: 'Remove extra spaces.',
        span: { start: m.index, end: m.index + m[0].length },
        original: m[0],
        suggestions: [' '],
        confidence: 0.9,
        source_rule: 'punctuation.repeated_whitespace',
      }))
    }

    // Repeated word ("the the").
    const wordRe = /\b(\w+)\s+\1\b/gi
    while ((m = wordRe.exec(src))) {
      issues.push(issue({
        issue_id: `internal.repeated_word.${m.index}`,
        category: 'grammar',
        message: `Repeated word "${m[1]}".`,
        span: { start: m.index, end: m.index + m[0].length },
        original: m[0],
        suggestions: [m[1]],
        confidence: 0.85,
        source_rule: 'grammar.repeated_word',
      }))
    }

    return { ok: true, engine: this.engine, engine_version: this.engine_version, issues }
  }
}

// ---------------------------------------------------------------------------
// HarperGrammarCheckerAdapter — wraps Harper.js (WASM) loaded lazily. The heavy
// engine is injected so the pipeline stays testable and offline-safe: production
// wiring passes a loader that dynamically imports `harper.js` and points it at a
// locally hosted WASM asset (no CDN). On any failure it returns the documented
// unavailable code instead of throwing.
// ---------------------------------------------------------------------------
const HARPER_CATEGORY = {
  Spelling: 'spelling',
  Capitalization: 'capitalization',
  Repetition: 'grammar',
  Agreement: 'grammar',
  WordChoice: 'vocabulary',
  Punctuation: 'punctuation',
  Miscellaneous: 'grammar',
}

export class HarperGrammarCheckerAdapter extends GrammarCheckerAdapter {
  /**
   * @param {object} opts
   * @param {() => Promise<object>} opts.loadLinter async factory returning a
   *   Harper linter instance exposing `lint(text) => Promise<Lint[]>` and
   *   optionally `getVersion()`. Kept injectable so no CDN/WASM is required in
   *   tests and so provisioning can point at a local asset.
   * @param {number} [opts.timeoutMs]
   */
  constructor({ loadLinter, timeoutMs = 4000 } = {}) {
    super()
    this.engine = 'harper'
    this.engine_version = GRAMMAR_CONTRACT_VERSION
    this._loadLinter = loadLinter
    this._timeoutMs = timeoutMs
    this._linter = null
    this._loadPromise = null
  }

  async _ensure() {
    if (this._linter) return this._linter
    if (!this._loadLinter) throw new Error('no_loader')
    if (!this._loadPromise) this._loadPromise = this._loadLinter()
    this._linter = await withTimeout(this._loadPromise, this._timeoutMs)
    if (typeof this._linter?.getVersion === 'function') {
      try { this.engine_version = String(await this._linter.getVersion()) } catch { /* keep default */ }
    }
    return this._linter
  }

  async lint(text, options = {}) {
    const src = typeof text === 'string' ? text : ''
    try {
      const linter = await this._ensure()
      const raw = await withTimeout(
        Promise.resolve(linter.lint(src, options)),
        options.timeoutMs || this._timeoutMs,
      )
      const issues = (raw || []).map((r, i) => normalizeHarperLint(r, i, src))
      return { ok: true, engine: this.engine, engine_version: this.engine_version, issues }
    } catch (err) {
      return { ok: false, code: 'GRAMMAR_ENGINE_UNAVAILABLE', engine: this.engine, reason: String(err?.message || err) }
    }
  }
}

function callable(obj, name) {
  return obj && typeof obj[name] === 'function'
}

function normalizeHarperLint(lint, index, src) {
  // Real harper.js Lint (v2.x): span() → {start,end}; lint_kind(); message();
  // suggestions() → [{ get_replacement_text() }]. Also tolerate plain-object
  // test doubles that expose the same fields as properties.
  const rawSpan = callable(lint, 'span') ? lint.span() : lint?.span
  const span = rawSpan
    ? { start: rawSpan.start ?? rawSpan[0] ?? 0, end: rawSpan.end ?? rawSpan[1] ?? 0 }
    : { start: 0, end: 0 }
  const kind = callable(lint, 'lint_kind') ? lint.lint_kind() : (lint?.lint_kind || lint?.kind || 'Miscellaneous')
  const message = callable(lint, 'message') ? lint.message() : (lint?.message || lint?.problem_text || 'Grammar issue.')
  const rawSuggestions = callable(lint, 'suggestions') ? lint.suggestions() : (lint?.suggestions || [])
  const suggestions = rawSuggestions.map((s) => {
    if (typeof s === 'string') return s
    if (callable(s, 'get_replacement_text')) { try { return s.get_replacement_text() } catch { return '' } }
    return s?.replacement ?? s?.text ?? ''
  }).filter(Boolean)
  return {
    issue_id: `harper.${kind}.${span.start}.${index}`,
    category: HARPER_CATEGORY[kind] || 'grammar',
    message,
    span,
    original: src.slice(span.start, span.end),
    suggestions,
    confidence: typeof lint?.confidence === 'number' ? lint.confidence : 0.75,
    source_rule: `harper.${kind}`,
  }
}

/**
 * Production Harper loader: real WebAssembly linter with the WASM inlined in the
 * bundle (no CDN, offline-safe). `LocalLinter` runs in both browser and Node.
 * Callers wrap this in HarperGrammarCheckerAdapter (which owns setup/timeout/
 * caching) or a worker.
 */
export function createProductionHarperLoader() {
  return async () => {
    // `binary` loads the WASM as a separate local asset (served from origin, no
    // CDN) — lighter than inlining ~18 MB as a data URL in a JS chunk.
    const [{ LocalLinter }, { binary }] = await Promise.all([
      import('harper.js'),
      import('harper.js/binary'),
    ])
    const linter = new LocalLinter({ binary })
    await linter.setup()
    return {
      lint: (text, options) => linter.lint(text, options),
      getVersion: async () => 'harper.js@2',
    }
  }
}

function withTimeout(promise, ms) {
  if (!ms || ms <= 0) return promise
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('grammar_timeout')), ms)
    Promise.resolve(promise).then(
      (v) => { clearTimeout(t); resolve(v) },
      (e) => { clearTimeout(t); reject(e) },
    )
  })
}

/**
 * Build the default grammar checker: try Harper, fall back to internal rules.
 * The returned object always answers `lint()` with `ok: true` — if Harper is
 * unavailable it transparently substitutes the internal checker so the app
 * never loses grammar coverage nor opens an error boundary.
 */
export function createGrammarChecker({ harperLoader = null } = {}) {
  const internal = new InternalGrammarChecker()
  if (!harperLoader) return internal
  const harper = new HarperGrammarCheckerAdapter({ loadLinter: harperLoader })
  return {
    engine: 'harper+internal',
    engine_version: GRAMMAR_CONTRACT_VERSION,
    async lint(text, options = {}) {
      const res = await harper.lint(text, options)
      if (res.ok) return res
      // GRAMMAR_ENGINE_UNAVAILABLE → conservative internal coverage.
      const fallback = await internal.lint(text, options)
      return { ...fallback, engine: 'internal', degraded_from: 'harper', grammar_engine_code: res.code }
    },
  }
}
