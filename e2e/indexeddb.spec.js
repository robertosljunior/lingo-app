// PARTE 13 — IndexedDB real no navegador: schema, persistência após reopen
// real do browser e upgrade de versão.
import { test, expect, chromium } from '@playwright/test'
import {
  enableTestHooks, seedFixtures, generateFromHome, dbInfo, readStore,
  readLessonWithQuestions, attachErrorMonitor, GEN_SEED, PROFILE_A,
} from './helpers.js'

const EXPECTED_STORES = [
  'answers', 'collocations', 'content_packs', 'lessons', 'lexical_items',
  'mistakes', 'profiles', 'questions', 'settings', 'skill_events',
  'skill_profiles', 'srs', 'template_definitions',
]

test('database v4 has the expected stores, indexes and persisted data', async ({ page, context }) => {
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context, { seed: GEN_SEED })
  await seedFixtures(page, { active: PROFILE_A })
  await generateFromHome(page, { count: 30 })

  const info = await dbInfo(page)
  expect(info.version).toBe(4)
  expect(info.stores).toEqual(EXPECTED_STORES)
  expect(info.indexes.lessons).toEqual(['created_at'])
  expect(info.indexes.questions).toEqual(['lesson_id'])
  expect(info.indexes.answers).toEqual(['lesson_id', 'mistake_type', 'session_id'])
  expect(info.indexes.mistakes).toEqual(['profile_id'])
  expect(info.indexes.srs).toEqual(['due_at', 'profile_id'])
  expect(info.indexes.skill_events).toEqual(['answer_id', 'profile_id', 'profile_skill'])
  expect(info.indexes.skill_profiles).toEqual(['profile_id', 'skill_id'])

  // Sample lesson (7 questions) + generated lesson (30 questions).
  expect(info.counts.lessons).toBe(2)
  expect(info.counts.questions).toBe(37)
  expect(info.counts.profiles).toBeGreaterThanOrEqual(2)
  expect(info.counts.skill_profiles).toBe(3)
  expect(info.counts.settings).toBeGreaterThanOrEqual(4)

  monitor.assertClean()
})

test('data survives a real browser close/reopen (persistent context)', async ({ baseURL }, testInfo) => {
  const userDataDir = testInfo.outputPath('user-data-dir')

  // First real browser session: seed + generate.
  const ctx1 = await chromium.launchPersistentContext(userDataDir, { baseURL })
  await enableTestHooks(ctx1, { seed: GEN_SEED })
  const page1 = await ctx1.newPage()
  await seedFixtures(page1, { active: PROFILE_A })
  const lessonId = await generateFromHome(page1, { count: 30 })
  const before = await dbInfo(page1)
  expect(before.counts.questions).toBe(37)
  await ctx1.close()

  // Second, fresh browser session over the same profile directory.
  const ctx2 = await chromium.launchPersistentContext(userDataDir, { baseURL })
  await enableTestHooks(ctx2, { seed: GEN_SEED })
  const page2 = await ctx2.newPage()
  await page2.goto('./')
  await page2.waitForFunction(() => window.__e2e && window.__e2e.db)

  const after = await dbInfo(page2)
  expect(after.version).toBe(4)
  expect(after.counts.lessons).toBe(before.counts.lessons)
  expect(after.counts.questions).toBe(before.counts.questions)
  const { lesson, questions } = await readLessonWithQuestions(page2, lessonId)
  expect(lesson).toBeTruthy()
  expect(lesson.owner_profile_id).toBe(PROFILE_A)
  expect(questions).toHaveLength(30)
  await expect(page2.getByText('Adaptive Workplace English').first()).toBeVisible()
  await ctx2.close()
})

test('opening a legacy v2 database upgrades to v4 preserving data', async ({ page, context }) => {
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context)

  // Blank same-origin page so we can create the legacy DB before the app runs.
  await page.route('**/e2e-blank', (route) => route.fulfill({ body: '<html><body>blank</body></html>', contentType: 'text/html' }))
  await page.goto('./e2e-blank')
  await page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('app-idiomas', 2)
      r.onupgradeneeded = () => {
        const d = r.result
        d.createObjectStore('lessons', { keyPath: 'lesson_id' }).createIndex('created_at', 'created_at')
        d.createObjectStore('questions', { keyPath: 'key' }).createIndex('lesson_id', 'lesson_id')
        const answers = d.createObjectStore('answers', { keyPath: 'key', autoIncrement: true })
        answers.createIndex('lesson_id', 'lesson_id')
        answers.createIndex('session_id', 'session_id')
        answers.createIndex('mistake_type', 'mistake_type')
        d.createObjectStore('mistakes', { keyPath: 'key' }).createIndex('profile_id', 'profile_id')
        d.createObjectStore('profiles', { keyPath: 'profile_id' })
        const srs = d.createObjectStore('srs', { keyPath: 'key' })
        srs.createIndex('profile_id', 'profile_id')
        srs.createIndex('due_at', 'due_at')
        d.createObjectStore('settings', { keyPath: 'key' })
      }
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    const put = (store, val) => new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite')
      tx.objectStore(store).put(val)
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error)
    })
    await put('lessons', { lesson_id: 'legacy_v2_001', title: 'Aula legada', level: 'B1', focus: 'legacy_focus', raw_content: 'lesson_id: legacy_v2_001', count: 1, created_at: Date.now() - 86400000 })
    await put('questions', { key: 'legacy_v2_001:1', lesson_id: 'legacy_v2_001', id: 1, type: 'translate_natural', prompt: 'Diga em inglês.', prompt_pt: 'Eu trabalho aqui.', expected_answer: 'I work here.', accepted_answers: [], skill_target: 'vocabulary' })
    await put('profiles', { profile_id: 'default', name: 'Você', created_at: Date.now() - 86400000 })
    await put('settings', { key: 'active_profile', value: 'default' })
    db.close()
  })

  // Load the app: it opens the DB at v4 and runs the upgrade path.
  await page.goto('./')
  await page.waitForFunction(() => window.__e2e && window.__e2e.db)

  const info = await dbInfo(page)
  expect(info.version).toBe(4)
  expect(info.stores).toEqual(EXPECTED_STORES)

  // Legacy data preserved and readable through the app layer.
  const lessons = await readStore(page, 'lessons')
  expect(lessons.some((l) => l.lesson_id === 'legacy_v2_001')).toBe(true)
  const legacy = await page.evaluate(() => window.__e2e.db.getLesson('legacy_v2_001'))
  expect(legacy.title).toBe('Aula legada')
  expect(legacy.questions).toHaveLength(1)

  monitor.assertClean()
})
