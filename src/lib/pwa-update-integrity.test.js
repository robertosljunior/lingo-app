import { describe, expect, it, vi } from 'vitest'
import { installPwaUpdateIntegrity, PWA_UPDATE_CHECK_INTERVAL_MS } from './pwa-update-integrity.js'

function eventTarget() {
  const listeners = new Map()
  return {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type).add(fn)
    },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn) },
    emit(type) { for (const fn of listeners.get(type) || []) fn() },
  }
}

function harness({ controlled = false, online = true } = {}) {
  const swEvents = eventTarget()
  const docEvents = eventTarget()
  const winEvents = eventTarget()
  const registration = { update: vi.fn(() => Promise.resolve()) }
  const navigatorObj = { serviceWorker: { ...swEvents, controller: controlled ? {} : null }, onLine: online }
  const documentObj = { ...docEvents, visibilityState: 'visible' }
  const windowObj = { ...winEvents }
  const locationObj = { reload: vi.fn() }
  let callbacks = null
  const updateSW = vi.fn(() => Promise.resolve())
  const registerSW = vi.fn((opts) => {
    callbacks = opts
    opts.onRegisteredSW('/sw.js', registration)
    return updateSW
  })
  const setIntervalFn = vi.fn(() => 77)
  const clearIntervalFn = vi.fn()
  return {
    registration, navigatorObj, documentObj, windowObj, locationObj,
    registerSW, updateSW, setIntervalFn, clearIntervalFn,
    get callbacks() { return callbacks },
  }
}

describe('RX-8C PWA update integrity', () => {
  it('does not reload a first-install client when the first worker takes control', () => {
    const h = harness({ controlled: false })
    installPwaUpdateIntegrity(h)
    h.navigatorObj.serviceWorker.emit('controllerchange')
    expect(h.locationObj.reload).not.toHaveBeenCalled()
  })

  it('reloads an already-controlled stale client exactly once after controllerchange', () => {
    const h = harness({ controlled: true })
    installPwaUpdateIntegrity(h)
    h.navigatorObj.serviceWorker.emit('controllerchange')
    h.navigatorObj.serviceWorker.emit('controllerchange')
    expect(h.locationObj.reload).toHaveBeenCalledTimes(1)
  })

  it('registers immediately and checks for updates on registration, foreground and online', () => {
    const h = harness({ controlled: true })
    installPwaUpdateIntegrity(h)
    expect(h.registerSW).toHaveBeenCalledWith(expect.objectContaining({ immediate: true }))
    expect(h.registration.update).toHaveBeenCalledTimes(1)
    h.documentObj.emit('visibilitychange')
    h.windowObj.emit('online')
    expect(h.registration.update).toHaveBeenCalledTimes(3)
    expect(h.setIntervalFn).toHaveBeenCalledWith(expect.any(Function), PWA_UPDATE_CHECK_INTERVAL_MS)
  })

  it('does not perform network update checks while offline', () => {
    const h = harness({ controlled: true, online: false })
    installPwaUpdateIntegrity(h)
    h.documentObj.emit('visibilitychange')
    h.windowObj.emit('online')
    expect(h.registration.update).not.toHaveBeenCalled()
  })

  it('activates a refresh-required worker and cleanup removes the interval', async () => {
    const h = harness({ controlled: true })
    const cleanup = installPwaUpdateIntegrity(h)
    h.callbacks.onNeedRefresh()
    expect(h.updateSW).toHaveBeenCalledWith(true)
    cleanup()
    expect(h.clearIntervalFn).toHaveBeenCalledWith(77)
  })
})
