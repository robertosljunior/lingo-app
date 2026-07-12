// PARTE 11 — proteção contra duplo clique no botão "Gerar aula".
import { test, expect } from '@playwright/test'
import {
  enableTestHooks, seedFixtures, readStore, attachErrorMonitor, GEN_SEED, PROFILE_A,
} from './helpers.js'

test('two rapid clicks produce a single lesson, single loading state and no errors', async ({ page, context }) => {
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context, { seed: GEN_SEED })
  await seedFixtures(page, { active: PROFILE_A })

  await expect(page.getByTestId('generation-card')).toBeVisible()
  // Fire both clicks in the same task so the second lands before any re-render
  // could disable the button — the store-level guard must absorb it.
  await page.getByTestId('generate-lesson').evaluate((btn) => { btn.click(); btn.click() })

  await expect(page.getByTestId('generated-lesson-result')).toBeVisible()
  await expect(page.getByTestId('generate-lesson')).toHaveText('Gerar aula')

  // Give any duplicated background write a chance to land, then assert.
  await page.waitForTimeout(1_000)
  const lessons = (await readStore(page, 'lessons')).filter((l) => l.generated)
  expect(lessons).toHaveLength(1)
  const questions = (await readStore(page, 'questions')).filter((q) => q.generated)
  expect(questions).toHaveLength(30)
  expect(new Set(questions.map((q) => q.key)).size).toBe(30)

  // Single result panel / no duplicated navigation.
  await expect(page.getByTestId('generated-lesson-result')).toHaveCount(1)
  await expect(page.getByTestId('start-generated-lesson')).toHaveCount(1)

  // No unhandled exceptions, IndexedDB errors, duplicate React keys or
  // relevant promise rejections.
  monitor.assertClean()
})
