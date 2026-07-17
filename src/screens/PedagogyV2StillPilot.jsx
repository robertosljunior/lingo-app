// PedagogyV2StillPilot.jsx — "Laboratório V2 — still": the first executable
// V2 journey. Hosts the pilot session controller (state machine) locally —
// the V2 session state deliberately does NOT live in the global store. The
// screen is guarded by the experimental `pedagogy_v2_pilot_enabled` setting.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp, SCREENS } from '../store.jsx'
import { I } from '../components/icons.jsx'
import { getPedagogyV2Pack } from '../lib/pedagogy-v2/pack-registry.js'
import { buildLessonEngineContextV2 } from '../lib/pedagogy-v2/lesson-engine-context.js'
import { createPilotSessionController, summarizePilotSession } from '../lib/pedagogy-v2/pilot-session-controller.js'
import { detectRuntimeCapabilitiesV2 } from '../lib/pedagogy-v2/runtime-capabilities.js'
import { speechSupported } from '../lib/audio/tts.js'
import { sttSupported } from '../lib/audio/stt.js'
import V2ActivityRenderer from '../components/pedagogy-v2/V2ActivityRenderer.jsx'
import V2Feedback from '../components/pedagogy-v2/V2Feedback.jsx'
import V2SelectionDetails from '../components/pedagogy-v2/V2SelectionDetails.jsx'

const PACK_ID = 'pedagogy_v2_still'

export default function PedagogyV2StillPilot() {
  const { settings, activeProfile, db, setTab, back } = useApp()
  const enabled = !!settings?.pedagogy_v2_pilot_enabled

  const capabilities = useMemo(() => detectRuntimeCapabilitiesV2({
    ttsSupported: speechSupported,
    sttSupported,
  }), [])

  const controllerRef = useRef(null)
  const [state, setState] = useState(null)

  useEffect(() => {
    if (!enabled) return undefined
    const controller = createPilotSessionController({
      profileId: activeProfile,
      pack: getPedagogyV2Pack(PACK_ID),
      buildContext: (profileId, opts) => buildLessonEngineContextV2(profileId, opts),
      recordBatch: (events) => db.recordLearnerEvidenceBatchV2(events),
      capabilities,
      assessmentServices: {
        // Existing semantic pipeline through its PUBLIC API only, loaded
        // lazily so the pilot does not weigh on the main bundle.
        analyzeSemantics: async ({ text, assessmentMode }) =>
          (await import('../lib/language-analysis/index.js')).analyzeProduction({ text, assessmentMode }),
      },
    })
    controllerRef.current = controller
    setState(controller.getState())
    const unsub = controller.subscribe(setState)
    controller.start()
    return unsub
  }, [enabled, activeProfile, db, capabilities])

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

  const c = controllerRef.current
  const s = state
  const busy = !s || ['loading', 'submitting', 'advancing'].includes(s.status)
  const showDiagnostics = !!import.meta.env?.DEV

  return (
    <div className="phone" data-testid="v2-pilot-screen">
      <div style={{ padding: '8px 20px', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
        <button className="back" onClick={() => back(SCREENS.TRAINING)} aria-label="Voltar"><I.chevL s={18} /></button>
        <div>
          <div className="label-eyebrow">laboratório experimental</div>
          <h1 className="h1" style={{ margin: 0, fontSize: 20 }}>Laboratório V2 — still</h1>
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
              Sua resposta não foi perdida. Você pode tentar novamente.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              {s.pendingResponse
                ? <button className="btn btn-primary" data-testid="v2-retry" onClick={() => c.retry()}>Tentar novamente</button>
                : <button className="btn btn-primary" data-testid="v2-retry" onClick={() => c.start()}>Recomeçar</button>}
              <button className="btn btn-ghost" onClick={() => back(SCREENS.TRAINING)}>Sair</button>
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

        {s?.status === 'complete' && <SessionSummary interactions={s.interactions} onExit={() => setTab(SCREENS.TRAINING)} />}
      </div>
    </div>
  )
}

function SessionSummary({ interactions, onExit }) {
  const sum = summarizePilotSession(interactions)
  return (
    <div className="card" data-testid="v2-session-complete" style={{ padding: 18 }}>
      <div style={{ fontWeight: 900, fontSize: 18 }}>Sessão concluída</div>
      <ul className="muted" style={{ fontSize: 14, lineHeight: 1.7, margin: '10px 0', paddingLeft: 18 }}>
        <li>{sum.sentences_seen} frases encontradas</li>
        <li>{sum.constructions_practiced} construções praticadas</li>
        <li>{sum.modalities_practiced.length} modalidades praticadas</li>
        <li>{sum.senses_encountered} usos de still encontrados</li>
        <li>{sum.assessed_interactions} interações avaliadas</li>
        <li>{sum.exposures} exposições</li>
      </ul>
      <p style={{ fontSize: 14 }}>Você continuará encontrando <b>still</b> em novas formas e contextos.</p>
      <button className="btn btn-primary" onClick={onExit}>Voltar ao treinamento</button>
    </div>
  )
}
