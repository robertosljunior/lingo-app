// V2ChoiceActivity.jsx — meaning_recognition and listening_recognition. Options
// are EXACTLY the authored ones declared in the ActivityPlanV2; no correct
// answer is ever highlighted before submission. For listening, the English
// sentence is NOT shown before the answer (presentation.show === []) and every
// replay after the first records `audio_replay`.

import { useState } from 'react'
import { V2AudioButton } from './V2AudioButton.jsx'

export default function V2ChoiceActivity({ plan, capabilities, settings, busy, onSubmit, onSupport }) {
  const [chosen, setChosen] = useState(null)
  const showEnglish = (plan.presentation.show || []).includes('text_en')
  const isListening = plan.recipe === 'listening_recognition'
  return (
    <div data-testid={`v2-activity-${plan.recipe}`} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p className="muted" style={{ fontSize: 13 }}>{plan.context}</p>
      {showEnglish && (
        <div className="card" style={{ padding: 18 }}>
          <div data-testid="v2-text-en" style={{ fontWeight: 900, fontSize: 20 }}>{plan.text_en}</div>
        </div>
      )}
      {isListening && (
        <div>
          <V2AudioButton text={plan.text_en} settings={settings}
            available={!!capabilities?.audio_output}
            onReplay={() => onSupport('audio_replay')} />
        </div>
      )}
      <div role="radiogroup" aria-label="Alternativas" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(plan.presentation.options || []).map((o) => (
          <button key={o.option_id} type="button" data-testid={`v2-option-${o.option_id}`}
            className="card tap" role="radio" aria-checked={chosen === o.option_id}
            onClick={() => setChosen(o.option_id)}
            style={{
              textAlign: 'left', padding: 14, font: 'inherit', cursor: 'pointer',
              border: chosen === o.option_id ? '2px solid var(--indigo-600)' : '1px solid var(--border)',
            }}>
            {o.text_pt}
          </button>
        ))}
      </div>
      <button className="btn btn-primary" data-testid="v2-submit" disabled={busy || !chosen}
        onClick={() => onSubmit('single_choice', { option_id: chosen })}>Responder</button>
    </div>
  )
}
