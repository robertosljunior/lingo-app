// SLICE 7.4 PART 6 — Training Hub lessons must open for all 24 theme/level
// combinations. Each combo is an independent test (fresh page) that drives the
// real Hub UI: open theme → pick level → generate → first question valid (non
// empty instruction, answer not exposed) → submit works → Próxima works →
// Result opens. No fatal screen, no empty lesson.
import { test, expect } from '@playwright/test'
import {
  enableTestHooks, seedFixtures, readStore, readLessonWithQuestions,
  answerCurrentQuestion, goNext, attachErrorMonitor, PROFILE_A,
} from './helpers.js'
import { questionLanguageIssues } from '../src/lib/generated-lesson-contracts.js'

const THEMES = ['daily_life', 'workplace', 'travel', 'food_and_restaurants', 'shopping_and_services', 'technology_and_communication']
const LEVELS = ['A1', 'A2', 'B1', 'B2']

async function openHub(page) {
  await page.getByTestId('open-training-hub').click()
  await expect(page.getByRole('heading', { name: 'Escolha o que treinar' })).toBeVisible()
}

async function latestGeneratedQuestions(page) {
  const lessons = (await readStore(page, 'lessons')).filter((l) => l.generated)
  lessons.sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
  return readLessonWithQuestions(page, lessons[0].lesson_id)
}

for (const theme of THEMES) {
  for (const level of LEVELS) {
    test(`Hub lesson opens and completes for ${theme} / ${level}`, async ({ page, context }) => {
      test.setTimeout(90_000)
      const monitor = attachErrorMonitor(page)
      await enableTestHooks(context)
      await seedFixtures(page, { active: PROFILE_A })

      await openHub(page)
      await page.getByTestId(`theme-${theme}`).click()
      const levelCard = page.getByTestId(`level-${level}`)
      await expect(levelCard).toBeVisible()
      await levelCard.getByRole('button', { name: 'Prática rápida' }).click()

      // The lesson opened (no fatal screen, no empty lesson).
      await expect(page.getByTestId('question-type')).toBeVisible({ timeout: 30_000 })

      const { lesson, questions } = await latestGeneratedQuestions(page)
      expect(questions.length).toBeGreaterThan(0)
      expect(lesson.generation_metadata?.pedagogical_justification, 'justification persisted').toBeTruthy()

      // First question: valid instruction, no answer/transcript leak.
      const first = questions[0]
      expect(questionLanguageIssues(first), `language contract ${first.type}`).toEqual([])
      const instruction = (first.prompt_pt || first.prompt || '').trim()
      expect(instruction.length, 'instruction not empty').toBeGreaterThan(0)

      // Run the whole lesson through the UI: submit + Próxima both work.
      for (let i = 0; i < questions.length; i++) {
        await expect(page.getByTestId('question-type')).toBeVisible()
        await answerCurrentQuestion(page, questions[i])
        await goNext(page)
      }

      // Result opens.
      await expect(page.getByText('Resultado')).toBeVisible({ timeout: 15_000 })
      await expect(page.getByTestId('result-score')).toBeVisible()
      await expect(page.getByTestId('lesson-justification')).toBeVisible()

      monitor.assertClean()
    })
  }
}
