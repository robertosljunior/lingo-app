#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

// RX-6 makes the current dependency debt explicit instead of hiding it behind
// `npm audit fix`. RX-8 owns removal/upgrades. Until then, CI fails on any
// critical advisory or on growth beyond the reviewed high-severity baseline.
const BASELINE = Object.freeze({ critical: 0, high: 3 })

const result = spawnSync('npm', ['audit', '--json'], {
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
  shell: process.platform === 'win32',
})

if (!result.stdout?.trim()) {
  console.error('DEPENDENCY_AUDIT_UNAVAILABLE: npm audit returned no JSON output')
  if (result.stderr) console.error(result.stderr.trim())
  process.exit(1)
}

let report
try {
  report = JSON.parse(result.stdout)
} catch (error) {
  console.error(`DEPENDENCY_AUDIT_INVALID_JSON: ${error.message}`)
  console.error(result.stdout.slice(0, 2000))
  process.exit(1)
}

writeFileSync('dependency-audit.json', JSON.stringify(report, null, 2))

const counts = report.metadata?.vulnerabilities || {}
const summary = {
  info: Number(counts.info || 0),
  low: Number(counts.low || 0),
  moderate: Number(counts.moderate || 0),
  high: Number(counts.high || 0),
  critical: Number(counts.critical || 0),
  total: Number(counts.total || 0),
}

console.log('DEPENDENCY_AUDIT_SUMMARY', JSON.stringify({ summary, baseline: BASELINE }))

const failures = []
if (summary.critical > BASELINE.critical) {
  failures.push(`critical ${summary.critical} > ${BASELINE.critical}`)
}
if (summary.high > BASELINE.high) {
  failures.push(`high ${summary.high} > ${BASELINE.high}`)
}

if (failures.length) {
  console.error(`DEPENDENCY_AUDIT_BUDGET_EXCEEDED: ${failures.join(', ')}`)
  process.exit(1)
}

if (result.error) {
  console.error(`DEPENDENCY_AUDIT_COMMAND_FAILED: ${result.error.message}`)
  process.exit(1)
}

console.log('Dependency advisory budget respected. Existing high-severity debt remains tracked for RX-8.')
