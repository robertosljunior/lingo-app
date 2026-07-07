import { describe, it, expect, vi } from 'vitest'
import {
  LESSON_SYSTEM_PROMPT,
  buildLessonUserPrompt,
  buildResultsLessonPrompt,
  extractYaml,
  sanitizeLessonYaml,
  generateLesson,
} from './lesson-generator.js'
import { validateLesson } from '../lib/lesson-parser.js'

// A fake chat capability that streams a fixed reply per call.
function fakeChat(...replies) {
  let call = 0
  return {
    async *stream() {
      const text = replies[Math.min(call++, replies.length - 1)]
      // stream in a few chunks to exercise onToken accumulation
      const step = Math.ceil(text.length / 4)
      for (let i = 0; i < text.length; i += step) yield text.slice(i, i + step)
    },
  }
}

describe('lesson-generator prompt format', () => {
  it('the worked example inside the system prompt is itself a valid lesson', () => {
    // If the model copies the example structure verbatim, validation must pass.
    const yamlText = extractYaml(LESSON_SYSTEM_PROMPT)
    const v = validateLesson(yamlText)
    expect(v.ok).toBe(true)
    expect(v.lesson.lesson_id).toBe('eng_007')
    expect(v.lesson.questions).toHaveLength(6)
    expect(new Set(v.lesson.questions.map((q) => q.type)).size).toBe(6) // all six types covered
  })

  it('topic prompt pins scope, level, count and a type per question', () => {
    const p = buildLessonUserPrompt({ focus: 'reuniao_de_resultados', level: 'B1', count: 8 })
    expect(p).toContain('reuniao_de_resultados')
    expect(p).toContain('todas as 8 perguntas')
    expect(p).toContain('Nível: B1')
    expect(p).toContain('ids 1 a 8')
    expect(p).toContain('1=translate_natural')
    expect(p).toContain('8=fill_blank') // cycle wraps after the 6 types
  })

  it('sanitizer quotes scalar values that would break YAML', () => {
    const dirty = [
      'q:',
      '  - id: 1',
      '    t: translate_natural',
      '    pt: Pergunta: como assim?',
      '    p: Diga isso.',
      '    a: "Already quoted: fine"',
      '    alt: [Keep, flow arrays]',
    ].join('\n')
    const clean = sanitizeLessonYaml(dirty)
    expect(clean).toContain('    pt: "Pergunta: como assim?"')
    expect(clean).toContain('    p: Diga isso.')            // untouched
    expect(clean).toContain('    a: "Already quoted: fine"') // untouched
    expect(clean).toContain('    alt: [Keep, flow arrays]')  // untouched
  })

  it('results prompt embeds the result YAML', () => {
    const p = buildResultsLessonPrompt({ resultYaml: 'result:\n  score: 55', level: 'B1', count: 10 })
    expect(p).toContain('score: 55')
    expect(p).toContain('Perguntas: 10')
  })
})

describe('generateLesson', () => {
  const validReply = 'Claro!\n' + extractYaml(LESSON_SYSTEM_PROMPT).replace(/^/, '```yaml\n') + '\n```'

  it('parses a valid streamed lesson', async () => {
    const onToken = vi.fn()
    const res = await generateLesson({ chat: fakeChat(validReply), focus: 'jobs', level: 'B1', count: 6, onToken })
    expect(res.ok).toBe(true)
    expect(res.lesson.questions).toHaveLength(6)
    expect(onToken).toHaveBeenCalled()
  })

  it('retries once with the parser error and succeeds', async () => {
    const onRetry = vi.fn()
    const res = await generateLesson({
      chat: fakeChat('desculpe, aqui vai:\nnothing useful', validReply),
      focus: 'jobs', level: 'B1', count: 6, onRetry,
    })
    expect(res.ok).toBe(true)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('reports failure when both attempts are invalid', async () => {
    const res = await generateLesson({ chat: fakeChat('garbage', 'more garbage'), count: 6 })
    expect(res.ok).toBe(false)
    expect(res.error).toBeTruthy()
  })
})
