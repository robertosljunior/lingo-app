// PARTE 5 — geração pela Home + PARTE 16 (tempos reais no browser).
import { test, expect } from '@playwright/test'
import {
  enableTestHooks, seedFixtures, generateFromHome, readLessonWithQuestions,
  attachErrorMonitor, GEN_SEED, PROFILE_A, SEVEN_TYPES,
} from './helpers.js'

test('generates a 30-question adaptive lesson from Home, persists it and survives reload', async ({ page, context }, testInfo) => {
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context, { seed: GEN_SEED })
  await seedFixtures(page, { active: PROFILE_A })

  // Home shows the generation card with level + main target skills.
  await expect(page.getByText('Gerar nova aula adaptativa')).toBeVisible()
  await expect(page.getByTestId('generation-focus')).toContainText('B1')
  await expect(page.getByTestId('generation-focus')).toContainText('Verbo com -ing depois de have been')

  // Select 30 questions and click generate exactly once, watching the
  // transient loading state on a rAF poll (generation is fast).
  await page.getByTestId('gen-count-30').click()
  const sawLoading = page.waitForFunction(
    () => document.querySelector('[data-testid="generate-lesson"]')?.textContent?.includes('Gerando aula'),
    null, { polling: 'raf', timeout: 15_000 },
  )
  const t0 = Date.now()
  await page.getByTestId('generate-lesson').click()
  await sawLoading
  await expect(page.getByTestId('generated-lesson-result')).toBeVisible()
  const generationMs = Date.now() - t0
  await expect(page.getByTestId('generated-lesson-result')).toContainText('30 perguntas')

  await testInfo.attach('home-generated', { body: await page.screenshot(), contentType: 'image/png' })

  // Real IndexedDB: lesson + 30 questions persisted with owner metadata.
  const lessonId = await (async () => {
    const all = await page.evaluate(() => window.__e2e.db.getAllLessons('profile-a'))
    const gen = all.find((l) => l.generated)
    expect(gen).toBeTruthy()
    return gen.lesson_id
  })()
  const { lesson, questions } = await readLessonWithQuestions(page, lessonId)
  expect(lesson).toBeTruthy()
  expect(lesson.level).toBe('B1')
  expect(lesson.generated).toBe(true)
  expect(lesson.owner_profile_id).toBe(PROFILE_A)
  expect(lesson.generation_metadata).toBeTruthy()
  expect(lesson.generation_metadata.seed).toBeTruthy()
  expect(lesson.generation_metadata.requested_questions).toBe(30)
  expect(lesson.generation_metadata.actual_questions).toBe(30)
  expect(lesson.generation_metadata.target_skills).toContain('gerund_after_been')
  // No fatal warnings: every requested slot was generated.
  const fatal = (lesson.generation_metadata.warnings || []).filter((w) => w.code === 'INSUFFICIENT_TEMPLATES_FOR_SKILL')
  expect(fatal).toEqual([])

  expect(questions).toHaveLength(30)
  const ids = new Set(questions.map((q) => q.key))
  expect(ids.size).toBe(30)
  const types = new Set(questions.map((q) => q.type))
  for (const t of SEVEN_TYPES) expect(types.has(t), `missing type ${t}`).toBe(true)
  for (const q of questions) {
    expect(q.owner_profile_id).toBe(PROFILE_A)
    expect(q.generated).toBe(true)
    expect(q.skill_index).toBeTruthy()
    expect(q.skill_index.primary_skill_id).toBeTruthy()
  }

  // Reload: lesson still available in the UI and in IndexedDB.
  const tReload = Date.now()
  await page.reload()
  await page.waitForFunction(() => window.__e2e && window.__e2e.db)
  const reloadMs = Date.now() - tReload
  await expect(page.getByText('Adaptive Workplace English').first()).toBeVisible()
  await expect(page.getByText('30 perguntas').first()).toBeVisible()

  const after = await readLessonWithQuestions(page, lessonId)
  expect(after.lesson).toBeTruthy()
  expect(after.questions).toHaveLength(30)

  // PARTE 16 — real timings through the public storage layer.
  const perf = await page.evaluate(async (lessonId) => {
    const t1 = performance.now()
    const byId = await window.__e2e.db.getLesson(lessonId)
    const openMs = performance.now() - t1
    const t2 = performance.now()
    const list = await window.__e2e.db.getAllLessons('profile-a')
    const listMs = performance.now() - t2
    const t3 = performance.now()
    const plan = await window.__e2e.db.getAdaptivePracticePlan('profile-a', { requestedSize: 10 })
    const planMs = performance.now() - t3
    return { openMs, listMs, planMs, opened: byId.questions.length, listed: list.length, planned: plan.selected_questions.length }
  }, lessonId)

  const report = { generation_and_persist_ms: generationMs, reload_ms: reloadMs, ...perf }
  console.log(`[perf] ${JSON.stringify(report)}`)
  await testInfo.attach('performance', { body: JSON.stringify(report, null, 2), contentType: 'application/json' })
  // Generous CI-safe bounds; real numbers land in the attachment.
  expect(generationMs).toBeLessThan(15_000)
  expect(perf.openMs).toBeLessThan(1_500)
  expect(perf.listMs).toBeLessThan(1_500)
  expect(perf.planMs).toBeLessThan(5_000)
  expect(perf.opened).toBe(30)

  monitor.assertClean()
})
