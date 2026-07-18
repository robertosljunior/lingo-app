// V2Feedback.jsx — feedback for one V2 interaction. States: correct, partial,
// incorrect, not_assessed, unable_to_assess. Shows the authored reference,
// translation, a short usage note and relevant corrections. NEVER shows
// mastery numbers, weights, skill IDs, selection scores or a global CEFR, and
// never claims the word was "learned".

const STYLES = {
  correct: { bg: 'color-mix(in srgb, #16a34a 12%, var(--surface))', title: 'Muito bem!' },
  partial: { bg: 'color-mix(in srgb, #d97706 12%, var(--surface))', title: 'Quase lá' },
  incorrect: { bg: 'color-mix(in srgb, #dc2626 10%, var(--surface))', title: 'Ainda não' },
  not_assessed: { bg: 'var(--bg-alt)', title: 'Prática registrada' },
  unable_to_assess: { bg: 'var(--bg-alt)', title: 'Não foi possível avaliar' },
}

// Copy is derived from the ACTIVE lexeme declared in the plan — this component
// is shared by every pack and must not hardcode any word.
function progressPhrase(plan, state) {
  const lemma = plan.lexeme_lemma || 'esta palavra'
  if (plan.recipe === 'exposure') return `Você encontrou este uso de ${lemma} em uma frase completa.`
  if (state === 'correct') {
    return plan.capability === 'recognition' || plan.capability === 'comprehension'
      ? `Você reconheceu este uso de ${lemma}.`
      : `Agora você praticou ${lemma} em uma nova construção.`
  }
  if (state === 'partial') return `Você está se aproximando deste uso de ${lemma}.`
  if (state === 'incorrect') return 'Compare com a frase de referência e tente de novo.'
  if (state === 'unable_to_assess') return 'Não conseguimos avaliar desta vez — você pode tentar novamente.'
  return `Você praticou ${lemma} nesta frase.`
}

export default function V2Feedback({ plan, assessment, busy, onContinue, onTryAgain }) {
  const state = assessment.status === 'unable_to_assess' ? 'unable_to_assess'
    : assessment.status === 'not_assessed' ? 'not_assessed'
    : assessment.outcome
  const st = STYLES[state] || STYLES.not_assessed
  const fb = assessment.feedback || {}
  const canRetry = ['incorrect', 'partial', 'unable_to_assess'].includes(state) && plan.recipe !== 'exposure'
  return (
    <div className="card" data-testid="v2-feedback" data-state={state} style={{ padding: 18, background: st.bg }}>
      <div style={{ fontWeight: 900, fontSize: 18 }}>{st.title}</div>
      <p style={{ fontSize: 14, margin: '6px 0 10px' }}>{progressPhrase(plan, state)}</p>
      {plan.recipe !== 'exposure' && (
        <div style={{ marginBottom: 10 }}>
          <div data-testid="v2-feedback-reference" style={{ fontWeight: 800, fontSize: 16 }}>{plan.text_en}</div>
          <div className="muted" style={{ fontSize: 14 }}>{plan.text_pt}</div>
        </div>
      )}
      {fb.corrected_version && fb.corrected_version !== plan.text_en && (
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Uma forma natural: <b>{fb.corrected_version}</b></div>
      )}
      {(fb.detected_errors || []).filter((e) => e.explanation_pt).slice(0, 2).map((e, i) => (
        <div key={i} className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
          <b>{e.explanation_pt.title}:</b> {e.explanation_pt.summary}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn btn-primary" data-testid="v2-feedback-continue" disabled={busy} onClick={onContinue}>Continuar</button>
        {canRetry && <button className="btn btn-secondary" data-testid="v2-feedback-retry" disabled={busy} onClick={onTryAgain}>Tentar novamente</button>}
      </div>
    </div>
  )
}
