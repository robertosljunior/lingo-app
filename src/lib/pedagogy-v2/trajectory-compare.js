// trajectory-compare.js — pure comparison of two pedagogical trajectories
// (Slice V2.10). Puts a BEFORE and an AFTER SimulationResultV2 side by side on
// the dimensions that matter for calibration decisions: capability depth,
// modality distribution, review pressure, novelty, repetition, support
// dependency and findings. NEVER compares a global mastery — none exists.

import { computePedagogicalMetricsV2 } from './pedagogical-metrics.js'
import { analyzeTrajectoryV2 } from './trajectory-analyzer.js'
import { loadPedagogyV2Registry } from './registry.js'

const round4 = (n) => +Number(n).toFixed(4)

function diffCounts(before = {}, after = {}) {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()
  const out = {}
  for (const k of keys) out[k] = { before: before[k] || 0, after: after[k] || 0, delta: (after[k] || 0) - (before[k] || 0) }
  return out
}

/**
 * comparePedagogicalTrajectoriesV2(before, after, { registry })
 * before/after: SimulationResultV2. Returns a deterministic structured diff.
 */
export function comparePedagogicalTrajectoriesV2(before, after, { registry = loadPedagogyV2Registry() } = {}) {
  const mB = computePedagogicalMetricsV2(before, { registry })
  const mA = computePedagogicalMetricsV2(after, { registry })
  const fB = analyzeTrajectoryV2(before, { registry }).findings
  const fA = analyzeTrajectoryV2(after, { registry }).findings
  const codes = (f) => [...new Set(f.map((x) => x.code))].sort()
  const codesB = codes(fB)
  const codesA = codes(fA)

  return {
    compare_version: 1,
    interactions: { before: before.interactions.length, after: after.interactions.length },
    capability_depth: diffCounts(mB.capability_depth, mA.capability_depth),
    modality_balance: diffCounts(mB.modality_balance.counts, mA.modality_balance.counts),
    review_ratio: { before: mB.review_ratio.ratio, after: mA.review_ratio.ratio },
    new_item_load: { before: mB.new_item_load.total, after: mA.new_item_load.total },
    repetition_same_target: { before: mB.repetition_pressure.same_target, after: mA.repetition_pressure.same_target },
    unaided_production: {
      controlled: { before: mB.unaided_production_rate.controlled.rate, after: mA.unaided_production_rate.controlled.rate },
      free: { before: mB.unaided_production_rate.free.rate, after: mA.unaided_production_rate.free.rate },
    },
    pack_switch_rate: { before: round4(mB.pack_switch.rate), after: round4(mA.pack_switch.rate) },
    cross_pack_transfer: { before: mB.cross_pack_transfer.total, after: mA.cross_pack_transfer.total },
    findings: {
      before: codesB,
      after: codesA,
      resolved: codesB.filter((c) => !codesA.includes(c)),
      introduced: codesA.filter((c) => !codesB.includes(c)),
    },
  }
}
