import { describe, it, expect } from 'vitest'
import { resolveVoiceForSegment, PORTUGUESE_FABIOLA_VOICE_ID } from './speech-router.js'

describe('speech router', () => {
  it('routes Portuguese explanation to Fabiola', () => {
    expect(resolveVoiceForSegment({ role:'explanation_pt', language:'pt-BR', settings:{} }).voiceId).toBe(PORTUGUESE_FABIOLA_VOICE_ID)
  })
  it('routes English to selected voice and responds to changes', () => {
    expect(resolveVoiceForSegment({ role:'exercise_en', language:'en', settings:{ english_voice_id:'en_GB-alan-medium' } }).voiceId).toBe('en_GB-alan-medium')
    expect(resolveVoiceForSegment({ role:'correct_answer_en', language:'en', settings:{ english_voice_id:'en_US-ryan-medium' } }).voiceId).toBe('en_US-ryan-medium')
  })
  it('keeps rates independent', () => {
    expect(resolveVoiceForSegment({ role:'explanation_pt', language:'pt-BR', settings:{ portuguese_voice_rate:.8, english_voice_rate:1.1 } }).rate).toBe(.8)
    expect(resolveVoiceForSegment({ role:'exercise_en', language:'en', settings:{ portuguese_voice_rate:.8, english_voice_rate:1.1 } }).rate).toBe(1.1)
  })
})
