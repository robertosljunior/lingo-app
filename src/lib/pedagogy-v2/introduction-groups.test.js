// introduction-groups.test.js — Slice V2.21-R2b §16/§28. The structural contract
// of introduction groups.
//
// A group is a REALIZATION tool, never a mastery tool: it lets the engine choose
// between sentences that are already equally valid for the SAME first-contact
// decision. It must never grant mastery, satisfy a prerequisite, open a
// capability, advance a stage, or make a sibling construction look known.
import { describe, it, expect } from 'vitest'
import stillPack from '../../content/pedagogy-v2/still.json'
import butPack from '../../content/pedagogy-v2/but.json'
import yetPack from '../../content/pedagogy-v2/yet.json'
import { getIntroductionGroupId, getIntroductionGroupMembers, getIntendedNewItems } from './query.js'
import { validatePedagogyV2Pack } from './validator.js'

const PACKS = [stillPack, butPack, yetPack]
const groupsOf = (pack) => {
  const m = new Map()
  for (const e of pack.exemplars) {
    const gid = getIntroductionGroupId(e)
    if (!gid || gid.startsWith('intro:solo.')) continue
    if (!m.has(gid)) m.set(gid, [])
    m.get(gid).push(e)
  }
  return m
}

describe('§28.1 — a group never crosses a construction boundary', () => {
  for (const pack of PACKS) {
    for (const [gid, members] of groupsOf(pack)) {
      it(`${gid}: every member realizes the same construction`, () => {
        const constructions = new Set(members.map((e) => e.construction_id))
        expect([...constructions]).toHaveLength(1)
      })
    }
  }

  it('the still continuity sense does NOT collapse its two constructions into one group', () => {
    // sense:still.continuity is realized by the lexical-verb step AND the
    // be-complement step. They are different curricular rungs (§12), so they
    // must never share an introduction group.
    const groups = groupsOf(stillPack)
    const lexical = [...groups].find(([, ms]) => ms[0].construction_id === 'construction:still.subject_still_lexical_verb')
    const be = [...groups].find(([, ms]) => ms[0].construction_id === 'construction:still.subject_be_still_complement')
    expect(lexical).toBeTruthy()
    expect(be).toBeTruthy()
    expect(lexical[0]).not.toBe(be[0])
  })

  it('later still constructions are not folded into an earlier group', () => {
    // but...still, although...still and discourse Still stay later steps (§13/§14/§15).
    const LATER = [
      'construction:still.clause_but_subject_still_verb',
      'construction:still.although_clause_subject_still_verb',
      'construction:still.discourse_still_clause',
    ]
    for (const [, members] of groupsOf(stillPack)) {
      const constructions = new Set(members.map((e) => e.construction_id))
      for (const later of LATER) {
        if (!constructions.has(later)) continue
        // If a later construction ever gets a group, it must be ITS OWN.
        expect([...constructions]).toEqual([later])
      }
    }
  })
})

describe('§28.2/§28.3 — new-item semantics inside a group', () => {
  for (const pack of PACKS) {
    for (const [gid, members] of groupsOf(pack)) {
      it(`${gid}: every member declares the same new-item refs`, () => {
        const sig = (e) => getIntendedNewItems(e).map((n) => `${n.type}:${n.ref}`).sort().join('|')
        const first = sig(members[0])
        for (const e of members) expect(sig(e), e.exemplar_id).toBe(first)
      })
    }
  }

  it('a second member does not re-consume the new-item budget', async () => {
    // The engine keys the budget on the ITEM ref, not on the exemplar: once an
    // item has been introduced in the session, another realization of the same
    // group costs nothing.
    const { newItemsIntroducedInSessionV2 } = await import('./lesson-engine-contracts.js')
    const groups = groupsOf(butPack)
    const [, members] = [...groups][0]
    const refs = getIntendedNewItems(members[0]).map((n) => n.ref)
    const session = { history: [{ new_item_refs: refs }] }
    const introduced = newItemsIntroducedInSessionV2(session)
    // The second member's refs are all already introduced → nothing new to pay.
    const stillNew = getIntendedNewItems(members[1]).map((n) => n.ref).filter((r) => !introduced.has(r))
    expect(stillNew).toEqual([])
  })
})

describe('§16 — group membership is not a gate', () => {
  it('membership grants no mastery, prerequisite, capability or stage', () => {
    // The metadata is a plain string on the exemplar. Nothing in the learner
    // model, the prerequisite assessment or the capability gate reads it — the
    // whole point is that a group only chooses BETWEEN already-valid options.
    for (const pack of PACKS) {
      for (const [, members] of groupsOf(pack)) {
        for (const e of members) {
          expect(typeof e.introduction_group_id).toBe('string')
          // A member never carries mastery-ish or gate-ish fields of its own.
          for (const forbidden of ['mastery', 'capability', 'evidence_level', 'grants', 'unlocks']) {
            expect(e[forbidden], `${e.exemplar_id}.${forbidden}`).toBeUndefined()
          }
        }
      }
    }
  })

  it('members share the exposure stage and the blocking prerequisites', () => {
    // Equal accessibility is what makes them interchangeable (§5). A sentence
    // needing a different bridge or stage must not join the group.
    for (const pack of PACKS) {
      for (const [gid, members] of groupsOf(pack)) {
        const sig = (e) => JSON.stringify({
          stage: e.exposure_stage,
          v2: (e.prerequisites || []).filter((p) => p.type === 'sense' || p.type === 'construction')
            .map((p) => `${p.type}:${p.ref}`).sort(),
          bridges: (e.prerequisites || []).filter((p) => p.type === 'grammar_skill_v1').map((p) => p.ref).sort(),
        })
        const first = sig(members[0])
        for (const e of members) expect(sig(e), `${gid}/${e.exemplar_id}`).toBe(first)
      }
    }
  })
})

describe('§4 — the validator enforces one canonical group per item', () => {
  it('accepts the authored packs', () => {
    for (const pack of PACKS) expect(validatePedagogyV2Pack(pack).valid, pack.manifest.pack_id).toBe(true)
  })

  it('rejects the same item introduced by two different groups', () => {
    const broken = structuredClone(stillPack)
    const target = broken.exemplars.find((e) => getIntendedNewItems(e).length > 0)
    const other = broken.exemplars.find((e) => e !== target && getIntendedNewItems(e).length > 0)
    other.intended_new_items = [...target.intended_new_items]
    other.introduction_group_id = 'intro:a.rogue.group'
    const res = validatePedagogyV2Pack(broken)
    expect(res.valid).toBe(false)
    expect(res.errors.join(' ')).toContain('INTRODUCTION_GROUP_AMBIGUOUS')
  })

  it('rejects a member that is not interchangeable with its group', () => {
    const broken = structuredClone(butPack)
    const members = broken.exemplars.filter((e) => e.introduction_group_id === 'intro:but.contrast_clause')
    expect(members.length).toBeGreaterThan(1)
    members[1].exposure_stage = 'B2' // a materially harder entry point
    const res = validatePedagogyV2Pack(broken)
    expect(res.valid).toBe(false)
    expect(res.errors.join(' ')).toContain('INTRODUCTION_GROUP_SIGNATURE_MISMATCH')
  })
})

describe('helpers', () => {
  it('an exemplar without the field falls back to a singleton group', () => {
    const consolidation = stillPack.exemplars.find((e) => !e.introduction_group_id && getIntendedNewItems(e).length === 0)
    expect(getIntroductionGroupId(consolidation)).toBeNull()
    const introducer = { exemplar_id: 'exemplar:x.1', intended_new_items: [{ type: 'sense', ref: 'sense:x' }] }
    expect(getIntroductionGroupId(introducer)).toBe('intro:solo.exemplar:x.1')
  })

  it('lists the members of a group', () => {
    const members = getIntroductionGroupMembers(butPack, 'intro:but.contrast_clause')
    expect(members.length).toBeGreaterThan(1)
    for (const e of members) expect(e.introduction_group_id).toBe('intro:but.contrast_clause')
  })
})
