// PedagogyV2Lab.jsx — "Laboratório V2": the generic multi-pack V2 lab
// (Slice V2.5, generalizing the single-pack pilot screen of V2.4). Two states:
//
//   selection — lists every registered pedagogy pack (word, short description,
//     use/construction counts, FACTUAL progress — never a global level,
//     a single mastery percentage or a "word learned" badge);
//   session   — hosts the pack-agnostic session controller for the selected
//     pack, parametrized by the formal scope { registry, pack_id, lexeme_id }.
//
// Guarded by the experimental `pedagogy_v2_pilot_enabled` setting (ONE flag for
// the whole lab, never one per word). Direct access to an unknown pack shows an
// error and returns to the selection — it never crashes the app.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp, SCREENS } from '../store.jsx'
import { I } from '../components/icons.jsx'
import { loadPedagogyV2Registry, getPedagogyPack, getLexemeAcrossRegistry } from '../lib/pedagogy-v2/registry.js'
import { buildLessonEngineContextV2 } from '../lib/pedagogy-v2/lesson-engine-context.js'
import { createPilotSessionController, summarizePilotSession } from '../lib/pedagogy-v2/pilot-session-controller.js'
import { detectRuntimeCapabilitiesV2 } from '../lib/pedagogy-v2/runtime-capabilities.js'
import { speechSupported } from '../lib/audio/tts.js'
import { sttSupported } from '../lib/audio/stt.js'
import V2ActivityRenderer from '../components/pedagogy-v2/V2ActivityRenderer.jsx'
import V2Feedback from '../components/pedagogy-v2/V2Feedback.jsx'
import V2SelectionDetails from '../components/pedagogy-v2/V2SelectionDetails.jsx'

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

export default function PedagogyV2Lab() {
  const { settings, params, setTab, back, navigate } = useApp()
  const enabled = !!settings?.pedagogy_v2_pilot_enabled
  const registry = useMemo(() => loadPedagogyV2Registry(), [])
  const packId = params?.packId ?? null
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

  // Direct access to an unknown pack: appropriate error + way back, no crash.
  if (packId && !pack) {
    return (
      <div className="phone" data-testid="v2-lab-screen">
        <div className="screen-body" style={{ justifyContent: 'center', textAlign: 'center' }}>
          <p className="muted" data-testid="v2-pack-invalid">
            Este pack não existe ou não está disponível neste laboratório.
          </p>
          <button className="btn btn-primary" onClick={() => navigate(SCREENS.PEDAGOGY_V2_PILOT, {})}>
            Voltar ao laboratório
          </button>
        </div>
      </div>
    )
  }

  if (!pack) {
    return <LabPackSelection registry={registry}
      onOpen={(id) => navigate(SCREENS.PEDAGOGY_V2_PILOT, { packId: id })}
      onBack={() => back(SCREENS.TRAINING)} />
  }

  return <LabSession key={packId} registry={registry} pack={pack}
    onExitToSelection={() => navigate(SCREENS.PEDAGOGY_V2_PILOT, {})} />
}

// ---- selection --------------------------------------------------------------

function LabPackSelection({ registry, onOpen, onBack }) {
  const { db, activeProfile } = useApp()
  const [states, setStates] = useState(null)

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
        {registry.packs.map((pack) => {
          const lemma = packLemma(pack, registry)
          const targets = packProgressTargetIds(pack)
          const seen = targets.filter((id) => (byTargetId.get(id)?.exposure?.count || 0) > 0)
          let lastContact = null
          for (const id of seen) {
            const at = byTargetId.get(id)?.exposure?.last_seen_at
            if (at && (!lastContact || at > lastContact)) lastContact = at
          }
          return (
            <button key={pack.manifest.pack_id} className="card tap" data-testid={`v2-pack-${lemma}`}
              onClick={() => onOpen(pack.manifest.pack_id)}
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
                  : seen.length
                    ? `${seen.length} de ${targets.length} usos e construções já encontrados`
                    : 'Ainda não praticado'}
                {lastContact ? ` · último contato: ${new Date(lastContact).toLocaleDateString('pt-BR')}` : ''}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---- session ----------------------------------------------------------------

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
