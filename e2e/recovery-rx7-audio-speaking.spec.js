import { test, expect } from '@playwright/test'
import { attachErrorMonitor, enableTestHooks, gotoApp, readStore } from './helpers.js'

async function finishFreshV2Onboarding(page, name = 'Rob') {
  await expect(page.getByTestId('v2lx-onboarding')).toBeVisible()
  await page.getByTestId('v2lxo-continue').click()
  await page.getByTestId('v2lxo-name-input').fill(name)
  await page.getByTestId('v2lxo-start').click()
  await expect(page.getByTestId('v2lx-home')).toBeVisible({ timeout: 20_000 })
}

async function installVoicePreparationHook(context, state) {
  await context.addInitScript((state) => {
    window.__LINGO_E2E__ = window.__LINGO_E2E__ || {}
    window.__LINGO_E2E__.voicePreparation = state
  }, state)
}

async function installDeterministicSpeechSynthesis(context, durationMs = 700) {
  await context.addInitScript((durationMs) => {
    const voices = [{
      voiceURI: 'RX7 English',
      name: 'RX7 English',
      lang: 'en-US',
      localService: true,
    }]
    class E2EUtterance {
      constructor(text) {
        this.text = text
        this.voice = null
        this.lang = ''
        this.rate = 1
        this.onend = null
        this.onerror = null
      }
    }
    let timer = null
    const synth = {
      getVoices: () => voices,
      addEventListener: () => {},
      speak: (utterance) => {
        window.__LINGO_E2E__ = window.__LINGO_E2E__ || {}
        window.__LINGO_E2E__.rx7Spoken = (window.__LINGO_E2E__.rx7Spoken || 0) + 1
        clearTimeout(timer)
        timer = setTimeout(() => utterance.onend?.(), durationMs)
      },
      cancel: () => { clearTimeout(timer); timer = null },
    }
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth })
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: E2EUtterance })
  }, durationMs)
}

test('automatic neural voice preparation is honest, non-blocking and stays above BottomNav', async ({ page, context }) => {
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context)
  await installVoicePreparationHook(context, { mode: 'downloading', progress: 42 })
  await gotoApp(page)
  await finishFreshV2Onboarding(page)

  const banner = page.getByTestId('piper-preparation-card')
  await expect(banner).toBeVisible()
  await expect(banner).toHaveAttribute('data-status', 'downloading')
  await expect(banner).toHaveAttribute('data-progress', '42')
  await expect(banner).toContainText('voz americana')
  await expect(banner).toContainText('42%')
  await expect(banner).toContainText('voz do aparelho continua disponível')

  const nav = page.getByRole('navigation', { name: 'Navegação principal' })
  await expect(nav).toBeVisible()
  const [bannerBox, navBox] = await Promise.all([banner.boundingBox(), nav.boundingBox()])
  expect(bannerBox).toBeTruthy()
  expect(navBox).toBeTruthy()
  expect(bannerBox.y + bannerBox.height).toBeLessThanOrEqual(navBox.y + 1)

  // The banner reports progress but does not trap the learner on Home.
  await nav.getByRole('button', { name: 'Histórico' }).click()
  await expect(page.getByTestId('v2-history')).toBeVisible()
  monitor.assertClean()
})

test('the learner audio control stays busy until real speech onend, not merely speak() start', async ({ page, context }) => {
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context)
  await installDeterministicSpeechSynthesis(context, 700)
  await gotoApp(page)
  await finishFreshV2Onboarding(page)

  await page.getByTestId('v2lxh-primary').click()
  await expect(page.getByTestId('v2lx-shell')).toBeVisible()
  await expect(page.getByTestId('v2lx-activity-exposure')).toBeVisible()

  const audio = page.getByTestId('v2lx-audio')
  await expect(audio).toBeEnabled()
  await audio.click()
  await expect(audio).toBeDisabled()
  await expect(audio).toHaveAttribute('data-playing', 'true')
  await expect(audio).toContainText('Tocando')
  await page.waitForTimeout(200)
  await expect(audio).toBeDisabled()

  await expect(audio).toBeEnabled({ timeout: 3_000 })
  await expect(audio).not.toHaveAttribute('data-playing', 'true')
  await expect(audio).toHaveAttribute('data-engine', 'system')
  expect(await page.evaluate(() => window.__LINGO_E2E__?.rx7Spoken)).toBe(1)
  monitor.assertClean()
})

test('a prepared primary voice migrates only the legacy default route to Piper/Reza', async ({ page, context }) => {
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context)
  await installVoicePreparationHook(context, { mode: 'ready' })
  await gotoApp(page)
  await finishFreshV2Onboarding(page)

  await expect(page.getByTestId('piper-preparation-card')).toHaveCount(0)
  await expect.poll(async () => {
    const settings = await readStore(page, 'settings')
    return Object.fromEntries(settings.map((row) => [row.key, row.value]))
  }).toMatchObject({
    tts_engine: 'piper',
    english_voice_id: 'en_US-reza_ibrahim-medium',
    piper_voice: 'en_US-reza_ibrahim-medium',
  })

  monitor.assertClean()
})
