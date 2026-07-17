// V2ExposureActivity.jsx — first-contact presentation of an authored exemplar:
// full English sentence, pt-BR translation, situational context, optional
// audio, and a single Continuar. No artificial response is requested — the
// interaction records only the planned exposure evidence.

import { V2AudioButton } from './V2AudioButton.jsx'

export default function V2ExposureActivity({ plan, capabilities, settings, busy, onSubmit, onSupport }) {
  return (
    <div data-testid="v2-activity-exposure" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p className="muted" style={{ fontSize: 13 }}>{plan.context}</p>
      <div className="card" style={{ padding: 18 }}>
        <div data-testid="v2-text-en" style={{ fontWeight: 900, fontSize: 22, lineHeight: 1.35 }}>{plan.text_en}</div>
        <div data-testid="v2-text-pt" className="muted" style={{ fontSize: 15, marginTop: 8 }}>{plan.text_pt}</div>
      </div>
      <div>
        <V2AudioButton text={plan.text_en} settings={settings}
          available={!!capabilities?.audio_output}
          onReplay={() => onSupport('audio_replay')} />
      </div>
      <button className="btn btn-primary" data-testid="v2-continue" disabled={busy}
        onClick={() => onSubmit('continue', {})}>Continuar</button>
    </div>
  )
}
