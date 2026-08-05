import { describe, expect, it } from 'vitest'
import {
  computeRecipeRuntimeAvailability,
  detectRuntimeCapabilitiesV2,
  isRecipeExecutable,
} from './runtime-capabilities.js'
import { buildActivityResponseV2 } from './activity-runtime-contracts.js'

function plan({ recipe = 'guided_production', modality = 'speaking' } = {}) {
  return {
    activity_id: `activity:${recipe}:${modality}`,
    recipe,
    activity_kind: recipe,
    capability: recipe === 'free_production' ? 'free_production' : 'controlled_production',
    modality,
    response_contract: {
      accepted_response_types: modality === 'speaking' ? ['speech_transcript'] : ['text'],
    },
    support: { tier: 'none', features: [] },
    planned_evidence: [],
  }
}

describe('RX-7 — speaking runtime respondibility', () => {
  it('blocks guided/free speaking without speech input while keeping writing executable', () => {
    const capabilities = detectRuntimeCapabilitiesV2({
      ttsSupported: true,
      sttSupported: false,
      semanticAvailable: true,
      pronunciationAssessorAvailable: false,
    })
    const availability = computeRecipeRuntimeAvailability(capabilities)

    expect(isRecipeExecutable(availability, 'guided_production', 'speaking')).toBe(false)
    expect(isRecipeExecutable(availability, 'free_production', 'speaking')).toBe(false)
    expect(isRecipeExecutable(availability, 'guided_production', 'writing')).toBe(true)
    expect(isRecipeExecutable(availability, 'free_production', 'writing')).toBe(true)
    expect(availability.unavailable).toEqual(expect.arrayContaining([
      { recipe: 'guided_production', modality: 'speaking', reason: 'RUNTIME_SPEECH_INPUT_UNAVAILABLE' },
      { recipe: 'free_production', modality: 'speaking', reason: 'RUNTIME_SPEECH_INPUT_UNAVAILABLE' },
    ]))
  })

  it('never enables pronunciation merely because a transcript runtime exists', () => {
    const capabilities = detectRuntimeCapabilitiesV2({
      ttsSupported: true,
      sttSupported: true,
      semanticAvailable: true,
      pronunciationAssessorAvailable: false,
    })
    const availability = computeRecipeRuntimeAvailability(capabilities)
    expect(isRecipeExecutable(availability, 'guided_production', 'speaking')).toBe(true)
    expect(isRecipeExecutable(availability, 'pronunciation', 'speaking')).toBe(false)
    expect(capabilities.pronunciation_assessment).toBe(false)
  })

  it('does not allow a written response to masquerade as speaking evidence', () => {
    expect(() => buildActivityResponseV2({
      plan: plan({ modality: 'speaking' }),
      responseType: 'text',
      payload: { text: 'I still work here.' },
      supportRuntime: { used: [] },
      submittedAt: '2026-08-05T00:00:00.000Z',
      capabilities: {
        text_input: true,
        audio_output: true,
        speech_input: false,
        semantic_assessment: true,
        pronunciation_assessment: false,
      },
    })).toThrow()
  })
})
