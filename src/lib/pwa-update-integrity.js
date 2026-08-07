// pwa-update-integrity.js — RX-8C update lifecycle for the production PWA.
//
// The service worker already uses Workbox skipWaiting/clientsClaim through
// registerType:autoUpdate. The missing piece was the client lifecycle: an open
// tab could continue executing the old hashed JS after a new worker took
// control. This coordinator reloads an ALREADY-CONTROLLED client exactly once
// when its controller changes, while deliberately not reloading on first install.
// It also asks the registration to check for updates on useful foreground/online
// transitions and at a bounded interval.

export const PWA_UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

export function installPwaUpdateIntegrity({
  registerSW,
  navigatorObj = globalThis.navigator,
  locationObj = globalThis.location,
  documentObj = globalThis.document,
  windowObj = globalThis.window,
  setIntervalFn = globalThis.setInterval,
  clearIntervalFn = globalThis.clearInterval,
  intervalMs = PWA_UPDATE_CHECK_INTERVAL_MS,
} = {}) {
  const serviceWorker = navigatorObj?.serviceWorker
  if (typeof registerSW !== 'function' || !serviceWorker) return () => {}

  const controlledAtBoot = Boolean(serviceWorker.controller)
  let reloadIssued = false
  let registration = null
  let updateSW = null

  const reloadOnControllerChange = () => {
    // A first installation changes controller from null -> worker. That is not a
    // stale-client event and must not cause a surprise first-load refresh.
    if (!controlledAtBoot || reloadIssued) return
    reloadIssued = true
    locationObj?.reload?.()
  }
  serviceWorker.addEventListener?.('controllerchange', reloadOnControllerChange)

  const requestUpdate = () => {
    if (!registration || navigatorObj?.onLine === false) return
    try {
      const result = registration.update?.()
      result?.catch?.(() => {})
    } catch { /* update checks are best-effort; offline use must keep working */ }
  }

  const onVisibilityChange = () => {
    if (!documentObj || documentObj.visibilityState === 'visible') requestUpdate()
  }
  const onOnline = () => requestUpdate()
  documentObj?.addEventListener?.('visibilitychange', onVisibilityChange)
  windowObj?.addEventListener?.('online', onOnline)

  // `autoUpdate` normally activates immediately. If the virtual registration
  // surface still reports a refresh-required state (browser/version variance),
  // explicitly activate it. Controllerchange remains the single reload guard.
  updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, reg) {
      registration = reg || null
      requestUpdate()
    },
    onNeedRefresh() {
      try {
        const result = updateSW?.(true)
        result?.catch?.(() => {})
      } catch { /* keep the current offline-capable client alive */ }
    },
  })

  const timer = typeof setIntervalFn === 'function'
    ? setIntervalFn(requestUpdate, intervalMs)
    : null

  return () => {
    serviceWorker.removeEventListener?.('controllerchange', reloadOnControllerChange)
    documentObj?.removeEventListener?.('visibilitychange', onVisibilityChange)
    windowObj?.removeEventListener?.('online', onOnline)
    if (timer != null && typeof clearIntervalFn === 'function') clearIntervalFn(timer)
  }
}
