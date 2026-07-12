// PARTE 10 — IDs e idempotência de geração no IndexedDB real.
import { test, expect } from '@playwright/test'
import {
  enableTestHooks, seedFixtures, generateFromHome, readLessonWithQuestions,
  readStore, switchProfileViaUi, attachErrorMonitor, GEN_SEED, PROFILE_A, PROFILE_B,
} from './helpers.js'

test('same profile+seed is idempotent, different profiles/seeds never collide', async ({ page, context }) => {
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context, { seed: GEN_SEED })
  await seedFixtures(page, { active: PROFILE_A })

  // Same profile, same seed and context → same lesson_id, single persisted copy.
  const first = await generateFromHome(page, { count: 30 })
  const second = await generateFromHome(page, { count: 30 })
  expect(second).toBe(first)
  const lessonsA = (await readStore(page, 'lessons')).filter((l) => l.generated)
  expect(lessonsA).toHaveLength(1)
  expect(lessonsA[0].owner_profile_id).toBe(PROFILE_A)
  const { questions } = await readLessonWithQuestions(page, first)
  expect(questions).toHaveLength(30)
  expect(new Set(questions.map((q) => q.key)).size).toBe(30)
  expect(lessonsA[0].generation_metadata.seed).toBe(GEN_SEED)

  // Different profile, same seed and context → different id, both persisted.
  await switchProfileViaUi(page, 'Perfil B')
  const forB = await generateFromHome(page, { count: 30 })
  expect(forB).not.toBe(first)
  let all = (await readStore(page, 'lessons')).filter((l) => l.generated)
  expect(all).toHaveLength(2)
  const byId = Object.fromEntries(all.map((l) => [l.lesson_id, l]))
  expect(byId[first].owner_profile_id).toBe(PROFILE_A)
  expect(byId[forB].owner_profile_id).toBe(PROFILE_B)
  // A's copy was not overwritten.
  const aAfter = await readLessonWithQuestions(page, first)
  expect(aAfter.lesson.owner_profile_id).toBe(PROFILE_A)
  expect(aAfter.questions).toHaveLength(30)

  // Different seed → different id, both persisted.
  await page.evaluate(() => sessionStorage.setItem('e2e:generation-seed', 'e2e-generated-lesson-002'))
  const otherSeed = await generateFromHome(page, { count: 30 })
  expect(otherSeed).not.toBe(forB)
  expect(otherSeed).not.toBe(first)
  all = (await readStore(page, 'lessons')).filter((l) => l.generated)
  expect(all).toHaveLength(3)
  const totalQuestions = (await readStore(page, 'questions')).filter((q) => q.generated)
  expect(totalQuestions).toHaveLength(90)

  monitor.assertClean()
})
