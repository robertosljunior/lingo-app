// V2ProductionActivity.jsx — guided_production and free_production, writing or
// speaking per the plan's modality. Shows ONLY the supports the plan declares
// (translation/model_sentence for guided-supported; hint for free-supported);
// learner-triggered aids are reported to the support runtime. The authored
// reference sentence never appears before the answer unless explicitly
// revealed (recorded as answer_reveal).

import { useState } from 'react'
import { MicButton } from '../mic-button.jsx'

export default function V2ProductionActivity({ plan, capabilities, busy, onSubmit, onSupport }) {
  const [value, setValue] = useState('')
  const [partial, setPartial] = useState('')
  const [hintShown, setHintShown] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const speaking = plan.modality === 'speaking'
  const features = plan.support.features || []
  const showTranslation = (plan.presentation.show || []).includes('text_pt') || features.includes('translation')
  const isFree = plan.recipe === 'free_production'
  return (
    <div data-testid={`v2-activity-${plan.recipe}`} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p className="muted" style={{ fontSize: 13 }}>{plan.context}</p>
      {showTranslation && <div className="card" style={{ padding: 14 }}><div style={{ fontWeight: 800, fontSize: 16 }}>{plan.text_pt}</div></div>}
      {features.includes('model_sentence') && plan.presentation.model_reference && (
        <div className="muted" data-testid="v2-model-sentence" style={{ fontSize: 13 }}>Modelo: {plan.text_en}</div>
      )}
      {isFree && features.includes('hint') && !hintShown && (
        <button className="btn btn-sm btn-ghost" data-testid="v2-hint" disabled={busy}
          onClick={() => { setHintShown(true); onSupport('hint') }}>Ver uma dica</button>
      )}
      {hintShown && <div className="muted" data-testid="v2-hint-text" style={{ fontSize: 13 }}>Dica: {plan.text_pt}</div>}
      {speaking ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
          {capabilities?.speech_input ? (
            <>
              <MicButton lang="en-US" label="Falar em inglês" disabled={busy}
                onPartial={setPartial}
                onResult={(t) => { setPartial(''); setValue(t) }} />
              {(partial || value) && <div data-testid="v2-transcript" className="card" style={{ padding: 10, fontSize: 14 }}>{partial || value}</div>}
            </>
          ) : (
            <div className="muted" data-testid="v2-stt-unavailable" style={{ fontSize: 13 }}>Reconhecimento de fala indisponível neste dispositivo.</div>
          )}
        </div>
      ) : (
        <textarea className="input" data-testid="v2-production-input" rows={3} value={value} disabled={busy}
          placeholder="Escreva em inglês" aria-label="Resposta em inglês"
          onChange={(e) => setValue(e.target.value)} />
      )}
      {revealed && <div data-testid="v2-revealed" className="muted" style={{ fontSize: 13 }}>Referência: <b>{plan.text_en}</b> — esta atividade agora conta como prática acompanhada.</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" data-testid="v2-submit" disabled={busy || !value.trim()}
          onClick={() => onSubmit(speaking ? 'speech_transcript' : 'text', speaking ? { transcript: value } : { text: value })}>
          Responder
        </button>
        {!revealed && !isFree && (
          <button className="btn btn-ghost" data-testid="v2-reveal" disabled={busy}
            onClick={() => { setRevealed(true); onSupport('answer_reveal') }}>Revelar resposta</button>
        )}
      </div>
    </div>
  )
}
