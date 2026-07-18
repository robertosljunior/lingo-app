// pedagogy-v2-study-lab.test.jsx — UI tests for the Slice V2.6 study-mode
// additions (§27): the three study-mode entries, preserved focused sessions,
// factual review count, empty review handling and the no-global-mastery /
// no-global-level invariants. Interactive session flow and the live pack
// transition banner are covered end-to-end by e2e/pedagogy-v2-study.spec.js.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildLearnerEvidenceV2 } from '../lib/pedagogy-v2/learner-evidence-contracts.js'
import { aggregateProfileEvidence } from '../lib/pedagogy-v2/learner-model.js'

const noop = () => {}
const DAY = 24 * 60 * 60 * 1000
const NOW = Date.now()

// Build real aggregated states from evidence so the review queue is realistic.
function statesWithOverdueReview() {
  const ev = (i) => buildLearnerEvidenceV2({
    evidence_id: `evidence:ui.${i}`, profile_id: 'p1', interaction_id: `interaction:ui.${i}`,
    target: { target_type: 'sense', target_id: 'sense:still.continuity' },
    exemplar_id: null,
    activity: { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' },
    attribution: 'direct', outcome: 'correct',
    occurred_at: new Date(NOW - 8 * DAY + i * 60000).toISOString(),
    source: { source_type: 'test' },
  })
  return aggregateProfileEvidence([ev(0)]) // single retrieval 8d ago → overdue
}

function mockApp({ enabled = true, params = {}, states = [] } = {}) {
  vi.doMock('../store.jsx', () => ({
    SCREENS: { HOME: 'home', TRAINING: 'training', PEDAGOGY_V2_PILOT: 'pedagogy_v2_pilot' },
    useApp: () => ({
      settings: { pedagogy_v2_pilot_enabled: enabled },
      activeProfile: 'p1',
      params,
      db: {
        getLearnerTargetStatesV2: async () => states,
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

// The async effect that loads states resolves after render; for static markup
// we assert on what renders synchronously (mode cards, pack list, invariants).
afterEach(() => {
  vi.doUnmock('../store.jsx')
  vi.resetModules()
})

describe('§27.37–39 — study mode entries', () => {
  it('shows Sessão adaptativa, Revisão and Explorar', async () => {
    const html = await renderLab({ params: {} })
    expect(html).toContain('v2-mode-adaptive')
    expect(html).toContain('Sessão adaptativa')
    expect(html).toContain('v2-mode-review')
    expect(html).toContain('Revisão')
    expect(html).toContain('v2-mode-explore')
    expect(html).toContain('Explorar')
    expect(html).toContain('O aplicativo escolhe o próximo foco com base no que você já praticou.')
  })

  it('never surfaces "IA escolhe", automatic level, or a global mastery on the modes', async () => {
    const html = await renderLab({ params: {} })
    expect(html).not.toMatch(/IA escolhe|nível autom|mastery global/i)
  })
})

describe('§27.40–41 — focused sessions preserved', () => {
  it('40: selecting a still pack opens the focused still session', async () => {
    const html = await renderLab({ params: { packId: 'pedagogy_v2_still' } })
    expect(html).toContain('v2-pilot-screen')
    expect(html).toContain('data-pack-id="pedagogy_v2_still"')
    expect(html).toContain('Laboratório V2 — still')
  })

  it('41: selecting a but pack opens the focused but session', async () => {
    const html = await renderLab({ params: { packId: 'pedagogy_v2_but' } })
    expect(html).toContain('v2-pilot-screen')
    expect(html).toContain('data-pack-id="pedagogy_v2_but"')
    expect(html).toContain('Laboratório V2 — but')
  })
})

describe('§27.42–43 — review count', () => {
  it('42: the review card renders a factual count (never a score)', async () => {
    const html = await renderLab({ params: {}, states: statesWithOverdueReview() })
    // The count element is present; its value fills in after the async load
    // (covered live by E2E). Structurally, it is factual text, not a percentage.
    expect(html).toContain('v2-review-count')
    expect(html).toContain('Revisões disponíveis:')
    expect(html).not.toMatch(/Revisões disponíveis:\s*\d+\s*%/)
  })

  it('43: a brand-new learner sees the review entry without error', async () => {
    const html = await renderLab({ params: {}, states: [] })
    expect(html).toContain('v2-mode-review')
  })
})

describe('§27.44 — study-mode routing', () => {
  it('opening a study mode renders the study screen with its title', async () => {
    const html = await renderLab({ params: { mode: 'adaptive' } })
    expect(html).toContain('v2-study-screen')
    expect(html).toContain('data-mode="adaptive"')
  })

  it('an unknown study mode is handled without crashing', async () => {
    const html = await renderLab({ params: { mode: 'nonsense' } })
    expect(html).toContain('v2-pack-invalid')
  })
})

describe('§27.45–46 — no global mastery / level anywhere in the lab home', () => {
  it('the selection screen never shows a percentage, CEFR level or "learned"', async () => {
    const html = await renderLab({ params: {}, states: statesWithOverdueReview() })
    expect(html).not.toMatch(/%|\bA1\b|\bB2\b|mastery|domínio|aprendida|conclu[ií]d/i)
  })
})

describe('§36 — static guarantees: no still/but hardcode in the planner layer', () => {
  it('the study-planner modules carry no pedagogical still/but identifiers or global mastery', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const { dirname, join } = await import('node:path')
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'pedagogy-v2')
    const forbidden = /pedagogy_v2_still|pedagogy_v2_but|lexeme:still|lexeme:but|sense:still|sense:but|construction:still|construction:but/
    for (const f of ['study-planner.js', 'study-planner-contracts.js', 'study-planner-context.js', 'review-queue.js', 'study-session-controller.js']) {
      const src = readFileSync(join(root, f), 'utf8')
      expect(forbidden.test(src), `${f} contains a pack-specific hardcode`).toBe(false)
      expect(/mastery_global|global_mastery/.test(src), `${f} references a global mastery`).toBe(false)
    }
  })
})
