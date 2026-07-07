import { useMemo, useState } from 'react'
import { useApp } from '../store.jsx'
import { I } from '../components/icons.jsx'
import { buildResultYaml, buildNewLessonPrompt, buildLevelAnalysisPrompt, downloadText } from '../lib/export-engine.js'

export default function Export() {
  const { activeLesson, session, settings, back, navigate, showToast, lessons, SCREENS } = useApp()
  const [tab, setTab] = useState('result')
  const [copied, setCopied] = useState(false)

  // Works both after a lesson (with answers) and standalone from Home.
  const lesson = activeLesson || lessons[0] || { lesson_id: 'eng_000', level: settings?.level || 'B1', questions: [] }
  const answers = session.answers

  const resultYaml = useMemo(() => buildResultYaml({ lesson, answers }), [lesson, answers])
  const promptNew = useMemo(
    () => buildNewLessonPrompt({ resultYaml, level: lesson.level, questionCount: settings?.question_count || 30 }),
    [resultYaml, lesson.level, settings?.question_count],
  )
  const promptAnalysis = useMemo(() => buildLevelAnalysisPrompt({ resultYaml }), [resultYaml])

  const content = tab === 'result' ? resultYaml : tab === 'new' ? promptNew : promptAnalysis

  const copy = async () => {
    try { await navigator.clipboard.writeText(content) } catch { /* older browsers */ }
    setCopied(true); showToast('Copiado para a área de transferência')
    setTimeout(() => setCopied(false), 1500)
  }

  const filenames = { result: 'resultado.yaml', new: 'prompt-nova-aula.txt', analysis: 'prompt-analise.txt' }

  return (
    <div className="phone">
      <div className="app-header">
        <button className="back" onClick={() => back(answers.length ? SCREENS.RESULT : SCREENS.HOME)} aria-label="Voltar"><I.back /></button>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Exportar</div>
        <div style={{ width: 40 }} />
      </div>

      <div className="screen-body" style={{ paddingTop: 8, gap: 14 }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-alt)', padding: 4, borderRadius: 12 }}>
          {[{ k: 'result', l: 'Resultado' }, { k: 'new', l: 'Prompt aula' }, { k: 'analysis', l: 'Análise' }].map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)} style={{
              flex: 1, padding: 8, borderRadius: 8, textAlign: 'center', border: 0, cursor: 'pointer',
              fontWeight: tab === t.k ? 700 : 600, fontSize: 13, fontFamily: 'inherit',
              background: tab === t.k ? 'var(--surface)' : 'transparent',
              color: tab === t.k ? 'var(--ink)' : 'var(--ink-3)',
              boxShadow: tab === t.k ? 'var(--shadow-sm)' : 'none',
            }}>{t.l}</button>
          ))}
        </div>

        <div>
          <div className="label-eyebrow">
            {tab === 'result' ? 'resultado compacto · YAML' : tab === 'new' ? 'prompt para chatgpt tutor' : 'prompt para análise de nível'}
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 4, lineHeight: 1.4 }}>
            {tab === 'result' ? 'Cole no ChatGPT tutor pra ele analisar e gerar a próxima aula.'
              : tab === 'new' ? 'Cole inteiro no ChatGPT — ele retorna o YAML da próxima aula.'
                : 'Use para receber feedback de tutor sobre o seu nível.'}
          </p>
        </div>

        <div className="code" style={{ flex: 1, overflowY: 'auto', fontSize: 11.5, lineHeight: 1.6, minHeight: 160 }}>{content}</div>

        {tab === 'new' && (
          <button
            className="btn btn-primary btn-block"
            style={{ background: 'linear-gradient(140deg, var(--indigo-500), var(--indigo-700))' }}
            onClick={() => navigate(SCREENS.GENERATE, {
              resultYaml,
              level: lesson.level,
              count: Math.min(settings?.question_count || 8, 12),
            })}
          >
            <I.spark s={18} /> Gerar agora no aparelho (IA)
          </button>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { downloadText(filenames[tab], content); showToast('Arquivo baixado') }}>
            <I.download s={18} /> Baixar
          </button>
          <button className="btn btn-primary" style={{ flex: 1.4, background: copied ? 'var(--success)' : undefined, boxShadow: copied ? '0 2px 0 #14532D' : undefined }} onClick={copy}>
            {copied ? <><I.check s={18} /> Copiado!</> : <><I.copy s={18} /> Copiar</>}
          </button>
        </div>
      </div>
    </div>
  )
}
