// error-log.js — persistent diagnostic log (ring buffer in localStorage).
//
// Why localStorage and not IndexedDB: it's synchronous and survives the kind
// of hard crash we're trying to diagnose (WebGPU/OOM tab death during model
// download). Entries written just before the crash are there on next launch.
//
// Levels: 'error' for failures, 'info' for breadcrumbs (e.g. "model download
// started") that give context to a crash that never got to log an error.

const KEY = 'app-idiomas:error-log'
const MAX_ENTRIES = 50

function storageAvailable() {
  try {
    return typeof localStorage !== 'undefined'
  } catch {
    return false
  }
}

function read() {
  if (!storageAvailable()) return []
  try {
    const raw = localStorage.getItem(KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function write(entries) {
  if (!storageAvailable()) return
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)))
  } catch {
    // Quota/full — drop the oldest half and retry once.
    try {
      localStorage.setItem(KEY, JSON.stringify(entries.slice(-Math.floor(MAX_ENTRIES / 2))))
    } catch { /* give up silently — logging must never crash the app */ }
  }
}

export function logError(source, err, extra = null) {
  return append('error', source, err, extra)
}

export function logInfo(source, message, extra = null) {
  return append('info', source, message, extra)
}

function append(level, source, err, extra) {
  const message = err instanceof Error ? err.message : String(err ?? '')
  const stack = err instanceof Error && err.stack ? String(err.stack).slice(0, 1500) : null
  const entry = {
    ts: Date.now(),
    level,
    source,
    message: message.slice(0, 500),
    ...(stack ? { stack } : {}),
    ...(extra ? { extra: JSON.parse(JSON.stringify(extra)) } : {}),
  }
  write([...read(), entry])
  return entry
}

export function getErrorLog() {
  return read().slice().reverse() // newest first
}

export function clearErrorLog() {
  if (storageAvailable()) {
    try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  }
}

// Plain-text dump for "copiar" → paste into an issue/chat.
export function formatErrorLog() {
  return getErrorLog()
    .map((e) => {
      const when = new Date(e.ts).toISOString()
      const extra = e.extra ? ` ${JSON.stringify(e.extra)}` : ''
      const stack = e.stack ? `\n${e.stack}` : ''
      return `[${when}] ${e.level.toUpperCase()} ${e.source}: ${e.message}${extra}${stack}`
    })
    .join('\n\n')
}

// Wire window-level capture (uncaught errors + unhandled promise rejections).
// Called once from main.jsx.
export function installGlobalErrorLogging() {
  if (typeof window === 'undefined') return
  window.addEventListener('error', (ev) => {
    logError('window', ev.error || ev.message, ev.filename ? { at: `${ev.filename}:${ev.lineno}` } : null)
  })
  window.addEventListener('unhandledrejection', (ev) => {
    logError('promise', ev.reason)
  })
}
