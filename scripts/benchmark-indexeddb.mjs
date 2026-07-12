// benchmark-indexeddb.mjs — PARTE 17: 100 aulas / 3.000 perguntas em um
// IndexedDB realista (fake-indexeddb), medindo geração, persistência,
// listagem, abertura por ID, exclusão e isolamento entre perfis.
//
// Roda isolado do banco do usuário (o IndexedDB fake vive só neste processo):
//   npm run benchmark:indexeddb
import 'fake-indexeddb/auto'

import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const storage = await import('../src/lib/storage.js')
const { generateLesson } = await import('../src/lib/lesson-generator.js')
const { setBundledPacksForNode, composeBundledSnapshot } = await import('../src/lib/content-pack-loader.js')
const repo = await import('../src/lib/content-pack-repository.js')

// Load the bundled packs from disk (plain node has no import.meta.glob).
const packsDir = path.join(path.dirname(path.dirname(url.fileURLToPath(import.meta.url))), 'src/content/packs')
setBundledPacksForNode(fs.readdirSync(packsDir).flatMap((dir) =>
  fs.readdirSync(path.join(packsDir, dir)).map((f) => JSON.parse(fs.readFileSync(path.join(packsDir, dir, f), 'utf8')))))

const LESSONS = 100
const QUESTIONS_PER_LESSON = 30
const PROFILE_A = 'profile-a'
const PROFILE_B = 'profile-b'

const now = () => performance.now()

async function main() {
  await storage.saveProfile({ profile_id: PROFILE_A, name: 'Perfil A' })
  await storage.saveProfile({ profile_id: PROFILE_B, name: 'Perfil B' })
  await storage.setSetting('active_profile', PROFILE_A)

  const context = {
    level: 'B1',
    profile_id: PROFILE_A,
    target_skills: [
      { skill_id: 'gerund_after_been', priority: 1, mastery: 0.34, evidence: 'emerging' },
      { skill_id: 'question_structure', priority: 0.7, mastery: 0.55, evidence: 'established' },
    ],
    reinforcement_skills: [{ skill_id: 'workplace_preposition', mastery: 0.68 }],
  }

  // Content pack seed + snapshot (Slice 5 paths).
  const tSeed = now()
  const seedResult = await repo.seedBuiltinContentPacks()
  const seed_packs_ms = Math.round(now() - tSeed)
  const tSeed2 = now()
  await repo.seedBuiltinContentPacks()
  const seed_noop_ms = Math.round(now() - tSeed2)
  const tSnap = now()
  const dbSnapshot = await repo.resolveContentSnapshot({ theme: 'workplace', level: 'B1' })
  const snapshot_ms = Math.round(now() - tSnap)
  const snapshot = composeBundledSnapshot('workplace', 'B1')

  // Generation (pure, deterministic).
  const tGen = now()
  const lessons = []
  for (let i = 0; i < LESSONS; i++) {
    lessons.push(generateLesson({
      context: { ...context, profile_id: PROFILE_A },
      contentSnapshot: snapshot,
      questionCount: QUESTIONS_PER_LESSON,
      seed: `bench-${i}`,
    }))
  }
  const generate_ms = Math.round(now() - tGen)

  // Persistence.
  const tWrite = now()
  for (const lesson of lessons) await storage.saveLesson(lesson)
  const write_ms = Math.round(now() - tWrite)

  // Listing (owner vs non-owner).
  const tListA = now()
  const listedA = await storage.getAllLessons(PROFILE_A)
  const list_owner_ms = Math.round(now() - tListA)
  const tListB = now()
  const listedB = await storage.getAllLessons(PROFILE_B)
  const list_non_owner_ms = Math.round(now() - tListB)

  // Read by id (middle of the set).
  const target = lessons[Math.floor(LESSONS / 2)].lesson_id
  const tRead = now()
  const byId = await storage.getLesson(target, { profile_id: PROFILE_A })
  const read_by_id_ms = Math.round(now() - tRead)

  // Cross-profile leak checks: B must see none of A's lessons/questions, and
  // direct access must be refused.
  const questionsForB = await storage.getAllQuestions(PROFILE_B)
  let cross_profile_leaks = listedB.length + questionsForB.filter((q) => q.owner_profile_id === PROFILE_A).length
  try {
    await storage.getLesson(target, { profile_id: PROFILE_B })
    cross_profile_leaks += 1
  } catch (e) {
    if (e?.code !== 'LESSON_NOT_ACCESSIBLE') cross_profile_leaks += 1
  }

  // Deletion.
  const tDelete = now()
  await storage.deleteLesson(target, { profile_id: PROFILE_A })
  const delete_ms = Math.round(now() - tDelete)

  const report = {
    lessons: LESSONS,
    questions: LESSONS * QUESTIONS_PER_LESSON,
    content_packs_installed: seedResult.installed + seedResult.skipped + seedResult.updated,
    seed_packs_ms,
    seed_noop_ms,
    snapshot_ms,
    snapshot_pack_ids: dbSnapshot.pack_ids,
    generate_ms,
    write_ms,
    list_owner_ms,
    list_non_owner_ms,
    read_by_id_ms,
    delete_ms,
    listed_owner: listedA.length,
    listed_non_owner: listedB.length,
    read_by_id_questions: byId.questions.length,
    cross_profile_leaks,
  }
  console.log(JSON.stringify(report, null, 2))

  // Sanity gates (loose on purpose — this is a report, not a strict CI gate).
  if (listedA.length !== LESSONS) throw new Error(`owner listing expected ${LESSONS}, got ${listedA.length}`)
  if (byId.questions.length !== QUESTIONS_PER_LESSON) throw new Error('read_by_id returned wrong question count')
  if (cross_profile_leaks !== 0) throw new Error(`cross-profile leaks detected: ${cross_profile_leaks}`)
}

main().then(() => process.exit(0), (err) => { console.error(err); process.exit(1) })
