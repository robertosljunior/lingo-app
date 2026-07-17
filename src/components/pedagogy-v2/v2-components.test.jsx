// v2-components.test.jsx — component tests for the V2 pilot UI using static
// server rendering (react-dom/server), the render infrastructure available in
// this repo's node-environment vitest setup. Interactive behavior (clicks,
// typing, audio) is covered end-to-end by e2e/pedagogy-v2-pilot.spec.js.

import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import stillPack from '../../content/pedagogy-v2/still.json'
import { createLessonSessionV2 } from '../../lib/pedagogy-v2/lesson-engine-contracts.js'
import { selectNextActivityV2 } from '../../lib/pedagogy-v2/lesson-engine.js'
import V2ActivityRenderer from './V2ActivityRenderer.jsx'
import V2Feedback from './V2Feedback.jsx'
import V2SelectionDetails from './V2SelectionDetails.jsx'

const NOW = '2026-07-01T10:00:00.000Z'
const CAPS = { text_input: true, audio_output: true, speech_input: false, semantic_assessment: true, pronunciation_assessment: false }
const noop = () => {}

// A REAL engine plan (exposure for a brand-new learner)…
const realDecision = selectNextActivityV2({
  session: createLessonSessionV2({ session_id: 'sess1', profile_id: 'p1', now: NOW }),
  pack: stillPack, learnerStates: [], recentEvidence: [],
})
const exposurePlan = realDecision.plan

// …and hand-shaped plans reusing its structure for the other recipes.
const variant = (over) => ({ ...exposurePlan, ...over })
const options = [
  { option_id: 'option:1', text_pt: 'Eu ainda moro aqui.', source_exemplar_id: 'exemplar:still.001', is_target: true },
  { option_id: 'option:2', text_pt: 'Eu me mudei.', source_exemplar_id: 'exemplar:still.002', is_target: false },
]

const PLANS = {
  exposure: exposurePlan,
  meaning_recognition: variant({
    recipe: 'meaning_recognition',
    presentation: { instructions_pt: 'Escolha a tradução.', show: ['text_en'], options },
    response_contract: { response_type: 'option_select', correct_option_id: 'option:1' },
  }),
  listening_recognition: variant({
    recipe: 'listening_recognition',
    presentation: { instructions_pt: 'Ouça.', show: [], options, audio_reference: { type: 'authored_exemplar_audio', exemplar_id: exposurePlan.exemplar_id } },
    response_contract: { response_type: 'option_select', correct_option_id: 'option:1' },
  }),
  fixed_element_completion: variant({
    recipe: 'fixed_element_completion',
    support: { features: ['word_bank'], derived_tier: 'high' },
    presentation: { instructions_pt: 'Complete.', show: ['text_pt'], masked_text_source: { exemplar_id: exposurePlan.exemplar_id, mask: 'construction_fixed_elements', fixed_elements: ['still'] } },
  }),
  word_order_reconstruction: variant({
    recipe: 'word_order_reconstruction',
    presentation: { instructions_pt: 'Ordene.', show: ['text_pt'], token_source: { exemplar_id: exposurePlan.exemplar_id, tokenization: 'text_en_whitespace', presentation_order: 'lexicographic' } },
  }),
  guided_production: variant({
    recipe: 'guided_production', modality: 'writing',
    support: { features: ['model_sentence', 'translation'], derived_tier: 'high' },
    presentation: { instructions_pt: 'Produza.', show: ['context', 'text_pt'], model_reference: { exemplar_id: exposurePlan.exemplar_id } },
  }),
  free_production: variant({
    recipe: 'free_production', modality: 'writing',
    support: { features: ['hint'], derived_tier: 'medium' },
    presentation: { instructions_pt: 'Responda.', show: ['context'] },
  }),
  pronunciation: variant({
    recipe: 'pronunciation', modality: 'speaking',
    support: { features: ['model_sentence', 'audio_replay'], derived_tier: 'high' },
    presentation: { instructions_pt: 'Leia em voz alta.', show: ['text_en'], audio_reference: { type: 'authored_exemplar_audio', exemplar_id: exposurePlan.exemplar_id } },
  }),
}

const render = (plan) => renderToStaticMarkup(
  <V2ActivityRenderer plan={plan} capabilities={CAPS} settings={{}} busy={false} onSubmit={noop} onSupport={noop} />
)

describe('V2ActivityRenderer — every recipe renders', () => {
  for (const [recipe, plan] of Object.entries(PLANS)) {
    it(recipe, () => {
      const html = render(plan)
      expect(html.length).toBeGreaterThan(50)
      expect(html).toContain(plan.presentation.instructions_pt)
    })
  }

  it('exposure shows the full sentence, translation and continue button', () => {
    const html = render(PLANS.exposure)
    expect(html).toContain('I still live here.')
    expect(html).toContain('Eu ainda moro aqui.')
    expect(html).toContain('v2-continue')
  })

  it('listening never shows the English sentence before the answer, but audio is present', () => {
    const html = render(PLANS.listening_recognition)
    expect(html).not.toContain('I still live here.')
    expect(html).toContain('v2-audio-button')
    expect(html).toContain('Eu ainda moro aqui.') // the pt options ARE shown
  })

  it('meaning recognition shows exactly the declared options, none marked correct', () => {
    const html = render(PLANS.meaning_recognition)
    expect(html).toContain('v2-option-option:1')
    expect(html).toContain('v2-option-option:2')
    expect(html).not.toContain('correct')
  })

  it('completion masks only the fixed element and offers the declared word bank', () => {
    const html = render(PLANS.fixed_element_completion)
    expect(html).toContain('I ___ live here.')
    expect(html).toContain('v2-word-bank')
  })

  it('word order shows every token in plan-declared lexicographic order', () => {
    const html = render(PLANS.word_order_reconstruction)
    for (const t of ['I', 'still', 'live', 'here.']) expect(html).toContain(`>${t}</button>`)
    expect(html.indexOf('>here.<')).toBeLessThan(html.indexOf('>still<'))
  })

  it('free production has a free field and no word bank', () => {
    const html = render(PLANS.free_production)
    expect(html).toContain('v2-production-input')
    expect(html).not.toContain('v2-word-bank')
    expect(html).not.toContain('I still live here.') // reference hidden before answer
  })

  it('pronunciation states availability and disables recording without STT', () => {
    const html = render(PLANS.pronunciation)
    expect(html).toContain('ainda não é avaliada automaticamente')
    expect(html).toContain('v2-record-unavailable')
  })
})

describe('V2Feedback', () => {
  const feedback = (status, outcome) => renderToStaticMarkup(
    <V2Feedback plan={PLANS.meaning_recognition}
      assessment={{ status, outcome, feedback: {}, assessment_confidence: 1 }}
      busy={false} onContinue={noop} onTryAgain={noop} />
  )

  it('renders each state with reference sentence and continue button', () => {
    for (const [status, outcome, marker] of [
      ['assessed', 'correct', 'data-state="correct"'],
      ['assessed', 'partial', 'data-state="partial"'],
      ['assessed', 'incorrect', 'data-state="incorrect"'],
      ['not_assessed', 'observed', 'data-state="not_assessed"'],
      ['unable_to_assess', 'not_assessed', 'data-state="unable_to_assess"'],
    ]) {
      const html = feedback(status, outcome)
      expect(html).toContain(marker)
      expect(html).toContain('I still live here.')
      expect(html).toContain('v2-feedback-continue')
    }
  })

  it('offers retry on incorrect, not on correct, and never claims the word was learned', () => {
    expect(feedback('assessed', 'incorrect')).toContain('v2-feedback-retry')
    const ok = feedback('assessed', 'correct')
    expect(ok).not.toContain('v2-feedback-retry')
    expect(ok).not.toMatch(/aprendeu still/i)
    expect(ok).toContain('reconheceu este uso de still')
  })
})

describe('V2SelectionDetails (diagnostics)', () => {
  it('is hidden by default (visible=false renders nothing)', () => {
    expect(renderToStaticMarkup(<V2SelectionDetails plan={exposurePlan} visible={false} />)).toBe('')
  })
  it('shows the selection trace when explicitly visible', () => {
    const html = renderToStaticMarkup(<V2SelectionDetails plan={exposurePlan} visible />)
    expect(html).toContain('Por que esta atividade foi escolhida?')
    expect(html).toContain(exposurePlan.primary_target.target_id)
  })
})

describe('feature-flag gating (screen)', () => {
  it('the pilot screen blocks access when the flag is off', async () => {
    vi.doMock('../../store.jsx', () => ({
      SCREENS: { HOME: 'home', TRAINING: 'training' },
      useApp: () => ({ settings: { pedagogy_v2_pilot_enabled: false }, activeProfile: 'p1', db: {}, setTab: noop, back: noop }),
    }))
    const { default: Screen } = await import('../../screens/PedagogyV2StillPilot.jsx')
    const html = renderToStaticMarkup(<Screen />)
    expect(html).toContain('v2-pilot-disabled')
    expect(html).not.toContain('v2-pilot-screen')
    vi.doUnmock('../../store.jsx')
  })
})
