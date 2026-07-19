// PedagogyV2Inspector.jsx — internal, READ-ONLY "Pedagogy V2 Inspector"
// (Slice V2.7). Visualizes a learner's multidimensional V2 state and explains
// planner decisions. Gated to development builds or the existing
// `pedagogy_v2_diagnostics_enabled` diagnostics flag. It never edits data,
// never "marks as mastered", and never shows a global mastery. The export is
// privacy-safe: no free-text answers, no transcripts, no profile_id.

import { useEffect, useMemo, useState } from 'react'
import { useApp, SCREENS } from '../store.jsx'
import { I } from '../components/icons.jsx'
import { loadPedagogyV2Registry } from '../lib/pedagogy-v2/registry.js'
import {
  buildLearnerInspectorSnapshotV2, explainStudyFocusV2, buildObservabilityExportV2,
} from '../lib/pedagogy-v2/learner-inspector.js'
import { OBSERVABILITY_POLICY_V2 } from '../lib/pedagogy-v2/observability-contracts.js'
import { STUDY_PLANNER_POLICY_VERSION } from '../lib/pedagogy-v2/study-planner-contracts.js'

export function inspectorEnabled(settings) {
  return !!(import.meta.env?.DEV || settings?.pedagogy_v2_diagnostics_enabled)
}

export default function PedagogyV2Inspector() {
  const { settings, activeProfile, db, back, setTab } = useApp()
  const enabled = inspectorEnabled(settings)
  const registry = useMemo(() => loadPedagogyV2Registry(), [])

  const [states, setStates] = useState(null)
  const [evidence, setEvidence] = useState(null)
  const [lexemeId, setLexemeId] = useState(registry.packs[0]?.manifest.primary_lexeme_id ?? null)
  const [targetId, setTargetId] = useState('')
  const [exportJson, setExportJson] = useState(null)

  useEffect(() => {
    if (!enabled) return undefined
    let alive = true
    Promise.all([
      db.getLearnerTargetStatesV2(activeProfile),
      db.getLearnerEvidenceV2(activeProfile),
    ]).then(([s, e]) => { if (alive) { setStates(s); setEvidence(e) } })
    return () => { alive = false }
  }, [enabled, db, activeProfile])

  const snapshot = useMemo(() => {
    if (!states || !evidence) return null
    const now = new Date().toISOString()
    return buildLearnerInspectorSnapshotV2({
      registry, learnerStates: states, recentEvidence: evidence, now, mode: 'adaptive',
      runtimeCapabilities: { text_input: true, audio_output: true, speech_input: true, semantic_assessment: true, pronunciation_assessment: false },
    })
  }, [registry, states, evidence])

  if (!enabled) {
    return (
      <div className="phone">
        <div className="screen-body" style={{ justifyContent: 'center', textAlign: 'center' }}>
          <p className="muted" data-testid="v2-inspector-unavailable">
            O Inspector V2 é uma ferramenta de diagnóstico e está disponível apenas em modo de desenvolvimento.
          </p>
          <button className="btn btn-secondary" onClick={() => setTab(SCREENS.HOME)}>Voltar</button>
        </div>
      </div>
    )
  }

  const doExport = () => {
    setExportJson(JSON.stringify(buildObservabilityExportV2({
      metrics: null,
      trajectory: snapshot ? { targets: snapshot.targets.length, review_queue: snapshot.review_queue.length } : null,
      findings: [],
      telemetry: null,
      policyVersions: { study_planner_policy: STUDY_PLANNER_POLICY_VERSION, observability_policy: OBSERVABILITY_POLICY_V2.policy_version },
      registryVersion: registry.registry_version,
      includeProfileId: false, // privacy: profile_id omitted by default
    }), null, 2))
  }

  const targetView = targetId ? (snapshot?.targets || []).find((t) => t.target_id === targetId) : null
  const lexemeView = (snapshot?.lexemes || []).find((l) => l.lexeme_id === lexemeId) || null
  const focus = snapshot?.planner?.selected_focus
  const explanation = focus ? explainStudyFocusV2(focus, { learnerStates: states, registry }) : null

  return (
    <div className="phone" data-testid="v2-inspector-screen">
      <div style={{ padding: '8px 20px', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
        <button className="back" onClick={() => back(SCREENS.TRAINING)} aria-label="Voltar"><I.chevL s={18} /></button>
        <div>
          <div className="label-eyebrow">diagnóstico</div>
          <h1 className="h1" style={{ margin: 0, fontSize: 20 }}>Pedagogy V2 Inspector</h1>
        </div>
      </div>
      <div className="screen-body" style={{ paddingBottom: 40, gap: 12 }}>
        {!snapshot && <div className="muted" data-testid="v2-inspector-loading">Carregando estado do aluno…</div>}

        {snapshot && (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Lexema:</label>
              <select data-testid="v2-inspector-lexeme-select" value={lexemeId || ''} onChange={(e) => setLexemeId(e.target.value)}>
                {registry.packs.map((p) => (
                  <option key={p.manifest.primary_lexeme_id} value={p.manifest.primary_lexeme_id}>
                    {(p.lexemes || []).find((l) => l.lexeme_id === p.manifest.primary_lexeme_id)?.lemma}
                  </option>
                ))}
              </select>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Target:</label>
              <select data-testid="v2-inspector-target-select" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                <option value="">(todos)</option>
                {snapshot.targets.map((t) => <option key={t.target_id} value={t.target_id}>{t.target_id}</option>)}
              </select>
            </div>

            {lexemeView && (
              <section className="card" style={{ padding: 14 }} data-testid="v2-inspector-lexeme">
                <div style={{ fontWeight: 900 }}>{lexemeView.lemma}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {lexemeView.senses_encountered.length} usos · {lexemeView.constructions_encountered.length} construções · {lexemeView.functions_encountered.length} funções encontradas
                  {lexemeView.last_contact ? ` · último contato: ${new Date(lexemeView.last_contact).toLocaleString('pt-BR')}` : ''}
                </div>
              </section>
            )}

            <section className="card" style={{ padding: 14 }} data-testid="v2-inspector-targets">
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Targets {targetView ? '(selecionado)' : `(${snapshot.targets.length})`}</div>
              {(targetView ? [targetView] : snapshot.targets).map((t) => (
                <div key={t.target_id} style={{ borderTop: '1px solid var(--border)', padding: '6px 0', fontSize: 12 }}>
                  <div style={{ fontWeight: 700 }}>{t.target_id} <span className="muted">[{t.kind}] exposição {t.exposure.count}</span></div>
                  {Object.entries(t.capabilities).map(([capKey, cap]) => (
                    <div key={capKey} className="muted">
                      {capKey}: overall {cap.overall?.evidence_level}/{cap.overall?.mastery_estimate ?? '—'} · apoio {cap.supported?.evidence_level || '—'} · indep. {cap.independent?.evidence_level || '—'} · tend. {cap.overall?.trend}
                    </div>
                  ))}
                </div>
              ))}
            </section>

            <section className="card" style={{ padding: 14 }} data-testid="v2-inspector-review-queue">
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Fila de revisão ({snapshot.review_queue.length})</div>
              {snapshot.review_queue.slice(0, 12).map((r, i) => (
                <div key={i} style={{ borderTop: '1px solid var(--border)', padding: '6px 0', fontSize: 12 }}>
                  <b>{r.lemma}</b> · {r.capability_label} · {r.human_reason}
                </div>
              ))}
              {!snapshot.review_queue.length && <div className="muted" style={{ fontSize: 12 }}>Nenhuma revisão pendente.</div>}
            </section>

            <section className="card" style={{ padding: 14 }} data-testid="v2-inspector-planner">
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Planner</div>
              {explanation
                ? (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{explanation.headline}</div>
                    <ul className="muted" style={{ fontSize: 12, margin: '4px 0', paddingLeft: 16 }}>
                      {explanation.reasons.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </>
                )
                : <div className="muted" style={{ fontSize: 12 }}>Sem foco elegível no estado atual.</div>}
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }} data-testid="v2-inspector-candidates">
                Candidatos: {snapshot.planner?.candidate_count ?? 0} · filtrados: {snapshot.planner?.filtered.length ?? 0}
              </div>
            </section>

            <section className="card" style={{ padding: 14 }} data-testid="v2-inspector-timeline">
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Linha do tempo recente</div>
              {snapshot.recent_evidence.slice(-12).map((e, i) => (
                <div key={i} style={{ fontSize: 12, borderTop: '1px solid var(--border)', padding: '4px 0' }} className="muted">
                  {new Date(e.occurred_at).toLocaleTimeString('pt-BR')} · {e.target_id} · {e.attribution}/{e.outcome}
                </div>
              ))}
              {!snapshot.recent_evidence.length && <div className="muted" style={{ fontSize: 12 }}>Sem evidências ainda.</div>}
            </section>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" data-testid="v2-inspector-export" onClick={doExport}>Exportar diagnóstico (JSON)</button>
            </div>
            {exportJson && (
              <pre data-testid="v2-inspector-export-output" style={{ fontSize: 11, overflow: 'auto', maxHeight: 220, background: 'var(--bg-alt)', padding: 10, borderRadius: 8 }}>{exportJson}</pre>
            )}
          </>
        )}
      </div>
    </div>
  )
}
