// Generate.jsx — full-screen "generating your lesson" flow.
//
// Receives its job via navigation params:
//   { focus, level, count }            → topic mode (from the lesson composer)
//   { resultYaml, level, count }       → next-lesson-from-results mode
//
// Loads the model if needed, streams the generation with a per-question
// progress bar (the model's output is YAML, so counting `- id:` lines gives
// real progress), then saves the lesson and drops the user straight into it.

import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store.jsx'
import { useAI } from '../ai/useAI.js'
import { I } from '../components/icons.jsx'
import { generateLesson } from '../ai/lesson-generator.js'
import * as engine from '../ai/engine.js'
import { logError } from '../lib/error-log.js'

export default function Generate() {
  const { params, back, saveLesson, startLesson, mistakes, settings, SCREENS } = useApp()
  const ai = useAI()

  // Params vanish on re-navigation; pin the job for this screen's lifetime.
  const jobRef = useRef(null)
  if (!jobRef.current) {
    jobRef.current = {
      focus: params.focus || null,
      resultYaml: params.resultYaml || null,
      level: params.level || settings?.level || 'B1',
      count: params.count || Math.min(settings?.question_count || 8, 12),
    }
  }
  const job = jobRef.current

  const [phase, setPhase] = useState('idle') // idle | model | generating | error
  const [progress, setProgress] = useState({ ratio: 0, text: '' })
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to re-run
  const runningRef = useRef(false)

  useEffect(() => {
    if (runningRef.current) return
    runningRef.current = true

    let wakeLock = null
    let cancelled = false

    const run = async () => {
      try { wakeLock = (await navigator.wakeLock?.request('screen')) ?? null } catch { /* unsupported */ }

      // 1. Model. Kick the load if needed and wait on the engine store — this
      // also handles a load that's already in flight (loadModel would return
      // false for "already loading").
      if (engine.getState().status !== 'ready') {
        setPhase('model')
        engine.loadModel(settings?.ai_model)
        await new Promise((resolve) => {
          const settle = () => {
            const st = engine.getState().status
            if (st === 'ready' || st === 'error') { unsub(); resolve() }
          }
          const unsub = engine.subscribe(settle)
          settle()
        })
        if (cancelled) return
        if (engine.getState().status !== 'ready') { setPhase('error'); setError(null); return } // ai.error carries the message
      }
      const chat = engine.getCapability('chat')
      if (!chat) { setPhase('error'); setError('O modelo não está pronto. Ative o tutor nas Configurações.'); return }

      // 2. Generate, with question-count progress from the YAML stream.
      setPhase('generating')
      setProgress({ ratio: 0.03, text: 'Preparando… os primeiros tokens podem demorar' })
      const total = job.count
      try {
        const res = await generateLesson({
          chat,
          focus: job.focus || undefined,
          resultYaml: job.resultYaml || undefined,
          level: job.level,
          count: total,
          weaknesses: job.resultYaml ? [] : mistakes.slice(0, 3).map((m) => m.mistake_type),
          onToken: (acc) => {
            if (cancelled) return
            const done = (acc.match(/-\s*id:/g) || []).length
            setProgress({
              ratio: Math.min(0.05 + (done / total) * 0.9, 0.95),
              text: done > 0 ? `Escrevendo pergunta ${Math.min(done, total)} de ${total}…` : 'Pensando na aula…',
            })
          },
          onRetry: () => { if (!cancelled) setProgress({ ratio: 0.1, text: 'Ajustando o formato… (2ª tentativa)' }) },
        })
        if (cancelled) return
        if (!res.ok) {
          setPhase('error')
          setError(`A aula gerada não passou na validação (${res.error}). Tente de novo — modelos pequenos às vezes erram o formato.`)
          return
        }
        // 3. Save and drop straight into the exercise.
        setProgress({ ratio: 1, text: 'Aula pronta!' })
        const saved = await saveLesson(res.lesson)
        if (cancelled) return
        await startLesson(saved)
      } catch (e) {
        logError('ai-lesson', e, { mode: job.resultYaml ? 'results' : 'topic', focus: job.focus })
        if (!cancelled) { setPhase('error'); setError(engine.humanizeError(e)) }
      }
    }

    run().finally(() => { try { wakeLock?.release() } catch { /* released */ } })
    return () => { cancelled = true; runningRef.current = false }
  }, [attempt])

  const retry = () => { runningRef.current = false; setError(null); setPhase('idle'); setAttempt((n) => n + 1) }

  const loadingModel = phase === 'model'
  const pct = Math.round((loadingModel ? ai.progress?.ratio || 0 : progress.ratio) * 100)
  const statusText = loadingModel ? (ai.progress?.text || 'Carregando o modelo…') : progress.text
  const failed = phase === 'error'
  const errorText = error || ai.error || 'Algo deu errado.'

  return (
    <div className="phone">
      <div className="app-header">
        <button className="back" onClick={() => back()} aria-label="Voltar"><I.back /></button>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Gerar aula</div>
        <div style={{ width: 40 }} />
      </div>

      <div className="screen-body" style={{ justifyContent: 'center', gap: 16 }}>
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(140deg, var(--indigo-500), var(--indigo-700))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <I.spark s={26} />
            </div>
            <div>
              <h2 className="h2">{job.resultYaml ? 'Nova aula com base nos seus erros' : 'Criando sua aula'}</h2>
              <div className="muted" style={{ fontSize: 13, marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                {job.focus ? `${job.focus} · ` : ''}{job.level} · {job.count} perguntas
              </div>
            </div>
          </div>

          {!failed ? (
            <div>
              <div className="progress" style={{ height: 10 }}>
                <div className="fill" style={{ width: `${pct}%`, transition: 'width .4s ease' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--ink-3)' }}>
                <span>{statusText || 'Começando…'}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
              </div>
              <p className="muted" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 14 }}>
                A aula é gerada no seu aparelho e abre sozinha quando ficar pronta. Mantenha o app aberto.
              </p>
            </div>
          ) : (
            <div>
              <div className="card" style={{ background: 'var(--error-bg)', borderColor: 'transparent', padding: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--error-ink)', lineHeight: 1.4 }}>{errorText}</div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => back()}>Voltar</button>
                <button className="btn btn-primary" style={{ flex: 1.4 }} onClick={retry}>Tentar de novo</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
