import { test, expect } from '@playwright/test'
import { enableTestHooks, seedFixtures, PROFILE_A } from './helpers.js'
import { setLearnerFlag } from './v2-helpers.js'

async function boot(page, context) {
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await setLearnerFlag(page, true)
  await expect(page.getByTestId('v2lx-home')).toBeVisible()
}

test('every destination visible in the V2 BottomNav stays inside the V2 product', async ({ page, context }) => {
  await boot(page, context)

  const nav = page.getByRole('navigation', { name: 'Navegação principal' })
  await expect(nav).toHaveAttribute('data-experience', 'v2')
  await expect(nav.getByRole('button')).toHaveCount(4)
  await expect(nav.getByRole('button', { name: 'Início' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Histórico' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Erros' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Ajustes' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Fale' })).toHaveCount(0)
  await expect(nav.getByRole('button', { name: 'Histórias' })).toHaveCount(0)

  await nav.getByRole('button', { name: 'Histórico' }).click()
  await expect(page.getByTestId('v2-history')).toHaveAttribute('data-experience', 'v2')

  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: 'Erros' }).click()
  await expect(page.getByTestId('v2-review-points')).toHaveAttribute('data-experience', 'v2')

  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: 'Ajustes' }).click()
  const settings = page.getByTestId('v2-settings')
  await expect(settings).toHaveAttribute('data-experience', 'v2')
  await expect(settings).not.toContainText('Nível atual')
  await expect(settings).not.toContainText('Perguntas por aula')
  await expect(settings).not.toContainText('pacotes de conteúdo')
  await expect(settings).not.toContainText('Laboratório V2')
  await expect(settings).not.toContainText(/\bA1\b|\bA2\b|\bB1\b|\bB2\b/)
  await expect(settings).not.toContainText('YAML')

  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: 'Início' }).click()
  await expect(page.getByTestId('v2lx-home')).toHaveAttribute('data-experience', 'v2')
})

test('the explicit V1 opt-out preserves the legacy Talk and Settings surfaces', async ({ page, context }) => {
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await setLearnerFlag(page, false)

  const nav = page.getByRole('navigation', { name: 'Navegação principal' })
  await expect(nav).toHaveAttribute('data-experience', 'v1')
  await expect(nav.getByRole('button', { name: 'Fale' })).toBeVisible()

  await nav.getByRole('button', { name: 'Fale' }).click()
  await expect(page.getByRole('heading', { name: 'Fale com o Bob' })).toBeVisible()

  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: 'Ajustes' }).click()
  await expect(page.getByText('Nível atual')).toBeVisible()
  await expect(page.getByTestId('v2-settings')).toHaveCount(0)
})
