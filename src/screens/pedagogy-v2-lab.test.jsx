// pedagogy-v2-lab.test.jsx — mandatory UI tests of Slice V2.5 (§26) using the
// repo's static server rendering. Interactive behavior (clicks, session flow,
// back navigation semantics) is covered end-to-end by e2e/pedagogy-v2-lab.spec.js.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadPedagogyV2Registry } from '../lib/pedagogy-v2/registry.js'
import { createLessonSessionV2 } from '../lib/pedagogy-v2/lesson-engine-contracts.js'
import { selectNextActivityV2 } from '../lib/pedagogy-v2/lesson-engine.js'
import V2Feedback from '../components/pedagogy-v2/V2Feedback.jsx'

const noop = () => {}
const NOW = '2026-07-01T10:00:00.000Z'

function mockApp({ enabled = true, params = {} } = {}) {
  vi.doMock('../store.jsx', () => ({
    SCREENS: { HOME: 'home', TRAINING: 'training', PEDAGOGY_V2_PILOT: 'pedagogy_v2_pilot' },
    useApp: () => ({
      settings: { pedagogy_v2_pilot_enabled: enabled },
      activeProfile: 'p1',
      params,
      db: {
        getLearnerTargetStatesV2: async () => [],
        recordLearnerEvidenceBatchV2: async () => ({ recorded: [], skipped: [], state_keys: [] }),
      },
      setTab: noop, back: noop, navigate: noop, showToast: noop,
    }),
  }))
}

async function renderLab(opts) {
  mockApp(opts)
  const { default: Screen } = await import('./PedagogyV2Lab.jsx')
  return renderToStaticMarkup(<Screen />)
}

afterEach(() => {
  vi.doUnmock('../store.jsx')
  vi.resetModules()
})

const registry = loadPedagogyV2Registry()
const butPlan = (learnerStates = []) => selectNextActivityV2({
  session: createLessonSessionV2({ session_id: 's-ui', profile_id: 'p1', now: NOW }),
  scope: { registry, pack_id: 'pedagogy_v2_but', lexeme_id: 'lexeme:but' },
  learnerStates, recentEvidence: [],
}).plan

describe('§26.56 — the lab lists both packs', () => {
  it('shows still and but with word, description and factual counts', async () => {
    const html = await renderLab({ params: {} })
    expect(html).toContain('v2-lab-screen')
    expect(html).toContain('Laboratório V2')
    expect(html).toContain('Aprofunde palavras fundamentais em novos sentidos e construções.')
    expect(html).toContain('v2-pack-still')
    expect(html).toContain('v2-pack-but')
    expect(html).toContain('3 usos · 5 construções')  // still
    expect(html).toContain('4 usos · 5 construções')  // but
  })
})

describe('§26.57 — flag off hides the lab', () => {
  it('renders the disabled notice, never the lab or a session', async () => {
    const html = await renderLab({ enabled: false, params: {} })
    expect(html).toContain('v2-pilot-disabled')
    expect(html).not.toContain('v2-lab-screen')
    expect(html).not.toContain('v2-pilot-screen')
  })
})

describe('§26.58–59 — selecting a pack opens ITS session', () => {
  it('58: still opens a still-scoped session', async () => {
    const html = await renderLab({ params: { packId: 'pedagogy_v2_still' } })
    expect(html).toContain('v2-pilot-screen')
    expect(html).toContain('data-pack-id="pedagogy_v2_still"')
    expect(html).toContain('Laboratório V2 — still')
  })

  it('59: but opens a but-scoped session', async () => {
    const html = await renderLab({ params: { packId: 'pedagogy_v2_but' } })
    expect(html).toContain('v2-pilot-screen')
    expect(html).toContain('data-pack-id="pedagogy_v2_but"')
    expect(html).toContain('Laboratório V2 — but')
  })
})

describe('§26.60 — UI copy derives from the ACTIVE lexeme', () => {
  it('feedback copy for a but plan speaks about but, never still', () => {
    const plan = butPlan()
    expect(plan.lexeme_lemma).toBe('but')
    const html = renderToStaticMarkup(
      <V2Feedback plan={plan} assessment={{ status: 'not_assessed', outcome: 'observed', feedback: {}, assessment_confidence: 1 }}
        busy={false} onContinue={noop} onTryAgain={noop} />)
    expect(html).toContain('uso de but')
    expect(html).not.toContain('uso de still')
  })
})

describe('§26.61 — session summary uses the active lexeme and session facts only', () => {
  it('speaks about constructions practiced WITH the lexeme, no global mastery claim', async () => {
    mockApp({})
    const { SessionSummary } = await import('./PedagogyV2Lab.jsx')
    const plan = butPlan()
    const interactions = [{ plan, response: {}, assessment: { status: 'not_assessed' }, events: [] }]
    const html = renderToStaticMarkup(
      <SessionSummary interactions={interactions} fallbackLemma="but" onExit={noop} />)
    expect(html).toContain('construções praticadas com but')
    expect(html).toContain('usos de but encontrados')
    expect(html).toContain('Você continuará encontrando')
    // No global-mastery claims about the WORD ("Sessão concluída" is a fact
    // about the session, not about the lexeme).
    expect(html).not.toMatch(/aprendeu|palavra conclu|domínio|nível|%/i)
  })
})

describe('§26.62–63 — invalid pack and way back', () => {
  it('62: an unknown pack id shows an error and a way back to the lab — no crash', async () => {
    const html = await renderLab({ params: { packId: 'pedagogy_v2_ghost' } })
    expect(html).toContain('v2-pack-invalid')
    expect(html).toContain('Voltar ao laboratório')
    expect(html).not.toContain('v2-pilot-screen')
  })

  it('63: the session header offers a back affordance to the selection', async () => {
    const html = await renderLab({ params: { packId: 'pedagogy_v2_but' } })
    expect(html).toContain('aria-label="Voltar"')
  })
})

describe('§26.64 — factual progress, never a global mastery', () => {
  it('the selection screen never shows a level, a single percentage or a "learned" badge', async () => {
    const html = await renderLab({ params: {} })
    expect(html).not.toMatch(/%|nível|domínio|aprendida|conclu[ií]d/i)
    // The factual copy template is what renders instead.
    expect(html).toContain('Carregando progresso…')
  })
})

describe('§26.65 — no still hardcodes in generic components', () => {
  it('generic V2 runtime/UI files carry no pedagogical still identifiers or copy', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..')
    const genericFiles = [
      'screens/PedagogyV2Lab.jsx',
      'screens/TrainingHub.jsx',
      'components/pedagogy-v2/V2ActivityRenderer.jsx',
      'components/pedagogy-v2/V2ChoiceActivity.jsx',
      'components/pedagogy-v2/V2CompletionActivity.jsx',
      'components/pedagogy-v2/V2ExposureActivity.jsx',
      'components/pedagogy-v2/V2Feedback.jsx',
      'components/pedagogy-v2/V2ProductionActivity.jsx',
      'components/pedagogy-v2/V2PronunciationActivity.jsx',
      'components/pedagogy-v2/V2SelectionDetails.jsx',
      'components/pedagogy-v2/V2WordOrderActivity.jsx',
      'components/pedagogy-v2/V2AudioButton.jsx',
      'lib/pedagogy-v2/lesson-engine.js',
      'lib/pedagogy-v2/pilot-session-controller.js',
      'lib/pedagogy-v2/activity-assessment.js',
      'lib/pedagogy-v2/assessment-to-evidence.js',
      'lib/pedagogy-v2/lesson-engine-context.js',
      'lib/pedagogy-v2/registry.js',
      'lib/pedagogy-v2/runtime-capabilities.js',
    ]
    // Pedagogical identifiers/copy of the still pack — forbidden outside the
    // pack, its tests, fixtures and specific documentation.
    const forbidden = /pedagogy_v2_still|lexeme:still|sense:still|construction:still|exemplar:still|uso de still|encontrando still|Laboratório V2 — still/
    for (const f of genericFiles) {
      const src = readFileSync(join(root, f), 'utf8')
      expect(forbidden.test(src), `${f} contains a still hardcode`).toBe(false)
    }
  })
})
