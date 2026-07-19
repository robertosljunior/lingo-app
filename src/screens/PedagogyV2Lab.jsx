// PedagogyV2Lab.jsx — "Laboratório V2": the generic multi-pack V2 lab.
// Slice V2.6 adds the Study Planner modes on top of the V2.5 selection:
//
//   selection — study modes (Sessão adaptativa / Revisão / Explorar), the
//     focused pack entries (Estudar still / Estudar but, ordered by the
//     EDITORIAL manifest catalog_order) and a factual review-queue diagnostic;
//   focused session — the V2.5 pack-scoped session (pilot controller);
//   study session — adaptive/review/explore driven by the Study Planner
//     (study-session-controller): focus re-evaluated after every assessed
//     interaction, pack transitions surfaced with human copy derived from the
//     planner reason codes.
//
// Never shown: a global level, a single mastery percentage, "word learned",
// internal target ids or mathematical scores. Guarded by the single
// experimental `pedagogy_v2_pilot_enabled` flag.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp, SCREENS } from '../store.jsx'
import { I } from '../components/icons.jsx'
import { loadPedagogyV2Registry, getPedagogyPack, getLexemeAcrossRegistry, resolvePedagogyEntity } from '../lib/pedagogy-v2/registry.js'
import { buildLessonEngineContextV2 } from '../lib/pedagogy-v2/lesson-engine-context.js'
import { createPilotSessionController, summarizePilotSession } from '../lib/pedagogy-v2/pilot-session-controller.js'
import { detectRuntimeCapabilitiesV2 } from '../lib/pedagogy-v2/runtime-capabilities.js'
import { buildReviewQueueV2 } from '../lib/pedagogy-v2/review-queue.js'
import { factualPackProgressV2 } from '../lib/pedagogy-v2/study-planner.js'
import { buildStudyPlannerContextV2 } from '../lib/pedagogy-v2/study-planner-context.js'
import { createStudySessionControllerV2, summarizeStudySessionV2 } from '../lib/pedagogy-v2/study-session-controller.js'
import { speechSupported } from '../lib/audio/tts.js'
import { sttSupported } from '../lib/audio/stt.js'
import V2ActivityRenderer from '../components/pedagogy-v2/V2ActivityRenderer.jsx'
import V2Feedback from '../components/pedagogy-v2/V2Feedback.jsx'
import V2SelectionDetails from '../components/pedagogy-v2/V2SelectionDetails.jsx'

const STUDY_MODE_META = {
  adaptive: { title: 'Sessão adaptativa', description: 'O aplicativo escolhe o próximo foco com base no que você já praticou.' },
  review: { title: 'Revisão', description: 'Revise usos que precisam ser recuperados novamente.' },
  explore: { title: 'Explorar', description: 'Conheça novas formas de usar palavras fundamentais.' },
}

function packLemma(pack, registry) {
  return getLexemeAcrossRegistry(pack.manifest.primary_lexeme_id, registry)?.lexeme?.lemma
    ?? pack.manifest.primary_lexeme_id
}

/** Target ids OWNED by the pack that carry learner-visible progress. */
function packProgressTargetIds(pack) {
  return [
    ...(pack.senses || []).map((s) => s.sense_id),
    ...(pack.constructions || []).map((c) => c.construction_id),
  ]
}

// Human copy for a review item: word + use description + capability/modality
// + reason — never internal ids, never a mathematical score.
const CAPABILITY_LABELS = {
  reading_recognition: 'Reconhecimento ao ler',
  listening_recognition: 'Reconhecimento ao ouvir',
  reading_comprehension: 'Compreensão ao ler',
  listening_comprehension: 'Compreensão ao ouvir',
  writing_controlled_production: 'Produção escrita guiada',
  speaking_controlled_production: 'Produção falada guiada',
  writing_free_production: 'Produção escrita livre',
  speaking_free_production: 'Produção falada livre',
  speaking_pronunciation: 'Pronúncia',
}

function reviewReasonPt(item) {
  const codes = item.reason_codes || []
  if (codes.includes('RECENT_FAILURE')) return 'Você errou este uso recentemente.'
  if (codes.includes('DELAYED_RETRIEVAL_FAILED')) return 'Este uso ainda não se manteve entre um encontro e outro.'
  if (codes.includes('RETENTION_OVERDUE')) return 'Faz tempo que você não recupera este uso.'
  if (codes.includes('DECLINING_TREND')) return 'Os últimos resultados neste uso caíram.'
  if (codes.includes('MODALITY_GAP')) {
    return item.capability_key.startsWith('listening')
      ? 'Você praticou este uso antes, mas ainda há pouca evidência auditiva.'
      : 'Você praticou este uso antes, mas ainda há pouca evidência nesta forma.'
  }
  if (codes.includes('SUPPORTED_WITHOUT_INDEPENDENT')) return 'Você praticou com apoio; falta recuperar este uso sem ajuda.'
  if (codes.includes('LOW_STABILITY')) return 'Este uso ainda não se manteve estável entre sessões.'
  return 'Este uso merece uma nova prática.'
}

// Pack-transition copy derived from the planner reason codes (§18) — the
// learner never sees internal target names or codes.
function transitionCopyPt(transition, registry) {
  const fromLemma = transition.from_pack ? packLemma(getPedagogyPack(transition.from_pack, registry), registry) : null
  const toLemma = packLemma(getPedagogyPack(transition.to_pack, registry), registry)
  switch (transition.code) {
    case 'PACK_SWITCH_FOR_CROSS_PACK_PROGRESSION':
      return `Agora vamos reutilizar uma ideia que você já conhece com ${fromLemma}.`
    case 'PACK_SWITCH_FOR_RETENTION':
      return `Vamos voltar a ${toLemma} para recuperar um uso que você já praticou.`
    case 'PACK_SWITCH_FOR_REMEDIATION':
      return `Vamos voltar a ${toLemma} em outra construção.`
    default:
      return `Agora vamos praticar ${toLemma}.`
  }
}

export default function PedagogyV2Lab() {
  const { settings, params, setTab, back, navigate } = useApp()
  const enabled = !!settings?.pedagogy_v2_pilot_enabled
  const registry = useMemo(() => loadPedagogyV2Registry(), [])
  const packId = params?.packId ?? null
  const studyMode = params?.mode ?? null
  const pack = packId ? getPedagogyPack(packId, registry) : null

  if (!enabled) {
    return (
      <div className="phone">
        <div className="screen-body" style={{ justifyContent: 'center', textAlign: 'center' }}>
          <p className="muted" data-testid="v2-pilot-disabled">
            O Laboratório V2 é experimental e está desativado. Ative-o em Configurações.
          </p>
          <button className="btn btn-secondary" onClick={() => setTab(SCREENS.HOME)}>Voltar</button>
        </div>
      </div>
    )
  }

  // Direct access to an unknown pack or mode: error + way back, no crash.
  if ((packId && !pack) || (studyMode && !STUDY_MODE_META[studyMode])) {
    return (
      <div className="phone" data-testid="v2-lab-screen">
        <div className="screen-body" style={{ justifyContent: 'center', textAlign: 'center' }}>
          <p className="muted" data-testid="v2-pack-invalid">
            {packId ? 'Este pack não existe ou não está disponível neste laboratório.' : 'Este modo de estudo não existe.'}
          </p>
          <button className="btn btn-primary" onClick={() => navigate(SCREENS.PEDAGOGY_V2_PILOT, {})}>
            Voltar ao laboratório
          </button>
        </div>
      </div>
    )
  }

  if (studyMode) {
    return <StudyModeSession key={studyMode} registry={registry} mode={studyMode}
      onExitToSelection={() => navigate(SCREENS.PEDAGOGY_V2_PILOT, {})} />
  }

  if (!pack) {
    return <LabPackSelection registry={registry}
      diagnosticsEnabled={!!(import.meta.env?.DEV || settings?.pedagogy_v2_diagnostics_enabled)}
      onOpenPack={(id) => navigate(SCREENS.PEDAGOGY_V2_PILOT, { packId: id })}
      onOpenMode={(mode) => navigate(SCREENS.PEDAGOGY_V2_PILOT, { mode })}
      onOpenInspector={() => navigate(SCREENS.PEDAGOGY_V2_INSPECTOR, {})}
      onBack={() => back(SCREENS.TRAINING)} />
  }

  return <LabSession key={packId} registry={registry} pack={pack}
    onExitToSelection={() => navigate(SCREENS.PEDAGOGY_V2_PILOT, {})} />
}

// ---- selection --------------------------------------------------------------

function LabPackSelection({ registry, onOpenPack, onOpenMode, onBack, onOpenInspector, diagnosticsEnabled }) {
  const { db, activeProfile } = useApp()
  const [states, setStates] = useState(null)
  const [showQueue, setShowQueue] = useState(false)

  useEffect(() => {
    let alive = true
    db.getLearnerTargetStatesV2(activeProfile).then((rows) => { if (alive) setStates(rows) })
    return () => { alive = false }
  }, [db, activeProfile])

  const byTargetId = useMemo(() => {
    const map = new Map()
    for (const s of states || []) map.set(s.target?.target_id, s)
    return map
  }, [states])

  // Runtime review queue — a diagnostic PRIORITIZATION, not a schedule.
  const queue = useMemo(() => {
    if (!states) return []
    return buildReviewQueueV2({ registry, learnerStates: states, recentEvidence: [], now: new Date().toISOString() })
  }, [registry, states])

  // Editorial catalog order (manifest catalog_order) — presentation only.
  const orderedPacks = useMemo(() => [...registry.packs].sort((a, b) =>
    ((a.manifest.catalog_order ?? 999) - (b.manifest.catalog_order ?? 999))
    || (a.manifest.pack_id < b.manifest.pack_id ? -1 : 1)), [registry])

  return (
    <div className="phone" data-testid="v2-lab-screen">
      <div style={{ padding: '8px 20px', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
        <button className="back" onClick={onBack} aria-label="Voltar"><I.chevL s={18} /></button>
        <div>
          <div className="label-eyebrow">laboratório experimental</div>
          <h1 className="h1" style={{ margin: 0, fontSize: 20 }}>Laboratório V2</h1>
        </div>
      </div>
      <div className="screen-body" style={{ paddingBottom: 40, gap: 14 }}>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Aprofunde palavras fundamentais em novos sentidos e construções.
        </p>

        {Object.entries(STUDY_MODE_META).map(([mode, meta]) => (
          <button key={mode} className="card tap" data-testid={`v2-mode-${mode}`}
            onClick={() => onOpenMode(mode)}
            style={{ textAlign: 'left', padding: 16, font: 'inherit', background: 'var(--surface)' }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{meta.title}</div>
            <p className="muted" style={{ fontSize: 13, margin: '4px 0 0' }}>{meta.description}</p>
            {mode === 'review' && (
              <div className="muted" data-testid="v2-review-count" style={{ fontSize: 12, marginTop: 6 }}>
                Revisões disponíveis: {states === null ? '…' : queue.length}
              </div>
            )}
          </button>
        ))}

        {states !== null && queue.length > 0 && (
          <div className="card" style={{ padding: 12 }}>
            <button className="btn btn-sm btn-ghost" data-testid="v2-review-queue-toggle"
              onClick={() => setShowQueue(!showQueue)} style={{ width: '100%' }}>
              {showQueue ? 'Ocultar revisões' : 'Ver o que precisa de revisão'}
            </button>
            {showQueue && (
              <ul data-testid="v2-review-queue" style={{ margin: '10px 0 0', paddingLeft: 0, listStyle: 'none' }}>
                {queue.slice(0, 6).map((item) => {
                  const hit = resolvePedagogyEntity(item.target.target_id, registry)
                  const ownerPack = hit ? getPedagogyPack(hit.pack_id, registry) : null
                  const lemma = ownerPack ? packLemma(ownerPack, registry) : ''
                  const useLabel = hit?.entity?.label ?? ''
                  return (
                    <li key={`${item.target.target_id}|${item.capability_key}`}
                      style={{ borderTop: '1px solid var(--border)', padding: '8px 0' }}>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{lemma}</div>
                      {useLabel && <div className="muted" style={{ fontSize: 12 }}>{useLabel}</div>}
                      <div className="muted" style={{ fontSize: 12 }}>{CAPABILITY_LABELS[item.capability_key] || item.capability_key}</div>
                      <div style={{ fontSize: 12 }}>{reviewReasonPt(item)}</div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        <div className="label-eyebrow" style={{ marginTop: 4 }}>estudar uma palavra</div>
        {orderedPacks.map((pack) => {
          const lemma = packLemma(pack, registry)
          const targets = packProgressTargetIds(pack)
          const seen = targets.filter((id) => (byTargetId.get(id)?.exposure?.count || 0) > 0)
          const facts = states === null ? null : factualPackProgressV2(pack, states, queue)
          let lastContact = null
          for (const id of seen) {
            const at = byTargetId.get(id)?.exposure?.last_seen_at
            if (at && (!lastContact || at > lastContact)) lastContact = at
          }
          return (
            <button key={pack.manifest.pack_id} className="card tap" data-testid={`v2-pack-${lemma}`}
              onClick={() => onOpenPack(pack.manifest.pack_id)}
              style={{ textAlign: 'left', padding: 16, font: 'inherit', background: 'var(--surface)' }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>{lemma}</div>
              <p className="muted" style={{ fontSize: 13, margin: '6px 0 8px' }}>
                {pack.manifest.short_description_pt || pack.manifest.title?.pt}
              </p>
              <div className="muted" style={{ fontSize: 12 }}>
                {(pack.senses || []).length} usos · {(pack.constructions || []).length} construções
              </div>
              <div className="muted" data-testid={`v2-pack-${lemma}-progress`} style={{ fontSize: 12, marginTop: 4 }}>
                {states === null
                  ? 'Carregando progresso…'
                  : facts.constructions_seen || facts.senses_seen
                    ? `${facts.constructions_seen} construções encontradas · ${facts.senses_seen} formas de uso${facts.reviews_available ? ` · ${facts.reviews_available} ${facts.reviews_available === 1 ? 'revisão disponível' : 'revisões disponíveis'}` : ''}`
                    : 'Ainda não praticado'}
                {lastContact ? ` · último contato: ${new Date(lastContact).toLocaleDateString('pt-BR')}` : ''}
              </div>
            </button>
          )
        })}

        {diagnosticsEnabled && (
          <button className="btn btn-ghost btn-sm" data-testid="v2-open-inspector"
            onClick={onOpenInspector} style={{ marginTop: 8 }}>
            Inspector (diagnóstico)
          </button>
        )}
      </div>
    </div>
  )
}

// ---- study-mode session (adaptive / review / explore) -----------------------

function StudyModeSession({ registry, mode, onExitToSelection }) {
  const { settings, activeProfile, db } = useApp()
  const meta = STUDY_MODE_META[mode]

  const capabilities = useMemo(() => detectRuntimeCapabilitiesV2({
    ttsSupported: speechSupported,
    sttSupported,
  }), [])

  const controllerRef = useRef(null)
  const [state, setState] = useState(null)

  useEffect(() => {
    const controller = createStudySessionControllerV2({
      profileId: activeProfile,
      registry,
      mode,
      buildPlannerContext: (profileId, opts) => buildStudyPlannerContextV2(profileId, opts),
      recordBatch: (events) => db.recordLearnerEvidenceBatchV2(events),
      capabilities,
      assessmentServices: {
        analyzeSemantics: async ({ text, assessmentMode }) =>
          (await import('../lib/language-analysis/index.js')).analyzeProduction({ text, assessmentMode }),
      },
    })
    controllerRef.current = controller
    setState(controller.getState())
    const unsub = controller.subscribe(setState)
    controller.start()
    return unsub
  }, [activeProfile, db, capabilities, registry, mode])

  const c = controllerRef.current
  const s = state
  const showDiagnostics = !!import.meta.env?.DEV
  const activeLemma = s?.plan?.lexeme_lemma

  return (
    <div className="phone" data-testid="v2-study-screen" data-mode={mode}>
      <div style={{ padding: '8px 20px', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
        <button className="back" onClick={onExitToSelection} aria-label="Voltar"><I.chevL s={18} /></button>
        <div>
          <div className="label-eyebrow">laboratório experimental</div>
          <h1 className="h1" data-testid="v2-study-title" style={{ margin: 0, fontSize: 20 }}>
            {meta.title}{activeLemma ? ` — ${activeLemma}` : ''}
          </h1>
        </div>
      </div>
      <div className="screen-body" style={{ paddingBottom: 40, gap: 14 }}>
        {(!s || s.status === 'idle' || s.status === 'planning') && (
          <div className="muted" data-testid="v2-loading">Preparando sua sessão…</div>
        )}

        {s?.status === 'error' && (
          <div className="card" data-testid="v2-error" style={{ padding: 16 }}>
            <div style={{ fontWeight: 800 }}>Algo deu errado</div>
            <p className="muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>
              {s.error?.recoverable === false
                ? 'Não foi possível abrir esta sessão.'
                : 'Sua resposta não foi perdida. Você pode tentar novamente.'}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              {s.error?.recoverable !== false && (s.pendingResponse
                ? <button className="btn btn-primary" data-testid="v2-retry" onClick={() => c.retry()}>Tentar novamente</button>
                : <button className="btn btn-primary" data-testid="v2-retry" onClick={() => c.start()}>Recomeçar</button>)}
              <button className="btn btn-ghost" onClick={onExitToSelection}>Sair</button>
            </div>
          </div>
        )}

        {(s?.status === 'presenting' || s?.status === 'submitting') && s.plan && (
          <>
            {s.transition && (
              <div className="card" data-testid="v2-pack-transition" style={{ padding: 12, borderLeft: '4px solid var(--indigo-600)' }}>
                <p style={{ fontSize: 13, margin: 0 }}>{transitionCopyPt(s.transition, registry)}</p>
              </div>
            )}
            <V2ActivityRenderer plan={s.plan} capabilities={capabilities} settings={settings}
              busy={s.status === 'submitting'}
              onSubmit={(type, payload) => c.submit(type, payload)}
              onSupport={(f) => c.recordSupport(f)} />
            <V2SelectionDetails plan={s.plan} visible={showDiagnostics} />
          </>
        )}

        {(s?.status === 'feedback' || s?.status === 'advancing') && s.plan && s.assessment && (
          <>
            <V2Feedback plan={s.plan} assessment={s.assessment} busy={s.status === 'advancing'}
              onContinue={() => c.advance()} onTryAgain={() => c.tryAgain()} />
            <V2SelectionDetails plan={s.plan} assessment={s.assessment} events={s.recordedEvents} visible={showDiagnostics} />
          </>
        )}

        {s?.status === 'complete' && (
          <StudySessionSummary mode={mode} interactions={s.interactions} registry={registry} onExit={onExitToSelection} />
        )}
      </div>
    </div>
  )
}

function StudySessionSummary({ mode, interactions, registry, onExit }) {
  const sum = summarizeStudySessionV2(interactions)
  if (!interactions.length) {
    return (
      <div className="card" data-testid="v2-review-empty" style={{ padding: 18 }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>
          {mode === 'review' ? 'Nada para revisar agora' : 'Nada disponível agora'}
        </div>
        <p className="muted" style={{ fontSize: 14, margin: '8px 0' }}>
          {mode === 'review'
            ? 'Você ainda não tem usos precisando de recuperação. Continue praticando e volte depois.'
            : 'Pratique um pouco mais para desbloquear novos focos de estudo.'}
        </p>
        <button className="btn btn-primary" onClick={onExit}>Voltar ao laboratório</button>
      </div>
    )
  }
  const lemmas = sum.lemmas_practiced.join(' e ')
  return (
    <div className="card" data-testid="v2-session-complete" style={{ padding: 18 }}>
      <div style={{ fontWeight: 900, fontSize: 18 }}>Sessão concluída</div>
      <ul className="muted" style={{ fontSize: 14, lineHeight: 1.7, margin: '10px 0', paddingLeft: 18 }}>
        <li>{sum.sentences_seen} frases encontradas</li>
        <li>{sum.constructions_practiced} construções praticadas com {lemmas}</li>
        <li>{sum.senses_encountered} formas de uso encontradas</li>
        {sum.new_uses_introduced > 0 && <li>{sum.new_uses_introduced} novos usos introduzidos</li>}
        {sum.review_focuses > 0 && <li>{sum.review_focuses} focos de revisão praticados</li>}
        {sum.pack_transitions > 0 && <li>{sum.pack_transitions} transições entre palavras</li>}
        <li>{sum.assessed_interactions} interações avaliadas</li>
      </ul>
      <p style={{ fontSize: 14 }}>Você continuará encontrando {sum.lemmas_practiced.map((l, i) => (
        <span key={l}>{i > 0 ? ' e ' : ''}<b>{l}</b></span>
      ))} em novas formas e contextos.</p>
      <button className="btn btn-primary" onClick={onExit}>Voltar ao laboratório</button>
    </div>
  )
}

// ---- focused pack session (V2.5, unchanged behavior) ------------------------

function LabSession({ registry, pack, onExitToSelection }) {
  const { settings, activeProfile, db } = useApp()
  const lemma = packLemma(pack, registry)

  const capabilities = useMemo(() => detectRuntimeCapabilitiesV2({
    ttsSupported: speechSupported,
    sttSupported,
  }), [])

  const controllerRef = useRef(null)
  const [state, setState] = useState(null)

  useEffect(() => {
    const controller = createPilotSessionController({
      profileId: activeProfile,
      scope: {
        registry,
        pack_id: pack.manifest.pack_id,
        lexeme_id: pack.manifest.primary_lexeme_id,
      },
      buildContext: (profileId, opts) => buildLessonEngineContextV2(profileId, opts),
      recordBatch: (events) => db.recordLearnerEvidenceBatchV2(events),
      capabilities,
      assessmentServices: {
        // Existing semantic pipeline through its PUBLIC API only, loaded
        // lazily so the lab does not weigh on the main bundle.
        analyzeSemantics: async ({ text, assessmentMode }) =>
          (await import('../lib/language-analysis/index.js')).analyzeProduction({ text, assessmentMode }),
      },
    })
    controllerRef.current = controller
    setState(controller.getState())
    const unsub = controller.subscribe(setState)
    controller.start()
    return unsub
  }, [activeProfile, db, capabilities, registry, pack])

  const c = controllerRef.current
  const s = state
  const showDiagnostics = !!import.meta.env?.DEV

  return (
    <div className="phone" data-testid="v2-pilot-screen" data-pack-id={pack.manifest.pack_id}>
      <div style={{ padding: '8px 20px', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
        <button className="back" onClick={onExitToSelection} aria-label="Voltar"><I.chevL s={18} /></button>
        <div>
          <div className="label-eyebrow">laboratório experimental</div>
          <h1 className="h1" data-testid="v2-session-title" style={{ margin: 0, fontSize: 20 }}>Laboratório V2 — {lemma}</h1>
        </div>
      </div>
      <div className="screen-body" style={{ paddingBottom: 40, gap: 14 }}>
        {(!s || s.status === 'idle' || s.status === 'loading') && (
          <div className="muted" data-testid="v2-loading">Preparando sua sessão…</div>
        )}

        {s?.status === 'error' && (
          <div className="card" data-testid="v2-error" style={{ padding: 16 }}>
            <div style={{ fontWeight: 800 }}>Algo deu errado</div>
            <p className="muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>
              {s.error?.recoverable === false
                ? 'Não foi possível abrir esta sessão.'
                : 'Sua resposta não foi perdida. Você pode tentar novamente.'}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              {s.error?.recoverable !== false && (s.pendingResponse
                ? <button className="btn btn-primary" data-testid="v2-retry" onClick={() => c.retry()}>Tentar novamente</button>
                : <button className="btn btn-primary" data-testid="v2-retry" onClick={() => c.start()}>Recomeçar</button>)}
              <button className="btn btn-ghost" onClick={onExitToSelection}>Sair</button>
            </div>
          </div>
        )}

        {(s?.status === 'presenting' || s?.status === 'submitting') && s.plan && (
          <>
            <V2ActivityRenderer plan={s.plan} capabilities={capabilities} settings={settings}
              busy={s.status === 'submitting'}
              onSubmit={(type, payload) => c.submit(type, payload)}
              onSupport={(f) => c.recordSupport(f)} />
            <V2SelectionDetails plan={s.plan} visible={showDiagnostics} />
          </>
        )}

        {(s?.status === 'feedback' || s?.status === 'advancing') && s.plan && s.assessment && (
          <>
            <V2Feedback plan={s.plan} assessment={s.assessment} busy={s.status === 'advancing'}
              onContinue={() => c.advance()} onTryAgain={() => c.tryAgain()} />
            <V2SelectionDetails plan={s.plan} assessment={s.assessment} events={s.recordedEvents} visible={showDiagnostics} />
          </>
        )}

        {s?.status === 'complete' && (
          <SessionSummary interactions={s.interactions} fallbackLemma={lemma} onExit={onExitToSelection} />
        )}
      </div>
    </div>
  )
}

export function SessionSummary({ interactions, fallbackLemma, onExit }) {
  const sum = summarizePilotSession(interactions)
  const lemma = sum.lexeme_lemma || fallbackLemma
  return (
    <div className="card" data-testid="v2-session-complete" style={{ padding: 18 }}>
      <div style={{ fontWeight: 900, fontSize: 18 }}>Sessão concluída</div>
      <ul className="muted" style={{ fontSize: 14, lineHeight: 1.7, margin: '10px 0', paddingLeft: 18 }}>
        <li>{sum.sentences_seen} frases encontradas</li>
        <li>{sum.constructions_practiced} construções praticadas com {lemma}</li>
        <li>{sum.senses_encountered} usos de {lemma} encontrados</li>
        <li>{sum.modalities_practiced.length} modalidades praticadas</li>
        <li>{sum.assessed_interactions} interações avaliadas</li>
        <li>{sum.exposures} exposições</li>
      </ul>
      <p style={{ fontSize: 14 }}>Você continuará encontrando <b>{lemma}</b> em novas formas e contextos.</p>
      <button className="btn btn-primary" onClick={onExit}>Voltar ao laboratório</button>
    </div>
  )
}
