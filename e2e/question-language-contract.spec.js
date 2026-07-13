// SLICE 7.4 PART 8 — question language contract in the live UI. Writing and
// translation exercises must show Portuguese instructions and must never expose
// the English answer (or the dictation transcript) before the learner submits.
import { test, expect } from '@playwright/test'
import {
  enableTestHooks, seedFixtures, generateFromHome, readLessonWithQuestions,
  answerCurrentQuestion, goNext, attachErrorMonitor, PROFILE_A,
} from './helpers.js'
import { questionLanguageContract, questionLanguageIssues } from '../src/lib/generated-lesson-contracts.js'

const HIDE = new Set(['translate_natural', 'speak_sentence', 'listen_type'])

test('writing/translation/listen never leak the answer before submission', async ({ page, context }) => {
  test.setTimeout(120_000)
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })

  const lessonId = await generateFromHome(page, { count: 30 })
  const { questions } = await readLessonWithQuestions(page, lessonId)
  await page.getByTestId('start-generated-lesson').click()
  await expect(page.getByTestId('question-type')).toBeVisible()

  const seen = new Set()
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    seen.add(q.type)

    // The persisted question satisfies the language contract.
    expect(questionLanguageIssues(q), `${q.type} contract`).toEqual([])
    const contract = questionLanguageContract(q)
    expect(contract.instruction_pt.length).toBeGreaterThan(0)

    // Before answering, the visible exercise area must not contain the English
    // answer/transcript for hide-answer types.
    const visible = (await page.locator('.screen-body').innerText()).toLowerCase()
    if (HIDE.has(q.type)) {
      const answer = String(q.expected_answer || '').toLowerCase().replace(/[.?!]$/, '')
      expect(visible.includes(answer), `${q.type} q${q.id} leaked the answer before submit`).toBe(false)
    }

    await answerCurrentQuestion(page, q)
    await goNext(page)
  }
  // We actually exercised the leak-prone types.
  for (const t of ['translate_natural', 'speak_sentence', 'listen_type']) expect(seen.has(t)).toBe(true)

  monitor.assertClean()
})
