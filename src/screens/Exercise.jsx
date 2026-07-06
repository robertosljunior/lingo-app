import { useMemo, useState } from 'react'
import { useApp } from '../store.jsx'
import { StatusBar, Progress } from '../components/ui.jsx'
import { I } from '../components/icons.jsx'
import { analyze } from '../lib/nlp-client.js'
import { speak, speechSupported } from '../lib/speech.js'
import { AnswerDiff, TypoNote } from '../components/answer-diff.jsx'

export default function Exercise() {
  const { activeLesson, session, submitAnswer, rateAnswer, nextQuestion, back, settings } = useApp()
  const total = activeLesson.questions.length
  const q = activeLesson.questions[session.qIdx]

  const [user, setUser] = useState('')
  const [placed, setPlaced] = useState([])
  const [choice, setChoice] = useState(null)
  const [showHint, setShowHint] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [feedback, setFeedback] = useState(null) // analysis result once answered

  // Shuffle the word bank once per question.
  const bank = useMemo(() => {
    if (q.type !== 'build_sentence') return []
    return [...q.words].map((w, i) => ({ w, i })).sort(() => Math.random() - 0.5)
  }, [q])

  const progress = (session.qIdx / total) * 100

  const answerText = () => {
    if (q.type === 'build_sentence') return placed.join(' ')
    if (q.type === 'fill_blank' || q.type === 'choose_best') return choice ?? ''
    return user
  }

  const canSubmit = () => {
    if (feedback) return false
    if (q.type === 'build_sentence') return placed.length === q.words.length
    if (q.type === 'fill_blank' || q.type === 'choose_best') return choice != null
    return user.trim().length > 0
  }

  const handleSubmit = async () => {
    if (analyzing) return
    setAnalyzing(true)
    const ans = answerText()
    const strict = settings?.correction_mode === 'strict'
    const analysis = await analyze({
      user_answer: ans,
      expected_answer: q.expected_answer,
      accepted_answers: strict ? [] : q.accepted_answers,
      exercise_type: q.type,
      mistake_focus: q.mistake_focus,
    })
    // Choice questions: exact-match the option regardless of NLP.
    if (q.type === 'fill_blank' || q.type === 'choose_best') {
      const correct = ans.trim().toLowerCase() === q.expected_answer.trim().toLowerCase()
      analysis.verdict = correct ? 'correct' : 'incorrect'
      analysis.is_probably_correct = correct
      analysis.possible_mistake_type = correct ? null : q.mistake_focus
    }
    const entry = await submitAnswer({ question: q, user_answer: ans, analysis })
    setFeedback({ ...analysis, answerKey: entry.key, user_answer: ans })
    setAnalyzing(false)
  }

  const handleNext = () => {
    setUser(''); setPlaced([]); setChoice(null); setShowHint(false); setFeedback(null)
    nextQuestion()
  }
  const handleRetry = () => { setFeedback(null); setShowHint(false) }

  return (
    <div className="phone">
      <StatusBar />
      <div style={{ padding: '8px 20px 8px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button className="back" style={{ width: 36, height: 36 }} onClick={() => back()} aria-label="Sair da aula"><I.close s={18} /></button>
        <div style={{ flex: 1 }}><Progress value={progress + (feedback ? 100 / total : 0)} /></div>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink-2)', minWidth: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{session.qIdx + 1}/{total}</div>
      </div>

      <div style={{ padding: '6px 20px 0', display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
        <span className="chip chip-indigo" style={{ fontFamily: 'var(--font-mono)' }}>{q.type}</span>
        {q.mistake_focus && <span className="chip" style={{ fontFamily: 'var(--font-mono)' }}>{q.mistake_focus}</span>}
      </div>

      <div className="screen-body" style={{ paddingTop: 16, paddingBottom: feedback ? 20 : 110 }}>
        {q.context && (
          <div>
            <div className="label-eyebrow">contexto</div>
            <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0', lineHeight: 1.5 }}>{q.context}</p>
          </div>
        )}

        {(q.type === 'translate_natural' || q.type === 'answer_question') && (
          <TranslateBody q={q} user={user} setUser={setUser} disabled={!!feedback} showHint={showHint} />
        )}
        {q.type === 'build_sentence' && (
          <BuildBody q={q} bank={bank} placed={placed} setPlaced={setPlaced} disabled={!!feedback} />
        )}
        {q.type === 'rewrite_natural' && (
          <RewriteBody q={q} user={user} setUser={setUser} disabled={!!feedback} />
        )}
        {(q.type === 'fill_blank' || q.type === 'choose_best') && (
          <ChoiceBody q={q} choice={choice} setChoice={setChoice} disabled={!!feedback} />
        )}
        {q.type === 'listen_type' && (
          <DictationBody q={q} user={user} setUser={setUser} disabled={!!feedback} showHint={showHint} />
        )}
      </div>

      {!feedback && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, padding: '12px 20px 28px',
          background: 'linear-gradient(to top, var(--bg) 70%, transparent)', display: 'flex', gap: 10,
        }}>
          <button className="btn btn-secondary" style={{ minWidth: 56, padding: '12px 14px' }} onClick={() => setShowHint(true)} aria-label="Dica">
            <I.lightbulb s={20} />
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }} disabled={!canSubmit()} onClick={handleSubmit}>
            {analyzing ? 'Analisando…' : q.type === 'build_sentence' ? 'Verificar' : 'Responder'}
          </button>
        </div>
      )}

      {feedback && (
        <FeedbackSheet
          result={feedback} q={q} onNext={handleNext} onRetry={handleRetry}
          onRate={(confidence) => rateAnswer(feedback.answerKey, confidence)}
        />
      )}
    </div>
  )
}

function HintCard({ text }) {
  return (
    <div className="card" style={{ background: 'var(--warn-bg)', borderColor: 'transparent', padding: 12 }}>
      <div className="label-eyebrow" style={{ color: 'var(--warn-ink)' }}>dica</div>
      <div style={{ fontSize: 13, color: 'var(--warn-ink)', marginTop: 4, lineHeight: 1.5 }}>{text}</div>
    </div>
  )
}

function hintFor(q) {
  const first = (q.expected_answer || '').split(' ')[0]
  if (q.mistake_focus === 'question_structure' || q.mistake_focus === 'missing_auxiliary') return 'Comece com um auxiliar (Do / Does / Are).'
  if (q.mistake_focus === 'preposition') return 'Atenção à preposição — "at" para empresas.'
  return first ? `Começa com "${first}…"` : 'Pense em como um nativo diria.'
}

function TranslateBody({ q, user, setUser, disabled, showHint }) {
  const words = user.trim().split(/\s+/).filter(Boolean).length
  return (
    <>
      <div>
        <div className="label-eyebrow" style={{ color: 'var(--indigo-700)' }}>
          {q.type === 'answer_question' ? 'responda em inglês' : 'diga em inglês'}
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2, margin: '8px 0 0' }}>
          {q.prompt_pt || q.prompt}
        </h2>
        {!disabled && <p className="muted" style={{ margin: '12px 0 0', fontSize: 13 }}>Tente sem traduzir literalmente. Use uma forma natural.</p>}
      </div>
      {showHint && !disabled && <HintCard text={hintFor(q)} />}
      <div style={{ marginTop: 'auto' }}>
        <textarea
          className="input" style={{ fontFamily: 'var(--font-sans)', fontSize: 16, minHeight: 110 }}
          placeholder="Type your natural answer in English…"
          value={user} onChange={(e) => setUser(e.target.value)} disabled={disabled} autoFocus
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12, color: 'var(--ink-3)' }}>
          <span>{words} {words === 1 ? 'palavra' : 'palavras'}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><I.mic s={14} /> gravar</span>
        </div>
      </div>
    </>
  )
}

// Dictation: TTS speaks the expected sentence, the student types what they
// heard. Where TTS is unavailable the sentence is shown as text so the
// exercise still works (as a copy/attention drill).
function DictationBody({ q, user, setUser, disabled, showHint }) {
  const words = user.trim().split(/\s+/).filter(Boolean).length
  return (
    <>
      <div>
        <div className="label-eyebrow" style={{ color: 'var(--indigo-700)' }}>ouça e escreva</div>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>
          {q.prompt || 'Toque para ouvir e digite exatamente o que você ouvir.'}
        </p>
      </div>

      {speechSupported ? (
        <button className="btn btn-secondary" onClick={() => speak(q.expected_answer)}
          style={{ alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 10, padding: '18px 26px', borderRadius: 999, marginTop: 8 }}>
          <I.speaker s={22} /> Ouvir frase
        </button>
      ) : (
        <div className="card" style={{ padding: 14, background: 'var(--bg-alt)' }}>
          <div className="label-eyebrow" style={{ marginBottom: 6 }}>sem áudio neste navegador — copie a frase</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{q.expected_answer}</div>
        </div>
      )}

      {showHint && !disabled && <HintCard text={q.prompt_pt ? `Tradução: "${q.prompt_pt}"` : hintFor(q)} />}

      <div style={{ marginTop: 'auto' }}>
        <textarea
          className="input" style={{ fontFamily: 'var(--font-sans)', fontSize: 16, minHeight: 110 }}
          placeholder="Type what you hear…"
          value={user} onChange={(e) => setUser(e.target.value)} disabled={disabled}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12, color: 'var(--ink-3)' }}>
          <span>{words} {words === 1 ? 'palavra' : 'palavras'}</span>
          {speechSupported && (
            <button className="btn btn-sm btn-ghost" style={{ padding: '2px 8px', minHeight: 0 }} onClick={() => speak(q.expected_answer)} disabled={disabled}>
              <I.speaker s={14} /> ouvir de novo
            </button>
          )}
        </div>
      </div>
    </>
  )
}

function BuildBody({ q, bank, placed, setPlaced, disabled }) {
  const usedCount = {}
  placed.forEach((w) => { usedCount[w] = (usedCount[w] || 0) + 1 })
  return (
    <>
      <div>
        <div className="label-eyebrow" style={{ color: 'var(--indigo-700)' }}>monte uma frase natural</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.25, margin: '8px 0 0' }}>
          "{q.prompt_pt || q.prompt}"
        </h2>
      </div>
      <div className="word-slot" style={{ minHeight: 100, padding: 12 }}>
        {placed.map((w, i) => (
          <button key={i} className="word placed-active" onClick={() => !disabled && setPlaced(placed.filter((_, j) => j !== i))}>{w}</button>
        ))}
        {placed.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', color: 'var(--ink-4)', fontSize: 14, padding: '12px 8px' }}>
            Toque nas palavras abaixo na ordem
          </div>
        )}
      </div>
      <div>
        <div className="label-eyebrow" style={{ marginBottom: 10 }}>palavras disponíveis</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {bank.map(({ w, i }) => {
            const totalOf = q.words.filter((x) => x === w).length
            const isUsed = (usedCount[w] || 0) >= totalOf
            return (
              <button key={i} className={`word ${isUsed ? 'placed' : ''}`}
                disabled={isUsed || disabled}
                onClick={() => { if (!isUsed && !disabled) setPlaced([...placed, w]) }}>{w}</button>
            )
          })}
        </div>
      </div>
    </>
  )
}

function RewriteBody({ q, user, setUser, disabled }) {
  return (
    <>
      <div>
        <div className="label-eyebrow">frase original (estranha)</div>
        <div className="card" style={{ padding: 14, background: 'var(--bg-alt)', marginTop: 8 }}>
          <div style={{ fontSize: 16, color: 'var(--ink-2)', fontStyle: 'italic', lineHeight: 1.4 }}>"{q.original || q.prompt}"</div>
        </div>
      </div>
      <div>
        <div className="label-eyebrow" style={{ color: 'var(--indigo-700)' }}>reescreva de forma natural</div>
        <p className="muted-2" style={{ margin: '6px 0 0', fontSize: 13 }}>Soa estranho. Como um nativo diria?</p>
      </div>
      <textarea
        className="input" style={{ fontFamily: 'var(--font-sans)', fontSize: 16, flex: 1, minHeight: 100 }}
        placeholder="Rewrite naturally…" value={user} onChange={(e) => setUser(e.target.value)} disabled={disabled} autoFocus
      />
    </>
  )
}

function ChoiceBody({ q, choice, setChoice, disabled }) {
  return (
    <>
      <div>
        <div className="label-eyebrow" style={{ color: 'var(--indigo-700)' }}>
          {q.type === 'fill_blank' ? 'complete a frase' : 'escolha a melhor opção'}
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.3, margin: '8px 0 0' }}>{q.prompt}</h2>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
        {q.options.map((opt) => {
          const selected = choice === opt
          return (
            <button key={opt} className="card tap" disabled={disabled}
              onClick={() => setChoice(opt)}
              style={{
                textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                borderColor: selected ? 'var(--indigo-600)' : 'var(--border)',
                boxShadow: selected ? '0 0 0 3px var(--indigo-50)' : 'var(--shadow-sm)',
                background: 'var(--surface)', color: 'var(--ink)', font: 'inherit',
              }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${selected ? 'var(--indigo-600)' : 'var(--border-strong)'}`,
                background: selected ? 'var(--indigo-600)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
              }}>{selected && <I.check s={12} />}</div>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{opt}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

function FeedbackSheet({ result, q, onNext, onRetry, onRate }) {
  const tone = result.verdict === 'correct' ? 'success' : result.verdict === 'partial' ? 'warn' : 'error'
  const titles = {
    correct: 'Natural! 🎯',
    partial: 'Quase lá. Mais natural assim:',
    incorrect: q.mistake_focus === 'question_structure' ? 'Quase. Faltou o auxiliar.' : 'Não exatamente.',
  }
  const inkVar = tone === 'success' ? 'var(--success-ink)' : tone === 'warn' ? 'var(--warn-ink)' : 'var(--error-ink)'
  const baseColor = tone === 'success' ? 'var(--success)' : tone === 'warn' ? 'var(--warn)' : 'var(--error)'
  const shadow = tone === 'success' ? '#14532D' : tone === 'warn' ? '#78350F' : '#7F1D1D'

  return (
    <div className={`sheet sheet-${tone} sheet-anim`}>
      <div className="handle" style={{ background: 'rgba(0,0,0,.15)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: baseColor, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
          {result.verdict === 'correct' ? <I.check s={20} /> : result.verdict === 'partial' ? '~' : <I.x s={18} />}
        </div>
        <div className="sheet-title">{titles[result.verdict]}</div>
      </div>

      {result.verdict !== 'correct' && (
        <div className="card" style={{ padding: 12, background: 'rgba(255,255,255,.55)', borderColor: 'transparent' }}>
          <AnswerDiff
            user={result.user_answer ?? result.normalized_user_answer}
            target={result.target || q.expected_answer}
            missing={result.missing_words} extra={result.extra_words} typos={result.typos}
            inkVar={inkVar}
          />
        </div>
      )}

      {result.verdict === 'correct' && <TypoNote typos={result.typos} inkVar={inkVar} />}

      {result.verdict === 'correct' && q.accepted_answers?.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: inkVar, opacity: .7, fontWeight: 700, marginBottom: 6 }}>ALTERNATIVAS NATURAIS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {q.accepted_answers.map((a, i) => <div key={i} style={{ fontSize: 14, color: inkVar }}>· {a}</div>)}
          </div>
        </div>
      )}

      {result.verdict !== 'correct' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span className={`chip chip-${tone === 'warn' ? 'warn' : 'error'}`} style={{ fontFamily: 'var(--font-mono)' }}>
              {result.possible_mistake_type || q.mistake_focus || 'revisar'}
            </span>
          </div>
          <div style={{ fontSize: 14, color: inkVar, lineHeight: 1.5 }}>{result.feedback}</div>
        </div>
      )}

      <ConfidenceRow inkVar={inkVar} onRate={onRate} />

      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        {result.verdict !== 'correct' && (
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onRetry}>Tentar de novo</button>
        )}
        <button className="btn btn-primary" style={{ flex: 1, background: baseColor, boxShadow: `0 2px 0 ${shadow}` }} onClick={onNext}>
          Próxima <I.chevR s={18} />
        </button>
      </div>
    </div>
  )
}

// Self-rated difficulty — persisted with the answer (future input for spaced
// repetition scheduling).
function ConfidenceRow({ inkVar, onRate }) {
  const [sel, setSel] = useState(null)
  const opts = [
    { value: 'hard', label: '😅 Difícil' },
    { value: 'ok', label: '🙂 Ok' },
    { value: 'easy', label: '😎 Fácil' },
  ]
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ fontSize: 12, color: inkVar, opacity: .7, fontWeight: 700, marginRight: 4 }}>FOI:</div>
      {opts.map((o) => (
        <button key={o.value} className="btn btn-sm btn-secondary"
          onClick={() => { setSel(o.value); onRate?.(o.value) }}
          style={{ minHeight: 36, padding: '6px 12px', ...(sel === o.value ? { borderColor: inkVar, color: inkVar, background: 'rgba(255,255,255,.6)' } : {}) }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
