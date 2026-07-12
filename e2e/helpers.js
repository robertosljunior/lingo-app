// e2e/helpers.js — deterministic fixtures and IndexedDB access for the
// browser E2E suite. Everything here talks to the real IndexedDB inside the
// page (never to app internals), or drives the UI through stable selectors.
import { expect } from '@playwright/test'

export const DB_NAME = 'app-idiomas'
export const DB_VERSION = 4
export const GEN_SEED = 'e2e-generated-lesson-001'
export const PROFILE_A = 'profile-a'
export const PROFILE_B = 'profile-b'

export const SEVEN_TYPES = [
  'translate_natural', 'fill_blank', 'build_sentence', 'choose_best',
  'rewrite_natural', 'listen_type', 'speak_sentence',
]

// ---------- fixture rows ----------
// Granular profile required by the slice spec (PARTE 4). The rows carry the
// full aggregate shape the ranking/planner reads.
function skillRow(profile_id, skill_id, parent_skill_id, category, label_pt, patch) {
  const now = Date.now()
  return {
    key: `${profile_id}:${skill_id}`,
    profile_id, skill_id, parent_skill_id, category, label_pt,
    attempts: 0, correct: 0, partial: 0, incorrect: 0,
    weighted_attempts: 0, weighted_success: 0,
    mastery: 0.5, evidence_level: 'insufficient',
    current_correct_streak: 0, longest_correct_streak: 0,
    last_seen_at: now - 3600_000, last_correct_at: null, last_error_at: null,
    high_errors: 0, medium_errors: 0, low_errors: 0,
    average_confidence: 1, average_error_severity: 0,
    trend: 'insufficient_data', recent_outcomes: [], recent_examples: [],
    profile_engine_version: '1', registry_version: '1',
    updated_at: now - 3600_000,
    ...patch,
  }
}

export function profileASkillRows() {
  const hourAgo = Date.now() - 3600_000
  return [
    skillRow(PROFILE_A, 'gerund_after_been', 'present_perfect_continuous', 'verb_form',
      'Verbo com -ing depois de have been', {
        mastery: 0.34, evidence_level: 'emerging', attempts: 4,
        correct: 1, incorrect: 3, high_errors: 3,
        weighted_attempts: 4, weighted_success: 1,
        last_error_at: hourAgo,
        recent_examples: [{ actual: 'worked', expected: 'working', severity: 'high', rule_id: 'verb.have_been_requires_ing', created_at: hourAgo }],
      }),
    skillRow(PROFILE_A, 'question_structure', null, 'question_structure',
      'Estrutura de perguntas', {
        mastery: 0.55, evidence_level: 'established', attempts: 8,
        correct: 5, incorrect: 3, high_errors: 2, medium_errors: 1,
        weighted_attempts: 8, weighted_success: 4.4,
        last_error_at: hourAgo,
      }),
    skillRow(PROFILE_A, 'workplace_preposition', 'preposition', 'preposition',
      'Preposição em contexto profissional', {
        mastery: 0.60, evidence_level: 'insufficient', attempts: 1,
        incorrect: 1, low_errors: 1,
        weighted_attempts: 0.35, weighted_success: 0,
        last_error_at: hourAgo,
      }),
  ]
}

// ---------- app boot / fixtures ----------
// Flags the tab for the app's test hooks (public storage layer on
// window.__e2e, optional deterministic generation seed).
export async function enableTestHooks(context, { seed = null } = {}) {
  await context.addInitScript((seed) => {
    sessionStorage.setItem('e2e:enabled', '1')
    if (seed) sessionStorage.setItem('e2e:generation-seed', seed)
    else sessionStorage.removeItem('e2e:generation-seed')
  }, seed)
}

export async function gotoApp(page) {
  await page.goto('./')
  await expect(page.locator('.app-shell')).toBeVisible()
  await page.waitForFunction(() => window.__e2e && window.__e2e.db)
}

// Boots the app once (creating the v3 schema), injects profile A/B and the
// deterministic granular profile straight into the real IndexedDB, then
// reloads so the app starts as `active` profile.
export async function seedFixtures(page, { active = PROFILE_A } = {}) {
  await gotoApp(page)
  await page.evaluate(async ({ active, rows, A, B }) => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('app-idiomas')
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error)
    })
    const put = (store, val) => new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite')
      tx.objectStore(store).put(val)
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error)
    })
    await put('profiles', { profile_id: A, name: 'Perfil A', created_at: Date.now() - 10_000 })
    await put('profiles', { profile_id: B, name: 'Perfil B', created_at: Date.now() - 5_000 })
    for (const row of rows) await put('skill_profiles', row)
    await put('settings', { key: 'active_profile', value: active })
    // Mark the profiles as already rebuilt so boot does not wipe the fixture.
    await put('settings', { key: `skill_profile_rebuild_version:${A}`, value: '1' })
    await put('settings', { key: `skill_profile_rebuild_version:${B}`, value: '1' })
    await put('settings', { key: 'level', value: 'B1' })
    db.close()
  }, { active, rows: profileASkillRows(), A: PROFILE_A, B: PROFILE_B })
  await page.reload()
  await expect(page.locator('.app-shell')).toBeVisible()
  await page.waitForFunction(() => window.__e2e && window.__e2e.db)
}

// Switches profile through the real UI (Settings → profile chips).
export async function switchProfileViaUi(page, name) {
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await page.getByRole('button', { name, exact: true }).click()
  // The active chip re-renders; give the library refresh a beat.
  await page.getByRole('button', { name: 'Início' }).click()
  await expect(page.getByText('Bem-vindo', { exact: false }).first()).toBeVisible()
}

// ---------- raw IndexedDB access (browser side) ----------
export function dbInfo(page) {
  return page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('app-idiomas')
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error)
    })
    const stores = [...db.objectStoreNames].sort()
    const indexes = {}
    const counts = {}
    for (const name of stores) {
      const tx = db.transaction(name)
      const store = tx.objectStore(name)
      indexes[name] = [...store.indexNames].sort()
      counts[name] = await new Promise((res, rej) => {
        const rq = store.count(); rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error)
      })
    }
    const info = { version: db.version, stores, indexes, counts }
    db.close()
    return info
  })
}

export function readStore(page, storeName) {
  return page.evaluate(async (storeName) => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('app-idiomas')
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error)
    })
    const rows = await new Promise((res, rej) => {
      const rq = db.transaction(storeName).objectStore(storeName).getAll()
      rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error)
    })
    db.close()
    return rows
  }, storeName)
}

export async function readLessonWithQuestions(page, lessonId) {
  const lessons = await readStore(page, 'lessons')
  const lesson = lessons.find((l) => l.lesson_id === lessonId) || null
  const questions = (await readStore(page, 'questions'))
    .filter((q) => q.lesson_id === lessonId)
    .sort((a, b) => a.id - b.id)
  return { lesson, questions }
}

// ---------- console / page error monitoring ----------
// Known benign noise (documented): nothing app-generated is ignored today.
const IGNORED_CONSOLE = [
  /Download the React DevTools/,
]

export function attachErrorMonitor(page) {
  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', (err) => pageErrors.push(String(err)))
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (IGNORED_CONSOLE.some((re) => re.test(text))) return
    consoleErrors.push(text)
  })
  return {
    pageErrors,
    consoleErrors,
    assertClean() {
      expect(pageErrors, `unhandled page errors: ${pageErrors.join('\n')}`).toEqual([])
      const relevant = consoleErrors.filter((t) => !/net::ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(t))
      expect(relevant, `console errors: ${relevant.join('\n')}`).toEqual([])
    },
  }
}

// ---------- exercise driving ----------
function exactWord(w) {
  return new RegExp(`^${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
}

export function wrongAnswerFor(q) {
  const a = q.expected_answer || ''
  if (/been (\w+)ing\b/.test(a)) return a.replace(/been (\w+)ing\b/, 'been $1ed')
  return `yesterday maybe ${a.split(' ').slice(1).join(' ')}`
}

// Answers the question currently on screen through the UI. `q` is the
// persisted question record (read from IndexedDB), which carries the contract
// (expected answer, options, words). Returns the submitted text.
export async function answerCurrentQuestion(page, q, { wrong = false } = {}) {
  const typeChip = page.getByTestId('question-type')
  await expect(typeChip).toHaveText(q.type)

  let answer = wrong ? wrongAnswerFor(q) : q.expected_answer

  switch (q.type) {
    case 'translate_natural':
    case 'rewrite_natural': {
      await page.locator('textarea.input').fill(answer)
      break
    }
    case 'listen_type': {
      // Exercise the audio control when the browser exposes TTS; the answer is
      // always typed manually (real audio is never required).
      const listen = page.getByRole('button', { name: 'Ouvir frase' })
      if (await listen.count()) await listen.first().click()
      await page.locator('textarea.input').fill(answer)
      break
    }
    case 'speak_sentence': {
      // Exercise the mic control (it must not crash the screen even when no
      // microphone/recognition backend exists), then fall back to typing.
      const mic = page.getByRole('button', { name: 'Falar', exact: true })
      if (await mic.count()) {
        await mic.click()
        await page.waitForTimeout(400)
        await page.getByTestId('speak-type-fallback').click()
      }
      await page.locator('textarea.input').fill(answer)
      break
    }
    case 'fill_blank':
    case 'choose_best': {
      if (wrong) {
        const target = q.options.find((o) => o !== q.expected_answer)
        answer = target
        await page.locator('button.card').filter({ hasText: exactWord(target) }).first().click()
      } else {
        await page.locator('button.card').filter({ hasText: exactWord(q.expected_answer) }).first().click()
      }
      break
    }
    case 'build_sentence': {
      const words = q.words || []
      for (const w of words) {
        await page.locator('button.word:not(.placed):not(.placed-active)')
          .filter({ hasText: exactWord(w) }).first().click()
      }
      answer = words.join(' ')
      break
    }
    default:
      throw new Error(`unsupported question type ${q.type}`)
  }

  await page.getByRole('button', { name: /Responder|Verificar/ }).click()
  await expect(page.getByTestId('feedback-sheet')).toBeVisible()
  return answer
}

export async function goNext(page) {
  await page.getByTestId('feedback-sheet').getByRole('button', { name: /Próxima/ }).click()
}

// Generates a lesson from the Home card and returns its persisted lesson_id.
// Waits on the real IndexedDB write (a fresh created_at stamp), so it is safe
// to call repeatedly in the same page.
export async function generateFromHome(page, { count = 30 } = {}) {
  await expect(page.getByTestId('generation-card')).toBeVisible()
  if (count !== 30) await page.getByTestId(`gen-count-${count}`).click()
  const stampOf = (rows) => Math.max(0, ...rows.filter((l) => l.generated).map((l) => l.created_at || 0))
  const before = stampOf(await readStore(page, 'lessons'))
  await page.getByTestId('generate-lesson').click()
  await expect(page.getByTestId('generated-lesson-result')).toBeVisible()
  await expect.poll(async () => stampOf(await readStore(page, 'lessons')), { timeout: 30_000 })
    .toBeGreaterThan(before)
  const generated = (await readStore(page, 'lessons')).filter((l) => l.generated)
  generated.sort((a, b) => b.created_at - a.created_at)
  return generated[0].lesson_id
}
