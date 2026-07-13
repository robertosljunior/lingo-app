// SLICE 7.4 PART 7 — Portuguese explanations must use a pt-BR voice; English
// forms must use an English voice; the two never share a voice, and a
// Portuguese request must NEVER fall back to an English voice.
import { test, expect } from '@playwright/test'
import {
  enableTestHooks, seedFixtures, generateFromHome, readLessonWithQuestions,
  answerCurrentQuestion, attachErrorMonitor, PROFILE_A,
} from './helpers.js'

// Inject a deterministic set of device voices (one English, one pt-BR) BEFORE
// app boot and record the language actually spoken, so the test observes real
// routing instead of depending on whatever the headless engine ships.
async function installFakeVoices(context) {
  await context.addInitScript(() => {
    const voices = [
      { voiceURI: 'en-US-Test', name: 'English Test', lang: 'en-US', localService: true, default: true },
      { voiceURI: 'pt-BR-Test', name: 'Voz Portuguesa', lang: 'pt-BR', localService: true, default: false },
    ]
    window.__spokenLangs = []
    // Patch the existing engine's methods (redefining the accessor throws).
    const synth = window.speechSynthesis
    synth.getVoices = () => voices
    synth.speak = (u) => { window.__spokenLangs.push((u && (u.voice?.lang || u.lang)) || '') }
    synth.cancel = () => {}
    // A real SpeechSynthesisUtterance rejects a non-native voice object, so use a
    // plain stand-in that stores whatever voice the app assigns.
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.voice = null; this.lang = ''; this.rate = 1 } }
  })
}

async function openFeedback(page) {
  const lessonId = await generateFromHome(page, { count: 10 })
  const { questions } = await readLessonWithQuestions(page, lessonId)
  await page.getByTestId('start-generated-lesson').click()
  await expect(page.getByTestId('question-type')).toBeVisible()
  // Answer wrong so the feedback shows both the explanation and the correct form.
  await answerCurrentQuestion(page, questions[0], { wrong: true })
  await expect(page.getByTestId('feedback-sheet')).toBeVisible()
}

test('Portuguese explanation uses a pt-BR voice and English form uses English', async ({ page, context }) => {
  const monitor = attachErrorMonitor(page)
  await installFakeVoices(context)
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await openFeedback(page)

  const explain = page.getByRole('button', { name: 'Ouvir explicação' })
  await expect(explain).toBeVisible()
  await explain.click()
  await expect.poll(() => page.evaluate(() => window.__spokenLangs.at(-1))).toMatch(/^pt/i)

  const correct = page.getByRole('button', { name: /Ouvir forma correta|Ouvir versão corrigida/ })
  if (await correct.count()) {
    await correct.first().click()
    await expect.poll(() => page.evaluate(() => window.__spokenLangs.at(-1))).toMatch(/^en/i)
  }

  // The recorded TTS events: an explanation_pt event exists and NONE of them
  // resolved to English — the slice's failing condition must never occur.
  const events = await page.evaluate(() => window.__LINGO_E2E__.ttsEvents)
  const ptEvents = events.filter((e) => e.role === 'explanation_pt')
  expect(ptEvents.length).toBeGreaterThan(0)
  for (const e of ptEvents) {
    expect(e.language).not.toBe('en')
    expect(String(e.effective_voice_id)).not.toMatch(/en-/i)
    expect(String(e.language)).toMatch(/^pt/i)
  }
  monitor.assertClean()
})

test('Portuguese never falls back to English when no pt-BR voice exists', async ({ page, context }) => {
  const monitor = attachErrorMonitor(page)
  // Only an English voice available on the device.
  await context.addInitScript(() => {
    const voices = [{ voiceURI: 'en-US-Test', name: 'English Test', lang: 'en-US', localService: true, default: true }]
    window.__spokenLangs = []
    const synth = window.speechSynthesis
    synth.getVoices = () => voices
    synth.speak = (u) => { window.__spokenLangs.push((u.voice?.lang || u.lang) || '') }
    synth.cancel = () => {}
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.voice = null; this.lang = ''; this.rate = 1 } }
  })
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await openFeedback(page)

  await page.getByRole('button', { name: 'Ouvir explicação' }).click()
  await page.waitForTimeout(300)
  // Nothing was spoken with an English voice for the Portuguese explanation.
  const langs = await page.evaluate(() => window.__spokenLangs)
  expect(langs.some((l) => /^en/i.test(l))).toBe(false)
  const events = await page.evaluate(() => window.__LINGO_E2E__.ttsEvents)
  const pt = events.filter((e) => e.role === 'explanation_pt')
  expect(pt.length).toBeGreaterThan(0)
  for (const e of pt) {
    expect(e.language).not.toBe('en')
    expect(String(e.effective_voice_id)).not.toMatch(/en-/i) // never an English voice
  }
  // The system layer reported the language genuinely unavailable rather than
  // substituting English.
  expect(pt.some((e) => e.fallback_reason === 'NO_VOICE_FOR_LANGUAGE' && e.effective_voice_id === '')).toBe(true)
  monitor.assertClean()
})
