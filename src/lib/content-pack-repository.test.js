// Repository + IndexedDB tests over fake-indexeddb: seed idempotence, atomic
// install/rollback, custom pack protection, enable/disable/restore,
// dependencies and import collision safety.
import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it } from 'vitest'
import * as store from './storage.js'
import * as repo from './content-pack-repository.js'
import { loadBuiltinContentPacks } from './content-pack-loader.js'
import { generateLesson } from './lesson-generator.js'
import { parseLesson } from './lesson-parser.js'

describe('content pack repository (fake IndexedDB)', () => {
  beforeAll(async () => {
    await store.ensureBootstrapped()
  })

  it('seeds the 28 builtin packs and is idempotent on re-run', async () => {
    const first = await repo.seedBuiltinContentPacks()
    expect(first.invalid).toEqual([])
    expect(first.installed).toBe(28)
    const second = await repo.seedBuiltinContentPacks()
    expect(second.installed).toBe(0)
    expect(second.updated).toBe(0)
    expect(second.skipped).toBe(28)
    const all = await repo.getAllContentPacks()
    expect(all).toHaveLength(28)
    const wb1 = await repo.getContentPack('workplace_b1')
    expect(wb1.lexical_item_count).toBeGreaterThanOrEqual(12)
    expect(wb1.checksum).toBeTruthy()
    expect(wb1.dependencies).toEqual(['core_b1'])
  })

  it('atomic install: a failing write leaves zero partial records', async () => {
    const before = await repo.getLexicalItemsForPacks(['workplace_b1'])
    const bad = {
      record: { pack_id: 'workplace_b1', version: 99, source: 'builtin', enabled: true },
      lexical_items: [{ item_id: 'x1' }, null], // null row → put throws mid-transaction
      template_definitions: [],
      collocations: [],
    }
    await expect(store.installContentPack(bad)).rejects.toThrow()
    const after = await repo.getLexicalItemsForPacks(['workplace_b1'])
    expect(after.length).toBe(before.length)
    expect((await repo.getContentPack('workplace_b1')).version).toBe(1)
  })

  it('builtin seed never overwrites a custom/imported pack', async () => {
    const custom = { pack_id: 'daily_life_a1' }
    const rec = await repo.getContentPack('daily_life_a1')
    await store.installContentPack({
      record: { ...rec, source: 'custom', version: 7, checksum: 'deadbeef' },
      lexical_items: [{ item_id: 'custom_item', en: 'x', pt: 'x', semantic_type: 'theme_object' }],
      template_definitions: [], collocations: [],
    })
    const seeded = await repo.seedBuiltinContentPacks({ force: true })
    expect(seeded.invalid).toEqual([])
    const kept = await repo.getContentPack(custom.pack_id)
    expect(kept.source).toBe('custom')
    expect(kept.version).toBe(7)
    // restore builtin recovers the bundled content explicitly
    const restored = await repo.restoreBuiltinContentPack(custom.pack_id)
    expect(restored.source).toBe('builtin')
    expect(restored.version).toBe(1)
  })

  it('disable keeps data, enable restores availability, dependency errors are explicit', async () => {
    await repo.disableContentPack('travel_b1')
    expect((await repo.getContentPack('travel_b1')).enabled).toBe(false)
    expect((await repo.getLexicalItemsForPacks(['travel_b1'])).length).toBeGreaterThan(0)
    await expect(repo.resolveContentSnapshot({ theme: 'travel', level: 'B1' })).rejects.toThrow()
    await repo.enableContentPack('travel_b1')
    // missing core dependency blocks generation for the theme
    await repo.disableContentPack('core_b1')
    await expect(repo.resolveContentSnapshot({ theme: 'travel', level: 'B1' })).rejects.toMatchObject({ code: 'CONTENT_DEPENDENCY_MISSING' })
    await repo.enableContentPack('core_b1')
    const snap = await repo.resolveContentSnapshot({ theme: 'travel', level: 'B1' })
    expect(snap.pack_ids).toEqual(['core_b1', 'travel_b1'])
  })

  it('rejects packs incompatible with the generator version', async () => {
    const pack = JSON.parse(JSON.stringify(loadBuiltinContentPacks()[0]))
    pack.manifest.generator_compatibility = { min_version: '9', max_version: '9' }
    const { validateContentPack } = repo
    expect(validateContentPack(pack).valid).toBe(true) // schema-valid…
    // …but the seeder refuses it:
    const { setBundledPacksForNode } = await import('./content-pack-loader.js')
    setBundledPacksForNode([pack])
    const res = await repo.seedBuiltinContentPacks({ force: true })
    setBundledPacksForNode(null)
    expect(res.invalid.some((x) => x.errors.some((e) => e.code === 'GENERATOR_INCOMPATIBLE'))).toBe(true)
  })

  it('snapshot is immutable and drives generation with pack metadata', async () => {
    const snap = await repo.resolveContentSnapshot({ theme: 'workplace', level: 'B1' })
    expect(Object.isFrozen(snap)).toBe(true)
    expect(Object.isFrozen(snap.template_definitions)).toBe(true)
    expect(() => { snap.pack_ids.push('x') }).toThrow()
    const lesson = generateLesson({ context: { profile_id: 'p1' }, contentSnapshot: snap, questionCount: 30 })
    expect(lesson.questions).toHaveLength(30)
    expect(lesson.generation_metadata.content_pack_ids).toEqual(['core_b1', 'workplace_b1'])
    expect(lesson.generation_metadata.content_snapshot_checksum).toBe(snap.checksum)
  })
})

describe('import collision safety (PARTE 1)', () => {
  it('never overwrites a private lesson; re-import of the same YAML is idempotent', async () => {
    const snap = await repo.resolveContentSnapshot({ theme: 'workplace', level: 'B1' })
    const priv = generateLesson({ context: { profile_id: 'profile-a' }, contentSnapshot: snap, seed: 'import-col', questionCount: 10 })
    await store.saveLesson(priv)
    const stored = await store.getLesson(priv.lesson_id, { profile_id: 'profile-a' })
    expect(stored.owner_profile_id).toBe('profile-a')

    // Import the exported YAML of the same lesson (same lesson_id).
    const imported = await store.importLesson(parseLesson(priv.raw_content))
    expect(imported.lesson_id).not.toBe(priv.lesson_id)
    expect(imported.lesson_id).toMatch(/^import_b1_[0-9a-f]{8}$/)
    expect(imported.source_lesson_id).toBe(priv.lesson_id)
    expect(imported.imported).toBe(true)
    expect(imported.owner_profile_id).toBeNull()

    // The private original is 100% intact.
    const original = await store.getLesson(priv.lesson_id, { profile_id: 'profile-a' })
    expect(original.owner_profile_id).toBe('profile-a')
    expect(original.generated).toBe(true)
    expect(original.questions).toHaveLength(10)
    expect(original.questions.map((q) => q.expected_answer)).toEqual(stored.questions.map((q) => q.expected_answer))

    // Another profile sees only the imported global copy.
    await expect(store.getLesson(priv.lesson_id, { profile_id: 'profile-b' })).rejects.toMatchObject({ code: 'LESSON_NOT_ACCESSIBLE' })
    const globalCopy = await store.getLesson(imported.lesson_id, { profile_id: 'profile-b' })
    expect(globalCopy.questions).toHaveLength(10)

    // Policy: re-importing the same YAML returns the existing imported copy.
    const again = await store.importLesson(parseLesson(priv.raw_content))
    expect(again.lesson_id).toBe(imported.lesson_id)
    expect(again.already_imported).toBe(true)
    const lessons = await store.getAllLessons()
    expect(lessons.filter((l) => l.source_lesson_id === priv.lesson_id)).toHaveLength(1)

    // Owner still deletes only its own private lesson; the copy survives.
    await store.deleteLesson(priv.lesson_id, { profile_id: 'profile-a' })
    expect(await store.getLesson(imported.lesson_id, { profile_id: 'profile-b' })).toBeTruthy()
  })

  it('import without collision keeps the original id as a global lesson', async () => {
    const yaml = 'lesson_id: tutor_lesson_9\nlevel: B1\nfocus: general\nq:\n  - id: 1\n    t: translate_natural\n    pt: Oi\n    a: Hello\n    f: vocabulary\n'
    const saved = await store.importLesson(parseLesson(yaml))
    expect(saved.lesson_id).toBe('tutor_lesson_9')
    expect((await store.getLesson('tutor_lesson_9')).owner_profile_id).toBeNull()
  })
})
