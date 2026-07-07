// lesson-generator.js — turn a chat capability into a validated lesson.
//
// Pure orchestration + parsing so it can be unit-tested with a fake `chat`
// capability (no model required). The heavy lifting is: a strict, closed
// system prompt with a complete worked example of the exact output format,
// extracting the YAML block from the model's reply, and validating it through
// the existing lesson-parser.

import { validateLesson } from '../lib/lesson-parser.js'

// A full example lesson in the exact desired format. Small on-device models
// follow a worked example far more reliably than a field-by-field spec, and it
// doubles as the single source of truth for the format.
const FORMAT_EXAMPLE = `\`\`\`yaml
lesson_id: eng_007
level: B1
focus: jobs_companies
q:
  - id: 1
    t: translate_natural
    pt: Eles têm vagas abertas?
    ctx: Você está conversando com um recrutador sobre uma vaga.
    p: Diga isso naturalmente em inglês.
    a: Do they have any open positions?
    alt: [Are they hiring?, Do they have any openings?]
    f: question_structure
  - id: 2
    t: build_sentence
    pt: Eu trabalharia lá com certeza.
    p: Monte uma frase natural.
    words: [I, would, work, there, for sure]
    a: I would work there for sure.
    f: word_order
  - id: 3
    t: rewrite_natural
    p: Reescreva de forma natural.
    original: I am working in this company since two years.
    a: I've been working at this company for two years.
    alt: [I have been working at this company for two years.]
    f: unnatural_translation
  - id: 4
    t: fill_blank
    p: This seems ___ a great company.
    opt: [like, as, with]
    a: like
    f: collocation
  - id: 5
    t: choose_best
    p: Choose the most natural way to ask about the salary.
    opt: [What is the salary?, Could you tell me the salary range?, How much money?]
    a: Could you tell me the salary range?
    f: question_structure
  - id: 6
    t: listen_type
    pt: Há quanto tempo você trabalha lá?
    p: Ouça a frase e digite exatamente o que ouvir.
    a: How long have you worked there?
    f: verb_tense
\`\`\``

export const LESSON_SYSTEM_PROMPT = `Você é um gerador de aulas de inglês para um app de treino. Você NÃO conversa: sua única função é produzir UMA aula em YAML.

Responda SEMPRE e SOMENTE com um bloco de código YAML no formato EXATO do exemplo abaixo — mesma cerca de código, mesmos nomes de campo, mesma estrutura. Nada antes nem depois do bloco.

Exemplo do formato:
${FORMAT_EXAMPLE}

Regras obrigatórias:
- TODAS as perguntas devem se passar dentro do tema/foco pedido pelo usuário. Não fuja do escopo.
- ids sequenciais a partir de 1. Misture os tipos: translate_natural, build_sentence, rewrite_natural, fill_blank, choose_best, listen_type.
- Campos por tipo: translate_natural usa pt (e ctx opcional); build_sentence usa pt + words; rewrite_natural usa original; fill_blank e choose_best usam opt com EXATAMENTE 3 opções curtas; listen_type usa pt e "a" é a frase que o app fala em voz alta.
- f é o tipo de erro treinado, um de: question_structure, preposition, word_order, verb_tense, collocation, article, unnatural_translation, vocabulary, missing_auxiliary.
- Conteúdo de estudo em inglês natural (chunks, collocations, conversação profissional real); instruções (p) e frases pt em português.
- Sem comentários, sem explicações, sem texto fora do bloco YAML.`

// Assign one exercise type per question. Small models "mix the types" poorly
// on their own (they repeat translate_natural); an explicit plan fixes that
// and big models follow it trivially.
const TYPE_CYCLE = ['translate_natural', 'fill_blank', 'choose_best', 'build_sentence', 'rewrite_natural', 'listen_type']
function typePlan(count) {
  return Array.from({ length: count }, (_, i) => `${i + 1}=${TYPE_CYCLE[i % TYPE_CYCLE.length]}`).join(', ')
}

export function buildLessonUserPrompt({ focus = 'professional_conversation', level = 'B1', count = 8, weaknesses = [] } = {}) {
  const weak = weaknesses.length
    ? `\nPriorize exercícios que treinem estes erros recorrentes do aluno (use-os no campo f): ${weaknesses.join(', ')}.`
    : ''
  return `Gere UMA aula em YAML no formato exato do exemplo.
Tema/foco: ${focus} — todas as ${count} perguntas devem acontecer nesse contexto.
Nível: ${level}. Perguntas: ${count} (ids 1 a ${count}).
Tipo de cada pergunta: ${typePlan(count)}.${weak}
Responda somente com o bloco \`\`\`yaml.`
}

// Closed prompt for "generate from my results": the model sees the compact
// result YAML of the finished session and builds the next lesson around what
// the student actually got wrong.
export function buildResultsLessonPrompt({ resultYaml, level = 'B1', count = 8 } = {}) {
  return `Gere UMA aula em YAML no formato exato do exemplo, como PRÓXIMA aula deste aluno.
Baseie-se no resultado abaixo: priorize os tipos de erro mais frequentes (campo mistakes) e refaça variações das frases erradas (campo wrong), sem repeti-las literalmente.
Nível: ${level}. Perguntas: ${count} (ids 1 a ${count}).
Tipo de cada pergunta: ${typePlan(count)}.
Responda somente com o bloco \`\`\`yaml.

Resultado da última aula:
${resultYaml}`
}

// Small models sometimes emit scalar values containing ':' or '#'
// (e.g. `a: Ask: what's next?`), which breaks YAML mapping parsing. Quote the
// unquoted scalar values of known text fields; leave flow arrays and
// already-quoted values alone.
export function sanitizeLessonYaml(text) {
  return String(text || '').split('\n').map((line) => {
    // Unterminated flow lists: a runaway generation ("words: [a, b, c, …" cut
    // by the token budget) leaves the bracket open and kills the whole parse.
    // Close it, dropping the trailing partial item; the quality filter later
    // drops the question if the list is degenerate.
    const flow = line.match(/^(\s*)(words|opt|alt):\s*\[([^\]]*)$/)
    if (flow) {
      const [, indent, key, rest] = flow
      const items = rest.split(',').map((s) => s.trim()).filter(Boolean)
      items.pop() // last item was likely cut mid-word
      return `${indent}${key}: [${items.join(', ')}]`
    }
    const m = line.match(/^(\s*(?:-\s+)?)(pt|ctx|p|a|original|f|t|level|focus|lesson_id):\s*(.*)$/)
    if (!m) return line
    const [, head, key, rawVal] = m
    const val = rawVal.trim()
    if (!val || /^["'[|>]/.test(val)) return line
    if (/:\s|:$|#|"/.test(val)) return `${head}${key}: ${JSON.stringify(val)}`
    return line
  }).join('\n')
}

// Drop questions that are structurally valid but degenerate — runaway flow
// lists and duplicates are the classic small-model artifacts — and renumber.
// A lesson with a few solid questions beats a hard failure.
export function filterLessonQuestions(lesson, requested = 8) {
  const seen = new Set()
  const questions = lesson.questions
    .filter((q) => {
      if (q.words && (q.words.length > 10 || q.words.length < 2)) return false
      if (q.options && (q.options.length > 6 || q.options.length < 2)) return false
      const sig = `${q.type}|${(q.prompt_pt || q.original || q.prompt || '').toLowerCase()}`
      if (seen.has(sig)) return false
      seen.add(sig)
      return true
    })
    .slice(0, requested)
    .map((q, i) => ({ ...q, id: i + 1 }))
  return { ...lesson, questions }
}

// Pull the first fenced code block (```yaml … ``` or ``` … ```), else fall back
// to the substring starting at the first `lesson_id:`.
export function extractYaml(text) {
  if (!text) return ''
  const fence = text.match(/```(?:ya?ml)?\s*([\s\S]*?)```/i)
  if (fence) return fence[1].trim()
  const idx = text.indexOf('lesson_id:')
  if (idx >= 0) return text.slice(idx).trim()
  return text.trim()
}

// Generate + validate. `chat` is a capability from the engine (or a fake in
// tests). Retries once with a stricter nudge if the first attempt doesn't
// parse. Pass either `resultYaml` (next-lesson-from-results mode) or
// focus/weaknesses (topic mode).
export async function generateLesson({ chat, focus, level, count, weaknesses = [], resultYaml = null, onToken, onRetry } = {}) {
  const userPrompt = resultYaml
    ? buildResultsLessonPrompt({ resultYaml, level, count })
    : buildLessonUserPrompt({ focus, level, count, weaknesses })
  const messages = [
    { role: 'system', content: LESSON_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ]

  // Token budget scaled to the lesson size — a fixed high cap can push
  // prompt + generation past the model's context window and get the request
  // rejected outright.
  const maxTokens = Math.min(1400, 150 + (count || 8) * 110)

  const runOnce = async (msgs) => {
    let acc = ''
    // Repetition penalties stop small models from spiralling inside opt/alt
    // flow lists ("[will have been to, will have been to, …") until the token
    // budget burns out.
    for await (const t of chat.stream(msgs, { temperature: 0.5, max_tokens: maxTokens, frequency_penalty: 0.4, repetition_penalty: 1.15 })) {
      acc += t
      onToken?.(acc)
    }
    return acc
  }

  // Parse → repair → quality-filter. Accepts a shorter lesson when only some
  // questions survive; below 3 usable questions counts as a failure.
  const attempt = (text) => {
    const v = validateLesson(sanitizeLessonYaml(extractYaml(text)), { lenient: true })
    if (!v.ok) return v
    const lesson = filterLessonQuestions(v.lesson, count || 8)
    if (lesson.questions.length < Math.min(3, count || 8)) {
      return { ok: false, error: 'quase todas as perguntas vieram malformadas' }
    }
    return { ok: true, lesson }
  }

  let raw = await runOnce(messages)
  let v = attempt(raw)
  if (v.ok) return { ok: true, lesson: v.lesson, raw }

  // Retry with the parser error fed back in.
  onRetry?.(v.error)
  const retryMsgs = [
    ...messages,
    { role: 'assistant', content: raw },
    { role: 'user', content: `O YAML anterior falhou na validação: ${v.error}. Reescreva a aula inteira em um único bloco \`\`\`yaml seguindo exatamente o formato do exemplo. Só o bloco YAML.` },
  ]
  raw = await runOnce(retryMsgs)
  v = attempt(raw)
  if (v.ok) return { ok: true, lesson: v.lesson, raw }
  return { ok: false, error: v.error, raw }
}

// System prompt for the tutoring chat. Deliberately narrow: the chat exists to
// practice English, not as a general assistant — small on-device models drift
// into unreliable territory on open-ended questions.
export const TUTOR_SYSTEM_PROMPT = `Você é um tutor de inglês dentro de um app mobile de treino, e esse é seu ÚNICO papel.
Você SÓ responde sobre aprender inglês: dúvidas de gramática e vocabulário, correção de frases, como dizer algo em inglês, pronúncia, exemplos e mini-exercícios.
Se o aluno pedir qualquer outra coisa (notícias, opiniões, matemática, temas gerais), recuse em uma frase gentil e puxe de volta para o treino de inglês.
Se o aluno pedir uma aula completa, NÃO gere: diga para tocar no botão ✦ (Criar aula) aqui do chat.
Fale com o aluno em português; mantenha o conteúdo de estudo em inglês. O aluno é nível B1, foco em inglês profissional. Seja conciso, como num chat.`
