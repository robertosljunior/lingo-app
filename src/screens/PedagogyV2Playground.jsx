// PedagogyV2Playground.jsx — "Pedagogy V2 Playground" (Slice V2.12): a minimal,
// DIAGNOSTIC surface to exercise the whole existing V2 intelligence by hand. It
// is NOT the final UI and never replaces the V1 flow — it runs strictly beside
// it. Gated to development builds or the `pedagogy_v2_diagnostics_enabled` flag
// (the same gate as the Inspector). It reuses the REAL pipeline end to end —
// Study Planner → Lesson Engine → V2 renderers → Assessment → Evidence → Learner
// Model — and never re-implements exercises, assessment or feedback analysis.
//
// Three modes:
//   Sessão V2         — a real study session (focused / adaptive / review /
//                       explore); persists evidence in the normal session.
//   Testar target     — materialize ONE authored activity for a chosen
//                       (pack, target, capability, modality); isolated by
//                       default (no evidence written).
//   Sandbox           — one real ActivityPlan, many alternative responses, the
//                       real Assessment, NEVER persisted.
//
// The feedback shown here is built by the PURE buildV2FeedbackViewModel adapter,
// which is the single guardian of the honesty rules (a textual mismatch is never
// invented into a grammar error; a coarse outcome is reported as such).

import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp, SCREENS } from '../store.jsx'
import { I } from '../components/icons.jsx'
import {
  loadPedagogyV2Registry, getPedagogyPack, getLexemeAcrossRegistry,
} from '../lib/pedagogy-v2/registry.js'
import { buildStudyPlannerContextV2 } from '../lib/pedagogy-v2/study-planner-context.js'
import { buildLessonEngineContextV2 } from '../lib/pedagogy-v2/lesson-engine-context.js'
import { createStudySessionControllerV2 } from '../lib/pedagogy-v2/study-session-controller.js'
import { selectNextActivityV2 } from '../lib/pedagogy-v2/lesson-engine.js'
import { createLessonSessionV2 } from '../lib/pedagogy-v2/lesson-engine-contracts.js'
import { evaluateActivityResponseV2 } from '../lib/pedagogy-v2/activity-assessment.js'
import { buildLearnerEvidenceBatchFromInteractionV2 } from '../lib/pedagogy-v2/assessment-to-evidence.js'
import { buildActivityResponseV2, createSupportRuntime } from '../lib/pedagogy-v2/activity-runtime-contracts.js'
import { validateActivityResponseV2 } from '../lib/pedagogy-v2/activity-runtime-validator.js'
import { detectRuntimeCapabilitiesV2, computeRecipeRuntimeAvailability } from '../lib/pedagogy-v2/runtime-capabilities.js'
import { getTrainingAffordancesV2, getTrainableModalitiesForCapabilityV2 } from '../lib/pedagogy-v2/training-affordances.js'
import { speechSupported } from '../lib/audio/tts.js'
import { sttSupported } from '../lib/audio/stt.js'
import V2ActivityRenderer from '../components/pedagogy-v2/V2ActivityRenderer.jsx'
import { buildV2FeedbackViewModel } from '../lib/pedagogy-v2/feedback-view-model.js'
import { createProductionAssessmentServicesV2 } from '../lib/pedagogy-v2/production-assessment-service.js'
import {
  packReferencedTargetsV2, synthesizeIsolatedStatesV2, CAPABILITY_LADDER,
} from '../lib/pedagogy-v2/playground-support.js'

export function playgroundEnabled(settings) {
  return !!(import.meta.env?.DEV || settings?.pedagogy_v2_diagnostics_enabled)
}

const MODES = [
  { id: 'session', title: 'Sessão V2', description: 'Sessão real: Planner → Engine → Assessment → Evidence (grava evidência).' },
  { id: 'target', title: 'Testar target', description: 'Materializa uma atividade autorada para um alvo. Isolado por padrão.' },
  { id: 'sandbox', title: 'Sandbox de avaliação', description: 'Teste várias respostas na mesma atividade. Nenhuma evidência é gravada.' },
]

const CAPABILITY_LABELS = {
  recognition: 'Reconhecimento', comprehension: 'Compreensão',
  controlled_production: 'Produção guiada', free_production: 'Produção livre',
  pronunciation: 'Pronúncia',
}

// ---- shared presentation bits ----------------------------------------------

function PipelineBadge() {
  return <div className="label-eyebrow" data-testid="v2pg-pipeline-badge" style={{ color: 'var(--indigo-600)' }}>Pipeline: Pedagogy V2</div>
}

function useRuntime() {
  const capabilities = useMemo(() => detectRuntimeCapabilitiesV2({ ttsSupported: speechSupported, sttSupported }), [])
  const availability = useMemo(() => computeRecipeRuntimeAvailability(capabilities), [capabilities])
  return { capabilities, availability }
}

// Compact key/value line used across the diagnostics panels.
function KV({ k, v }) {
  return (
    <div style={{ display: 'flex', gap: 6, fontFamily: 'var(--font-mono, monospace)', fontSize: 12, wordBreak: 'break-word' }}>
      <span className="muted" style={{ flexShrink: 0 }}>{k}:</span>
      <span>{v === null || v === undefined || v === '' ? '—' : v}</span>
    </div>
  )
}

function targetStr(t) { return t ? `${t.target_type} ${t.target_id}` : '—' }

// Raw assessment for display: the semantic_result (shown in its own section) is
// stripped here so the two panels don't duplicate the same large payload.
function rawAssessmentForDisplay(assessment) {
  if (!assessment) return assessment
  const { semantic_result, ...rest } = assessment // eslint-disable-line no-unused-vars
  return rest
}

// ---- feedback (built from the PURE view model) ------------------------------

function FeedbackView({ plan, response, assessment, recordedEvidence }) {
  const vm = useMemo(
    () => buildV2FeedbackViewModel({ plan, response, assessment, recordedEvidence }),
    [plan, response, assessment, recordedEvidence],
  )
  return (
    <div className="card" data-testid="v2pg-feedback" data-status={vm.status} style={{ padding: 16 }}>
      <div style={{ fontWeight: 900, fontSize: 17 }} data-testid="v2pg-feedback-headline">{vm.headline}</div>

      {vm.response_text !== '' && (
        <div style={{ marginTop: 8 }}>
          <div className="label-eyebrow">Sua resposta</div>
          <div data-testid="v2pg-feedback-response" style={{ fontSize: 15 }}>{vm.response_text}</div>
        </div>
      )}
      {vm.target_form && (
        <div style={{ marginTop: 8 }}>
          <div className="label-eyebrow">Forma de referência (forma-alvo)</div>
          <div data-testid="v2pg-feedback-target-form" style={{ fontSize: 15, fontWeight: 700 }}>{vm.target_form.text_en}</div>
          {vm.target_form.text_pt && <div className="muted" style={{ fontSize: 13 }}>{vm.target_form.text_pt}</div>}
        </div>
      )}

      {vm.correct_points.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div className="label-eyebrow">O que estava correto</div>
          <ul data-testid="v2pg-correct" style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 14 }}>
            {vm.correct_points.map((p, i) => <li key={i}>✓ {p.text}</li>)}
          </ul>
        </div>
      )}

      {vm.issues.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div className="label-eyebrow">Correção linguística (o que precisa de ajuste)</div>
          <ul data-testid="v2pg-issues" style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 14 }}>
            {vm.issues.map((it, i) => (
              <li key={i}>△ {it.title ? <b>{it.title}: </b> : null}{it.text}
                {it.category && <span className="muted" style={{ fontSize: 11 }}> [{it.category}{it.severity ? `/${it.severity}` : ''}]</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {vm.suggestions.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div className="label-eyebrow">Sugestões (naturalidade)</div>
          <ul data-testid="v2pg-suggestions" style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 14 }}>
            {vm.suggestions.map((s, i) => <li key={i}>{s.text}</li>)}
          </ul>
        </div>
      )}

      {vm.target_form_note && (
        <div style={{ marginTop: 10 }}>
          <div className="label-eyebrow">Forma-alvo</div>
          <p data-testid="v2pg-target-form-note" style={{ fontSize: 13, margin: 0 }}>{vm.target_form_note}</p>
        </div>
      )}

      {vm.diagnostics.note && (
        <p className="muted" data-testid="v2pg-feedback-note" style={{ fontSize: 13, marginTop: 10 }}>{vm.diagnostics.note}</p>
      )}

      <div className="muted" data-testid="v2pg-provenance" style={{ fontSize: 12, marginTop: 10 }}>
        Avaliado por: <b>{vm.diagnostics.provenance.label}</b>
      </div>
    </div>
  )
}

// ---- technical diagnostics ("Diagnóstico técnico") --------------------------

function DiagnosticsPanel({ focus, plan, response, assessment, plannedEvidence, recordedEvidence, plannerDecision }) {
  const vm = useMemo(
    () => (plan && assessment ? buildV2FeedbackViewModel({ plan, response, assessment, recordedEvidence }) : null),
    [plan, response, assessment, recordedEvidence],
  )
  const planned = plannedEvidence ?? plan?.planned_evidence ?? []
  return (
    <details data-testid="v2pg-diagnostics" style={{ fontSize: 12, border: '1px dashed var(--border)', borderRadius: 10, padding: 10 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 800 }}>Diagnóstico técnico</summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
        <PipelineBadge />

        {focus && (
          <section data-testid="v2pg-diag-focus">
            <div className="label-eyebrow">StudyFocus</div>
            <KV k="focus_type" v={focus.focus_type} />
            <KV k="pack_id" v={focus.pack_id} />
            <KV k="lexeme_id" v={focus.lexeme_id ?? plan?.lexeme_id} />
            <KV k="target" v={targetStr(focus.target)} />
            <KV k="capability" v={focus.capability} />
            <KV k="modality" v={focus.modality} />
            <KV k="reason_codes" v={(focus.reason_codes || []).join(', ')} />
          </section>
        )}

        {plan && (
          <section data-testid="v2pg-diag-plan">
            <div className="label-eyebrow">ActivityPlan</div>
            <KV k="activity_id" v={plan.activity_id} />
            <KV k="exemplar_id" v={plan.exemplar_id} />
            <KV k="recipe" v={plan.recipe} />
            <KV k="activity_kind" v={plan.activity_kind} />
            <KV k="capability" v={plan.capability} />
            <KV k="modality" v={plan.modality} />
            <KV k="support tier" v={plan.support?.derived_tier} />
            <KV k="primary target" v={targetStr(plan.primary_target)} />
            <KV k="secondary targets" v={(plan.secondary_targets || []).map(targetStr).join(' | ')} />
          </section>
        )}

        {assessment && (
          <section data-testid="v2pg-diag-assessment">
            <div className="label-eyebrow">Assessment</div>
            <KV k="status" v={assessment.status} />
            <KV k="outcome" v={assessment.outcome} />
            <KV k="score" v={assessment.partial_score} />
            <KV k="confidence" v={assessment.assessment_confidence} />
            <KV k="semantic verdict" v={assessment.feedback?.verdict} />
            <KV k="assessment mode" v={assessment.feedback?.kind} />
            <KV k="issues" v={(assessment.feedback?.detected_errors || []).map((e) => `${e.category || 'issue'}/${e.severity || '?'}`).join(', ')} />
            <KV k="suggestions" v={(assessment.feedback?.natural_alternatives || []).map((a) => a.text).join(' | ')} />
            <KV k="avaliado por" v={vm?.diagnostics.provenance.label} />
          </section>
        )}

        {assessment?.diagnosis && (
          <section data-testid="v2pg-diag-diagnosis">
            <div className="label-eyebrow">Assessment Diagnosis</div>
            <KV k="cause coverage" v={assessment.diagnosis.cause_coverage} />
            <KV k="primary cause" v={assessment.diagnosis.primary_cause
              ? `${assessment.diagnosis.primary_cause.category} · ${assessment.diagnosis.primary_cause.code}`
              : '— (nenhuma / correto)'} />
            <KV k="primary severity" v={assessment.diagnosis.primary_cause?.severity} />
            <KV k="primary confidence" v={assessment.diagnosis.primary_cause?.confidence} />
            <KV k="primary source" v={assessment.diagnosis.primary_cause?.source} />
            <KV k="semantic relation" v={assessment.diagnosis.semantic_relation?.status} />
            <KV k="target form relation" v={assessment.diagnosis.target_form_relation?.status} />
            {(assessment.diagnosis.causes || []).map((c, i) => (
              <KV key={i} k={`cause[${i}]`} v={`${c.category}/${c.severity ?? '—'} · ${c.code} · src=${c.source}${c.origin ? ` (${c.origin})` : ''}`} />
            ))}
            {(assessment.diagnosis.positive_findings || []).map((p, i) => (
              <KV key={`p${i}`} k={`positive[${i}]`} v={`${p.code} · src=${p.source}`} />
            ))}
          </section>
        )}

        {assessment?.semantic_bridge && (
          <section data-testid="v2pg-diag-bridge">
            <div className="label-eyebrow">Semantic Assessment Bridge</div>
            <KV k="strategy" v={assessment.semantic_bridge.strategy} />
            <KV k="assessment_mode" v={assessment.semantic_bridge.assessment_mode} />
            <KV k="requested_intent" v={assessment.semantic_bridge.requested_intent} />
            {/* Authored target metadata only — never the learner's answer. */}
            <KV k="equivalent_target" v={assessment.semantic_bridge.equivalent_target
              ? `text="${assessment.semantic_bridge.equivalent_target.text}" · essential=[${(assessment.semantic_bridge.equivalent_target.essential_words || []).join(', ')}]`
              : null} />
            <KV k="bridge source" v={assessment.semantic_bridge.provenance?.source} />
            <KV k="provenance target" v={assessment.semantic_bridge.provenance?.target_id} />
            <KV k="fallback reason" v={assessment.semantic_bridge.fallback_reason} />
          </section>
        )}

        {assessment?.semantic_result?.semantic_equivalence && (() => {
          const eq = assessment.semantic_result.semantic_equivalence
          const ev = eq.evidence || {}
          return (
            <section data-testid="v2pg-diag-equivalence">
              <div className="label-eyebrow">Semantic Equivalence</div>
              <KV k="status" v={eq.status} />
              <KV k="confidence" v={eq.confidence} />
              <KV k="engine" v={eq.engine} />
              <KV k="reason_codes" v={(eq.reason_codes || []).join(', ')} />
              <KV k="essential" v={ev.essential_entities ? `preserved=${ev.essential_entities.preserved} · missing=[${(ev.essential_entities.missing || []).join(', ')}]` : null} />
              <KV k="polarity" v={ev.polarity ? `target=${ev.polarity.target ?? '—'}(authored=${ev.polarity.target_authored}) · response=${ev.polarity.response} · contradiction=${ev.polarity.contradiction}` : null} />
              <KV k="similarity" v={ev.semantic_similarity ? `${ev.semantic_similarity.score ?? '—'} (thr=${ev.semantic_similarity.threshold}, meets=${ev.semantic_similarity.meets_threshold})` : null} />
            </section>
          )
        })()}

        <section data-testid="v2pg-diag-planned-evidence">
          <div className="label-eyebrow">Planned evidence</div>
          {planned.length === 0 ? <div className="muted">—</div> : planned.map((pe, i) => (
            <KV key={i} k={targetStr(pe.target)} v={`attr=${pe.attribution} · ${pe.activity?.capability}/${pe.activity?.modality}`} />
          ))}
        </section>

        <section data-testid="v2pg-diag-recorded-evidence">
          <div className="label-eyebrow">Recorded evidence {recordedEvidence == null ? '(não persistida — sandbox/isolado)' : ''}</div>
          {(recordedEvidence || []).length === 0 ? <div className="muted">—</div> : recordedEvidence.map((ev, i) => (
            <KV key={i} k={ev.evidence_id} v={`${targetStr(ev.target)} · attr=${ev.attribution} · ${ev.outcome} · tier=${ev.support?.features?.length ? ev.support.features.join('+') : 'none'}`} />
          ))}
        </section>

        {plannerDecision && (
          <section data-testid="v2pg-diag-planner">
            <div className="label-eyebrow">Planner decision (trace)</div>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 11, margin: 0 }}>{JSON.stringify(plannerDecision, null, 1)}</pre>
          </section>
        )}

        {assessment?.semantic_result && (
          <section data-testid="v2pg-diag-raw-semantic">
            <div className="label-eyebrow">Raw semantic result (em memória — não persistido)</div>
            <pre data-testid="v2pg-raw-semantic" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 11, margin: 0 }}>{JSON.stringify(assessment.semantic_result, null, 1)}</pre>
          </section>
        )}
        {assessment && (
          <section data-testid="v2pg-diag-raw">
            <div className="label-eyebrow">Raw assessment</div>
            <pre data-testid="v2pg-raw-assessment" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 11, margin: 0 }}>{JSON.stringify(rawAssessmentForDisplay(assessment), null, 1)}</pre>
          </section>
        )}
        {vm && (
          <section data-testid="v2pg-diag-vm">
            <div className="label-eyebrow">Feedback apresentado (view model)</div>
            <pre data-testid="v2pg-feedback-vm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 11, margin: 0 }}>{JSON.stringify({
              status: vm.status, headline: vm.headline, correct_points: vm.correct_points,
              issues: vm.issues, suggestions: vm.suggestions, target_form: vm.target_form,
              target_form_note: vm.target_form_note,
            }, null, 1)}</pre>
          </section>
        )}
      </div>
    </details>
  )
}

// ---- learner-state change panel (§21/§22) -----------------------------------

function laneSummary(state) {
  const out = []
  for (const [capKey, lanes] of Object.entries(state?.capabilities || {})) {
    const o = lanes.overall || {}
    const ind = lanes.independent || {}
    out.push(`${capKey}: nível=${o.evidence_level} · evidências=${o.assessed_evidence_count} · tendência=${o.trend}${ind.assessed_evidence_count ? ` · independente=${ind.assessed_evidence_count}` : ''}`)
  }
  return out
}

// Slice V2.16 — Focus Resolution diagnostics (§20). Diagnostics only; never
// shown to the learner. Distinguishes planner_empty from no_materializable_focus.
function FocusResolutionPanel({ resolution }) {
  if (!resolution) return null
  const t = resolution.resolution_trace || {}
  const rejected = (t.attempts || []).filter((a) => a.result === 'rejected')
  const reasonDist = {}
  for (const a of rejected) for (const code of a.reason_codes || []) reasonDist[code] = (reasonDist[code] || 0) + 1
  return (
    <details data-testid="v2pg-focus-resolution" style={{ fontSize: 12, border: '1px dashed var(--border)', borderRadius: 10, padding: 10 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 800 }}>Focus Resolution</summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
        <KV k="status" v={resolution.status} />
        <KV k="candidates" v={t.candidate_count} />
        <KV k="attempted" v={t.attempted_count} />
        <KV k="selected rank" v={t.selected?.planner_rank ?? '—'} />
        <KV k="rejected before selection" v={rejected.length} />
        <KV k="reason distribution" v={Object.keys(reasonDist).length ? Object.entries(reasonDist).map(([c, n]) => `${c}×${n}`).join(', ') : '—'} />
        {rejected.slice(0, 8).map((a, i) => (
          <KV key={i} k={`rejected[${a.planner_rank}]`} v={`${a.focus_key} · ${(a.reason_codes || []).join(',')}`} />
        ))}
      </div>
    </details>
  )
}

function LearnerChangePanel({ affectedTargets, statesAfter }) {
  if (!affectedTargets || affectedTargets.length === 0) return null
  const byId = new Map((statesAfter || []).map((s) => [s.target?.target_id, s]))
  return (
    <div className="card" data-testid="v2pg-learner-change" style={{ padding: 14 }}>
      <div style={{ fontWeight: 800, fontSize: 15 }}>O que mudou no Learner Model</div>
      <p className="muted" style={{ fontSize: 12, margin: '4px 0 8px' }}>Apenas os alvos afetados por esta interação. Sem mastery global.</p>
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
        {affectedTargets.map((t) => {
          const st = byId.get(t.target_id)
          return (
            <li key={`${t.target_type}:${t.target_id}`} style={{ borderTop: '1px solid var(--border)', padding: '6px 0' }}>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12, fontWeight: 700 }}>{t.target_type} {t.target_id}</div>
              <div className="muted" style={{ fontSize: 12 }}>exposições: {st?.exposure?.count ?? 0}</div>
              {(laneSummary(st)).map((line, i) => <div key={i} style={{ fontSize: 12 }}>{line}</div>)}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ============================================================================
// Mode: Sessão V2
// ============================================================================

const STUDY_MODE_OPTIONS = [
  { id: 'focused', label: 'Focused (um pack)' },
  { id: 'adaptive', label: 'Adaptive' },
  { id: 'review', label: 'Review' },
  { id: 'explore', label: 'Explore' },
]

function packLemma(pack, registry) {
  return getLexemeAcrossRegistry(pack?.manifest?.primary_lexeme_id, registry)?.lexeme?.lemma
    ?? pack?.manifest?.primary_lexeme_id ?? '—'
}

function SessionMode({ registry }) {
  const { activeProfile, db, settings } = useApp()
  const { capabilities } = useRuntime()
  const [mode, setMode] = useState('focused')
  const [packId, setPackId] = useState(registry.packs[0]?.manifest.pack_id ?? null)
  const [running, setRunning] = useState(false)
  const [state, setState] = useState(null)
  const [statesAfter, setStatesAfter] = useState(null)
  const controllerRef = useRef(null)

  const packs = useMemo(() => [...registry.packs].sort((a, b) =>
    ((a.manifest.catalog_order ?? 999) - (b.manifest.catalog_order ?? 999))), [registry])

  const start = () => {
    const controller = createStudySessionControllerV2({
      profileId: activeProfile,
      registry,
      mode,
      focusedPackId: mode === 'focused' ? packId : null,
      buildPlannerContext: (profileId, opts) => buildStudyPlannerContextV2(profileId, opts),
      recordBatch: (events) => db.recordLearnerEvidenceBatchV2(events),
      capabilities,
      assessmentServices: createProductionAssessmentServicesV2(),
    })
    controllerRef.current = controller
    setState(controller.getState())
    controller.subscribe(setState)
    controller.start()
    setRunning(true)
  }

  // After each recorded interaction, refresh the real states so the change
  // panel reflects persisted evidence.
  useEffect(() => {
    if (state?.status === 'feedback' && state.recordedEvents?.length) {
      let alive = true
      db.getLearnerTargetStatesV2(activeProfile).then((s) => { if (alive) setStatesAfter(s) })
      return () => { alive = false }
    }
    return undefined
  }, [state?.status, state?.recordedEvents, db, activeProfile])

  const c = controllerRef.current
  const s = state
  const focusForDiag = s?.focus ? {
    focus_type: s.focus.focus_type, pack_id: s.focus.pack_id, lexeme_id: s.plan?.lexeme_id,
    target: s.focus.target, capability: s.focus.capability, modality: s.focus.modality,
    reason_codes: s.focus.reason_codes,
  } : null
  const affected = useMemo(() => {
    const seen = new Map()
    for (const ev of s?.recordedEvents || []) seen.set(ev.target.target_id, ev.target)
    return [...seen.values()]
  }, [s?.recordedEvents])

  if (!running) {
    return (
      <div className="card" style={{ padding: 16 }} data-testid="v2pg-session-setup">
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>Modo de estudo</div>
        <select className="input" data-testid="v2pg-session-mode" value={mode} onChange={(e) => setMode(e.target.value)} style={{ width: '100%', marginBottom: 10 }}>
          {STUDY_MODE_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        {mode === 'focused' && (
          <>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>Pack (do registry)</div>
            <select className="input" data-testid="v2pg-session-pack" value={packId ?? ''} onChange={(e) => setPackId(e.target.value)} style={{ width: '100%', marginBottom: 10 }}>
              {packs.map((p) => <option key={p.manifest.pack_id} value={p.manifest.pack_id}>{packLemma(p, registry)} — {p.manifest.pack_id}</option>)}
            </select>
          </>
        )}
        <button className="btn btn-primary" data-testid="v2pg-session-start" onClick={start}>Iniciar sessão</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} data-testid="v2pg-session-run" data-mode={mode}>
      {(!s || s.status === 'idle' || s.status === 'planning') && <div className="muted" data-testid="v2pg-loading">Preparando sessão…</div>}

      {s?.status === 'error' && (
        <div className="card" data-testid="v2pg-error" style={{ padding: 14 }}>
          <div style={{ fontWeight: 800 }}>Algo deu errado</div>
          <p className="muted" style={{ fontSize: 12 }}>{s.error?.code}: {s.error?.detail}</p>
          <button className="btn btn-secondary" onClick={() => c.start()}>Recomeçar</button>
        </div>
      )}

      {(s?.status === 'presenting' || s?.status === 'submitting') && s.plan && (
        <>
          <div className="card" style={{ padding: 12 }}>
            <div className="muted" style={{ fontSize: 12 }} data-testid="v2pg-activity-summary">
              Pack: {s.plan.lexeme_lemma || s.plan.pack_id} · Modo: {mode} · Atividade: {s.plan.recipe}
            </div>
          </div>
          <V2ActivityRenderer plan={s.plan} capabilities={capabilities} settings={settings}
            busy={s.status === 'submitting'}
            onSubmit={(type, payload) => c.submit(type, payload)}
            onSupport={(f) => c.recordSupport(f)} />
          <FocusResolutionPanel resolution={s.resolution} />
          <DiagnosticsPanel focus={focusForDiag} plan={s.plan} plannerDecision={s.plannerDecision?.trace} />
        </>
      )}

      {(s?.status === 'feedback' || s?.status === 'advancing') && s.plan && s.assessment && (
        <>
          <FeedbackView plan={s.plan} response={s.pendingResponse} assessment={s.assessment} recordedEvidence={s.recordedEvents} />
          <LearnerChangePanel affectedTargets={affected} statesAfter={statesAfter} />
          <DiagnosticsPanel focus={focusForDiag} plan={s.plan} response={s.pendingResponse}
            assessment={s.assessment} recordedEvidence={s.recordedEvents} plannerDecision={s.plannerDecision?.trace} />
          <button className="btn btn-primary" data-testid="v2pg-continue" disabled={s.status === 'advancing'} onClick={() => c.advance()}>Continuar</button>
        </>
      )}

      {s?.status === 'complete' && (
        <>
          <div className="card" data-testid="v2pg-session-complete" style={{ padding: 16 }}>
            <div style={{ fontWeight: 800 }}>Sessão concluída</div>
            <p className="muted" style={{ fontSize: 13 }}>{s.interactions.length} interações avaliadas nesta sessão.</p>
            {/* §19 — the learner sees only "done"; diagnostics expose why. */}
            {s.resolution && s.resolution.status !== 'activity' && (
              <p className="muted" data-testid="v2pg-session-end-reason" style={{ fontSize: 12 }}>
                Motivo (diagnóstico): {s.resolution.status === 'planner_empty' ? 'nenhum foco elegível' : 'nenhum foco materializável agora'}
              </p>
            )}
            <button className="btn btn-secondary" onClick={() => { setRunning(false); setState(null) }}>Nova sessão</button>
          </div>
          <FocusResolutionPanel resolution={s.resolution} />
        </>
      )}
    </div>
  )
}

// ============================================================================
// Shared: activity materializer (Target + Sandbox)
// ============================================================================

const ISOLATION_OPTIONS = [
  { id: 'isolated', label: 'Teste isolado (não grava evidência)' },
  { id: 'current', label: 'Usar meu estado atual' },
]

function useAffordanceOptions(availability) {
  const affordances = useMemo(() => getTrainingAffordancesV2({ runtimeAvailability: availability }), [availability])
  const capabilities = useMemo(() => CAPABILITY_LADDER.filter((cap) =>
    affordances.some((a) => a.capability === cap && a.can_produce_assessed_evidence)), [affordances])
  return { affordances, capabilities }
}

/**
 * Materialize ONE real ActivityPlan for a (pack, target, capability, modality).
 * Isolated mode builds an in-memory learner state and NEVER reads/writes the DB;
 * current mode reads the real context. Returns { decision, plan, focus,
 * learnerStates, recentEvidence, context } or { decision } on no-eligible.
 */
async function materializeActivityV2({ registry, packId, target, capability, modality, isolation, profileId, buildContext, availability }) {
  const pack = getPedagogyPack(packId, registry)
  const now = new Date().toISOString()
  const scope = { registry, pack_id: packId, lexeme_id: pack.manifest.primary_lexeme_id }
  const focus = capability
    ? { target_id: target?.target_id, capability, modality, focus_type: 'playground_target', pack_id: packId, target }
    : { target_id: target?.target_id, focus_type: 'playground_introduction', pack_id: packId, target }

  let learnerStates = []
  let recentEvidence = []
  let context = null
  if (isolation === 'current') {
    context = await buildContext(profileId, { now, packId, lexemeId: pack.manifest.primary_lexeme_id, registry })
    learnerStates = context.learner_states
    recentEvidence = context.recent_evidence
  } else {
    // Isolated: derive external prereqs from the real context SHAPE only (no
    // learner data) so cross-pack prerequisites can be warmed in-memory.
    const shape = await buildContext(profileId, { now, packId, lexemeId: pack.manifest.primary_lexeme_id, registry })
    const synth = synthesizeIsolatedStatesV2({
      registry, pack, capability, modality,
      externalPrerequisiteTargets: shape.external_prerequisite_targets || [],
      profileId: 'playground-isolated',
    })
    learnerStates = synth.states
    recentEvidence = synth.evidence
    context = { external_prerequisite_targets: shape.external_prerequisite_targets, isolated: true }
  }

  // Deterministic seed (Slice V2.14): the same (pack, target, capability,
  // modality) materializes the SAME authored activity every time — a diagnostic
  // tool should be reproducible, and it lets tests target authored metadata.
  const seedKey = `v2pg-${packId}-${target?.target_id ?? 'none'}-${capability ?? 'intro'}-${modality ?? 'none'}`
  const session = createLessonSessionV2({ session_id: seedKey, profile_id: profileId, now })
  const decision = selectNextActivityV2({
    session, scope, learnerStates, recentEvidence,
    focus: capability ? { target_id: target?.target_id, capability, modality } : { target_id: target?.target_id },
    runtimeAvailability: availability,
  })
  return { decision, plan: decision.status === 'activity' ? decision.plan : null, focus, learnerStates, recentEvidence, context, session }
}

function TargetSelectors({ registry, availability, value, onChange, showCapabilityless }) {
  const pack = getPedagogyPack(value.packId, registry)
  const targets = useMemo(() => packReferencedTargetsV2(pack), [pack])
  const { capabilities } = useAffordanceOptions(availability)
  const modalities = useMemo(() => value.capability
    ? getTrainableModalitiesForCapabilityV2(value.capability, { runtimeAvailability: availability })
    : [], [value.capability, availability])

  // Keep dependent selects valid when a parent changes.
  useEffect(() => {
    if (value.capability && modalities.length && !modalities.includes(value.modality)) {
      onChange({ ...value, modality: modalities[0] })
    }
  }, [value.capability]) // eslint-disable-line react-hooks/exhaustive-deps

  const packs = [...registry.packs].sort((a, b) => (a.manifest.catalog_order ?? 999) - (b.manifest.catalog_order ?? 999))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label style={{ fontSize: 13, fontWeight: 700 }}>Pack (registry)
        <select className="input" data-testid="v2pg-target-pack" value={value.packId} style={{ width: '100%' }}
          onChange={(e) => onChange({ ...value, packId: e.target.value, target: packReferencedTargetsV2(getPedagogyPack(e.target.value, registry))[0] })}>
          {packs.map((p) => <option key={p.manifest.pack_id} value={p.manifest.pack_id}>{packLemma(p, registry)} — {p.manifest.pack_id}</option>)}
        </select>
      </label>
      <label style={{ fontSize: 13, fontWeight: 700 }}>Target (do pack)
        <select className="input" data-testid="v2pg-target-target" value={value.target?.target_id ?? ''} style={{ width: '100%' }}
          onChange={(e) => onChange({ ...value, target: targets.find((t) => t.target_id === e.target.value) })}>
          {targets.map((t) => <option key={t.target_id} value={t.target_id}>{t.target_type}: {t.label}</option>)}
        </select>
      </label>
      <label style={{ fontSize: 13, fontWeight: 700 }}>Capability
        <select className="input" data-testid="v2pg-target-capability" value={value.capability ?? ''} style={{ width: '100%' }}
          onChange={(e) => onChange({ ...value, capability: e.target.value || null })}>
          {showCapabilityless && <option value="">Introdução / exposição (sem capability)</option>}
          {capabilities.map((cap) => <option key={cap} value={cap}>{CAPABILITY_LABELS[cap] || cap}</option>)}
        </select>
      </label>
      {value.capability && (
        <label style={{ fontSize: 13, fontWeight: 700 }}>Modality
          <select className="input" data-testid="v2pg-target-modality" value={value.modality ?? ''} style={{ width: '100%' }}
            onChange={(e) => onChange({ ...value, modality: e.target.value })}>
            {modalities.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      )}
    </div>
  )
}

// ============================================================================
// Mode: Testar target
// ============================================================================

function TargetMode({ registry }) {
  const { activeProfile, settings } = useApp()
  const { capabilities: runtimeCaps, availability } = useRuntime()
  const { capabilities: capOptions } = useAffordanceOptions(availability)
  const [sel, setSel] = useState(() => {
    const pack = registry.packs[0]
    return { packId: pack.manifest.pack_id, target: packReferencedTargetsV2(pack)[0], capability: capOptions[0] || 'recognition', modality: 'reading' }
  })
  const [isolation, setIsolation] = useState('isolated')
  const [result, setResult] = useState(null) // { plan|null, decision, focus, ... }
  const [assessed, setAssessed] = useState(null) // { assessment, response, recordedEvidence }
  const { db } = useApp()

  const generate = async () => {
    setAssessed(null)
    const r = await materializeActivityV2({
      registry, packId: sel.packId, target: sel.target, capability: sel.capability, modality: sel.modality,
      isolation, profileId: activeProfile,
      buildContext: (id, opts) => buildLessonEngineContextV2(id, opts),
      availability,
    })
    setResult({ ...r, isolation })
  }

  const onSubmit = async (type, payload) => {
    const plan = result.plan
    const response = buildActivityResponseV2({ plan, responseType: type, payload, supportRuntime: createSupportRuntime(plan), submittedAt: new Date().toISOString(), capabilities: runtimeCaps })
    const v = validateActivityResponseV2(response, plan)
    if (!v.valid) { setAssessed({ error: v.errors.join(',') }); return }
    const assessment = await evaluateActivityResponseV2({ activityPlan: plan, response, assessmentServices: createProductionAssessmentServicesV2() })
    const events = buildLearnerEvidenceBatchFromInteractionV2({ activityPlan: plan, response, assessment, profileId: activeProfile, sessionId: plan.session_id })
    // ISOLATED never persists. Current-state persists into the real store.
    let recordedEvidence = null
    if (result.isolation === 'current' && events.length) {
      await db.recordLearnerEvidenceBatchV2(events)
      recordedEvidence = events
    } else {
      recordedEvidence = null // computed but not persisted
    }
    setAssessed({ assessment, response, recordedEvidence, wouldRecord: events })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card" style={{ padding: 16 }}>
        <TargetSelectors registry={registry} availability={availability} value={sel} onChange={setSel} showCapabilityless />
        <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginTop: 10 }}>Estado do learner
          <select className="input" data-testid="v2pg-target-isolation" value={isolation} onChange={(e) => setIsolation(e.target.value)} style={{ width: '100%' }}>
            {ISOLATION_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        <button className="btn btn-primary" data-testid="v2pg-target-generate" style={{ marginTop: 12 }} onClick={generate}>Gerar atividade</button>
      </div>

      {result && !result.plan && (
        <div className="card" data-testid="v2pg-target-empty" style={{ padding: 16 }}>
          <div style={{ fontWeight: 800 }}>Nenhuma atividade materializável para esta combinação.</div>
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Motivo estrutural: {result.decision?.reason || result.decision?.status || 'no_eligible_activity'}</p>
          <details style={{ fontSize: 12, marginTop: 6 }}>
            <summary style={{ cursor: 'pointer' }}>Diagnóstico</summary>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 11 }}>{JSON.stringify(result.decision?.trace ?? result.decision, null, 1)}</pre>
          </details>
        </div>
      )}

      {result?.plan && (
        <>
          {result.isolation === 'isolated' && (
            <div className="muted" data-testid="v2pg-isolated-note" style={{ fontSize: 12 }}>Modo isolado — nenhuma evidência será gravada.</div>
          )}
          {!assessed && (
            <V2ActivityRenderer key={result.plan.activity_id} plan={result.plan} capabilities={runtimeCaps} settings={settings}
              busy={false} onSubmit={onSubmit} onSupport={() => {}} />
          )}
          {assessed?.error && <div className="card" style={{ padding: 12 }}>Resposta inválida: {assessed.error}</div>}
          {assessed?.assessment && (
            <>
              <FeedbackView plan={result.plan} response={assessed.response} assessment={assessed.assessment} recordedEvidence={assessed.recordedEvidence} />
              <button className="btn btn-secondary" data-testid="v2pg-target-retry" onClick={() => setAssessed(null)}>Responder de novo</button>
            </>
          )}
          <DiagnosticsPanel focus={result.focus} plan={result.plan} response={assessed?.response} assessment={assessed?.assessment}
            recordedEvidence={assessed?.recordedEvidence} plannerDecision={result.decision?.trace} />
        </>
      )}
    </div>
  )
}

// ============================================================================
// Mode: Sandbox de avaliação
// ============================================================================

function SandboxMode({ registry }) {
  const { activeProfile, settings } = useApp()
  const { capabilities: runtimeCaps, availability } = useRuntime()
  const { capabilities: capOptions } = useAffordanceOptions(availability)
  const [sel, setSel] = useState(() => {
    const pack = registry.packs[0]
    // Default to FREE production / writing: it is always a single text-answerable
    // recipe, ideal for comparing arbitrary responses on the same activity (§16).
    const capability = capOptions.includes('free_production') ? 'free_production'
      : (capOptions.includes('controlled_production') ? 'controlled_production' : (capOptions[0] || 'recognition'))
    return { packId: pack.manifest.pack_id, target: packReferencedTargetsV2(pack)[0], capability, modality: 'writing' }
  })
  const [plan, setPlan] = useState(null)
  const [decision, setDecision] = useState(null)
  const [focus, setFocus] = useState(null)
  const [answer, setAnswer] = useState('')
  const [assessed, setAssessed] = useState(null)

  const materialize = async () => {
    setPlan(null); setAssessed(null)
    // Sandbox is ALWAYS isolated — never persists.
    const r = await materializeActivityV2({
      registry, packId: sel.packId, target: sel.target, capability: sel.capability, modality: sel.modality,
      isolation: 'isolated', profileId: activeProfile,
      buildContext: (id, opts) => buildLessonEngineContextV2(id, opts),
      availability,
    })
    setDecision(r.decision); setFocus(r.focus)
    setPlan(r.plan)
  }

  const responseTypeFor = (p) => (p.response_contract?.response_type === 'spoken_text' || p.modality === 'speaking' ? 'text' : 'text')

  const evaluate = async () => {
    if (!plan || !answer.trim()) return
    const response = buildActivityResponseV2({ plan, responseType: responseTypeFor(plan), payload: { text: answer }, supportRuntime: createSupportRuntime(plan), submittedAt: new Date().toISOString(), capabilities: runtimeCaps })
    const assessment = await evaluateActivityResponseV2({ activityPlan: plan, response, assessmentServices: createProductionAssessmentServicesV2() })
    // Compute the batch that WOULD be recorded, but never persist it.
    const wouldRecord = buildLearnerEvidenceBatchFromInteractionV2({ activityPlan: plan, response, assessment, profileId: 'sandbox', sessionId: plan.session_id })
    setAssessed({ assessment, response, wouldRecord })
  }

  const textAnswerable = plan && ['fixed_element_completion', 'guided_production', 'free_production'].includes(plan.recipe)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="muted" data-testid="v2pg-sandbox-warning" style={{ fontSize: 13, fontWeight: 700, color: 'var(--indigo-600)' }}>
        Modo sandbox — nenhuma evidência será gravada.
      </div>
      <div className="card" style={{ padding: 16 }}>
        <TargetSelectors registry={registry} availability={availability} value={sel} onChange={setSel} showCapabilityless={false} />
        <button className="btn btn-primary" data-testid="v2pg-sandbox-materialize" style={{ marginTop: 12 }} onClick={materialize}>Materializar atividade</button>
      </div>

      {decision && !plan && (
        <div className="card" data-testid="v2pg-sandbox-empty" style={{ padding: 16 }}>
          <div style={{ fontWeight: 800 }}>Nenhuma atividade materializável para esta combinação.</div>
          <p className="muted" style={{ fontSize: 12 }}>Motivo: {decision.reason || decision.status}</p>
        </div>
      )}

      {plan && (
        <>
          <div className="card" style={{ padding: 14 }} data-testid="v2pg-sandbox-activity">
            <div className="muted" style={{ fontSize: 12 }}>Atividade: {plan.recipe} · {plan.capability}/{plan.modality}</div>
            {/* §22 — the strategy of the LOADED plan is visible but never editable
                in the normal flow (it comes from authored metadata). */}
            <div className="muted" data-testid="v2pg-sandbox-strategy" style={{ fontSize: 12 }}>
              Semantic strategy: {plan.semantic_assessment?.strategy ?? 'free'}
              {plan.semantic_assessment?.essential_words ? ` · essential=[${plan.semantic_assessment.essential_words.join(', ')}]` : ''}
            </div>
            <p style={{ fontSize: 14, marginTop: 6 }}>{plan.context}</p>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{plan.text_pt}</div>
          </div>

          {!textAnswerable && (
            <div className="muted" style={{ fontSize: 12 }}>Esta atividade ({plan.recipe}) não é respondível por texto livre no sandbox. Escolha uma capability de produção para testar respostas escritas.</div>
          )}
          {textAnswerable && (
            <div className="card" style={{ padding: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 700 }}>Resposta</label>
              <textarea className="input" data-testid="v2pg-sandbox-answer" rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)}
                placeholder="Escreva uma resposta em inglês" style={{ width: '100%', marginTop: 6 }} />
              <button className="btn btn-primary" data-testid="v2pg-sandbox-evaluate" style={{ marginTop: 10 }} disabled={!answer.trim()} onClick={evaluate}>
                {assessed ? 'Avaliar novamente' : 'Avaliar'}
              </button>
            </div>
          )}

          {assessed && (
            <>
              <FeedbackView plan={plan} response={assessed.response} assessment={assessed.assessment} recordedEvidence={null} />
              <DiagnosticsPanel focus={focus} plan={plan} response={assessed.response} assessment={assessed.assessment} recordedEvidence={null} />
            </>
          )}
          {!assessed && (
            <DiagnosticsPanel focus={focus} plan={plan} plannerDecision={decision?.trace} />
          )}
        </>
      )}
    </div>
  )
}

// ============================================================================
// Shell
// ============================================================================

export default function PedagogyV2Playground() {
  const { settings, setTab, back } = useApp()
  const registry = useMemo(() => loadPedagogyV2Registry(), [])
  const [mode, setMode] = useState('session')

  if (!playgroundEnabled(settings)) {
    return (
      <div className="phone">
        <div className="screen-body" style={{ justifyContent: 'center', textAlign: 'center' }}>
          <p className="muted" data-testid="v2pg-unavailable">
            O Pedagogy V2 Playground é uma ferramenta de diagnóstico e está disponível apenas em desenvolvimento ou com o diagnóstico V2 ativado.
          </p>
          <button className="btn btn-secondary" onClick={() => setTab(SCREENS.HOME)}>Voltar</button>
        </div>
      </div>
    )
  }

  const ModeComponent = { session: SessionMode, target: TargetMode, sandbox: SandboxMode }[mode]

  return (
    <div className="phone" data-testid="v2pg-screen">
      <div style={{ padding: '8px 20px', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
        <button className="back" onClick={() => back(SCREENS.PEDAGOGY_V2_PILOT)} aria-label="Voltar"><I.chevL s={18} /></button>
        <div>
          <div className="label-eyebrow">ferramenta de diagnóstico</div>
          <h1 className="h1" style={{ margin: 0, fontSize: 20 }}>Pedagogy V2 Playground</h1>
        </div>
      </div>
      <div className="screen-body" style={{ paddingBottom: 40, gap: 14, overflowX: 'hidden' }}>
        <PipelineBadge />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} data-testid="v2pg-modes">
          {MODES.map((m) => (
            <button key={m.id} className={`btn btn-sm ${mode === m.id ? 'btn-primary' : 'btn-secondary'}`}
              data-testid={`v2pg-mode-${m.id}`} aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
              {m.title}
            </button>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>{MODES.find((m) => m.id === mode)?.description}</p>

        {ModeComponent && <ModeComponent registry={registry} />}
      </div>
    </div>
  )
}
