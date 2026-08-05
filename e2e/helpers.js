// e2e/helpers.js — deterministic fixtures and IndexedDB access for the
// browser E2E suite. Everything here talks to the real IndexedDB inside the
// page (never to app internals), or drives the UI through stable selectors.
import { expect } from '@playwright/test'

export const DB_NAME = 'app-idiomas'
export const DB_VERSION = 5 // v5: additive pedagogy V2 learner-model stores
export const GEN_SEED = 'e2e-generated-lesson-001'
export const PROFILE_A = 'profile-a'
export const PROFILE_B = 'profile-b'

export const SEVEN_TYPES = [
  'translate_natural', 'fill_blank', 'build_sentence', 'choose_best',
  'rewrite_natural', 'listen_type', 'speak_sentence',
]

// ---------- fixture rows ----------
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
export async function enableTestHooks(context, { seed = null, pwaInstall = null, voicePreparation = null } = {}) {
  await context.addInitScript(({ seed, pwaInstall, voicePreparation }) => {
    sessionStorage.setItem('e2e:enabled', '1')
    if (seed) sessionStorage.setItem('e2e:generation-seed', seed)
    else sessionStorage.removeItem('e2e:generation-seed')
    window.__LINGO_E2E__ = window.__LINGO_E2E__ || {}
    window.__LINGO_E2E__.pwaInstall = pwaInstall || { mode: 'disabled', promptOutcome: null }
    // Ordinary specs leave this unset; the production preparation controller
    // then takes its E2E-safe disabled path and never downloads a 60 MB model.
    // RX-7 specs opt into deterministic preparing/ready/failure states.
    if (voicePreparation) window.__LINGO_E2E__.voicePreparation = voicePreparation
  }, { seed, pwaInstall, voicePreparation })
}

export async function setPwaInstallState(context, pwaInstall) {
  await context.addInitScript((pwaInstall) => {
    window.__LINGO_E2E__ = window.__LINGO_E2E__ || {}
    window.__LINGO_E2E__.pwaInstall = pwaInstall
  }, pwaInstall)
}

export async function gotoApp(page) {
  await page.goto('./')
  await expect(page.locator('.app-shell')).toBeVisible()
  await page.waitForFunction(() => window.__e2e && window.__e2e.db)
}

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
    await put('settings', { key: 'onboarding_completed', value: true })
    await put('settings', { key: `skill_profile_rebuild_version:${A}`, value: '1' })
    await put('settings', { key: `skill_profile_rebuild_version:${B}`, value: '1' })
    await put('settings', { key: 'level', value: 'B1' })
    await put('settings', { key: 'v2_learner_experience_enabled', value: false })
    db.close()
  }, { active, rows: profileASkillRows(), A: PROFILE_A, B: PROFILE_B })
  await page.reload()
  await expect(page.locator('.app-shell')).toBeVisible()
  await page.waitForFunction(() => window.__e2e && window.__e2e.db)
}

export async function switchProfileViaUi(page, name) {
  const idByName = { 'Perfil A': PROFILE_A, 'Perfil B': PROFILE_B }
  const profileId = idByName[name] || name
  await page.evaluate((pid) => window.__e2e.db.setSetting('active_profile', pid), profileId)
  await page.reload()
  await expect(page.locator('.app-shell')).toBeVisible()
  await page.waitForFunction(() => window.__e2e && window.__e2e.db)
  const exitBtn = page.getByRole('button', { name: 'Sair da aula' })
  if (await exitBtn.count()) await exitBtn.click()
  await expect(page.getByTestId('open-training-hub')).toBeVisible()
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

export async function readStore(page, storeName) {
  return page.evaluate(async (name) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('app-idiomas')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const rows = await new Promise((resolve, reject) => {
      const request = db.transaction(name).objectStore(name).getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    db.close()
    return rows
  }, storeName)
}

// The remainder of this helper intentionally stays in the existing repository
// version. This replacement only extends enableTestHooks and preserves the
// exported fixture/storage contracts used by current suites.
