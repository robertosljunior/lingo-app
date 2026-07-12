// PARTE 8 — geração direcionada a partir do card de skill em "Pontos para revisar".
import { test, expect } from '@playwright/test'
import {
  enableTestHooks, seedFixtures, readLessonWithQuestions, readStore,
  answerCurrentQuestion, goNext, attachErrorMonitor, GEN_SEED, PROFILE_A,
} from './helpers.js'

test('generates a lesson targeted at gerund_after_been and updates only the practiced skills', async ({ page, context }, testInfo) => {
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context, { seed: GEN_SEED })
  await seedFixtures(page, { active: PROFILE_A })

  const fixtureProfiles = await readStore(page, 'skill_profiles')
  const fixtureGerund = fixtureProfiles.find((p) => p.key === `${PROFILE_A}:gerund_after_been`)
  expect(fixtureGerund.attempts).toBe(4)

  // Friendly skill card in Mistakes.
  await page.getByRole('button', { name: 'Erros' }).click()
  const card = page.getByTestId('skill-card-gerund_after_been')
  await expect(card).toBeVisible()
  await expect(card).toContainText('Verbo com -ing depois de have been')
  await card.getByTestId('generate-for-skill-gerund_after_been').click()

  // Generation is targeted and starts the lesson right away.
  await expect(page.getByTestId('question-type')).toBeVisible()
  const lessons = await readStore(page, 'lessons')
  const lesson = lessons.find((l) => l.generated)
  expect(lesson).toBeTruthy()
  expect(lesson.generation_metadata.target_skills[0]).toBe('gerund_after_been')

  // Predominance of the target skill + its parent among primary skill targets.
  const { questions } = await readLessonWithQuestions(page, lesson.lesson_id)
  expect(questions).toHaveLength(30)
  const counts = {}
  for (const q of questions) counts[q.skill_target] = (counts[q.skill_target] || 0) + 1
  const targetFamily = (counts.gerund_after_been || 0) + (counts.present_perfect_continuous || 0)
  const others = Object.entries(counts).filter(([k]) => k !== 'gerund_after_been' && k !== 'present_perfect_continuous')
  for (const [skill, n] of others) expect(targetFamily, `${skill} (${n}) outweighs target family (${targetFamily})`).toBeGreaterThanOrEqual(n)
  expect(targetFamily).toBeGreaterThanOrEqual(6)

  // Answer the first question incorrectly through the UI.
  const q1 = questions[0]
  const wrongText = await answerCurrentQuestion(page, q1, { wrong: true })
  await expect(page.getByTestId('feedback-sheet')).not.toHaveAttribute('data-verdict', 'correct')
  await testInfo.attach('skill-lesson-wrong-answer', { body: await page.screenshot(), contentType: 'image/png' })
  await goNext(page)
  await expect(page.getByText('2/30')).toBeVisible()

  // Persisted attempt + skill events: gerund_after_been updated, missing_auxiliary untouched.
  const answers = (await readStore(page, 'answers')).filter((a) => a.lesson_id === lesson.lesson_id)
  expect(answers).toHaveLength(1)
  expect(answers[0].user_answer).toBe(wrongText)
  expect(answers[0].profile_id).toBe(PROFILE_A)
  expect(answers[0].verdict).not.toBe('correct')

  const events = (await readStore(page, 'skill_events')).filter((e) => e.profile_id === PROFILE_A)
  expect(events.some((e) => e.skill_id === 'gerund_after_been')).toBe(true)
  expect(events.some((e) => e.skill_id === 'missing_auxiliary')).toBe(false)

  const profiles = await readStore(page, 'skill_profiles')
  const gerund = profiles.find((p) => p.key === `${PROFILE_A}:gerund_after_been`)
  expect(gerund.updated_at).toBeGreaterThan(fixtureGerund.updated_at)
  const missingAux = profiles.find((p) => p.key === `${PROFILE_A}:missing_auxiliary`)
  expect(missingAux).toBeUndefined()

  monitor.assertClean()
})
