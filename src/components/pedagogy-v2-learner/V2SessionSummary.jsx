// V2SessionSummary.jsx — Slice V2.17 (§27/§47) + V2.18 (§18). Renders the
// mode-aware session RESULT from buildLearnerSessionResultV2:
//   - `completed`: a FACTUAL summary (activities, modalities, real new uses) —
//     never mastery %, CEFR level or "word mastered".
//   - `empty`: an honest empty state for a session that produced NO activity —
//     it reuses the visual shell but NEVER pretends a session happened.
// Backwards-compatible: a bare `summary` prop still renders the completed view.
//
// V2.22-UX2-R §10: the type, spacing and surfaces used to be hardcoded inline
// here — `fontWeight: 900, fontSize: 26` for the headline, ad-hoc paddings for
// the fact rows. That put the last screen of every session outside the token
// system, so it kept the old scale while the rest of the product moved to the
// mockup's. The markup now carries classes and the values live in
// `v2-learner.css` with everything else. No copy, data or contract changed.

const EMPTY_ACTION_LABELS = { adaptive: 'Praticar agora', explore: 'Explorar', review: 'Revisão' }

function CompletedView({ summary, onFinish }) {
  const facts = summary?.facts || []
  return (
    <div className="v2lx-content v2lx-done" data-testid="v2lx-summary" data-kind="completed">
      <div className="v2lx-done-mark" aria-hidden="true">✓</div>
      <h1 className="v2lx-done-title">Sessão concluída</h1>
      <p className="v2lx-done-lede">Bom trabalho — aqui está o que você praticou.</p>
      <div className="v2lx-done-facts">
        {facts.map((f, i) => (
          <div key={i} className="v2lx-done-fact" data-testid="v2lx-summary-fact">
            <span className="v2lx-done-fact-icon" aria-hidden="true">{f.icon}</span>
            <span className="v2lx-done-fact-text">{f.text}</span>
          </div>
        ))}
      </div>
      <button type="button" className="v2lx-cta v2lx-done-cta" data-testid="v2lx-finish" onClick={onFinish}>Concluir</button>
    </div>
  )
}

function EmptyView({ result, onFinish, onAction }) {
  return (
    <div className="v2lx-content v2lx-done" data-testid="v2lx-summary" data-kind="empty" data-mode={result.mode}>
      <div className="v2lx-done-mark v2lx-done-mark--empty" aria-hidden="true">✦</div>
      <h1 className="v2lx-done-title v2lx-done-title--empty" data-testid="v2lx-empty-headline">{result.headline}</h1>
      {result.body && <p className="v2lx-done-lede" data-testid="v2lx-empty-body">{result.body}</p>}
      <div className="v2lx-done-actions">
        {(result.actions || []).map((a, i) => (
          <button
            key={a.mode}
            type="button"
            className={i === 0 ? 'v2lx-cta' : 'v2lx-cta v2lx-cta--secondary'}
            data-testid={`v2lx-empty-action-${a.mode}`}
            onClick={() => onAction?.(a.mode)}
          >
            {a.label || EMPTY_ACTION_LABELS[a.mode] || a.mode}
          </button>
        ))}
        <button type="button" className="v2lx-textbtn v2lx-done-home" data-testid="v2lx-empty-home" onClick={onFinish}>Voltar ao início</button>
      </div>
    </div>
  )
}

export default function V2SessionSummary({ result = null, summary = null, onFinish, onAction }) {
  // Normalize: an explicit `result` wins; a bare `summary` is a completed view.
  const r = result || (summary ? { kind: 'completed', summary } : null)
  return (
    <div className="v2lx-scroll v2lx v2lx-done-scroll">
      {r?.kind === 'empty'
        ? <EmptyView result={r} onFinish={onFinish} onAction={onAction} />
        : <CompletedView summary={r?.summary} onFinish={onFinish} />}
    </div>
  )
}
