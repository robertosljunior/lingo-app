import { describe, expect, it } from 'vitest'
import {
  describeKnowledgePack,
  formatStorageBytes,
  isReclaimableKnowledgePack,
} from './device-storage-manager.js'

describe('RX-8F device storage manager', () => {
  it('formats learner-facing storage sizes without false precision', () => {
    expect(formatStorageBytes(0)).toBe('0 B')
    expect(formatStorageBytes(1536)).toBe('1.5 KB')
    expect(formatStorageBytes(63 * 1024 * 1024)).toBe('63 MB')
    expect(formatStorageBytes(null)).toBe('indisponível')
  })

  it('never classifies imported/custom knowledge packs as reclaimable downloads', () => {
    expect(isReclaimableKnowledgePack({ source: 'imported' })).toBe(false)
    expect(isReclaimableKnowledgePack({ source: 'remote' })).toBe(true)
    expect(isReclaimableKnowledgePack({ source: 'builtin' })).toBe(true)
  })

  it('keeps pack source and reclaimability explicit in the snapshot contract', () => {
    expect(describeKnowledgePack({
      pack_id: 'my-custom-pack',
      source: 'imported',
      pack: { manifest: { name: 'Meu conteúdo' } },
    })).toEqual({
      id: 'my-custom-pack',
      label: 'Meu conteúdo',
      source: 'imported',
      reclaimable: false,
    })
  })
})
