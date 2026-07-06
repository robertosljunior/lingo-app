import { useState } from 'react'
import { useApp } from '../store.jsx'
import { I } from '../components/icons.jsx'
import { validateLesson } from '../lib/lesson-parser.js'
import { SAMPLE_YAML } from '../lib/sample-lesson.js'

export default function Import() {
  const { back, saveLesson, startLesson, showToast } = useApp()
  const [text, setText] = useState(SAMPLE_YAML)
  const [result, setResult] = useState(null) // { ok, summary } | { ok:false, error, line }

  const validate = () => setResult(validateLesson(text))

  const saveAndStart = async () => {
    const v = result && result.ok ? result : validateLesson(text)
    if (!v.ok) { setResult(v); return }
    const saved = await saveLesson(v.lesson)
    showToast('Aula salva')
    startLesson(saved)
  }

  const valid = result?.ok === true
  const error = result?.ok === false

  return (
    <div className="phone">
      <div className="app-header">
        <button className="back" onClick={() => back()} aria-label="Fechar"><I.close /></button>
        <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em' }}>Importar aula</div>
        <div style={{ width: 40 }} />
      </div>

      <div className="screen-body">
        <div>
          <h1 className="h1">Cole sua aula</h1>
          <p className="muted-2" style={{ margin: '8px 0 0', fontSize: 14 }}>
            Em YAML ou JSON compacto, gerado pelo seu tutor.
          </p>
        </div>

        {error && (
          <div className="card" style={{ background: 'var(--error-bg)', borderColor: 'transparent', padding: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ color: 'var(--error)', flexShrink: 0, marginTop: 1 }}><I.x s={18} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: 'var(--error-ink)', fontSize: 14 }}>
                  {result.line ? `Erro no YAML (linha ${result.line})` : 'YAML inválido'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--error-ink)', opacity: .85, marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                  {result.error}
                </div>
              </div>
            </div>
          </div>
        )}

        <textarea
          className="input"
          style={{ flex: 1, minHeight: 0 }}
          value={text}
          spellCheck={false}
          onChange={(e) => { setText(e.target.value); setResult(null) }}
          placeholder="lesson_id: ..."
          aria-label="Conteúdo da aula em YAML ou JSON"
        />

        {valid && (
          <div className="card" style={{ padding: 14, background: 'var(--success-bg)', borderColor: 'transparent' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ color: 'var(--success)' }}><I.check s={20} /></div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--success-ink)' }}>Aula válida</div>
                <div style={{ fontSize: 12, color: 'var(--success-ink)', opacity: .8 }}>
                  {result.summary.count} perguntas · {result.summary.level} · {result.summary.focus}
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={validate}>Validar</button>
          <button className="btn btn-primary" style={{ flex: 1.4 }} disabled={error} onClick={saveAndStart}>
            Salvar e iniciar
          </button>
        </div>
      </div>
    </div>
  )
}
