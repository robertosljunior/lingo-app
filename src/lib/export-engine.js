// export-engine.js — compact result YAML + the two tutor prompts.

import { summarizeLearningProfile } from './skill-profile.js'

// Build the compact result block from a finished session.
export function buildResultYaml({ lesson, answers, skillProfiles = [] }) {
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

  const profileBlock = buildLearningProfileBlock(skillProfiles)

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
${wrongBlock}
  learning_profile:
${profileBlock}`
}


function buildLearningProfileBlock(skillProfiles) {
  if (!skillProfiles?.length) return '    needs_review: []\n    strengths: []'
  const summary = summarizeLearningProfile(skillProfiles)
  const needs = summary.needs_review.slice(0, 8)
  const strengths = summary.strengths.slice(0, 5)
  const needsBlock = needs.length ? needs.map((p) => [
    `      - skill: ${p.skill_id}`,
    `        mastery: ${Number(p.mastery || 0).toFixed(2)}`,
    `        evidence: ${p.evidence_level}`,
    `        attempts: ${p.attempts}`,
    `        errors: ${(p.incorrect || 0) + (p.partial || 0)}`,
    `        trend: ${p.trend}`,
    p.recent_examples?.[0]?.actual ? `        last_error: ${yamlInline(p.recent_examples[0].actual)}` : null,
    p.recent_examples?.[0]?.expected ? `        expected: ${yamlInline(p.recent_examples[0].expected)}` : null,
  ].filter(Boolean).join('\n')).join('\n') : '      []'
  const strengthsBlock = strengths.length ? strengths.map((p) => [
    `      - skill: ${p.skill_id}`,
    `        mastery: ${Number(p.mastery || 0).toFixed(2)}`,
    `        evidence: ${p.evidence_level}`,
    `        attempts: ${p.attempts}`,
    `        correct: ${p.correct}`,
  ].join('\n')).join('\n') : '      []'
  return `    needs_review:\n${needsBlock}\n    strengths:\n${strengthsBlock}`
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
