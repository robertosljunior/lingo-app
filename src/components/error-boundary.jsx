// error-boundary.jsx — last line of defense: a render crash shows a readable
// recovery screen (with the diagnostic log) instead of a white page.

import { Component } from 'react'
import { logError, formatErrorLog, getErrorLog } from '../lib/error-log.js'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    logError('react', error, info?.componentStack ? { component: info.componentStack.split('\n')[1]?.trim() } : null)
  }

  render() {
    if (!this.state.error) return this.props.children
    const recent = getErrorLog().slice(0, 5)
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--bg, #FBF9F4)' }}>
        <div style={{ maxWidth: 420, width: '100%' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>😵</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Algo quebrou</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2, #57534E)', lineHeight: 1.5, margin: '8px 0 0' }}>
            O erro foi registrado no log de diagnóstico (Configurações → Diagnóstico).
            Seus dados estão salvos.
          </p>
          <pre style={{
            fontSize: 11, lineHeight: 1.5, background: 'var(--bg-alt, #F5F1E8)', borderRadius: 12,
            padding: 12, marginTop: 14, maxHeight: 180, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {String(this.state.error?.message || this.state.error)}
            {recent.length > 1 ? `\n\nÚltimos eventos:\n${recent.map((e) => `· ${e.source}: ${e.message}`).join('\n')}` : ''}
          </pre>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              onClick={() => { navigator.clipboard?.writeText(formatErrorLog()) }}
              style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: '1.5px solid var(--border, #E7E0D2)', background: 'transparent', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: 'inherit', fontFamily: 'inherit' }}>
              Copiar log
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: 'none', background: '#4F46E5', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              Recarregar app
            </button>
          </div>
        </div>
      </div>
    )
  }
}
