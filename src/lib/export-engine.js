// export-engine.js — compact result YAML + the two tutor prompts.

// Build the compact result block from a finished session.
export function buildResultYaml({ lesson, answers }) {
  const total = answers.length
  const correct = answers.filter((a) => a.verdict === 'correct').length
  const partial = answers.filter((a) => a.verdict === 'partial').length
  const score = total ? Math.round(((correct + partial * 0.5) / total) * 100) : 0

  const mistakes = {}
  for (const a of answers) {
    if (a.verdict === 'correct') continue
    const t = a.mistake_type || 'unknown'
    mistakes[t] = (mistakes[t] || 0) + 1
  }

  const wrong = answers.filter((a) => a.verdict !== 'correct')

  const mistakesBlock = Object.keys(mistakes).length
    ? Object.entries(mistakes).map(([k, v]) => `    ${k}: ${v}`).join('\n')
    : '    none: 0'

  const wrongBlock = wrong.length
    ? wrong.map((a) => [
        `    - q: ${a.question_id}`,
        `      user: ${yamlInline(a.user_answer)}`,
        `      expected: ${yamlInline(a.expected_answer)}`,
        `      mistake: ${a.mistake_type || 'unknown'}`,
      ].join('\n')).join('\n')
    : '    []'

  return `result:
  lesson_id: ${lesson.lesson_id}
  level: ${lesson.level}
  score: ${score}
  total: ${total}
  mistakes:
${mistakesBlock}
  wrong:
${wrongBlock}`
}

// Quote values that would otherwise break the flow scalar.
function yamlInline(s) {
  const v = String(s ?? '')
  if (/[:#\[\]{}"']|^\s|\s$/.test(v)) return JSON.stringify(v)
  return v
}

export function buildNewLessonPrompt({ resultYaml, level, questionCount = 30 }) {
  return `Com base nos resultados abaixo, gere uma nova aula de inglês em YAML compacto com ${questionCount} perguntas.
Meu nível atual é ${level}.
Foque nos meus erros recorrentes.
Use frases naturais de ambiente profissional e conversação real.
Misture exercícios de tradução natural, completar lacuna, montar frase, escolher melhor opção, reescrever frase, ditado (listen_type) e fala (speak_sentence: aluno fala a frase em inglês, use "pt" com a frase em português e "a" com a resposta em inglês).
Use vocabulário útil, chunks e collocations.
Não use explicações longas dentro do YAML.

Resultado anterior:
${resultYaml}`
}

export function buildLevelAnalysisPrompt({ resultYaml }) {
  return `Analise meu desempenho abaixo como tutor de inglês.
Identifique meus erros recorrentes.
Diga se meu nível parece A2, B1 ou B2.
Recomende o foco da próxima aula.
Seja direto e prático.

Resultado:
${resultYaml}`
}

// Convenience for a downloadable file.
export function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
