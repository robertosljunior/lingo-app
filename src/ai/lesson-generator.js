// lesson-generator.js — turn a chat capability into a validated lesson.
//
// Pure orchestration + parsing so it can be unit-tested with a fake `chat`
// capability (no model required). The heavy lifting is: a strict system prompt
// describing the compact schema, extracting the YAML block from the model's
// reply, and validating it through the existing lesson-parser.

import { validateLesson } from '../lib/lesson-parser.js'

export const LESSON_SYSTEM_PROMPT = `Você é um gerador de aulas de inglês para um app de treino.
Você SEMPRE responde com UMA aula em YAML compacto, dentro de um bloco \`\`\`yaml … \`\`\`, e nada mais fora do bloco.

Formato EXATO (siga os nomes de campo):
\`\`\`yaml
lesson_id: eng_<numero>
level: <A2|B1|B2>
focus: <tema_em_snake_case>
q:
  - id: 1
    t: translate_natural        # ou build_sentence, rewrite_natural, fill_blank, choose_best
    pt: <frase em português para traduzir>     # translate_natural / build_sentence
    ctx: <contexto curto opcional>
    p: <instrução curta em português>
    a: <resposta esperada em inglês>
    alt: [<alternativa natural>, <outra>]      # opcional
    words: [w1, w2, w3]         # apenas build_sentence
    opt: [op1, op2, op3]        # apenas fill_blank / choose_best
    f: <tipo_de_erro>           # question_structure, preposition, word_order, verb_tense, collocation, article, unnatural_translation, vocabulary, missing_auxiliary
\`\`\`
Regras:
- Inglês profissional e conversação real. Frases naturais, chunks e collocations.
- Misture os tipos de exercício.
- O conteúdo de estudo é em inglês; instruções (p) em português.
- NÃO escreva explicações fora do bloco YAML.`

export function buildLessonUserPrompt({ focus = 'professional_conversation', level = 'B1', count = 8, weaknesses = [] } = {}) {
  const weak = weaknesses.length
    ? `\nFoque nos meus erros recorrentes: ${weaknesses.join(', ')}.`
    : ''
  return `Gere uma aula com ${count} perguntas.
Nível: ${level}.
Tema/foco: ${focus}.${weak}
Responda apenas com o bloco YAML.`
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
// tests). Retries once with a stricter nudge if the first attempt doesn't parse.
export async function generateLesson({ chat, focus, level, count, weaknesses = [], onToken } = {}) {
  const messages = [
    { role: 'system', content: LESSON_SYSTEM_PROMPT },
    { role: 'user', content: buildLessonUserPrompt({ focus, level, count, weaknesses }) },
  ]

  const runOnce = async (msgs) => {
    let acc = ''
    for await (const t of chat.stream(msgs, { temperature: 0.5, max_tokens: 1400 })) {
      acc += t
      onToken?.(acc)
    }
    return acc
  }

  let raw = await runOnce(messages)
  let v = validateLesson(extractYaml(raw))
  if (v.ok) return { ok: true, lesson: v.lesson, raw }

  // Retry with the parser error fed back in.
  const retryMsgs = [
    ...messages,
    { role: 'assistant', content: raw },
    { role: 'user', content: `O YAML anterior falhou na validação: ${v.error}. Reescreva a aula inteira em um único bloco \`\`\`yaml seguindo exatamente o formato. Só o bloco YAML.` },
  ]
  raw = await runOnce(retryMsgs)
  v = validateLesson(extractYaml(raw))
  if (v.ok) return { ok: true, lesson: v.lesson, raw }
  return { ok: false, error: v.error, raw }
}

// System prompt for free-form tutoring chat (distinct from lesson generation).
export const TUTOR_SYSTEM_PROMPT = `Você é um tutor de inglês simpático e direto, dentro de um app mobile de treino.
Fale com o aluno em português (chrome/conversa), mas mantenha o conteúdo de estudo em inglês.
O aluno é nível B1, foco em inglês profissional e conversação real; dificuldade em formar frases naturais sem traduzir do português.
Seja conciso (respostas curtas, como num chat). Corrija com gentileza e dê exemplos naturais.
Se o aluno pedir uma aula/exercícios, gere a aula em um bloco \`\`\`yaml no formato compacto do app (campos: lesson_id, level, focus, q com id, t, pt, p, a, alt, words, opt, f) e explique em uma linha antes do bloco.`
