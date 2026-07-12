// SLICE 5 — content packs no navegador real: seed, Settings, enable/disable,
// geração por tema/nível, persistência após reload e metadata da aula.
import { test, expect } from '@playwright/test'
import {
  enableTestHooks, seedFixtures, generateFromHome, readStore, dbInfo,
  attachErrorMonitor, GEN_SEED, PROFILE_A,
} from './helpers.js'

test('seeds 28 packs, lists them in Settings and reload keeps them (idempotent seed)', async ({ page, context }) => {
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })

  const packs = await readStore(page, 'content_packs')
  expect(packs).toHaveLength(28)
  expect(packs.filter((p) => p.theme === 'core')).toHaveLength(4)
  expect(packs.every((p) => p.enabled)).toBe(true)
  expect(packs.every((p) => p.source === 'builtin')).toBe(true)

  // Settings lists all packs grouped with metadata.
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await expect(page.getByTestId('content-packs-count')).toHaveText(/28 pacotes · 28 habilitados/)
  await page.getByTestId('content-packs-toggle').click()
  await expect(page.getByTestId('content-pack-core_b1')).toBeVisible()
  await expect(page.getByTestId('content-pack-workplace_b1')).toContainText('v1 · builtin')
  await expect(page.getByTestId('content-pack-workplace_b1')).toContainText('depende de core_b1')

  // Reload: seed is idempotent, still 28 packs and no duplicates.
  await page.reload()
  await page.waitForFunction(() => window.__e2e && window.__e2e.db)
  const after = await readStore(page, 'content_packs')
  expect(after).toHaveLength(28)
  const info = await dbInfo(page)
  expect(info.counts.lexical_items).toBeGreaterThanOrEqual(360)
  expect(info.counts.template_definitions).toBeGreaterThanOrEqual(184)
  expect(info.counts.collocations).toBeGreaterThanOrEqual(176)
  monitor.assertClean()
})

test('disabling a theme pack removes it from generation and enabling restores it', async ({ page, context }) => {
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })

  // Disable travel B1 in Settings.
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await page.getByTestId('content-packs-toggle').click()
  await page.getByTestId('content-pack-toggle-travel_b1').click()
  await expect(page.getByTestId('content-packs-count')).toHaveText(/27 habilitados/)

  // The theme disappears from the B1 generation card.
  await page.getByRole('button', { name: 'Início' }).click()
  await expect(page.getByTestId('gen-theme-workplace')).toBeVisible()
  await expect(page.getByTestId('gen-theme-travel')).toHaveCount(0)

  // Data stays in place while disabled.
  const items = await readStore(page, 'lexical_items')
  expect(items.some((i) => i.pack_id === 'travel_b1')).toBe(true)

  // Re-enable: the theme returns.
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await page.getByTestId('content-packs-toggle').click()
  await page.getByTestId('content-pack-toggle-travel_b1').click()
  await expect(page.getByTestId('content-packs-count')).toHaveText(/28 habilitados/)
  await page.getByRole('button', { name: 'Início' }).click()
  await expect(page.getByTestId('gen-theme-travel')).toBeVisible()
  monitor.assertClean()
})

test('generates lessons across levels and themes with pack metadata persisted', async ({ page, context }) => {
  test.setTimeout(120_000)
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context, { seed: GEN_SEED })
  await seedFixtures(page, { active: PROFILE_A })

  const combos = [
    ['A1', 'daily_life'],
    ['A2', 'travel'],
    ['B1', 'workplace'],
    ['B2', 'technology_and_communication'],
  ]
  for (const [level, theme] of combos) {
    await page.getByTestId(`gen-level-${level}`).click()
    await page.getByTestId(`gen-theme-${theme}`).click()
    const lessonId = await generateFromHome(page, { count: 30 })
    const lessons = await readStore(page, 'lessons')
    const lesson = lessons.find((l) => l.lesson_id === lessonId)
    expect(lesson.level).toBe(level)
    expect(lesson.focus).toBe(`adaptive_${theme}_english`)
    const meta = lesson.generation_metadata
    expect(meta.content_pack_ids).toEqual([`core_${level.toLowerCase()}`, `${theme}_${level.toLowerCase()}`])
    expect(meta.content_pack_versions[`core_${level.toLowerCase()}`]).toBe(1)
    expect(meta.content_snapshot_checksum).toBeTruthy()
    expect(meta.content_schema_version).toBe('1')
    expect(meta.actual_questions).toBe(30)
  }
  monitor.assertClean()
})
