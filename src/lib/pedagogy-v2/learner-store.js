// learner-store.js — IndexedDB persistence for the learner model V2.
//
// Uses a SEPARATE database (like knowledge-pack-store.js) so the V2 namespace
// never touches the frozen V1 schema in storage.js. Two stores:
//   learner_evidence_v2      — append-only event log (immutable: an existing
//                              evidence_id can never be overwritten)
//   learner_target_states_v2 — derived rows, rebuilt deterministically from
//                              the log at any time (rebuildLearnerStatesV2)
//
// Every append validates against the pedagogy-v2 content registry: evidence
// may only reference targets/exemplars that exist in a validated pack.

import { openDB } from 'idb'
import { loadBuiltinPedagogyV2Packs } from './pack-registry.js'
import { validateLearnerEvidenceV2, reduceLearnerStatesV2 } from './learner-model.js'

const DB_NAME = 'app-idiomas-pedagogy-v2'
const DB_VERSION = 1

let dbPromise = null

function open() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      blocking(_current, _blocked, event) { try { event?.target?.close?.() } catch { /* noop */ } },
      upgrade(db) {
        if (!db.objectStoreNames.contains('learner_evidence_v2')) {
          const s = db.createObjectStore('learner_evidence_v2', { keyPath: 'evidence_id' })
          s.createIndex('profile_id', 'profile_id')
          s.createIndex('session_id', 'session_id')
          s.createIndex('profile_target', ['profile_id', 'target_id'])
        }
        if (!db.objectStoreNames.contains('learner_target_states_v2')) {
          const s = db.createObjectStore('learner_target_states_v2', { keyPath: 'key' })
          s.createIndex('profile_id', 'profile_id')
          s.createIndex('profile_target', ['profile_id', 'target_id'])
        }
      },
    })
  }
  return dbPromise
}

// Append one immutable evidence event and refresh the derived states for its
// (profile, target). Returns { ok, errors? }. Never overwrites: re-appending
// an existing evidence_id fails with EVIDENCE_IMMUTABLE.
export async function appendLearnerEvidenceV2(event) {
  const packs = loadBuiltinPedagogyV2Packs()
  const validation = validateLearnerEvidenceV2(event, { packs })
  if (!validation.valid) return { ok: false, errors: validation.errors }
  const d = await open()
  const tx = d.transaction(['learner_evidence_v2', 'learner_target_states_v2'], 'readwrite')
  const log = tx.objectStore('learner_evidence_v2')
  if (await log.get(event.evidence_id)) {
    await tx.done
    return { ok: false, errors: [`EVIDENCE_IMMUTABLE:${event.evidence_id}`] }
  }
  await log.add({ ...event })
  // Re-derive only the states of the affected (profile, target) — the fold is
  // per-domain, so other targets cannot change.
  const targetEvents = await log.index('profile_target').getAll([event.profile_id, event.target_id])
  const stateStore = tx.objectStore('learner_target_states_v2')
  for (const s of reduceLearnerStatesV2(targetEvents)) {
    await stateStore.put({ key: `${event.profile_id}|${s.state_key}`, profile_id: event.profile_id, ...s })
  }
  await tx.done
  return { ok: true }
}

export async function appendLearnerEvidenceBatchV2(events) {
  const results = []
  for (const e of events || []) results.push(await appendLearnerEvidenceV2(e))
  return { ok: results.every((r) => r.ok), results }
}

export async function getLearnerEvidenceV2(profile_id, { target_id = null, session_id = null } = {}) {
  const d = await open()
  let rows
  if (target_id) rows = await d.getAllFromIndex('learner_evidence_v2', 'profile_target', [profile_id, target_id])
  else if (session_id) rows = (await d.getAllFromIndex('learner_evidence_v2', 'session_id', session_id)).filter((r) => r.profile_id === profile_id)
  else rows = await d.getAllFromIndex('learner_evidence_v2', 'profile_id', profile_id)
  return rows.sort((a, b) => (a.created_at - b.created_at) || String(a.evidence_id).localeCompare(String(b.evidence_id)))
}

export async function getLearnerStatesV2(profile_id) {
  const d = await open()
  const rows = await d.getAllFromIndex('learner_target_states_v2', 'profile_id', profile_id)
  return rows.sort((a, b) => a.key.localeCompare(b.key))
}

export async function getLearnerStatesForTargetV2(profile_id, target_id) {
  const d = await open()
  return (await d.getAllFromIndex('learner_target_states_v2', 'profile_target', [profile_id, target_id]))
    .sort((a, b) => a.key.localeCompare(b.key))
}

// Drop and rebuild every derived state of a profile from its evidence log.
// The log is the source of truth; this must always converge to the same rows
// the incremental path maintains.
export async function rebuildLearnerStatesV2(profile_id) {
  const d = await open()
  const events = await d.getAllFromIndex('learner_evidence_v2', 'profile_id', profile_id)
  const tx = d.transaction('learner_target_states_v2', 'readwrite')
  const store = tx.objectStore('learner_target_states_v2')
  for (const k of await store.index('profile_id').getAllKeys(profile_id)) await store.delete(k)
  for (const s of reduceLearnerStatesV2(events)) {
    await store.put({ key: `${profile_id}|${s.state_key}`, profile_id, ...s })
  }
  await tx.done
  return getLearnerStatesV2(profile_id)
}

export async function __resetLearnerV2StoreForTests() {
  if (dbPromise) { try { (await dbPromise).close() } catch { /* noop */ } }
  dbPromise = null
  await new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = req.onerror = req.onblocked = () => resolve()
  })
}
