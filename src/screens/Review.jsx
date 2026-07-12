import { useState } from 'react'
import { useApp } from '../store.jsx'
import { Progress } from '../components/ui.jsx'
import { I } from '../components/icons.jsx'
import { speak, speechSupported } from '../lib/audio/tts.js'
import { FEEDBACK_BY_TYPE, wordDiff } from '../lib/correction-engine.js'
import { AnswerDiff } from '../components/answer-diff.jsx'
import { getSkill } from '../lib/skill-registry.js'

export default function Review() {
  const { session, back, showToast, SCREENS } = useApp()
  const wrong = session.answers.filter((a) => a.verdict !== 'correct')
  const [idx, setIdx] = useState(0)
  const a = wrong[idx]

  if (!a) {
    return (
      <div className="phone">
        <div className="app-header">
          <button className="back" onClick={() => back(SCREENS.RESULT)} aria-label="Voltar"><I.back /></button>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Revisão</div>
          <div style={{ width: 40 }} />
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
            <h2 className="h2">Sem erros pra revisar!</h2>
            <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>Você acertou tudo nessa aula.</p>
          </div>
        </div>
      </div>
    )
  }

  const q = a.question
  const next = () => { if (idx + 1 >= wrong.length) back(SCREENS.RESULT); else setIdx(idx + 1) }
  const primary = a.evaluation?.primary_error || a.evaluation?.detected_errors?.[0] || null
  const explanation = primary?.feedback || FEEDBACK_BY_TYPE[a.mistake_type]?.wrong || a.feedback
  const diff = wordDiff(a.user_answer || '', a.expected_answer || q.expected_answer || '')

  return (
    <div className="phone">
      <div style={{ padding: '8px 20px 8px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button className="back" onClick={() => back(SCREENS.RESULT)} aria-label="Voltar"><I.back s={18} /></button>
        <div style={{ flex: 1 }}><Progress value={(idx / wrong.length) * 100} /></div>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>{idx + 1}/{wrong.length}</div>
      </div>
      <div style={{ padding: '6px 20px 0', flexShrink: 0 }}>
        <span className="chip chip-error" style={{ fontFamily: 'var(--font-mono)' }}>{primary?.category || a.mistake_type || q.mistake_focus}</span>
      </div>

      <div className="screen-body" style={{ paddingTop: 16, paddingBottom: 20 }}>
        <div>
          <div className="label-eyebrow">pergunta</div>
          <div className="card" style={{ padding: 14, background: 'var(--bg-alt)', marginTop: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>
              {q.prompt_pt ? `"${q.prompt_pt}"` : q.original ? `"${q.original}"` : q.prompt}
            </div>
          </div>
        </div>

        <div>
          <div className="label-eyebrow" style={{ color: 'var(--error-ink)' }}>comparação</div>
          <div className="card" style={{ padding: 14, marginTop: 8, borderColor: 'var(--error)' }}>
            <AnswerDiff
              user={a.user_answer}
              target={a.expected_answer || q.expected_answer}
              missing={diff.missing_words}
              extra={diff.extra_words}
              typos={diff.typos}
              alignment={a.evaluation?.alignment}
              inkVar="var(--error-ink)"
            />
          </div>
        </div>

        <div>
          <div className="label-eyebrow" style={{ color: 'var(--success-ink)' }}>esperado</div>
          <div className="card" style={{ padding: 14, marginTop: 8, borderColor: 'var(--success)' }}>
            {q.accepted_answers?.length > 0 && (
              <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 6 }}>
                Alt: <span style={{ color: 'var(--ink-2)' }}>{q.accepted_answers[0]}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              {speechSupported && (
                <>
                  <button className="btn btn-sm btn-ghost" style={{ padding: '6px 10px' }} onClick={() => speak(q.expected_answer)}>
                    <I.speaker s={14} /> Ouvir
                  </button>
                  <button className="btn btn-sm btn-ghost" style={{ padding: '6px 10px' }} onClick={() => speak(q.expected_answer, { slow: true })} aria-label="Ouvir devagar">
                    <I.turtle s={14} />
                  </button>
                </>
              )}
              <button className="btn btn-sm btn-ghost" style={{ padding: '6px 10px' }}
                onClick={() => { navigator.clipboard?.writeText(q.expected_answer); showToast('Copiado') }}>
                <I.copy s={14} /> Copiar
              </button>
            </div>
          </div>
        </div>


        {a.evaluation?.assessed_skills?.length > 0 && (
          <div className="card" style={{ padding: 14 }}>
            <div className="label-eyebrow" style={{ marginBottom: 8 }}>habilidades avaliadas</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {a.evaluation.assessed_skills.map((s) => (
                <div key={s.skill_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
                  <span>{getSkill(s.skill_id).label_pt}</span>
                  <strong style={{ color: s.outcome === 'correct' ? 'var(--success)' : s.outcome === 'incorrect' ? 'var(--error)' : 'var(--warn)' }}>{s.outcome}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card" style={{ background: 'var(--indigo-50)', borderColor: 'transparent', padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ color: 'var(--indigo-700)' }}><I.lightbulb s={16} /></div>
            <div className="label-eyebrow" style={{ color: 'var(--indigo-700)' }}>por quê</div>
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.5 }}>{explanation}</div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={next}>Pular</button>
          <button className="btn btn-primary" style={{ flex: 1.4 }} onClick={next}>
            {idx + 1 >= wrong.length ? 'Concluir' : 'Próximo'} <I.chevR s={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
