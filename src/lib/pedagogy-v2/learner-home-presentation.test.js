// learner-home-presentation.test.js — Slice V2.18 Home presentation adapter
// (§38). Every case protects the product rules: the Home presents REAL study
// modes, never computes mastery / CEFR / skill scores, and never promises to
// resume a persisted session.

import { describe, it, expect } from 'vitest'
import {
  buildLearnerHomePresentationV2,
  buildLearnerSessionResultV2,
  SESSION_CONTEXT_LABELS,
  LEARNER_HOME_PRESENTATION_VERSION,
} from './learner-home-presentation.js'
import { STUDY_MODES } from './study-planner-contracts.js'

describe('§38 — Home presentation adapter', () => {
  it('1. greeting uses the profile name when available', () => {
    const p = buildLearnerHomePresentationV2({ profileName: 'Roberto' })
    expect(p.greeting).toBe('Bom te ver, Roberto.')
  })

  it('2. greeting falls back with no / placeholder name', () => {
    expect(buildLearnerHomePresentationV2({ profileName: null }).greeting).toBe('Bom te ver de novo.')
    expect(buildLearnerHomePresentationV2({ profileName: '  ' }).greeting).toBe('Bom te ver de novo.')
    expect(buildLearnerHomePresentationV2({ profileName: 'Você' }).greeting).toBe('Bom te ver de novo.')
  })

  it('3. primary action is the REAL adaptive mode', () => {
    const p = buildLearnerHomePresentationV2({})
    expect(p.primary_action.mode).toBe('adaptive')
    expect(STUDY_MODES).toContain(p.primary_action.mode)
    expect(p.primary_action.label).toBe('Praticar agora')
  })

  it('4. explore action carries the real explore mode', () => {
    const p = buildLearnerHomePresentationV2({})
    const explore = p.actions.find((a) => a.label === 'Explorar')
    expect(explore.mode).toBe('explore')
  })

  it('5. review action carries the real review mode, non-punitive copy', () => {
    const p = buildLearnerHomePresentationV2({})
    const review = p.actions.find((a) => a.label === 'Revisão')
    expect(review.mode).toBe('review')
    expect(review.description).not.toMatch(/erro|esqueceu|falha|corrigir/i)
  })

  it('6/7/8. no global mastery / CEFR / skill metric anywhere', () => {
    const json = JSON.stringify(buildLearnerHomePresentationV2({ profileName: 'Ana' }))
    expect(json).not.toMatch(/%|master|domínio|CEFR|\bA1\b|\bA2\b|\bB1\b|\bB2\b|skill/i)
  })

  it('9. no false resumability promise (§7)', () => {
    const json = JSON.stringify(buildLearnerHomePresentationV2({ profileName: 'Ana' }))
    expect(json).not.toMatch(/continuar onde parou|retomar|atividade \d|aula anterior/i)
    // "starts from what you practiced" is allowed — it is not a resume claim.
    expect(buildLearnerHomePresentationV2({}).primary_action.description).toMatch(/parte do que você já praticou/i)
  })

  it('10. deterministic output', () => {
    const a = buildLearnerHomePresentationV2({ profileName: 'Ana' })
    const b = buildLearnerHomePresentationV2({ profileName: 'Ana' })
    expect(a).toEqual(b)
    expect(a.presentation_version).toBe(LEARNER_HOME_PRESENTATION_VERSION)
  })

  it('every action mode is a canonical Study Planner mode', () => {
    const p = buildLearnerHomePresentationV2({})
    for (const a of [p.primary_action, ...p.actions]) expect(STUDY_MODES).toContain(a.mode)
    expect(Object.keys(SESSION_CONTEXT_LABELS).sort()).toEqual([...STUDY_MODES].sort())
  })
})

describe('§18 — mode-aware session result (empty vs completed)', () => {
  const interaction = (modality = 'reading', lemma = 'still') => ({
    plan: { modality, pack_id: `pedagogy_v2_${lemma}`, lexeme_lemma: lemma, exemplar_id: `ex:${lemma}`, construction_id: `c:${lemma}`, sense_ids: [`s:${lemma}`] },
    focus: { pack_id: `pedagogy_v2_${lemma}`, reason_codes: [] }, assessment: { status: 'assessed' }, transition: null,
  })

  it('zero interactions → empty (NEVER "praticou 0 atividades")', () => {
    for (const mode of ['review', 'explore', 'adaptive']) {
      const r = buildLearnerSessionResultV2({ interactions: [], mode })
      expect(r.kind).toBe('empty')
      expect(r.mode).toBe(mode)
      expect(JSON.stringify(r)).not.toMatch(/praticou 0|0 atividades/i)
    }
  })

  it('review empty copy', () => {
    const r = buildLearnerSessionResultV2({ interactions: [], mode: 'review' })
    expect(r.headline).toBe('Nada para revisar agora.')
    expect(r.actions.map((a) => a.mode)).toContain('explore')
  })

  it('explore empty copy', () => {
    const r = buildLearnerSessionResultV2({ interactions: [], mode: 'explore' })
    expect(r.headline).toBe('Nada novo disponível agora.')
  })

  it('adaptive empty is neutral — no "course finished / mastered / 100%"', () => {
    const r = buildLearnerSessionResultV2({ interactions: [], mode: 'adaptive' })
    expect(r.headline).toMatch(/não há uma prática disponível/i)
    expect(JSON.stringify(r)).not.toMatch(/terminou o curso|dominou tudo|100%/i)
  })

  it('real interactions → completed factual summary (V2.17-R preserved)', () => {
    const r = buildLearnerSessionResultV2({ interactions: [interaction('reading'), interaction('writing')], mode: 'adaptive' })
    expect(r.kind).toBe('completed')
    const texts = r.summary.facts.map((f) => f.text).join(' | ')
    expect(texts).toMatch(/praticou 2 atividades/i)
    expect(texts).not.toMatch(/%|CEFR|domin|master|formas de usar/i)
  })

  it('an invalid mode falls back to a safe empty state, never crashes', () => {
    const r = buildLearnerSessionResultV2({ interactions: [], mode: 'bogus' })
    expect(r.kind).toBe('empty')
    expect(r.mode).toBe('adaptive')
  })
})
