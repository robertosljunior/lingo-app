// v2-learner-components.test.jsx — Slice V2.17 component tests (§40) using
// react-dom/server static rendering (the repo's node-env vitest setup;
// interactive behavior is covered by e2e/pedagogy-v2-learner.spec.js). Every
// assertion protects a learner-facing rule: honest feedback, no leaked internal
// ids, no invented linguistic claims, no fake progress denominator.

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import stillPack from '../../content/pedagogy-v2/still.json'
import { createLessonSessionV2 } from '../../lib/pedagogy-v2/lesson-engine-contracts.js'
import { selectNextActivityV2 } from '../../lib/pedagogy-v2/lesson-engine.js'
import V2FeedbackPanel from './V2FeedbackPanel.jsx'
import V2NewUseBanner from './V2NewUseBanner.jsx'
import V2PackTransition from './V2PackTransition.jsx'
import V2SessionSummary from './V2SessionSummary.jsx'
import V2LessonHeader from './V2LessonHeader.jsx'
import V2ActivityStage from './V2ActivityStage.jsx'
import V2LearnerActivity from './V2LearnerActivity.jsx'

const NOW = '2026-07-01T10:00:00.000Z'
const CAPS = { text_input: true, audio_output: true, speech_input: true, semantic_assessment: true, pronunciation_assessment: false }
const noop = () => {}

const realDecision = selectNextActivityV2({
  session: createLessonSessionV2({ session_id: 'sess1', profile_id: 'p1', now: NOW }),
  pack: stillPack, learnerStates: [], recentEvidence: [],
})
const exposurePlan = realDecision.plan
const variant = (over) => ({ ...exposurePlan, ...over })
const options = [
  { option_id: 'option:1', text_pt: 'Eu ainda moro aqui.', source_exemplar_id: 'exemplar:still.001', is_target: true },
  { option_id: 'option:2', text_pt: 'Eu me mudei.', source_exemplar_id: 'exemplar:still.002', is_target: false },
]

const PLANS = {
  exposure: exposurePlan,
  meaning_recognition: variant({ recipe: 'meaning_recognition', presentation: { instructions_pt: 'x', show: ['text_en'], options }, response_contract: { response_type: 'option_select', correct_option_id: 'option:1' } }),
  fixed_element_completion: variant({ recipe: 'fixed_element_completion', support: { features: ['word_bank'], derived_tier: 'high' }, presentation: { instructions_pt: 'x', show: ['text_pt'], masked_text_source: { fixed_elements: ['still'] } } }),
  word_order_reconstruction: variant({ recipe: 'word_order_reconstruction', presentation: { instructions_pt: 'x', show: ['text_pt'], token_source: { tokenization: 'text_en_whitespace', presentation_order: 'lexicographic' } } }),
  guided_production: variant({ recipe: 'guided_production', modality: 'writing', support: { features: ['translation'], derived_tier: 'high' }, presentation: { instructions_pt: 'x', show: ['context', 'text_pt'] } }),
  free_production: variant({ recipe: 'free_production', modality: 'writing', support: { features: ['hint'], derived_tier: 'medium' }, presentation: { instructions_pt: 'x', show: ['context'] } }),
  pronunciation: variant({ recipe: 'pronunciation', modality: 'speaking', support: { features: [], derived_tier: 'high' }, presentation: { instructions_pt: 'x', show: ['text_en'] } }),
}

const feedback = (over) => ({
  outcome_status: 'correct', visual_variant: 'correct', tone: 'correct', headline: 'Correto',
  body: null, correct_points: [], issues: [], suggestions: [], target_form: null, target_form_note: null, detail: null,
  ...over,
})

// ---- §40 feedback panel -----------------------------------------------------

describe('V2FeedbackPanel', () => {
  it('renders correct with an aria-live region and the outcome/variant attributes', () => {
    const html = renderToStaticMarkup(<V2FeedbackPanel feedback={feedback()} />)
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('data-variant="correct"')
    expect(html).toContain('data-outcome="correct"')
    expect(html).toContain('Correto')
  })

  it('suggestion shows the naturalness label, never an error/issue', () => {
    const html = renderToStaticMarkup(<V2FeedbackPanel feedback={feedback({
      visual_variant: 'suggestion', tone: 'suggestion', headline: 'Muito bom',
      correct_points: [{ text: 'A estrutura principal funciona.' }],
      suggestions: [{ text: 'Com “price”, “high” costuma soar mais natural.', label: 'Forma mais natural' }],
      target_form: { text_en: 'This price is very high.', text_pt: null, label: 'Uma forma possível' },
    })} />)
    expect(html).toContain('Forma mais natural')
    expect(html).toContain('This price is very high.')
    expect(html).not.toMatch(/erro|error/i)
  })

  it('semantic body never claims grammar is correct (§10)', () => {
    const html = renderToStaticMarkup(<V2FeedbackPanel feedback={feedback({
      outcome_status: 'incorrect', visual_variant: 'semantic', tone: 'semantic', headline: 'Outra ideia',
      body: 'A frase expressa uma ideia diferente da atividade.',
    })} />)
    expect(html).toContain('Outra ideia')
    expect(html).not.toMatch(/gramática|estrutura.*correta|verbo.*correto/i)
  })

  it('linguistic shows the issue line; progressive disclosure only with detail (§8)', () => {
    const withDetail = renderToStaticMarkup(<V2FeedbackPanel feedback={feedback({
      outcome_status: 'incorrect', visual_variant: 'linguistic', tone: 'linguistic', headline: 'Vamos ajustar',
      issues: [{ text: 'Concordância', detail: 'O verbo não concorda com o sujeito.', span: null, category: 'grammar' }],
      detail: 'O verbo não concorda com o sujeito.',
    })} />)
    expect(withDetail).toContain('Concordância')
    expect(withDetail).toContain('Entender melhor')
    const noDetail = renderToStaticMarkup(<V2FeedbackPanel feedback={feedback({ visual_variant: 'partial', tone: 'partial', headline: 'Quase lá' })} />)
    expect(noDetail).not.toContain('Entender melhor')
  })

  it('unable_to_assess is non-punitive copy, not an error (§11/§44)', () => {
    const html = renderToStaticMarkup(<V2FeedbackPanel feedback={feedback({
      outcome_status: 'not_assessed', visual_variant: 'unable_to_assess', tone: 'unknown', headline: 'Não deu para confirmar',
      body: 'Não consegui confirmar essa resposta com segurança.',
    })} />)
    expect(html).toContain('Não consegui confirmar')
    expect(html).not.toMatch(/errad|incorret/i)
  })
})

// ---- §40 banners ------------------------------------------------------------

describe('V2NewUseBanner / V2PackTransition', () => {
  it('new-use banner reinforces the old use stays valid; leaks no reason codes (§16/§18)', () => {
    const html = renderToStaticMarkup(<V2NewUseBanner newUse={{ known_word: 'yet', headline: 'Você já conhece “yet”.', subhead: 'Agora veja outra maneira de usar essa palavra.', reassurance: 'O que você já sabia continua valendo.', cross_pack_hint: 'Esta ideia se conecta a algo que você já praticou.' }} />)
    expect(html).toContain('Você já conhece')
    expect(html).toContain('já praticou')
    expect(html).not.toMatch(/KNOWN_|CROSS_PACK|reason_code|line-through/i)
  })

  it('pack transition shows a headline and never struck-through content (§16)', () => {
    const html = renderToStaticMarkup(<V2PackTransition transition={{ from_label: 'still', to_label: 'yet', headline: 'Agora vamos ver “yet”.', subhead: 'Uma nova maneira — o que você já viu continua valendo.', cross_pack_hint: null }} />)
    expect(html).toContain('Agora vamos ver')
    expect(html).not.toMatch(/line-through|text-decoration:\s*line/i)
  })
})

// ---- §40 session summary + §26 header ---------------------------------------

describe('V2SessionSummary / V2LessonHeader', () => {
  it('summary renders factual facts only — no %/mastery (§47)', () => {
    const html = renderToStaticMarkup(<V2SessionSummary summary={{ facts: [{ icon: '✎', text: 'Você praticou 6 atividades.' }, { icon: '✦', text: 'Novo uso encontrado: “yet”.' }] }} onFinish={noop} />)
    expect(html).toContain('Você praticou 6 atividades.')
    expect(html).toContain('Novo uso encontrado')
    expect(html).not.toMatch(/%|CEFR|domínio|master/i)
  })

  it('header shows a factual counter and a progressbar with NO fake denominator (§26)', () => {
    const html = renderToStaticMarkup(<V2LessonHeader focusLabel="still" activityNumber={4} onClose={noop} />)
    expect(html).toContain('Atividade 4')
    expect(html).toContain('role="progressbar"')
    // No "step / total" style denominator.
    expect(html).not.toMatch(/\bde\s+\d+\b|\/\s*\d+/)
  })
})

// ---- §29/§30 stage motion ---------------------------------------------------

describe('V2ActivityStage motion', () => {
  it('animates the stage phase by default', () => {
    const html = renderToStaticMarkup(<V2ActivityStage phase="in" reducedMotion={false} onStageEnd={noop}><div>x</div></V2ActivityStage>)
    expect(html).toContain('data-phase="in"')
  })
  it('reduced motion renders a static stage (no slide) (§30)', () => {
    const html = renderToStaticMarkup(<V2ActivityStage phase="out" reducedMotion onStageEnd={noop}><div>x</div></V2ActivityStage>)
    expect(html).toContain('data-phase="static"')
    expect(html).not.toContain('data-phase="out"')
  })
})

// ---- §40/§37 activity renderers — every recipe, no leaked ids ----------------

describe('V2LearnerActivity — every recipe renders learner-facing, id-free', () => {
  const render = (plan, extra = {}) => renderToStaticMarkup(
    <V2LearnerActivity plan={plan} capabilities={CAPS} settings={{}} busy={false} answered={false} assessment={null} onSubmit={noop} onSupport={noop} onSubmittable={noop} {...extra} />
  )
  for (const [recipe, plan] of Object.entries(PLANS)) {
    it(`${recipe} renders and leaks no internal id (§37)`, () => {
      const html = render(plan)
      expect(html).toContain(`v2lx-activity-${recipe === 'meaning_recognition' ? 'meaning_recognition' : recipe.replace('fixed_element_completion', 'completion').replace('word_order_reconstruction', 'word-order').replace('guided_production', 'guided_production').replace('free_production', 'free_production').replace('pronunciation', 'pronunciation')}`)
      // No exemplar/activity/target/session ids reach the learner surface.
      expect(html).not.toMatch(/exemplar:|activity:|target_id|session_id|evidence:|construction:|sense:/)
    })
  }

  it('exposure shows the sentence + translation, no correct/incorrect (§20)', () => {
    const html = render(PLANS.exposure)
    expect(html).toContain('Observe')
    expect(html).toContain(exposurePlan.text_en)
    expect(html).not.toMatch(/correto|incorreto/i)
  })

  it('recognition marks the expected option after answering (§21)', () => {
    const assessment = { feedback: { kind: 'choice', correct_option_id: 'option:1', chosen_option_id: 'option:2' } }
    const html = render(PLANS.meaning_recognition, { answered: true, assessment })
    expect(html).toContain('data-result="correct"')
    expect(html).toContain('data-result="wrong"')
  })

  it('pronunciation with no acoustic assessor is practice, never a score (§25/§46)', () => {
    const html = render(PLANS.pronunciation)
    expect(html).toContain('sem nota de pronúncia')
    expect(html).not.toMatch(/pronúncia correta|score|nota:\s*\d/i)
  })
})
