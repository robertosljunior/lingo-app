import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureExperienceFonts, resetExperienceFontsForTest } from './experience-fonts.js'

describe('experience font loading', () => {
  beforeEach(() => resetExperienceFontsForTest())

  it('does not request legacy fonts for V2', async () => {
    const loadLegacy = vi.fn()

    await expect(ensureExperienceFonts({ v2: true, loadLegacy })).resolves.toBe(false)
    expect(loadLegacy).not.toHaveBeenCalled()
  })

  it('loads legacy fonts once when V1 is active', async () => {
    const loadLegacy = vi.fn().mockResolvedValue({})

    await expect(ensureExperienceFonts({ v2: false, loadLegacy })).resolves.toBe(true)
    await expect(ensureExperienceFonts({ v2: false, loadLegacy })).resolves.toBe(true)
    expect(loadLegacy).toHaveBeenCalledTimes(1)
  })

  it('allows a retry after a failed legacy font load', async () => {
    const first = vi.fn().mockRejectedValue(new Error('offline'))
    await expect(ensureExperienceFonts({ v2: false, loadLegacy: first })).rejects.toThrow('offline')

    const retry = vi.fn().mockResolvedValue({})
    await expect(ensureExperienceFonts({ v2: false, loadLegacy: retry })).resolves.toBe(true)
    expect(retry).toHaveBeenCalledTimes(1)
  })
})
