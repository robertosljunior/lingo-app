// device-storage-manager.js — RX-8F central visibility/cleanup for large,
// shared device resources. Learner history/profile data is deliberately outside
// this module: cleanup may remove re-downloadable models, voices and caches only.

import { getInstalledModel, removeModel } from './language-analysis/semantic-model-store.js'
import { listInstalledPacks, removeKnowledgePack } from './language-analysis/knowledge-pack-store.js'
import { PIPER_VOICES, removeVoice, storedVoices } from './audio/tts-piper.js'
import { resetSemanticEncoder } from './language-analysis/index.js'
import { ENGLISH_VOICE_PREPARATION_STORAGE_KEY } from './audio/neural-voice-preparation.js'

const CACHE_PREFIXES = ['piper-audio-', 'piper-runtime-', 'semantic-runtime-']

function finiteBytes(value) {
  return Number.isFinite(value) && value >= 0 ? value : null
}

export function formatStorageBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'indisponível'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = units[0]
  for (let i = 1; i < units.length && value >= 1024; i++) { value /= 1024; unit = units[i] }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`
}

async function storageEstimate() {
  try {
    if (!navigator?.storage?.estimate) return { usage: null, quota: null }
    const estimate = await navigator.storage.estimate()
    return { usage: finiteBytes(estimate?.usage), quota: finiteBytes(estimate?.quota) }
  } catch { return { usage: null, quota: null } }
}

async function installedVoices() {
  try {
    const ids = await storedVoices()
    return ids.map((id) => {
      const catalog = PIPER_VOICES.find((voice) => voice.id === id)
      return { id, label: catalog?.label || id, size_bytes: catalog?.sizeMB ? catalog.sizeMB * 1024 * 1024 : null }
    })
  } catch { return [] }
}

async function installedModel() {
  try {
    const model = await getInstalledModel()
    return model ? { id: model.model_id, label: 'Modelo semântico local', size_bytes: finiteBytes(model.size_bytes) } : null
  } catch { return null }
}

async function installedPacks() {
  try {
    const packs = await listInstalledPacks()
    return packs.map((row) => ({ id: row.pack_id, label: row.pack?.manifest?.name || row.pack_id }))
  } catch { return [] }
}

async function managedCaches() {
  try {
    if (typeof caches === 'undefined') return []
    return (await caches.keys()).filter((name) => CACHE_PREFIXES.some((prefix) => name.startsWith(prefix)))
  } catch { return [] }
}

export async function getDeviceStorageSnapshot() {
  const [estimate, model, voices, packs, cacheNames] = await Promise.all([
    storageEstimate(), installedModel(), installedVoices(), installedPacks(), managedCaches(),
  ])
  const knownBytes = [model?.size_bytes, ...voices.map((voice) => voice.size_bytes)]
    .filter(Number.isFinite).reduce((sum, bytes) => sum + bytes, 0)
  return {
    usage_bytes: estimate.usage,
    quota_bytes: estimate.quota,
    known_resource_bytes: knownBytes,
    semantic_model: model,
    voices,
    knowledge_packs: packs,
    managed_cache_names: cacheNames,
  }
}

async function clearManagedCaches() {
  if (typeof caches === 'undefined') return 0
  let removed = 0
  for (const name of await caches.keys()) {
    if (!CACHE_PREFIXES.some((prefix) => name.startsWith(prefix))) continue
    if (await caches.delete(name)) removed++
  }
  return removed
}

export async function clearDownloadedResources({ snapshot = null } = {}) {
  const before = snapshot || await getDeviceStorageSnapshot()
  const failures = []
  if (before.semantic_model?.id) {
    try { await removeModel(before.semantic_model.id); resetSemanticEncoder() }
    catch (error) { failures.push(`semantic:${String(error?.message || error)}`) }
  }
  for (const voice of before.voices) {
    try { await removeVoice(voice.id) }
    catch (error) { failures.push(`voice:${voice.id}:${String(error?.message || error)}`) }
  }
  for (const pack of before.knowledge_packs) {
    try { await removeKnowledgePack(pack.id) }
    catch (error) { failures.push(`pack:${pack.id}:${String(error?.message || error)}`) }
  }
  try { await clearManagedCaches() }
  catch (error) { failures.push(`cache:${String(error?.message || error)}`) }
  try { localStorage.removeItem(ENGLISH_VOICE_PREPARATION_STORAGE_KEY) } catch { /* optional */ }

  const after = await getDeviceStorageSnapshot()
  return { ok: failures.length === 0, failures, before, after }
}
