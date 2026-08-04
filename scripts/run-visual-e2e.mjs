#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const result = spawnSync(command, ['playwright', 'test', '--config=playwright.visual.config.js'], {
  stdio: 'inherit',
  env: { ...process.env, V2_SHOTS: '1' },
})

if (result.error) {
  console.error(result.error)
  process.exit(1)
}
process.exit(result.status ?? 1)
