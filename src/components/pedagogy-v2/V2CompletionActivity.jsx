// V2CompletionActivity.jsx — fixed_element_completion: the full authored
// sentence with ONLY the construction's authorized fixed elements masked
// (buildMaskedCompletion — never arbitrary tokens). Supported variant shows a
// word bank; independent variant is a bare field. Answer reveal is available
// and recorded as real support.

import { useState } from 'react'
import { buildMaskedCompletion } from '../../lib/pedagogy-v2/activity-runtime-contracts.js'

export default function V2CompletionActivity({ plan, busy, onSubmit, onSupport }) {
  const [value, setValue] = useState('')
  const [revealed, setRevealed] = useState(false)
  const { masked_text, expected_tokens } = buildMaskedCompletion(plan)
  const hasWordBank = (plan.support.features || []).includes('word_bank')
  return (
    <div data-testid="v2-activity-completion" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p className="muted" style={{ fontSize: 13 }}>{plan.context}</p>
      <div className="card" style={{ padding: 18 }}>
        <div data-testid="v2-masked-text" style={{ fontWeight: 900, fontSize: 20 }}>{masked_text}</div>
        <div className="muted" style={{ fontSize: 14, marginTop: 8 }}>{plan.text_pt}</div>
      </div>
      {hasWordBank && (
        <div data-testid="v2-word-bank" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {expected_tokens.map((t, i) => (
            <button key={i} type="button" className="chip" style={{ cursor: 'pointer', font: 'inherit' }}
              onClick={() => setValue((v) => (v ? `${v} ${t}` : t))}>{t}</button>
          ))}
        </div>
      )}
      <input className="input" data-testid="v2-completion-input" value={value} disabled={busy}
        placeholder="Complete a frase" aria-label="Resposta"
        onChange={(e) => setValue(e.target.value)} />
      {revealed && <div data-testid="v2-revealed" className="muted" style={{ fontSize: 13 }}>Resposta: <b>{plan.text_en}</b> — esta atividade agora conta como prática acompanhada.</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" data-testid="v2-submit" disabled={busy || !value.trim()}
          onClick={() => onSubmit('text', { text: value })}>Responder</button>
        {!revealed && (
          <button className="btn btn-ghost" data-testid="v2-reveal" disabled={busy}
            onClick={() => { setRevealed(true); onSupport('answer_reveal') }}>Revelar resposta</button>
        )}
      </div>
    </div>
  )
}
