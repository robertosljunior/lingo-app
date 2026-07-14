import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store.jsx'
import { Progress } from '../components/ui.jsx'
import { I } from '../components/icons.jsx'
import { analyze } from '../lib/nlp-client.js'
import { analyzeProduction, resolveAssessmentMode, usesSemanticPipeline, toExerciseAnalysis, essentialWords, cancelSemanticAnalysis } from '../lib/language-analysis/index.js'
import { buildIncorrectChoiceEvaluation } from '../lib/correction-engine.js'
import { speechSupported } from '../lib/audio/tts.js'
import { sttSupported } from '../lib/audio/stt.js'
import { SpeakButton, SpeakableText } from '../components/speak-button.jsx'
import BobMascot from '../components/BobMascot.jsx'
import { MicButton } from '../components/mic-button.jsx'
import { MarkedText, TypoNote } from '../components/answer-diff.jsx'
import { buildFeedbackPresentation } from '../lib/feedback-presentation.js'
import { speakFeedbackSequence, speakSegment } from '../lib/speech-router.js'
import { stopSpeaking } from '../lib/audio/tts.js'

// The four real semantic-feedback states. `header` is the outcome line
// (resultado); `explanation` is a distinct "why" used only when there is no
// specific error explanation, so the header is never duplicated in the body.
// Colour is only a support: "no clear error" is neutral (warn), not error-red.
const SEM_STATE = {
  valid: { header: 'Sua frase está correta', tone: 'success', explanation: 'Está natural e o significado corresponde ao que foi pedido.' },
  valid_with_suggestions: { header: 'Sua frase está correta e é compreensível', tone: 'success', explanation: 'Está clara. Veja abaixo formas ainda mais naturais neste contexto.' },
  needs_revision: { header: 'Vamos ajustar uma coisa', tone: 'error', explanation: 'Há um ponto para ajustar. Veja a versão corrigida abaixo.' },
  unable_to_assess: { header: 'Não encontrei um erro claro', tone: 'warn', explanation: 'Não identifiquei um erro evidente. Confira a sua frase abaixo.' },
}

export default function Exercise() {
  const { activeLesson, session, submitAnswer, rateAnswer, nextQuestion, back, settings } = useApp()
  const total = activeLesson.questions.length
  const q = activeLesson.questions[session.qIdx]

  const [user, setUser] = useState('')
  const [placed, setPlaced] = useState([])
  const [choice, setChoice] = useState(null)
  const [showHint, setShowHint] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [canCancel, setCanCancel] = useState(false) // show "cancel" only if analysis drags
  const [feedback, setFeedback] = useState(null) // analysis result once answered
  // Monotonic token so a late analysis can never update a newer question, and a
  // flag distinguishing a user-initiated cancel from a genuine engine failure.
  const analysisToken = useRef(0)
  const cancelTimer = useRef(null)
  const userCancelled = useRef(false)

  // Leaving the exercise (unmount) must cancel any in-flight worker analysis.
  useEffect(() => () => { analysisToken.current++; clearTimeout(cancelTimer.current); cancelSemanticAnalysis() }, [])
  // Changing question resets scroll-sensitive local UI and abandons stale analysis.
  useEffect(() => { setCanCancel(false); userCancelled.current = false }, [q.id])

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
    const token = ++analysisToken.current
    userCancelled.current = false
    setAnalyzing(true)
    setCanCancel(false)
    // Offer to interrupt the advanced (worker) analysis only if it drags — a fast
    // analysis never flashes a cancel control.
    cancelTimer.current = setTimeout(() => { if (token === analysisToken.current) setCanCancel(true) }, 1200)
    try {
      await runSubmission(token)
    } finally {
      clearTimeout(cancelTimer.current)
      // Never leave the screen stuck on "Analisando…" if analysis throws; ignore
      // a stale run whose question has already moved on.
      if (token === analysisToken.current) { setAnalyzing(false); setCanCancel(false) }
    }
  }

  // Interrupt the advanced analysis but keep the basic correction (never blocks).
  const handleCancelAnalysis = () => {
    userCancelled.current = true
    cancelSemanticAnalysis()
  }

  const runSubmission = async (token) => {
    const ans = answerText()
    const strict = settings?.correction_mode === 'strict'
    let analysis
    const semanticMode = resolveAssessmentMode(q)
    if (usesSemanticPipeline(q)) {
      // Free / guided / equivalent → local semantic tutor pipeline (real Harper +
      // structural NLP + USE/hashing + knowledge packs). Free & guided never see
      // the model answer. On any engine failure, degrade to a conservative valid
      // result so free production is never a total failure (never blocks).
      try {
        const result = await analyzeProduction({
          text: ans,
          assessmentMode: semanticMode,
          requestedIntent: q.requested_intent || (semanticMode === 'guided' ? 'future_plan' : null),
          level: q.level || activeLesson?.level || 'A1',
          equivalentTarget: semanticMode === 'equivalent'
            ? { text: q.expected_answer, essential_words: essentialWords(q.expected_answer) }
            : null,
        })
        analysis = toExerciseAnalysis(result, { question: q, mode: semanticMode })
      } catch (err) {
        analysis = buildSemanticFallbackAnalysis({ mode: semanticMode, userAnswer: ans, interrupted: userCancelled.current })
      }
    } else {
      analysis = await analyze({
      user_answer: ans,
      expected_answer: q.expected_answer,
      accepted_answers: strict ? [] : q.accepted_answers,
      exercise_type: q.type,
      mistake_focus: q.mistake_focus,
      skill_target: q.skill_target || q.lesson_focus || q.mistake_focus,
      nlp_library: settings?.nlp_library,
      })
    }
    // Choice questions: exact-match the option regardless of NLP.
    if (q.type === 'fill_blank' || q.type === 'choose_best') {
      const correct = ans.trim().toLowerCase() === q.expected_answer.trim().toLowerCase()
      analysis.verdict = correct ? 'correct' : 'incorrect'
      analysis.is_probably_correct = correct
      // The skills assessed by the free-text engine no longer match the
      // rewritten choice evaluation — drop them so they are re-inferred.
      analysis.assessed_skills = null
      if (correct) {
        analysis.detected_errors = []
        analysis.primary_error = null
        analysis.possible_mistake_type = null
        analysis.feedback = 'Natural! Boa estrutura.'
      } else {
        Object.assign(analysis, buildIncorrectChoiceEvaluation({
          user_answer: ans,
          expected_answer: q.expected_answer,
          skill_target: q.skill_target || q.lesson_focus || q.mistake_focus,
        }))
        const selectedMeta = q.metadata?.distractors?.[ans] || q.options_meta?.find?.((o) => o.text === ans)
        if (selectedMeta) analysis.selected_distractor = { text: ans, invalid_rule_id: selectedMeta.invalid_rule_id || selectedMeta.rule_id }
      }
    }
    // Speaking drill: what the recognizer heard doubles as a rough
    // pronunciation score (word-level, Duolingo-style — not phonetic).
    const spoken = q.type === 'speak_sentence'
      ? { spoken_transcript: ans, pronunciation_score: analysis.similarity_score }
      : {}
    // A stale analysis (question already advanced) must never persist or update UI.
    if (token !== analysisToken.current) return
    const entry = await submitAnswer({ question: q, user_answer: ans, analysis, ...spoken, attempt_number: 1, hint_used: showHint })
    if (token !== analysisToken.current) return
    setFeedback({ ...analysis, answerKey: entry.key, user_answer: ans })
  }

  const handleNext = () => {
    analysisToken.current++; cancelSemanticAnalysis()
    stopSpeaking(); setUser(''); setPlaced([]); setChoice(null); setShowHint(false); setFeedback(null)
    nextQuestion()
  }
  const handleRetry = () => { stopSpeaking(); setFeedback(null); setShowHint(false) }

  return (
    <div className="phone">
      <div style={{ padding: '8px 20px 8px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button className="back" style={{ width: 36, height: 36 }} onClick={() => back()} aria-label="Sair da aula"><I.close s={18} /></button>
        <div style={{ flex: 1 }}><Progress value={progress + (feedback ? 100 / total : 0)} /></div>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink-2)', minWidth: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{session.qIdx + 1}/{total}</div>
      </div>

      <div className="screen-body" style={{ paddingTop: 16, paddingBottom: feedback ? 20 : 110 }}>
        <span data-testid="question-type" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{q.type}</span>
        {q.context && (
          <div>
            {session.mode === 'adaptive_review' && <div className="chip chip-indigo" style={{ marginBottom: 8 }}>Revisão direcionada</div>}
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
        {q.type === 'speak_sentence' && (
          <SpeakBody q={q} user={user} setUser={setUser} disabled={!!feedback} showHint={showHint} />
        )}
      </div>

      {!feedback && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, padding: '12px 20px calc(28px + env(safe-area-inset-bottom))',
          background: 'linear-gradient(to top, var(--bg) 70%, transparent)', display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {analyzing && (
            <div data-testid="analyzing-status" aria-live="polite" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              fontSize: 13, color: 'var(--ink-3)',
            }}>
              <span className="spinner-dot" aria-hidden="true" />
              <span>Analisando sua frase…</span>
              {canCancel && (
                <button className="btn btn-sm btn-ghost" style={{ padding: '2px 10px', minHeight: 0 }}
                  data-testid="cancel-analysis" onClick={handleCancelAnalysis}>Cancelar</button>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" style={{ minWidth: 56, padding: '12px 14px' }} onClick={() => setShowHint(true)} aria-label="Dica" disabled={analyzing}>
              <I.lightbulb s={20} />
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={!canSubmit() || analyzing} onClick={handleSubmit}>
              {analyzing ? 'Analisando…' : q.type === 'build_sentence' ? 'Verificar' : 'Responder'}
            </button>
          </div>
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

// A small Bob reaction at the top of the feedback sheet — celebratory on a
// correct answer, warmly reassuring otherwise. Purely cosmetic: the real
// feedback (status, explanation, comparison, testids) follows unchanged.
function BobReaction({ verdict, tone, mode = 'adult' }) {
  const ok = verdict === 'correct'
  const almost = tone === 'warn'
  const bg = ok ? 'var(--success-bg)' : almost ? 'var(--warn-bg)' : 'var(--error-bg)'
  const ink = ok ? 'var(--success-ink)' : almost ? 'var(--warn-ink)' : 'var(--error-ink)'
  const line = ok ? 'Boa! Você mandou bem 🔥' : almost ? 'Quase! Faltou um detalhe.' : 'Sem problema — todo mundo erra 💙'
  return (
    <div aria-hidden="true" style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', marginBottom: 10,
      background: bg, borderRadius: 18, animation: 'bob-pop .28s ease both',
    }}>
      <BobMascot size={52} mode={mode} float={ok} />
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, color: ink, lineHeight: 1.15 }}>{line}</div>
    </div>
  )
}

// Feedback for free/guided production: never shows the model answer, diff, or
// "Expected". Shows the learner's sentence, a corrected version (only for real
// errors) and intent-preserving natural alternatives.
function SemanticFeedbackBlock({ sem, userText, settings }) {
  const alts = sem.natural_alternatives || []
  return (
    <section className="feedback-comparison" aria-label="Análise da sua frase" data-testid="feedback-semantic">
      <div className="feedback-answer">
        <div className="feedback-answer-label">Sua frase</div>
        <div className="feedback-answer-text">{userText}</div>
        {userText && <button className="btn btn-sm btn-ghost" aria-label="Ouvir sua frase" onClick={() => speakSegment({ text: userText, language: 'en', role: 'user_answer_en', settings })}><I.speaker s={14} /> Ouvir</button>}
      </div>
      {sem.corrected_version && (
        <div className="feedback-answer correct" data-testid="feedback-corrected">
          <div className="feedback-answer-label">Versão corrigida</div>
          <div className="feedback-answer-text">{sem.corrected_version}</div>
          <button className="btn btn-sm btn-secondary" aria-label="Ouvir versão corrigida" onClick={() => speakSegment({ text: sem.corrected_version, language: 'en', role: 'correct_answer_en', settings })}><I.speaker s={14} /> Ouvir</button>
        </div>
      )}
      {alts.length > 0 && (
        <div className="feedback-answer" data-testid="feedback-alternatives">
          <div className="feedback-answer-label">{sem.corrected_version ? 'Outras formas naturais' : 'Formas mais naturais neste contexto'}</div>
          {alts.map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: i ? 6 : 2 }}>
              <span className="feedback-answer-text" style={{ flex: 1 }}>{t}</span>
              <button className="btn btn-sm btn-ghost" aria-label={`Ouvir alternativa ${i + 1}`} onClick={() => speakSegment({ text: t, language: 'en', role: 'correct_answer_en', settings })}><I.speaker s={14} /></button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// Conservative degrade when the local semantic pipeline throws (e.g. a chunk
// fails to load). Free production is never a total failure and the model answer
// is never shown; the learner sees a neutral, valid acknowledgement.
function buildSemanticFallbackAnalysis({ mode, userAnswer, interrupted = false }) {
  const headline = interrupted
    ? 'A análise avançada foi interrompida. A correção básica continua disponível.'
    : 'Sua frase foi registrada.'
  const summary = interrupted
    ? 'Você interrompeu a análise avançada. Sua resposta foi registrada com a correção básica.'
    : 'Não foi possível analisar em detalhe agora. Sua resposta foi registrada.'
  return {
    analysis_version: '1', assessment_mode: mode, verdict: 'correct', is_probably_correct: true,
    score: 1, similarity_score: 1, target: null, target_answer: null,
    detected_errors: [], primary_error: null, possible_mistake_type: null,
    detected_intents: [], matched_concepts: [], corrected_version: null, natural_alternatives: [],
    feedback: headline,
    semantic_feedback: {
      mode, hide_model_answer: mode === 'free' || mode === 'guided', verdict: 'valid',
      headline, corrected_version: null, natural_alternatives: [],
      explanation_pt: { title: interrupted ? 'Análise interrompida' : 'Análise indisponível', summary },
    },
    engines: null, fallback_events: [{ engine: 'pipeline', code: 'ANALYSIS_FAILED' }], knowledge_pack_versions: {},
    assessed_skills: null,
  }
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
          {q.type === 'answer_question' && !q.prompt_pt
            ? <SpeakableText text={q.prompt} />
            : (q.prompt_pt || q.prompt)}
        </h2>
        {q.type === 'answer_question' && !q.prompt_pt && (
          <div style={{ marginTop: 10 }}><SpeakButton text={q.prompt} size="sm" label=" ouvir pergunta" /></div>
        )}
        {!disabled && <p className="muted" style={{ margin: '12px 0 0', fontSize: 13 }}>Tente sem traduzir literalmente. Use uma forma natural.</p>}
      </div>
      {showHint && !disabled && <HintCard text={hintFor(q)} />}
      <div style={{ marginTop: 'auto' }}>
        <textarea
          className="input" style={{ fontFamily: 'var(--font-sans)', fontSize: 16, minHeight: 110 }}
          placeholder="Type your natural answer in English…"
          value={user} onChange={(e) => setUser(e.target.value)} disabled={disabled} autoFocus
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: 12, color: 'var(--ink-3)' }}>
          <span>{words} {words === 1 ? 'palavra' : 'palavras'}</span>
          {sttSupported && (
            <MicButton lang="en-US" size={34} disabled={disabled}
              onResult={(t) => { if (t) setUser((u) => (u ? `${u} ${t}` : t)) }} />
          )}
        </div>
      </div>
    </>
  )
}

// Dictation: TTS speaks the expected sentence, the student types what they
// heard. Where TTS is unavailable the sentence is shown as text so the
// exercise still works (as a copy/attention drill).
function DictationBody({ q, user, setUser, disabled, showHint }) {
  const { settings } = useApp()
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
        <div style={{ alignSelf: 'center', marginTop: 8 }}>
          <SpeakButton text={q.expected_answer} size="lg" turtle label=" Ouvir frase" />
        </div>
      ) : (
        <div className="card" style={{ padding: 14, background: 'var(--warn-bg)', borderColor: 'transparent' }}>
          <div className="label-eyebrow" style={{ marginBottom: 6, color: 'var(--warn-ink)' }}>áudio indisponível neste navegador</div>
          <div style={{ fontSize: 13, color: 'var(--warn-ink)', lineHeight: 1.5 }}>
            {/* Never reveal the transcript before submitting — show it only in the feedback. */}
            {disabled ? <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{q.expected_answer}</span>
              : 'Escreva a frase que você espera ouvir. A frase correta aparece na correção.'}
          </div>
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
            <span style={{ display: 'inline-flex', gap: 4 }}>
              <button className="btn btn-sm btn-ghost" style={{ padding: '2px 8px', minHeight: 0 }} onClick={() => speakSegment({ text: q.expected_answer, language: 'en', role: 'exercise_en', settings })} disabled={disabled}>
                <I.speaker s={14} /> de novo
              </button>
              <button className="btn btn-sm btn-ghost" style={{ padding: '2px 8px', minHeight: 0 }} onClick={() => speakSegment({ text: q.expected_answer, language: 'en', role: 'exercise_en', settings, rate: 0.65 })} disabled={disabled} aria-label="Ouvir devagar">
                <I.turtle s={14} /> devagar
              </button>
            </span>
          )}
        </div>
      </div>
    </>
  )
}

// Speaking drill: the student says the sentence out loud and the recognizer's
// transcript is graded like a typed answer. Two flavors:
//   with prompt_pt   → "say this in English" (speaking translation)
//   without prompt_pt → "read this sentence aloud" (repeat-after-me)
// Without STT support — or when the mic/recognizer fails (offline, no mic
// permission) — the exercise degrades to typing so the lesson never blocks.
function SpeakBody({ q, user, setUser, disabled, showHint }) {
  const [partial, setPartial] = useState('')
  const [typing, setTyping] = useState(false)
  const readAloud = !q.prompt_pt
  const useMic = sttSupported && !typing

  return (
    <>
      <div>
        <div className="label-eyebrow" style={{ color: 'var(--indigo-700)' }}>
          {readAloud ? 'leia em voz alta' : 'fale em inglês'}
        </div>
        {readAloud ? (
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.25, margin: '8px 0 0' }}>
            <SpeakableText text={q.expected_answer} />
          </h2>
        ) : (
          <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2, margin: '8px 0 0' }}>
            {q.prompt_pt}
          </h2>
        )}
        <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          {readAloud && <SpeakButton text={q.expected_answer} size="sm" turtle label=" ouvir modelo" />}
          {!readAloud && !disabled && <p className="muted" style={{ margin: 0, fontSize: 13 }}>Pense na frase e fale com calma, de uma vez.</p>}
        </div>
      </div>

      {showHint && !disabled && <HintCard text={hintFor(q)} />}

      {useMic ? (
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div className="card" style={{ padding: 14, width: '100%', minHeight: 64, background: 'var(--bg-alt)' }}>
            <div className="label-eyebrow" style={{ marginBottom: 6 }}>o que o app ouviu</div>
            <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.4, color: user ? 'var(--ink)' : 'var(--ink-4)' }}>
              {user || partial || 'Toque no microfone e fale…'}
            </div>
          </div>
          <MicButton lang="en-US" disabled={disabled}
            label={user ? 'Falar de novo' : 'Toque para falar'}
            onPartial={(t) => { setPartial(t) }}
            onResult={(t) => { setPartial(''); if (t) setUser(t) }}
          />
          <button className="btn btn-sm btn-ghost" style={{ padding: '2px 10px', minHeight: 0 }} disabled={disabled}
            data-testid="speak-type-fallback" onClick={() => setTyping(true)}>
            Sem microfone? Digitar a frase
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 'auto' }}>
          {!sttSupported && (
            <div className="card" style={{ padding: 12, background: 'var(--warn-bg)', borderColor: 'transparent', marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: 'var(--warn-ink)', lineHeight: 1.5 }}>
                Este navegador não tem reconhecimento de voz — no Android, use o Chrome. Por ora, digite a frase.
              </div>
            </div>
          )}
          <textarea
            className="input" style={{ fontFamily: 'var(--font-sans)', fontSize: 16, minHeight: 90 }}
            placeholder="Type the sentence…"
            value={user} onChange={(e) => setUser(e.target.value)} disabled={disabled}
          />
        </div>
      )}
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



function TechnicalDiagnostics({ result }) {
  const [open, setOpen] = useState(false)
  if (!import.meta.env.DEV) return null
  const errors = result.detected_errors?.length ? result.detected_errors : (result.primary_error ? [result.primary_error] : [])
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} style={{ fontSize: 12, color: 'var(--ink-2)' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 800 }}>Mostrar diagnóstico técnico</summary>
      <pre style={{ whiteSpace: 'pre-wrap', background: 'rgba(255,255,255,.55)', borderRadius: 10, padding: 10, overflowX: 'auto' }}>
        {JSON.stringify(errors.map(e => ({ category:e.category, subtype:e.subtype, severity:e.severity, confidence:e.confidence, rule_id:e.rule_id })), null, 2)}
      </pre>
    </details>
  )
}

function FeedbackSheet({ result, q, onNext, onRetry, onRate }) {
  const { settings } = useApp()
  const scrollRef = useRef(null)
  const target = result.target || q.expected_answer
  const presentation = useMemo(() => buildFeedbackPresentation({
    evaluation: result,
    question: q,
    userAnswer: result.user_answer ?? result.normalized_user_answer,
    expectedAnswer: target,
    selectedOption: result.user_answer,
    skillTarget: q.skill_target || q.lesson_focus || q.mistake_focus,
  }), [result, q, target])

  useEffect(() => {
    const id = requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' }))
    return () => cancelAnimationFrame(id)
  }, [result.answerKey, q.id])
  useEffect(() => { speakFeedbackSequence(presentation, settings); return () => stopSpeaking() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const sem = result.semantic_feedback || null
  // Four distinct, non-duplicated feedback states driven by the semantic verdict.
  // `resultado` (header) states the outcome; `explicação` (body) says WHY without
  // repeating the header line. Non-semantic answers keep the legacy tri-state.
  const semView = sem ? SEM_STATE[sem.verdict] || SEM_STATE.needs_revision : null
  const tone = semView ? semView.tone
    : presentation.tone === 'correct' ? 'success' : presentation.tone === 'almost' ? 'warn' : 'error'
  const header = semView ? semView.header
    : presentation.tone === 'correct' ? 'Muito bem' : presentation.tone === 'almost' ? 'Quase lá' : 'Vamos ajustar uma coisa'
  // For a real revision the primary error explanation is the "why"; otherwise a
  // state-specific line that is deliberately different from the header.
  const semExplanation = semView
    ? (sem.explanation_pt?.summary || semView.explanation)
    : null
  const secondary = presentation.secondary_suggestions || []
  const missing = result.missing_words || []
  const extra = result.extra_words || []
  const typos = result.typos || []
  const typoGot = typos.map((t) => t.got)
  const typoExpected = typos.map((t) => t.expected)

  return (
    <div className={`sheet feedback-sheet sheet-anim`} data-testid="feedback-sheet" data-verdict={result.verdict} aria-live="polite">
      <div className="feedback-scroll" ref={scrollRef} data-testid="feedback-scroll">
        <div className="feedback-content">
          <BobReaction verdict={result.verdict} tone={tone} mode={settings?.profile_mode} />
          <div className="feedback-status" data-testid="feedback-title">
            <div className={`feedback-status-icon ${tone}`} aria-hidden="true">
              {result.verdict === 'correct' ? <I.check s={22} /> : result.verdict === 'partial' ? '~' : <I.x s={18} />}
            </div>
            <div>
              <h2 className="feedback-title">{header}</h2>
              {presentation.primary_skill_label && <div className="feedback-skill">{presentation.primary_skill_label}</div>}
            </div>
          </div>

          <section className="feedback-card feedback-explanation" aria-label="Explicação" data-testid="feedback-explanation-card">
            <h3>{sem?.explanation_pt?.title || presentation.title}</h3>
            <p>{sem ? semExplanation : presentation.explanation_pt}</p>
            {!sem && presentation.learner_tip_pt && <p>{presentation.learner_tip_pt}</p>}
            <button className="btn btn-sm btn-secondary" style={{ marginTop: 10 }} aria-label="Ouvir explicação" onClick={() => speakSegment({ text: sem ? semExplanation : presentation.speech_segments[0].text, language: 'pt-BR', role: 'explanation_pt', settings })}><I.speaker s={14} /> Ouvir explicação</button>
          </section>

          {result.verdict === 'correct' && !sem && <TypoNote typos={result.typos} inkVar="var(--feedback-text-secondary)" />}

          {sem?.hide_model_answer ? (
            <SemanticFeedbackBlock sem={sem} userText={result.user_answer} settings={settings} />
          ) : (
            <section className="feedback-comparison" aria-label="Comparação da resposta" data-testid="feedback-comparison">
              <div className="feedback-answer">
                <div className="feedback-answer-label">{presentation.comparison.user_label}</div>
                <div className="feedback-answer-text"><MarkedText text={presentation.comparison.user_text} marked={extra} typos={typoGot} variant="extra" speakable={false} /></div>
                {presentation.comparison.user_text && <button className="btn btn-sm btn-ghost" aria-label="Ouvir sua resposta" onClick={() => speakSegment({ text: presentation.comparison.user_text, language: 'en', role: 'user_answer_en', settings })}><I.speaker s={14} /> Ouvir</button>}
              </div>
              <div className="feedback-answer correct">
                <div className="feedback-answer-label">{presentation.comparison.expected_label}</div>
                <div className="feedback-answer-text"><MarkedText text={presentation.comparison.expected_text} marked={missing} typos={typoExpected} variant="missing" speakable={false} /></div>
                <button className="btn btn-sm btn-secondary" aria-label="Ouvir forma correta" onClick={() => speakSegment({ text: presentation.comparison.expected_text, language: 'en', role: 'correct_answer_en', settings })}><I.speaker s={14} /> Ouvir forma correta</button>
              </div>
            </section>
          )}

          {q.type === 'speak_sentence' && <div style={{ fontSize: 13, color: 'var(--feedback-text-secondary)' }}>🎙️ Pronúncia reconhecida: <strong>{Math.round((result.similarity_score || 0) * 100)}%</strong> das palavras</div>}
          {secondary.length > 0 && <section className="feedback-card feedback-secondary" style={{ padding: 14 }}><details><summary>Outros pontos para observar ({secondary.length})</summary>{secondary.map((s,i)=><p key={i} style={{fontSize:14,color:'var(--feedback-text-secondary)',lineHeight:1.45}}><strong>{s.title}:</strong> {s.explanation_pt}</p>)}</details></section>}
          <TechnicalDiagnostics result={result} />
          <div className="feedback-footer" data-testid="feedback-footer">
            <div className="feedback-actions">
              {result.verdict !== 'correct' && <button className="btn feedback-secondary-action" onClick={onRetry}>Tentar de novo</button>}
              <button className="btn btn-primary feedback-primary-action" onClick={onNext}>Próxima <I.chevR s={18} /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
