import { readFileSync } from 'node:fs'
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

  it('keeps legacy fontsource imports out of the eager entrypoint', () => {
    const main = readFileSync(new URL('../main.jsx', import.meta.url), 'utf8')
    const legacyFonts = readFileSync(new URL('../styles/legacy-fonts.js', import.meta.url), 'utf8')

    expect(main).not.toContain('@fontsource/')
    expect(legacyFonts).toContain('@fontsource/nunito/')
    expect(legacyFonts).toContain('@fontsource/baloo-2/')
    expect(legacyFonts).toContain('@fontsource/geist-mono/')
  })

  it('keeps legacy font binaries out of the base service-worker precache', () => {
    const config = readFileSync(new URL('../../vite.config.js', import.meta.url), 'utf8')

    expect(config).toContain("'**/*nunito*.woff2'")
    expect(config).toContain("'**/*baloo*.woff2'")
    expect(config).toContain("'**/*geist-mono*.woff2'")
    expect(config).toContain("cacheName: 'legacy-fonts-v1'")
  })
})
