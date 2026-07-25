// V2SessionSummary.jsx — Slice V2.17 (§27/§47) + V2.18 (§18). Renders the
// mode-aware session RESULT from buildLearnerSessionResultV2:
//   - `completed`: a FACTUAL summary (activities, modalities, real new uses) —
//     never mastery %, CEFR level or "word mastered".
//   - `empty`: an honest empty state for a session that produced NO activity —
//     it reuses the visual shell but NEVER pretends a session happened.
// Backwards-compatible: a bare `summary` prop still renders the completed view.

const EMPTY_ACTION_LABELS = { adaptive: 'Praticar agora', explore: 'Explorar', review: 'Revisão' }

function CompletedView({ summary, onFinish }) {
  const facts = summary?.facts || []
  return (
    <div className="v2lx-content" data-testid="v2lx-summary" data-kind="completed">
      <div style={{ width: 76, height: 76, borderRadius: 24, background: 'var(--v2-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, color: '#fff', margin: '20px auto', boxShadow: 'var(--v2-shadow-cta)' }} aria-hidden="true">✓</div>
      <h1 style={{ fontWeight: 900, fontSize: 26, color: 'var(--v2-ink)', textAlign: 'center', margin: 0 }}>Sessão concluída</h1>
      <div className="v2lx-fb-body" style={{ color: 'var(--v2-muted)', margin: '6px 0 26px', textAlign: 'center' }}>Bom trabalho — aqui está o que você praticou.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
        {facts.map((f, i) => (
          <div key={i} className="v2lx-card" data-testid="v2lx-summary-fact" style={{ display: 'flex', gap: 13, alignItems: 'center', padding: '16px 18px' }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--v2-surface-alt)', color: 'var(--v2-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16, flex: 'none' }} aria-hidden="true">{f.icon}</div>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--v2-ink)', lineHeight: 1.3 }}>{f.text}</div>
          </div>
        ))}
      </div>
      <button type="button" className="v2lx-cta" data-testid="v2lx-finish" style={{ marginTop: 22 }} onClick={onFinish}>Concluir</button>
    </div>
  )
}

function EmptyView({ result, onFinish, onAction }) {
  return (
    <div className="v2lx-content" data-testid="v2lx-summary" data-kind="empty" data-mode={result.mode}>
      <div style={{ width: 72, height: 72, borderRadius: 22, background: 'var(--v2-surface-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: 'var(--v2-muted-2)', margin: '20px auto', border: '1px solid var(--v2-line)' }} aria-hidden="true">✦</div>
      <h1 style={{ fontWeight: 900, fontSize: 22, color: 'var(--v2-ink)', textAlign: 'center', margin: 0 }} data-testid="v2lx-empty-headline">{result.headline}</h1>
      {result.body && <div className="v2lx-fb-body" style={{ color: 'var(--v2-muted)', margin: '10px 0 24px', textAlign: 'center' }} data-testid="v2lx-empty-body">{result.body}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
        <button type="button" className="v2lx-textbtn" data-testid="v2lx-empty-home" onClick={onFinish} style={{ marginTop: 4 }}>Voltar ao início</button>
      </div>
    </div>
  )
}

export default function V2SessionSummary({ result = null, summary = null, onFinish, onAction }) {
  // Normalize: an explicit `result` wins; a bare `summary` is a completed view.
  const r = result || (summary ? { kind: 'completed', summary } : null)
  return (
    <div className="v2lx-scroll v2lx" style={{ textAlign: 'center' }}>
      {r?.kind === 'empty'
        ? <EmptyView result={r} onFinish={onFinish} onAction={onAction} />
        : <CompletedView summary={r?.summary} onFinish={onFinish} />}
    </div>
  )
}
