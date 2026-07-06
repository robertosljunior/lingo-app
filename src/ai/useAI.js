// useAI.js — React binding to the AI engine external store.

import { useSyncExternalStore, useEffect } from 'react'
import * as engine from './engine.js'

export function useAI() {
  const state = useSyncExternalStore(engine.subscribe, engine.getState, engine.getState)

  // Probe WebGPU support once on mount.
  useEffect(() => { engine.isSupported() }, [])

  return {
    ...state,
    loadModel: engine.loadModel,
    unloadModel: engine.unloadModel,
    setPreferredModel: engine.setPreferredModel,
    getCapability: engine.getCapability,
    hasCapability: engine.hasCapability,
    listCapabilities: engine.listCapabilities,
  }
}
