// root-home-routing.test.jsx — V2.20-R §18/§19. The cutover contract at the ROOT
// of the app: SCREENS.HOME renders the V2 Learner Home by default, the legacy V1
// Home only on an explicit opt-out, and the V2 Home never leaks a single V1
// truth — Bob included (§10/§19).
//
// Rendered with the repo's static-markup convention (see pedagogy-v2-lab.test.jsx);
// the interactive journeys are covered by the Playwright suites.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const noop = () => {}

const SCREENS = {
  HOME: 'home', IMPORT: 'import', EXPORT: 'export', MISTAKES: 'mistakes',
  TRAINING: 'training', PEDAGOGY_V2_PILOT: 'pedagogy_v2_pilot',
  PEDAGOGY_V2_LEARNER: 'pedagogy_v2_learner',
}

// One store mock rich enough for BOTH products, so the only difference between
// the cases below is the experience setting itself.
function mockApp(settings) {
  vi.doMock('../store.jsx', () => ({
    SCREENS,
    useApp: () => ({
      settings,
      SCREENS,
      profiles: [{ profile_id: 'p1', name: 'Roberto' }],
      activeProfile: 'p1',
      lessons: [], sessions: [], mistakes: [], skillProfiles: [], dueCount: 0,
      startLesson: noop, startReviewSession: noop, startPracticeSession: noop,
      generateAdaptiveLesson: noop, navigate: noop, setTab: noop,
      updateSetting: noop, showToast: noop,
    }),
  }))
}

async function renderScreen(file, settings) {
  mockApp(settings)
  const { default: Screen } = await import(file)
  return renderToStaticMarkup(<Screen />)
}

afterEach(() => {
  vi.doUnmock('../store.jsx')
  vi.resetModules()
})

// Every V1 truth that must never appear in the V2 experience (§10).
const V1_TRUTHS = [
  'Bora soltar o inglês hoje',
  'Escolha o que treinar',
  'Temas, níveis A1–B2',
  'Gerar nova aula adaptativa',
  'Prática adaptativa',
  'generation-card',
  'open-training-hub',
  'Importar aula',
  'Gerar prompt',
]

describe('§18 — root Home routing', () => {
  it('V2 default: an unset flag renders the V2 Learner Home', async () => {
    const html = await renderScreen('./Home.jsx', {})
    expect(html).toContain('data-testid="v2lx-home"')
    expect(html).toContain('data-experience="v2"')
  })

  it('V2 default: a null/absent settings record still renders V2', async () => {
    expect(await renderScreen('./Home.jsx', null)).toContain('data-testid="v2lx-home"')
  })

  it('explicit V1: flag false renders the LegacyHome', async () => {
    const html = await renderScreen('./Home.jsx', { v2_learner_experience_enabled: false })
    expect(html).toContain('data-testid="open-training-hub"')
    expect(html).toContain('Bora soltar o inglês hoje')
    expect(html).not.toContain('data-experience="v2"')
  })

  it('explicit V2: flag true renders the V2 Learner Home', async () => {
    expect(await renderScreen('./Home.jsx', { v2_learner_experience_enabled: true }))
      .toContain('data-testid="v2lx-home"')
  })
})

describe('§18 — Training routing agrees with the root Home', () => {
  it('an unset flag renders the V2 Learner Home, never the legacy hub', async () => {
    const html = await renderScreen('./TrainingHub.jsx', {})
    expect(html).toContain('data-testid="v2lx-home"')
    expect(html).not.toContain('Escolha o que treinar')
  })

  it('flag false renders the LegacyTrainingHub', async () => {
    const html = await renderScreen('./TrainingHub.jsx', { v2_learner_experience_enabled: false })
    expect(html).not.toContain('data-testid="v2lx-home"')
    expect(html).not.toContain('data-experience="v2"')
    // The hub loads its summary in an effect, so a static render shows its
    // loading state — which is still unmistakably the legacy hub, not V2.
    expect(html).toContain('Carregando hub…')
  })
})

describe('§19 — Bob belongs to the legacy product', () => {
  it('the V2 Home renders no mascot and no V1 truth', async () => {
    const html = await renderScreen('./Home.jsx', {})
    // BobMascot renders an SVG labelled "Bob, o mascote" (see BobMascot.jsx).
    expect(html).not.toContain('Bob, o mascote')
    expect(html).not.toMatch(/\bBob\b/)
    for (const truth of V1_TRUTHS) expect(html).not.toContain(truth)
    // A1–B2 must not be the learner-facing progression on the V2 Home.
    expect(html).not.toMatch(/\bA1\b|\bA2\b|\bB1\b|\bB2\b/)
  })

  it('the legacy Home keeps Bob — the V1 tests are not destroyed', async () => {
    const html = await renderScreen('./Home.jsx', { v2_learner_experience_enabled: false })
    expect(html).toContain('Bob, o mascote')
  })
})

describe('§13 — the DEV experience switch is not shipped to a public learner', () => {
  // Vitest itself runs with import.meta.env.DEV === true, so the ambient render
  // above always shows the DEV strip. The public-build absence is asserted where
  // it is actually observable: at the resolver (with a production env injected)
  // and end-to-end against the real production bundle
  // (e2e/production-cutover.spec.js).
  it('is not offered in a production environment without diagnostics', async () => {
    const { experienceSwitcherAvailable } = await import('../lib/pedagogy-v2/learner-experience-mode.js')
    expect(experienceSwitcherAvailable({}, { DEV: false })).toBe(false)
    expect(experienceSwitcherAvailable(null, { DEV: false })).toBe(false)
  })

  it('is present for an internal user who turned diagnostics on', async () => {
    const html = await renderScreen('./Home.jsx', { pedagogy_v2_diagnostics_enabled: true })
    expect(html).toContain('v2lxh-devstrip')
  })
})
