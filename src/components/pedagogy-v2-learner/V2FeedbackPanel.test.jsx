import { describe, expect, it } from 'vitest'
import {
  adaptiveSuggestionLabel,
  adaptiveTargetFormLabel,
} from './V2FeedbackPanel.jsx'

describe('adaptive learner feedback labels', () => {
  it('presents a recoverable linguistic correction before the authored model', () => {
    expect(adaptiveSuggestionLabel({
      variant: 'linguistic',
      index: 0,
      authoredLabel: 'Uma forma possível',
    })).toBe('Sua frase corrigida')

    expect(adaptiveTargetFormLabel({
      variant: 'linguistic',
      hasSuggestions: true,
      authoredLabel: 'Uma forma possível',
    })).toBe('Outro exemplo válido')
  })

  it('turns additional linguistic support into practice examples', () => {
    expect(adaptiveSuggestionLabel({
      variant: 'linguistic',
      index: 1,
      authoredLabel: 'Uma forma possível',
    })).toBe('Exemplo para praticar')
  })

  it('keeps accepted alternatives non-corrective', () => {
    expect(adaptiveSuggestionLabel({
      variant: 'suggestion',
      index: 0,
      authoredLabel: 'Forma mais natural',
    })).toBe('Forma mais natural')

    expect(adaptiveTargetFormLabel({
      variant: 'correct',
      hasSuggestions: false,
      authoredLabel: 'Uma forma possível',
    })).toBe('Uma forma possível')
  })

  it('labels support for semantic or coarse difficulty without claiming a correction', () => {
    for (const variant of ['semantic', 'partial', 'incorrect_unspecified']) {
      expect(adaptiveSuggestionLabel({
        variant,
        index: 0,
        authoredLabel: 'Uma forma possível',
      })).toBe('Exemplo para praticar')
    }

    expect(adaptiveTargetFormLabel({
      variant: 'semantic',
      hasSuggestions: true,
      authoredLabel: 'Uma forma possível',
    })).toBe('Forma de referência')
  })
})
