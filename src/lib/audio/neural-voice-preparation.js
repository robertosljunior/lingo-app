// neural-voice-preparation.js — one automatic, observable preparation path for
// the learner-facing English neural voices. It is deliberately independent of
// pedagogy and profile data: models are shared device resources stored in OPFS.

import { downloadVoice, piperSupported, storedVoices } from './tts-piper.js'
import { PRIMARY_ENGLISH_PIPER_VOICE_ID } from './tts.js'

export const ENGLISH_VOICE_PREPARATION_VERSION = 1
export const ENGLISH_VOICE_PREPARATION_STORAGE_KEY = 'pwa_english_voice_state'
export const PRIORITY_ENGLISH_VOICE_IDS = [
  PRIMARY_ENGLISH_PIPER_VOICE_ID,
  'en_GB-cori-medium',
]

const listeners = new Set()
let running = null

function baseState() {
  return {
    version: ENGLISH_VOICE_PREPARATION_VERSION,
    status: 'idle', // idle | waiting | downloading | ready | partial | failed | unsupported | disabled
    progress: 0,
    current_voice_id: null,
    ready_voice_ids: [],
    primary_ready: false,
    error_code: null,
    updated_at: null,
  }
}

export function loadEnglishVoicePreparationState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ENGLISH_VOICE_PREPARATION_STORAGE_KEY) || '{}')
    return { ...baseState(), ...parsed, ready_voice_ids: Array.isArray(parsed.ready_voice_ids) ? parsed.ready_voice_ids : [] }
  } catch {
    return baseState()
  }
}

function publish(patch, onState = null) {
  const next = {
    ...loadEnglishVoicePreparationState(),
    ...patch,
    version: ENGLISH_VOICE_PREPARATION_VERSION,
    updated_at: new Date().toISOString(),
  }
  try { localStorage.setItem(ENGLISH_VOICE_PREPARATION_STORAGE_KEY, JSON.stringify(next)) } catch { /* storage can be unavailable */ }
  listeners.forEach((listener) => listener(next))
  onState?.(next)
  try { window.dispatchEvent(new CustomEvent('lingo:english-voice-preparation', { detail: next })) } catch { /* non-browser */ }
  return next
}

export function subscribeEnglishVoicePreparation(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function e2ePreparationHook() {
  try {
    if (typeof window === 'undefined' || !window.__LINGO_E2E__) return null
    return window.__LINGO_E2E__.voicePreparation || { mode: 'disabled' }
  } catch {
    return null
  }
}

async function runE2EHook(hook, onState) {
  if (hook.mode === 'ready') {
    return publish({
      status: 'ready', progress: 100, current_voice_id: null,
      ready_voice_ids: [...PRIORITY_ENGLISH_VOICE_IDS], primary_ready: true, error_code: null,
    }, onState)
  }
  if (hook.mode === 'downloading') {
    return publish({
      status: 'downloading', progress: hook.progress ?? 42,
      current_voice_id: PRIORITY_ENGLISH_VOICE_IDS[0], ready_voice_ids: [], primary_ready: false,
    }, onState)
  }
  if (hook.mode === 'waiting') return publish({ status: 'waiting', error_code: 'OFFLINE' }, onState)
  if (hook.mode === 'failed') return publish({ status: 'failed', error_code: 'TEST_FAILURE' }, onState)
  return publish({ status: 'disabled', error_code: null }, onState)
}

export async function preparePriorityEnglishVoices({ force = false, onState = null } = {}) {
  const hook = e2ePreparationHook()
  if (hook) return runE2EHook(hook, onState)
  if (running && !force) return running

  running = (async () => {
    if (!piperSupported) return publish({ status: 'unsupported', error_code: 'PIPER_UNSUPPORTED' }, onState)
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return publish({ status: 'waiting', error_code: 'OFFLINE' }, onState)
    }

    let ready = await storedVoices()
    const readySet = new Set(ready)
    const total = PRIORITY_ENGLISH_VOICE_IDS.length

    for (let index = 0; index < total; index++) {
      const voiceId = PRIORITY_ENGLISH_VOICE_IDS[index]
      if (readySet.has(voiceId)) {
        publish({
          status: index === total - 1 ? 'ready' : 'downloading',
          progress: Math.round(((index + 1) / total) * 100),
          current_voice_id: index === total - 1 ? null : PRIORITY_ENGLISH_VOICE_IDS[index + 1],
          ready_voice_ids: [...readySet],
          primary_ready: readySet.has(PRIMARY_ENGLISH_PIPER_VOICE_ID),
          error_code: null,
        }, onState)
        continue
      }

      publish({
        status: 'downloading',
        progress: Math.round((index / total) * 100),
        current_voice_id: voiceId,
        ready_voice_ids: [...readySet],
        primary_ready: readySet.has(PRIMARY_ENGLISH_PIPER_VOICE_ID),
        error_code: null,
      }, onState)

      try {
        await downloadVoice(voiceId, (voiceProgress) => {
          const overall = Math.round(((index + voiceProgress / 100) / total) * 100)
          publish({
            status: 'downloading', progress: overall, current_voice_id: voiceId,
            ready_voice_ids: [...readySet],
            primary_ready: readySet.has(PRIMARY_ENGLISH_PIPER_VOICE_ID),
            error_code: null,
          }, onState)
        })
        readySet.add(voiceId)
      } catch (error) {
        const primaryReady = readySet.has(PRIMARY_ENGLISH_PIPER_VOICE_ID)
        return publish({
          status: primaryReady ? 'partial' : 'failed',
          current_voice_id: voiceId,
          ready_voice_ids: [...readySet],
          primary_ready: primaryReady,
          error_code: String(error?.message || 'VOICE_DOWNLOAD_FAILED'),
        }, onState)
      }
    }

    ready = [...readySet]
    return publish({
      status: 'ready', progress: 100, current_voice_id: null,
      ready_voice_ids: ready, primary_ready: readySet.has(PRIMARY_ENGLISH_PIPER_VOICE_ID), error_code: null,
    }, onState)
  })().finally(() => { running = null })

  return running
}
