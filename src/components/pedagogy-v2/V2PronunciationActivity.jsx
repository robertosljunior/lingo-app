// V2PronunciationActivity.jsx — pronunciation practice. In V2.4 there is NO
// acoustic assessor (documented in docs/pedagogy-v2-pilot-runtime.md), so the
// recipe is normally filtered from selection; this renderer exists for
// completeness and, if ever reached, states availability clearly and submits a
// practice attempt that can only yield observed/not_assessed — never a score
// derived from the STT transcript.

import { useState } from 'react'
import { MicButton } from '../mic-button.jsx'
import { V2AudioButton } from './V2AudioButton.jsx'

export default function V2PronunciationActivity({ plan, capabilities, settings, busy, onSubmit, onSupport }) {
  const [transcript, setTranscript] = useState(null)
  const canRecord = !!capabilities?.speech_input
  return (
    <div data-testid="v2-activity-pronunciation" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card" style={{ padding: 18 }}>
        <div data-testid="v2-text-en" style={{ fontWeight: 900, fontSize: 20 }}>{plan.text_en}</div>
      </div>
      <div>
        <V2AudioButton text={plan.text_en} settings={settings}
          available={!!capabilities?.audio_output}
          onReplay={() => onSupport('audio_replay')} />
      </div>
      <div className="muted" data-testid="v2-pronunciation-availability" style={{ fontSize: 13 }}>
        {capabilities?.pronunciation_assessment
          ? 'Sua pronúncia será avaliada.'
          : 'Prática de repetição: sua pronúncia ainda não é avaliada automaticamente.'}
      </div>
      {canRecord ? (
        <MicButton lang="en-US" label="Gravar" disabled={busy} onResult={setTranscript} />
      ) : (
        <button className="btn btn-secondary" data-testid="v2-record-unavailable" disabled aria-disabled="true">
          Gravação indisponível neste dispositivo
        </button>
      )}
      {transcript != null && <div className="muted" style={{ fontSize: 13 }}>Ouvimos: “{transcript}”</div>}
      <button className="btn btn-primary" data-testid="v2-submit" disabled={busy || (canRecord && transcript == null)}
        onClick={() => onSubmit('pronunciation_attempt', { transcript })}>Concluir prática</button>
    </div>
  )
}
