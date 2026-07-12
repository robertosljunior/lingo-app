import { speak, stopSpeaking } from './audio/tts.js'
import { PIPER_VOICES } from './audio/tts-piper.js'
export const PORTUGUESE_FABIOLA_VOICE_ID = 'pt_BR-fabiola-medium'
export const PORTUGUESE_VOICES = [{ id: PORTUGUESE_FABIOLA_VOICE_ID, label: 'Fabiola — Português do Brasil', language: 'pt-BR', sizeMB: 60 }]
export const SPEECH_ROLES = ['explanation_pt','exercise_en','correct_answer_en','user_answer_en','ui_preview']
export function resolveVoiceForSegment({ language, role, voiceId, settings = {} }) {
  const english = settings.english_voice_id || settings.piper_voice || PIPER_VOICES[0]?.id
  const portuguese = settings.portuguese_explanation_voice_id || PORTUGUESE_FABIOLA_VOICE_ID
  const rate = role === 'explanation_pt' || String(language).startsWith('pt') ? (settings.portuguese_voice_rate || 1) : (settings.english_voice_rate || settings.tts_rate || 1)
  if (voiceId) return { voiceId, rate }
  if (role === 'explanation_pt' || String(language).startsWith('pt')) return { voiceId: portuguese, rate }
  return { voiceId: english, rate }
}
export async function speakSegment({ text, language = 'en', role = 'exercise_en', voiceId = null, rate = null, settings = {}, interrupt = true } = {}) {
  const routed = resolveVoiceForSegment({ language, role, voiceId, settings })
  const selected = voiceId || routed.voiceId
  if (interrupt) stopSpeaking()
  return speak(text, { rate: rate ?? routed.rate, voiceId: selected, requestedVoiceId: selected, language, role, interrupt })
}
export async function speakFeedbackSequence(presentation, settings = {}) {
  if (!settings.auto_read_explanations) return false
  const pt = presentation?.speech_segments?.find(s => s.role === 'explanation_pt')
  const en = presentation?.speech_segments?.find(s => s.role === 'correct_answer_en')
  if (pt?.text) await speakSegment({ ...pt, settings })
  if (settings.auto_read_correct_answer !== false && en?.text) {
    await new Promise(r => setTimeout(r, 250))
    await speakSegment({ ...en, settings })
  }
  return true
}
