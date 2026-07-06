// Shared UI primitives: status bar, header, bottom nav, progress, logo, toast.

import { I } from './icons.jsx'

export function StatusBar() {
  return (
    <div className="statusbar">
      <span>9:41</span>
      <div className="right" aria-hidden="true">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5" width="3" height="7" rx="1" /><rect x="10" y="2" width="3" height="10" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 4a10 10 0 0 1 14 0M3.5 6.5a6 6 0 0 1 9 0M6 9a2.5 2.5 0 0 1 4 0" /><circle cx="8" cy="11" r=".8" fill="currentColor" /></svg>
        <svg width="26" height="12" viewBox="0 0 26 12" fill="none"><rect x="0.5" y="0.5" width="22" height="11" rx="3" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="19" height="8" rx="1.5" fill="currentColor" /><rect x="23.5" y="4" width="2" height="4" rx="1" fill="currentColor" opacity=".4" /></svg>
      </div>
    </div>
  )
}

export function AppHeader({ title, onBack, right = null }) {
  return (
    <div className="app-header">
      {onBack ? (
        <button className="back" onClick={onBack} aria-label="Voltar"><I.back /></button>
      ) : <div style={{ width: 40 }} />}
      <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em' }}>{title}</div>
      <div style={{ width: 40, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
    </div>
  )
}

export function BottomNav({ active, onNavigate, onTutor }) {
  const left = [
    { k: 'home', label: 'Início', icon: I.home },
    { k: 'history', label: 'Histórico', icon: I.history },
  ]
  const right = [
    { k: 'mistakes', label: 'Erros', icon: I.mistakes },
    { k: 'settings', label: 'Ajustes', icon: I.settings },
  ]
  const Item = (it) => (
    <button key={it.k} className={`nav-item ${active === it.k ? 'active' : ''}`}
      onClick={() => onNavigate(it.k)} aria-current={active === it.k ? 'page' : undefined}>
      <it.icon s={22} />
      <span>{it.label}</span>
    </button>
  )
  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {left.map(Item)}
      <div className="nav-center">
        <button className="fab" onClick={() => onTutor?.()} aria-label="Tutor IA"><I.spark s={24} /></button>
        <span className="fab-label">Tutor</span>
      </div>
      {right.map(Item)}
    </nav>
  )
}

export function Progress({ value }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className="fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

export function Logo({ size = 28 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: size, height: size, borderRadius: size * 0.32,
        background: 'linear-gradient(140deg, var(--indigo-500), var(--indigo-700))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontWeight: 800, fontSize: size * 0.55, letterSpacing: '-0.04em',
        boxShadow: '0 4px 12px rgba(99,102,241,.3)',
      }}>i</div>
      <span style={{ fontWeight: 800, fontSize: size * 0.62, letterSpacing: '-0.02em' }}>Idiomas</span>
    </div>
  )
}

export function Toast({ show, children }) {
  return <div className={`toast ${show ? 'show' : ''}`} role="status" aria-live="polite">{children}</div>
}

// Small scoring ring used in history + result.
export function ScoreRing({ score, size = 48, stroke = 4, color }) {
  const r = (size - stroke * 2) / 2
  const c = 2 * Math.PI * r
  const ring = color || (score >= 80 ? 'var(--success)' : score >= 65 ? 'var(--indigo-600)' : 'var(--warn)')
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--border)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={ring} strokeWidth={stroke} fill="none"
          strokeDasharray={`${c * (score / 100)} ${c}`} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray .8s ease' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.28, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
      }}>{score}</div>
    </div>
  )
}
