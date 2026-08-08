// RX-8E — load typography only for the active learner experience.
// V2 owns Barlow/Barlow Condensed and keeps those faces in the core offline
// precache. The legacy Bob faces are fetched only when V1 is explicitly used.
let legacyFontsPromise = null

export function ensureExperienceFonts({ v2, loadLegacy } = {}) {
  if (v2) return Promise.resolve(false)

  if (!legacyFontsPromise) {
    const load = loadLegacy || (() => import('../styles/legacy-fonts.js'))
    legacyFontsPromise = Promise.resolve()
      .then(() => load())
      .then(() => true)
      .catch((error) => {
        // Allow a later navigation/reconnect to retry instead of permanently
        // pinning a rejected promise for the lifetime of the tab.
        legacyFontsPromise = null
        throw error
      })
  }

  return legacyFontsPromise
}

export function resetExperienceFontsForTest() {
  legacyFontsPromise = null
}
