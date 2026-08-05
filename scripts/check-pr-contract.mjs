#!/usr/bin/env node

import { readFileSync } from 'node:fs'

const eventPath = process.argv[2] || process.env.GITHUB_EVENT_PATH
if (!eventPath) {
  console.error('PR_CONTRACT_EVENT_PATH_REQUIRED')
  process.exit(1)
}

const event = JSON.parse(readFileSync(eventPath, 'utf8'))
const body = String(event.pull_request?.body || '')
const title = String(event.pull_request?.title || '')

const requiredSections = [
  '## Stack',
  '## Problem',
  '## Verification plan',
  '## Remote verification',
]
const requiredFields = [
  /Head commit:\s*\S+/i,
  /Run URL:\s*\S+/i,
  /Unit tests:\s*\S+/i,
  /Playwright:\s*\S+/i,
  /Known warnings\/debt:\s*\S+/i,
]

const errors = []
if (!title.trim()) errors.push('title:required')
for (const section of requiredSections) {
  if (!body.includes(section)) errors.push(`section_missing:${section.replace(/^##\s*/, '')}`)
}
for (const field of requiredFields) {
  if (!field.test(body)) errors.push(`field_missing:${field.source}`)
}
if (/local\s+(tests?|gate)\s+(only|apenas)/i.test(body)) {
  errors.push('local_only_evidence_forbidden')
}

if (errors.length) {
  console.error(`PR_CONTRACT_INVALID:${errors.join(',')}`)
  console.error('Use .github/pull_request_template.md and keep Remote verification as pending until this head commit finishes CI.')
  process.exit(1)
}

console.log('PR contract present. The required-gate job remains the source of truth for whether the head commit is green.')
