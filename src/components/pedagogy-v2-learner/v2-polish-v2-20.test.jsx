// v2-polish-v2-20.test.jsx — Slice V2.20 regression tests for the UX/UI polish.
//
// These lock the polish decisions that are easy to silently undo (a sentence
// card creeping back, a nested feedback card, a "Forma correta" string, the
// context_recognition answer leaking above the options) AND the honesty rules
// that the redesign must not touch (§18/§22/§25/§26/§27).
//
// Static rendering only — interaction lives in the Playwright suites.

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import stillPack from '../../content/pedagogy-v2/still.json'
import { createLessonSessionV2 } from '../../lib/pedagogy-v2/lesson-engine-contracts.js'
import { selectNextActivityV2 } from '../../lib/pedagogy-v2/lesson-engine.js'
import V2LearnerActivity from './V2LearnerActivity.jsx'
import V2FeedbackPanel from './V2FeedbackPanel.jsx'
import V2Sentence from './V2Sentence.jsx'
import V2DevExperienceSwitch from './V2DevExperienceSwitch.jsx'

const NOW = '2026-07-01T10:00:00.000Z'
const CAPS = { text_input: true, audio_output: true, speech_input: true, semantic_assessment: true, pronunciation_assessment: false }
const noop = () => {}

const base = selectNextActivityV2({
  session: createLessonSessionV2({ session_id: 's', profile_id: 'p', now: NOW }),
  pack: stillPack, learnerStates: [], recentEvidence: [],
}).plan
const variant = (over) => ({ ...base, ...over })

const render = (plan, over = {}) => renderToStaticMarkup(
  <V2LearnerActivity plan={plan} capabilities={CAPS} settings={{}} busy={false} answered={false}
    assessment={null} onSubmit={noop} onSupport={noop} onSubmittable={noop} {...over} />,
)

const fb = (over) => ({
  outcome_status: 'correct', visual_variant: 'correct', tone: 'correct', headline: 'Correto',
  body: null, correct_points: [], issues: [], suggestions: [], target_form: null,
  target_form_note: null, detail: null, ...over,
})

// ---- §5 the sentence is the protagonist, never inside a card ----------------

describe('V2Sentence (§5)', () => {
  it('renders context size variants as classes, not inline font sizes (§35)', () => {
    for (const v of ['exposure', 'completion', 'speaking', 'prompt']) {
      const html = renderToStaticMarkup(<V2Sentence variant={v}>x</V2Sentence>)
      expect(html).toContain(`v2lx-sentence--${v}`)
      expect(html).not.toMatch(/font-size/)
    }
  })

  it('falls back to the exposure variant for an unknown context', () => {
    expect(renderToStaticMarkup(<V2Sentence variant="nope">x</V2Sentence>)).toContain('v2lx-sentence--exposure')
  })
})

describe('no sentence card remains (§5/§11)', () => {
  const cases = {
    exposure: base,
    fixed_element_completion: variant({
      recipe: 'fixed_element_completion', support: { features: ['word_bank'], derived_tier: 'high' },
      presentation: { instructions_pt: 'Complete a frase.', show: ['text_pt'], masked_text_source: { fixed_elements: ['still'] } },
    }),
    pronunciation: variant({
      recipe: 'pronunciation', modality: 'speaking', support: { features: [], derived_tier: 'high' },
      presentation: { instructions_pt: 'Leia em voz alta.', show: ['text_en'] },
    }),
  }
  for (const [recipe, plan] of Object.entries(cases)) {
    it(`${recipe} renders the sentence directly on the background`, () => {
      const html = render(plan)
      expect(html).toContain('v2lx-sentence')
      // The white/shadowed card wrapper is gone from every sentence surface.
      expect(html).not.toContain('v2lx-card')
    })
  }
})

// ---- §8/§9 recognition ------------------------------------------------------

describe('recognition (§8/§9)', () => {
  const options = [
    { option_id: 'option:1', text_pt: 'Quando algo continua verdadeiro.', source_exemplar_id: 'exemplar:still.001', is_target: true },
    { option_id: 'option:2', text_pt: 'Quando algo já terminou.', source_exemplar_id: 'exemplar:still.002', is_target: false },
  ]
  const meaning = variant({
    recipe: 'meaning_recognition',
    presentation: { instructions_pt: 'Escolha a tradução correta da frase.', show: ['text_en'], options },
    response_contract: { response_type: 'option_select', correct_option_id: 'option:1' },
  })
  const context = variant({
    recipe: 'context_recognition',
    context: 'SEGREDO: este é o contexto correto autoral',
    presentation: { instructions_pt: 'Em qual situação essa frase faria sentido?', show: ['text_en'], options, option_kind: 'authored_context' },
    response_contract: { response_type: 'option_select', correct_option_id: 'option:1' },
  })

  it('drops the redundant "Toque na opção correta." instruction (§8)', () => {
    expect(render(meaning)).not.toMatch(/toque na opção/i)
  })

  it('uses the Engine-authored instruction as the question — React writes none', () => {
    expect(render(meaning)).toContain('Escolha a tradução correta da frase.')
  })

  it('context_recognition renders as a real recipe, not "não suportada" (§9)', () => {
    const html = render(context)
    expect(html).toContain('v2lx-activity-context_recognition')
    expect(html).not.toContain('v2lx-unknown-recipe')
  })

  it('context_recognition never leaks the correct context outside the options (§9)', () => {
    const html = render(context)
    // The authored context is the ANSWER; it must appear only inside options.
    expect(html).not.toContain('SEGREDO')
    expect(html).toContain('Em qual situação essa frase faria sentido?')
    expect(html).toContain('Quando algo continua verdadeiro.')
  })

  it('listening never shows the target text before the answer (§10)', () => {
    const listening = variant({
      recipe: 'listening_recognition',
      presentation: { instructions_pt: 'Ouça a frase e escolha a tradução correta.', show: [], options },
    })
    const html = render(listening)
    expect(html).not.toContain(base.text_en)
    // The audio button carries more visual presence than in exposure.
    expect(html).toContain('v2lx-audio-hero')
  })

  it('exposure keeps audio as a SECONDARY pill (§7)', () => {
    const html = render(base)
    expect(html).toContain('v2lx-audio-pill')
    expect(html).not.toContain('v2lx-audio-hero')
  })

  it('marks correct/wrong with a glyph, not colour alone (§37)', () => {
    const html = render(meaning, { answered: true, assessment: { feedback: { correct_option_id: 'option:1', chosen_option_id: 'option:2' } } })
    expect(html).toContain('data-result="correct"')
    expect(html).toContain('aria-label="correta"')
    expect(html).toContain('aria-label="sua escolha"')
  })
})

// ---- §13/§14 production identity -------------------------------------------

describe('production identity (§13/§14)', () => {
  const guided = variant({
    recipe: 'guided_production', modality: 'writing', support: { features: [], derived_tier: 'high' },
    presentation: { instructions_pt: 'Produza a frase.', show: ['context', 'text_pt'] },
  })
  const free = variant({
    recipe: 'free_production', modality: 'writing', support: { features: [], derived_tier: 'medium' },
    presentation: { instructions_pt: 'Responda em inglês.', show: ['context'] },
  })

  it('guided uses the blue accent rule, free uses the violet one — same family', () => {
    expect(render(guided)).toContain('data-accent="guided"')
    expect(render(free)).toContain('data-accent="free"')
  })

  it('neither uses a filled prompt card', () => {
    for (const p of [guided, free]) {
      const html = render(p)
      expect(html).toContain('v2lx-accent')
      expect(html).not.toContain('v2lx-card')
    }
  })

  it('the textarea is the protagonist (bottom-rule "write" input, not a boxed field)', () => {
    expect(render(free)).toContain('v2lx-write')
  })

  it('never shows a reference form before submission (§13)', () => {
    const html = render(free)
    expect(html).not.toMatch(/forma de referência|uma forma possível/i)
  })
})

// ---- §17–§25 feedback: flattened but semantically unchanged -----------------

describe('feedback flattening (§17)', () => {
  it('the suggestion block is a hairline section, never a nested card (§20)', () => {
    const html = renderToStaticMarkup(<V2FeedbackPanel feedback={fb({
      visual_variant: 'suggestion', tone: 'suggestion', headline: 'Muito bom',
      suggestions: [{ label: 'Forma mais natural', text: 'Com “price”, “high” soa mais natural:' }],
      target_form: { text_en: 'This price is very high.', text_pt: null, label: 'Uma forma possível' },
    })} />)
    expect(html).toContain('v2lx-fb-note')
    // The nested card had its own background/radius; the flattened note does not.
    expect(html).not.toContain('v2lx-card')
    expect(html).toContain('Forma mais natural')
  })

  it('disclosure text lands directly in the panel, with no second card (§21)', () => {
    const html = renderToStaticMarkup(<V2FeedbackPanel feedback={fb({ detail: 'explicação mais profunda' })} />)
    expect(html).toContain('v2lx-fb-disclose')
    expect(html).toContain('aria-expanded="false"')
  })

  it('keeps the same-screen aria-live contract (§16/§37)', () => {
    const html = renderToStaticMarkup(<V2FeedbackPanel feedback={fb()} />)
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('role="status"')
  })
})

describe('feedback honesty is untouched by the redesign (§18/§22/§25)', () => {
  it('naturalness renders as a suggestion, never as an error (§20/§27)', () => {
    const html = renderToStaticMarkup(<V2FeedbackPanel feedback={fb({
      visual_variant: 'suggestion', tone: 'suggestion', headline: 'Muito bom',
      correct_points: [{ text: 'A estrutura principal funciona.' }],
      suggestions: [{ label: 'Forma mais natural', text: 'Com “price”, “high” costuma soar mais natural:' }],
      target_form: { text_en: 'This price is very high.', text_pt: null, label: 'Uma forma possível' },
    })} />)
    expect(html).toContain('data-variant="suggestion"')
    expect(html).not.toMatch(/forma correta|resposta correta|erro/i)
  })

  it('semantic mismatch never becomes a generic "Vocabulário" fallback (§22/§26)', () => {
    const html = renderToStaticMarkup(<V2FeedbackPanel feedback={fb({
      outcome_status: 'incorrect', visual_variant: 'semantic', tone: 'semantic', headline: 'Outra ideia',
      body: 'A frase expressa uma ideia diferente da atividade.',
    })} />)
    expect(html).toContain('data-variant="semantic"')
    expect(html).not.toMatch(/vocabulário|gramática|revise a escolha de palavras/i)
  })

  it('an unspecified incorrect invents no category (§23)', () => {
    const html = renderToStaticMarkup(<V2FeedbackPanel feedback={fb({
      outcome_status: 'incorrect', visual_variant: 'incorrect_unspecified', tone: 'unknown', headline: 'Ainda não',
      body: 'Essa resposta ainda não corresponde ao que a atividade pediu.',
    })} />)
    expect(html).not.toMatch(/vocabulário|gramática|verbo|preposição/i)
  })

  it('unable_to_assess is not framed as a failure and uses no error tone (§24)', () => {
    const html = renderToStaticMarkup(<V2FeedbackPanel feedback={fb({
      outcome_status: 'unable_to_assess', visual_variant: 'unable_to_assess', tone: 'unknown',
      headline: 'Não deu para confirmar',
    })} />)
    expect(html).toContain('data-tone="unknown"')
    expect(html).not.toContain('data-tone="linguistic"')
    expect(html).not.toMatch(/errad|incorret/i)
  })

  it('a reference form is NEVER labelled "Forma correta" (§25 regression gate)', () => {
    const html = renderToStaticMarkup(<V2FeedbackPanel feedback={fb({
      target_form: { text_en: 'I still live here.', text_pt: null, label: 'Uma forma possível' },
    })} />)
    expect(html).toContain('Uma forma possível')
    expect(html).not.toMatch(/forma correta|resposta correta/i)
  })
})

// ---- §2 dev switch ----------------------------------------------------------

describe('V2DevExperienceSwitch (§2)', () => {
  it('shows both experiences and marks the active one without colour alone', () => {
    const html = renderToStaticMarkup(<V2DevExperienceSwitch mode="v2" onChange={noop} />)
    expect(html).toContain('data-testid="v2lx-dev-experience-v2"')
    expect(html).toContain('data-testid="v2lx-dev-experience-v1"')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('Legado V1')
  })
})
