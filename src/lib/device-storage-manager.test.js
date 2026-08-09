import { describe, expect, it } from 'vitest'
import { formatStorageBytes } from './device-storage-manager.js'

describe('RX-8F device storage manager', () => {
  it('formats learner-facing storage sizes without false precision', () => {
    expect(formatStorageBytes(0)).toBe('0 B')
    expect(formatStorageBytes(1536)).toBe('1.5 KB')
    expect(formatStorageBytes(63 * 1024 * 1024)).toBe('63 MB')
    expect(formatStorageBytes(null)).toBe('indisponível')
  })
})
