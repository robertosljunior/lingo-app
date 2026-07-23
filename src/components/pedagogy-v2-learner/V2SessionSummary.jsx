// V2SessionSummary.jsx — Slice V2.17 (§27/§47). Renders the FACTUAL session
// summary produced by buildLearnerSessionSummaryV2. It receives resolved facts
// only — never mastery %, CEFR level or "word mastered".

export default function V2SessionSummary({ summary, onFinish }) {
  const facts = summary?.facts || []
  return (
    <div className="v2lx-scroll" data-testid="v2lx-summary" style={{ textAlign: 'center' }}>
      <div className="v2lx-content">
        <div style={{ width: 76, height: 76, borderRadius: 24, background: 'var(--v2-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, color: '#fff', margin: '20px auto', boxShadow: 'var(--v2-shadow-cta)' }} aria-hidden="true">✓</div>
        <div style={{ fontWeight: 900, fontSize: 26, color: 'var(--v2-ink)' }}>Sessão concluída</div>
        <div className="v2lx-fb-body" style={{ color: 'var(--v2-muted)', margin: '6px 0 26px' }}>Bom trabalho — aqui está o que você praticou.</div>
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
    </div>
  )
}
