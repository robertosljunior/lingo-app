// V2WordOrderActivity.jsx — word_order_reconstruction. Renders ONLY the tokens
// declared by the response contract (canonical whitespace tokens of the
// authored sentence): none added, none removed, contractions and punctuation
// preserved. The initial bank order comes from the PLAN
// (presentation_order: lexicographic) and is never re-shuffled here. Works by
// tap AND by keyboard (buttons are focusable; Enter/Space activates).

import { useState } from 'react'
import { presentedOrderTokens } from '../../lib/pedagogy-v2/activity-runtime-contracts.js'

export default function V2WordOrderActivity({ plan, busy, onSubmit }) {
  // Bank entries keep a stable index so duplicated words stay distinct.
  const bank = presentedOrderTokens(plan).map((t, i) => ({ t, i }))
  const [picked, setPicked] = useState([]) // array of bank indices, in chosen order
  const remaining = bank.filter((b) => !picked.includes(b.i))
  return (
    <div data-testid="v2-activity-word-order" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card" style={{ padding: 14 }}>
        <div className="muted" style={{ fontSize: 14 }}>{plan.text_pt}</div>
      </div>
      <div data-testid="v2-token-answer" aria-label="Sua frase" className="card"
        style={{ padding: 12, minHeight: 52, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {picked.map((i) => {
          const b = bank.find((x) => x.i === i)
          return (
            <button key={i} type="button" className="chip" style={{ cursor: 'pointer', font: 'inherit' }}
              aria-label={`Remover ${b.t}`}
              onClick={() => setPicked((p) => p.filter((x) => x !== i))}>{b.t}</button>
          )
        })}
      </div>
      <div data-testid="v2-token-bank" aria-label="Palavras disponíveis" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {remaining.map((b) => (
          <button key={b.i} type="button" className="chip" data-testid={`v2-token-${b.i}`}
            style={{ cursor: 'pointer', font: 'inherit' }}
            onClick={() => setPicked((p) => [...p, b.i])}>{b.t}</button>
        ))}
      </div>
      <button className="btn btn-primary" data-testid="v2-submit" disabled={busy || picked.length !== bank.length}
        onClick={() => onSubmit('token_sequence', { tokens: picked.map((i) => bank.find((x) => x.i === i).t) })}>
        Responder
      </button>
    </div>
  )
}
