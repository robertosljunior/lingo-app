// v2-interactive-ux1.test.jsx — Slice V2.22-UX1 structural regressions for the
// interactive exercises. Static rendering, per this repo's convention (no DOM
// environment is configured; live interaction lives in the Playwright suites).
//
// These lock what is easy to undo silently: a second slot disappearing, a chip
// becoming natively disabled and dropping focus, a per-token verdict creeping
// in, the model sentence going back to being free, the answer being wiped after
// assessment.

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import V2LearnerActivity from './V2LearnerActivity.jsx'
import V2FeedbackPanel from './V2FeedbackPanel.jsx'
import V2SentenceRail from './V2SentenceRail.jsx'
import V2CompletionSlot from './V2CompletionSlot.jsx'
import { wordOrderBank, wordOrderRailItems } from './v2-interaction-state.js'

const CAPS = { text_input: true, audio_output: true, speech_input: true, semantic_assessment: true, pronunciation_assessment: false }
const noop = () => {}

const basePlan = {
  activity_id: 'a1', session_id: 's1', text_en: 'She has not finished it yet', text_pt: 'Ela ainda não terminou.',
  capability: 'controlled_production', modality: 'writing', support: { features: [] },
  presentation: { instructions_pt: 'Complete a frase' }, response_contract: {}, planned_evidence: [],
}
const plan = (over) => ({ ...basePlan, ...over, presentation: { ...basePlan.presentation, ...(over.presentation || {}) } })

const render = (p, over = {}) => renderToStaticMarkup(
  <V2LearnerActivity plan={p} capabilities={CAPS} settings={{}} busy={false} answered={false}
    assessment={null} onSubmit={noop} onSupport={noop} onSubmittable={noop} onRequestSubmit={noop} {...over} />,
)

const COMPLETION_2 = plan({
  recipe: 'fixed_element_completion', support: { features: ['word_bank'] },
  presentation: { masked_text_source: { fixed_elements: ['not', 'yet'] } },
})
const COMPLETION_FREE = plan({
  recipe: 'fixed_element_completion', support: { features: [] },
  presentation: { masked_text_source: { fixed_elements: ['yet'] } },
})
const WORD_ORDER = plan({
  recipe: 'word_order_reconstruction',
  presentation: { instructions_pt: 'Monte a frase', token_source: { presentation_order: 'seeded_shuffle', presented_tokens: ['finished', 'yet', 'She', 'not', 'it', 'has'] } },
})
const GUIDED = plan({
  recipe: 'guided_production', context: 'Diga que ela ainda não terminou.',
  support: { features: ['model_sentence'] }, presentation: { model_reference: true },
})

// ---- §32 completion ---------------------------------------------------------

describe('completion renders one slot per gap (§14)', () => {
  it('draws TWO slots for a two-element mask and no literal blank', () => {
    const html = render(COMPLETION_2)
    expect(html).toContain('data-gaps="2"')
    expect(html).toContain('data-testid="v2lx-slot-0"')
    expect(html).toContain('data-testid="v2lx-slot-1"')
    // The pre-V2.22 renderer left the second gap as a literal `_____`.
    expect(html).not.toContain('_____')
    expect(html).not.toMatch(/_{3,}/)
  })

  it('each slot has its own accessible name and gap index', () => {
    const html = render(COMPLETION_2)
    expect(html).toContain('aria-label="Lacuna 1 vazia"')
    expect(html).toContain('aria-label="Lacuna 2 vazia"')
    expect(html).toContain('data-gap="0"')
    expect(html).toContain('data-gap="1"')
  })

  it('the empty slot never hints at the answer length', () => {
    const html = render(COMPLETION_2)
    // A fixed-measure blank, not one sized from the expected token.
    expect(html).toContain('v2lx-slot-blank')
    expect(html).not.toMatch(/size="(3|4|5)"/) // 'not'.length / 'yet'.length
  })

  it('the word bank is exactly the plan tokens — no distractor (§12)', () => {
    const html = render(COMPLETION_2)
    expect(html).toContain('v2lx-word-bank')
    expect(html).toContain('>not</button>')
    expect(html).toContain('>yet</button>')
    const chips = html.match(/data-testid="v2lx-token-\d+"/g) || []
    expect(chips.length).toBe(2)
  })

  it('12. free input stays a REAL input, never contenteditable (§13)', () => {
    const html = render(COMPLETION_FREE)
    expect(html).toContain('data-testid="v2lx-slot-0"')
    expect(html).toContain('<input')
    expect(html).not.toContain('contenteditable')
    expect(html).toContain('aria-label="Lacuna 1"')
  })

  it('a plan with no maskable element states it and stays non-submittable', () => {
    const html = render(plan({
      recipe: 'fixed_element_completion', support: { features: ['word_bank'] },
      presentation: { masked_text_source: { fixed_elements: ['zzz'] } },
    }))
    expect(html).toContain('v2lx-completion-nogap')
    expect(html).toContain('data-gaps="0"')
    expect(html).not.toContain('data-testid="v2lx-slot-0"')
  })

  it('6. answer reveal is offered as recorded support, and only before the answer', () => {
    expect(render(COMPLETION_2)).toContain('data-testid="v2lx-reveal"')
    expect(render(COMPLETION_2, { answered: true })).not.toContain('data-testid="v2lx-reveal"')
  })

  it('7/8. answered locks the slots and the bank without dropping them from focus', () => {
    const html = render(COMPLETION_2, { answered: true })
    expect(html).toContain('data-testid="v2lx-slot-0"')
    // aria-disabled, not `disabled`: a natively disabled control drops out of
    // the tab order and the browser throws focus to <body>.
    expect(html).toMatch(/v2lx-slot--bank[^>]*aria-disabled="true"/)
  })
})

// ---- §31 word order ---------------------------------------------------------

describe('word order renders a rail, not a box of buttons (§7/§8)', () => {
  it('renders insertion gaps as REAL buttons with clear names', () => {
    const html = render(WORD_ORDER)
    expect(html).toContain('data-testid="v2lx-token-answer"')
    expect(html).toContain('aria-label="Inserir na posição 1"')
    expect(html).toContain('class="v2lx-rail"')
  })

  it('EMPTY state invites the tap and shows no actions yet (§8)', () => {
    const html = render(WORD_ORDER)
    expect(html).toContain('data-empty="true"')
    expect(html).toContain('Toque nas palavras para montar')
    expect(html).not.toContain('Desfazer último')
    expect(html).not.toContain('Recomeçar')
  })

  it('the bank keeps every token and marks used ones by name, not by removal', () => {
    const html = render(WORD_ORDER)
    const chips = html.match(/data-testid="v2lx-token-\d+"/g) || []
    expect(chips.length).toBe(6)
    expect(html).toContain('toque para colocar')
  })

  it('14. no per-token correctness is rendered, ever', () => {
    const html = render(WORD_ORDER, { answered: true, assessment: { feedback: { kind: 'word_order', expected_tokens: ['She'], given_tokens: ['yet'] } } })
    expect(html).not.toMatch(/data-result=/)
    expect(html).not.toMatch(/v2lx-chip--(correct|wrong)/)
  })

  it('a placed token announces its position (duplicates stay distinguishable)', () => {
    const bank = wordOrderBank(WORD_ORDER)
    const html = renderToStaticMarkup(
      <V2SentenceRail items={wordOrderRailItems(bank, [2, 5])} actions={[]} hint="" locked={false}
        onGap={noop} onToken={noop} onMove={noop} />,
    )
    expect(html).toContain('She, posição 1.')
    expect(html).toContain('has, posição 2.')
    expect(html).toContain('Use as setas para mover.')
  })

  it('9/10. a locked rail drops the actions and the reorder affordance', () => {
    const bank = wordOrderBank(WORD_ORDER)
    const html = renderToStaticMarkup(
      <V2SentenceRail items={wordOrderRailItems(bank, [2, 5])} actions={[]} hint="" locked
        onGap={noop} onToken={noop} onMove={noop} />,
    )
    expect(html).toContain('data-locked="true"')
    expect(html).not.toContain('Use as setas para mover.')
  })
})

// ---- §33 guided writing -----------------------------------------------------

describe('guided writing (§16/§17)', () => {
  it('2. the model sentence is NOT free — it is offered, and revealing it is support', () => {
    const html = render(GUIDED)
    expect(html).toContain('data-testid="v2lx-model-reveal"')
    expect(html).toContain('Ver um modelo')
    // The authored model is not on screen until it is asked for.
    expect(html).not.toContain('data-testid="v2lx-model"')
    expect(html).not.toContain(`Modelo: ${GUIDED.text_en}`)
  })

  it('2b. no model affordance at all when the plan does not declare the feature', () => {
    const html = render(plan({ recipe: 'guided_production', context: 'x', support: { features: [] }, presentation: {} }))
    expect(html).not.toContain('v2lx-model-reveal')
    expect(html).not.toContain('v2lx-model"')
  })

  it('the writing area is a continuity column with a factual word count', () => {
    const html = render(GUIDED)
    expect(html).toContain('data-testid="v2lx-write-area"')
    // No count before anything is typed, and never a minimum or a warning.
    expect(html).not.toContain('v2lx-word-count')
    expect(html).not.toMatch(/mínimo|pelo menos|muito curt/i)
  })

  it('4. the learner text is preserved after the answer, not replaced by the reference', () => {
    const html = render(GUIDED, { answered: true })
    expect(html).toContain('data-testid="v2lx-production-input"')
    expect(html).toContain('data-answered="true"')
    // The textarea is still present and disabled — never removed, never refilled
    // with plan.text_en.
    expect(html).toMatch(/<textarea[^>]*disabled/)
  })
})

// ---- §20 the visual layer must not change the outcome -----------------------

describe('VISUAL_VARIANT_MUST_NOT_CHANGE_ASSESSMENT_OUTCOME', () => {
  const fb = (over) => ({
    outcome_status: 'correct', visual_variant: 'correct', tone: 'correct', headline: 'Correto',
    body: null, correct_points: [], issues: [], suggestions: [], target_form: null,
    target_form_note: null, detail: null, ...over,
  })

  it('the continuity rule does not alter the variant, tone or outcome attributes', () => {
    for (const [variant, tone, outcome] of [
      ['correct', 'correct', 'correct'],
      ['suggestion', 'suggestion', 'correct'],
      ['partial', 'partial', 'partial'],
      ['linguistic', 'linguistic', 'incorrect'],
      ['semantic', 'semantic', 'incorrect'],
      ['incorrect_unspecified', 'linguistic', 'incorrect'],
      ['unable_to_assess', 'unknown', 'not_assessed'],
    ]) {
      const html = renderToStaticMarkup(<V2FeedbackPanel feedback={fb({ visual_variant: variant, tone, outcome_status: outcome, headline: 'H' })} />)
      expect(html).toContain(`data-variant="${variant}"`)
      expect(html).toContain(`data-tone="${tone}"`)
      expect(html).toContain(`data-outcome="${outcome}"`)
    }
  })

  it('a suggestion is never dressed as an error, and unknown is never blame', () => {
    const sug = renderToStaticMarkup(<V2FeedbackPanel feedback={fb({
      visual_variant: 'suggestion', tone: 'suggestion', outcome_status: 'correct', headline: 'Aceito',
      suggestions: [{ text: 'Uma forma mais natural.', label: 'Forma mais natural' }],
    })} />)
    expect(sug).toContain('data-outcome="correct"')
    expect(sug).not.toMatch(/erro|errad|incorret/i)

    const unk = renderToStaticMarkup(<V2FeedbackPanel feedback={fb({
      visual_variant: 'unable_to_assess', tone: 'unknown', outcome_status: 'not_assessed',
      headline: 'Não foi possível avaliar', body: 'Isso não conta como erro.',
    })} />)
    expect(unk).toContain('data-outcome="not_assessed"')
    expect(unk).not.toMatch(/você errou|sua falha|incorret/i)
  })
})

// ---- slot primitive ---------------------------------------------------------

describe('V2CompletionSlot', () => {
  it('a filled bank slot says how to undo it', () => {
    const html = renderToStaticMarkup(<V2CompletionSlot gapIndex={0} value="not" mode="bank" />)
    expect(html).toContain('data-filled="true"')
    expect(html).toContain('Toque para limpar.')
  })
  it('an input slot grows with the LEARNER text, never with the answer', () => {
    expect(renderToStaticMarkup(<V2CompletionSlot gapIndex={0} value="" mode="input" />)).toContain('size="6"')
    expect(renderToStaticMarkup(<V2CompletionSlot gapIndex={0} value="already typed" mode="input" />)).toContain('size="14"')
  })
})

describe('punctuation never wraps away from its slot (§26)', () => {
  it('a comma after a gap rides inside the slot’s non-wrapping box', () => {
    const html = render(plan({
      recipe: 'fixed_element_completion', text_en: 'I have not seen it yet, but I will',
      support: { features: ['word_bank'] },
      presentation: { masked_text_source: { fixed_elements: ['not', 'yet'] } },
    }))
    // The comma sits INSIDE the second slot's nowrap wrapper…
    expect(html).toMatch(/v2lx-slot-hold[\s\S]*?data-gap="1"[\s\S]*?<\/button>,<\/span>/)
    // …and the sentence still reads in full, with nothing dropped or doubled.
    const text = html.replace(/<[^>]+>/g, '')
    expect(text).toContain('I have')
    expect(text).toContain(', but I will')
    expect(text.match(/but I will/g)).toHaveLength(1)
  })
})

describe('the §8 visual states are named and addressable', () => {
  const stateOf = (html) => (html.match(/data-state="([a-z_]+)"/) || [])[1]

  it('word order reports EMPTY / SUBMITTING / ANSWERED without reporting correctness', () => {
    expect(stateOf(render(WORD_ORDER))).toBe('empty')
    expect(stateOf(render(WORD_ORDER, { busy: true }))).toBe('submitting')
    expect(stateOf(render(WORD_ORDER, { answered: true }))).toBe('answered')
    // `answered` is the same token whatever the outcome was — the rail never
    // learns whether the learner was right.
    const correct = render(WORD_ORDER, { answered: true, assessment: { outcome: 'correct', feedback: { kind: 'word_order' } } })
    const wrong = render(WORD_ORDER, { answered: true, assessment: { outcome: 'incorrect', feedback: { kind: 'word_order' } } })
    expect(stateOf(correct)).toBe('answered')
    expect(stateOf(wrong)).toBe('answered')
    expect(correct).toBe(wrong)
  })

  it('completion reports EMPTY / SUBMITTING / ANSWERED the same way', () => {
    expect(stateOf(render(COMPLETION_2))).toBe('empty')
    expect(stateOf(render(COMPLETION_2, { busy: true }))).toBe('submitting')
    expect(stateOf(render(COMPLETION_2, { answered: true }))).toBe('answered')
  })
})
