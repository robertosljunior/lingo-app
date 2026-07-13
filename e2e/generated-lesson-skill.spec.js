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

  // Answer the first deterministically-graded question incorrectly through the
  // UI (free-production/translation types are graded leniently by design and
  // are not asserted to fail on a wrong answer). Earlier questions are answered
  // correctly so the wrong one is isolated.
  // Types the helper can answer definitively wrong (build_sentence always places
  // words in order, so it is excluded).
  const DETERMINISTIC = new Set(['fill_blank', 'choose_best', 'listen_type'])
  const GERUND_FAMILY = new Set(['gerund_after_been', 'present_perfect_continuous'])
  const wrongIdx = questions.findIndex((q) => DETERMINISTIC.has(q.type) && GERUND_FAMILY.has(q.skill_target))
  expect(wrongIdx, 'a deterministically-graded gerund-family question exists').toBeGreaterThanOrEqual(0)
  for (let i = 0; i < wrongIdx; i++) { await answerCurrentQuestion(page, questions[i]); await goNext(page) }
  const wrongText = await answerCurrentQuestion(page, questions[wrongIdx], { wrong: true })
  await expect(page.getByTestId('feedback-sheet')).not.toHaveAttribute('data-verdict', 'correct')
  await testInfo.attach('skill-lesson-wrong-answer', { body: await page.screenshot(), contentType: 'image/png' })
  await goNext(page)
  await expect(page.getByText(`${wrongIdx + 2}/30`)).toBeVisible()

  // Persisted attempts: the wrong one is recorded not-correct for this profile.
  const answers = (await readStore(page, 'answers')).filter((a) => a.lesson_id === lesson.lesson_id)
  expect(answers).toHaveLength(wrongIdx + 1)
  const wrongAnswer = answers.find((a) => a.user_answer === wrongText)
  expect(wrongAnswer).toBeTruthy()
  expect(wrongAnswer.profile_id).toBe(PROFILE_A)
  expect(wrongAnswer.verdict).not.toBe('correct')

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
