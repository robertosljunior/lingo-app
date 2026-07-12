// pack-catalog.js — secure remote knowledge-pack distribution. Packs are fetched
// from a versioned GitHub Releases catalog. Security invariants:
//   - only an allowlisted org/repo host is accepted
//   - HTTPS only
//   - max size + timeout
//   - SHA-256 checksum verified against the catalog before install
//   - schema + analysis-compatibility validated before install
//   - remote content is NEVER executed (pure JSON, parsed only)
//   - a pack's own URLs / out-of-catalog dependencies are never followed

import { validateKnowledgePack, ANALYSIS_VERSION } from './knowledge-pack-validator.js'

export const CATALOG_ALLOWLIST = [
  'github.com/robertosljunior/lingo-app',
  'objects.githubusercontent.com', // GitHub Releases asset CDN
  'api.github.com/repos/robertosljunior/lingo-app',
]
export const MAX_PACK_BYTES = 5 * 1024 * 1024
export const DEFAULT_TIMEOUT_MS = 15000

export function isAllowlistedUrl(url) {
  let u
  try { u = new URL(url) } catch { return false }
  if (u.protocol !== 'https:') return false
  const hostPath = u.host + u.pathname
  return CATALOG_ALLOWLIST.some((entry) => hostPath === entry || hostPath.startsWith(entry + '/') || u.host === entry)
}

async function sha256Hex(bytes) {
  const subtle = globalThis.crypto?.subtle
  if (subtle) {
    const digest = await subtle.digest('SHA-256', bytes)
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  // Node fallback.
  const { createHash } = await import('node:crypto')
  return createHash('sha256').update(Buffer.from(bytes)).digest('hex')
}

export async function verifyChecksum(bytes, expectedSha256) {
  const actual = await sha256Hex(bytes)
  return { ok: actual === (expectedSha256 || '').toLowerCase(), actual }
}

function checkCompatibility(pack, appVersion) {
  const ac = pack?.manifest?.analysis_compatibility
  if (!ac) return { ok: false, reason: 'NO_ANALYSIS_COMPATIBILITY' }
  if (ac.min_version !== ANALYSIS_VERSION) return { ok: false, reason: 'INCOMPATIBLE' }
  if (appVersion && pack.manifest.min_app_version && cmpSemver(appVersion, pack.manifest.min_app_version) < 0) {
    return { ok: false, reason: 'APP_TOO_OLD' }
  }
  return { ok: true }
}

/**
 * Validate a downloaded pack end-to-end before it may be installed. Pure and
 * synchronous over already-fetched bytes so it is fully testable.
 * @returns {{ ok, code?, pack?, validation? }}
 */
export async function verifyDownloadedPack({ bytes, catalogEntry, appVersion }) {
  if (!bytes || bytes.byteLength == null) return { ok: false, code: 'NO_BYTES' }
  if (bytes.byteLength > MAX_PACK_BYTES) return { ok: false, code: 'TOO_LARGE' }
  if (catalogEntry?.size_bytes != null && bytes.byteLength !== catalogEntry.size_bytes) {
    return { ok: false, code: 'SIZE_MISMATCH' }
  }
  const { ok: sumOk, actual } = await verifyChecksum(bytes, catalogEntry?.sha256)
  if (!sumOk) return { ok: false, code: 'CHECKSUM_MISMATCH', actual }

  let pack
  try {
    const text = new TextDecoder().decode(bytes)
    pack = JSON.parse(text) // JSON only — content is data, never executed.
  } catch {
    return { ok: false, code: 'INVALID_JSON' }
  }
  if (catalogEntry?.pack_id && pack?.manifest?.pack_id !== catalogEntry.pack_id) {
    return { ok: false, code: 'PACK_ID_MISMATCH' }
  }
  const compat = checkCompatibility(pack, appVersion)
  if (!compat.ok) return { ok: false, code: compat.reason }

  const validation = validateKnowledgePack(pack)
  if (!validation.valid) return { ok: false, code: 'SCHEMA_INVALID', validation }

  return { ok: true, pack, validation }
}

/**
 * Fetch a URL as bytes with allowlist, HTTPS, size and timeout guards. Injectable
 * fetch keeps it testable and lets non-browser callers pass their own.
 */
export async function fetchGuarded(url, { fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = MAX_PACK_BYTES } = {}) {
  if (!isAllowlistedUrl(url)) return { ok: false, code: 'URL_NOT_ALLOWLISTED' }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, { signal: controller.signal, redirect: 'follow' })
    if (!res.ok) return { ok: false, code: `HTTP_${res.status}` }
    const buf = await res.arrayBuffer()
    if (buf.byteLength > maxBytes) return { ok: false, code: 'TOO_LARGE' }
    return { ok: true, bytes: new Uint8Array(buf) }
  } catch (e) {
    return { ok: false, code: e?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR' }
  } finally {
    clearTimeout(timer)
  }
}

function cmpSemver(a, b) {
  const pa = String(a).split('.').map(Number)
  const pb = String(b).split('.').map(Number)
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0) }
  return 0
}

export { cmpSemver }
