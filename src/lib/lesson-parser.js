// lesson-parser.js — reads the compact lesson format (YAML or JSON) and
// normalizes it into the shape the rest of the app stores and runs.
//
// Compact source example:
//   lesson_id: eng_001
//   level: B1
//   focus: jobs_companies
//   q:
//     - id: 1
//       t: translate_natural
//       pt: Eles têm vagas abertas?
//       p: Say this naturally in English.
//       a: Do they have any open positions?
//       alt: [Are they hiring?, Do they have any openings?]
//       f: question_structure

import yaml from 'js-yaml'

export const EXERCISE_TYPES = [
  'fill_blank',
  'translate_natural',
  'build_sentence',
  'choose_best',
  'rewrite_natural',
  'answer_question',
  'listen_type', // dictation: TTS speaks the answer, the student types it
]

export class LessonParseError extends Error {
  constructor(message, { line } = {}) {
    super(message)
    this.name = 'LessonParseError'
    this.line = line ?? null
  }
}

// Accepts either JSON or the compact YAML. Tries JSON first only when it clearly
// looks like JSON, otherwise YAML — js-yaml also parses valid JSON.
function rawParse(text) {
  const trimmed = (text || '').trim()
  if (!trimmed) throw new LessonParseError('A aula está vazia. Cole o YAML ou JSON gerado pelo seu tutor.')
  try {
    return yaml.load(trimmed, { schema: yaml.JSON_SCHEMA })
  } catch (e) {
    // js-yaml exposes mark.line (0-based) on YAMLException
    const line = e && e.mark && typeof e.mark.line === 'number' ? e.mark.line + 1 : null
    const reason = (e && e.reason) || (e && e.message) || 'formato inválido'
    throw new LessonParseError(
      line ? `Erro no YAML na linha ${line}: ${reason}` : `Erro ao ler o YAML: ${reason}`,
      { line },
    )
  }
}

// Map compact per-question keys to the stored schema.
function normalizeQuestion(raw, index) {
  const where = `pergunta ${index + 1}`
  if (!raw || typeof raw !== 'object') {
    throw new LessonParseError(`A ${where} está malformada.`)
  }
  const type = raw.t || raw.type
  if (!type) throw new LessonParseError(`A ${where} não tem tipo (t).`)
  if (!EXERCISE_TYPES.includes(type)) {
    throw new LessonParseError(`Tipo desconhecido "${type}" na ${where}. Use um de: ${EXERCISE_TYPES.join(', ')}.`)
  }

  const expected = raw.a ?? raw.answer ?? raw.expected_answer ?? ''
  const accepted = raw.alt ?? raw.accepted ?? raw.accepted_answers ?? []
  const options = raw.opt ?? raw.options ?? null
  const words = raw.words ?? null

  // Every type except build_sentence needs an expected answer to grade against.
  if (type !== 'build_sentence' && (expected === '' || expected == null)) {
    throw new LessonParseError(`A ${where} (${type}) não tem resposta esperada (a).`)
  }
  if (type === 'build_sentence' && !Array.isArray(words)) {
    throw new LessonParseError(`A ${where} (build_sentence) precisa de "words".`)
  }
  if (type === 'choose_best' && !Array.isArray(options)) {
    throw new LessonParseError(`A ${where} (choose_best) precisa de "opt".`)
  }
  if (type === 'fill_blank' && !Array.isArray(options)) {
    throw new LessonParseError(`A ${where} (fill_blank) precisa de "opt".`)
  }

  const derivedExpected = type === 'build_sentence' && (expected === '' || expected == null)
    ? words.join(' ')
    : expected

  return {
    id: raw.id ?? index + 1,
    type,
    prompt: raw.p ?? raw.prompt ?? '',
    prompt_pt: raw.pt ?? raw.pt_prompt ?? null, // portuguese sentence to translate/build
    context: raw.ctx ?? raw.context ?? null,
    original: raw.original ?? null, // for rewrite_natural
    expected_answer: String(derivedExpected),
    accepted_answers: (Array.isArray(accepted) ? accepted : [accepted]).filter(Boolean).map(String),
    options: options ? options.map(String) : null,
    words: words ? words.map(String) : null,
    mistake_focus: raw.f ?? raw.focus ?? raw.mistake_focus ?? null,
    // keep the untouched source for round-trip / debugging
    payload: raw,
  }
}

// Public: parse compact text into a validated, normalized lesson object.
export function parseLesson(text) {
  const doc = rawParse(text)
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new LessonParseError('Estrutura inválida: esperado um objeto com lesson_id e q.')
  }
  if (!doc.lesson_id) throw new LessonParseError('Campo obrigatório ausente: lesson_id.')
  const qs = doc.q ?? doc.questions
  if (!Array.isArray(qs) || qs.length === 0) {
    throw new LessonParseError('A aula não tem perguntas (q).')
  }

  const questions = qs.map((raw, i) => normalizeQuestion(raw, i))

  return {
    lesson_id: String(doc.lesson_id),
    title: doc.title || prettyFocus(doc.focus) || String(doc.lesson_id),
    level: doc.level || 'B1',
    focus: doc.focus || 'general',
    raw_content: text,
    created_at: null, // set on save
    questions,
  }
}

// Lightweight validate that returns a result object instead of throwing —
// used by the Import screen's "Validar" button.
export function validateLesson(text) {
  try {
    const lesson = parseLesson(text)
    return {
      ok: true,
      lesson,
      summary: {
        count: lesson.questions.length,
        level: lesson.level,
        focus: lesson.focus,
        types: [...new Set(lesson.questions.map((q) => q.type))],
      },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof LessonParseError ? e.message : `Erro inesperado: ${e.message}`,
      line: e.line ?? null,
    }
  }
}

export function prettyFocus(focus) {
  if (!focus) return ''
  return String(focus).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
