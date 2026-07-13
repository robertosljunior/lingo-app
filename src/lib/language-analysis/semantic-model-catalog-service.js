// semantic-model-catalog-service.js — thin UI-facing wrapper over the semantic
// model catalog + store. Keeps Settings decoupled from provisioning internals and
// resets the cached semantic encoder after install/remove so the next analysis
// rebinds to the new engine (real USE ↔ hashing) without a reload.

import { getDefaultModelEntry, SEMANTIC_MODEL_CATALOG } from './semantic-model-catalog.js'
import { installModel as storeInstallModel, removeModel as storeRemoveModel, getInstalledModel } from './semantic-model-store.js'
import { resetSemanticEncoder, getSemanticEngineStatus } from './index.js'

export { getDefaultModelEntry, SEMANTIC_MODEL_CATALOG, getInstalledModel, getSemanticEngineStatus }

export async function installModel(entry = getDefaultModelEntry(), opts = {}) {
  const res = await storeInstallModel(entry, opts)
  if (res.ok) resetSemanticEncoder()
  return res
}

export async function removeModel(model_id = getDefaultModelEntry().model_id, opts = {}) {
  const res = await storeRemoveModel(model_id, opts)
  if (res.ok) resetSemanticEncoder()
  return res
}
