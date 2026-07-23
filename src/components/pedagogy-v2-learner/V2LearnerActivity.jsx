// V2LearnerActivity.jsx — Slice V2.17 learner-facing activity renderers (§19–§25).
// These REUSE the existing V2 runtime logic (response contracts, masking,
// token order, mic, audio) — they never re-implement validation or assessment.
// Only the visual layer is refactored to the handoff language. The primary CTA
// (Verificar/Continuar) lives in the shell footer; recipes that need a submit
// report their current payload up via `onSubmittable`, recognition submits on
// tap. No component decides anything pedagogical.

import { useEffect, useState } from 'react'
import { buildMaskedCompletion, presentedOrderTokens } from '../../lib/pedagogy-v2/activity-runtime-contracts.js'
import { MicButton } from '../mic-button.jsx'
import { V2AudioButton } from '../pedagogy-v2/V2AudioButton.jsx'

// ---- Exposure (§20) — not a question -----------------------------------------
function ExposureActivity({ plan, capabilities, settings, onSupport }) {
  return (
    <div data-testid="v2lx-activity-exposure" style={{ textAlign: 'center', paddingTop: 12 }}>
      <div className="v2lx-eyebrow" style={{ marginBottom: 20 }}>Observe esta frase</div>
      <div className="v2lx-sentence v2lx-sentence--display" data-testid="v2lx-sentence" style={{ marginBottom: 18 }}>{plan.text_en}</div>
      {!!capabilities?.audio_output && (
        <div style={{ marginBottom: 18 }}>
          <V2AudioButton text={plan.text_en} settings={settings} available onReplay={() => onSupport('audio_replay')} />
        </div>
      )}
      <div className="v2lx-translation" style={{ margin: '18px 0' }}>{plan.text_pt}</div>
      {plan.context && (
        <div className="v2lx-card" style={{ textAlign: 'left', display: 'flex', gap: 12, alignItems: 'flex-start', background: 'var(--v2-surface-alt)', boxShadow: 'none' }}>
          <div className="v2lx-banner-icon" style={{ background: 'var(--v2-primary)' }} aria-hidden="true">i</div>
          <div>
            <div className="v2lx-eyebrow" style={{ color: 'var(--v2-primary)', textTransform: 'none' }}>Observe</div>
            <div className="v2lx-fb-body">{plan.context}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Recognition (§21) — tap = answer ----------------------------------------
function RecognitionActivity({ plan, capabilities, settings, busy, answered, assessment, onSubmit, onSupport }) {
  const [chosen, setChosen] = useState(null)
  const showEnglish = (plan.presentation.show || []).includes('text_en')
  const isListening = plan.recipe === 'listening_recognition'
  // After the answer the assessment tells us which option was expected — mark it
  // so the learner sees the target without leaking any id (§21/§37).
  const correctId = assessment?.feedback?.correct_option_id ?? null
  const chosenId = assessment?.feedback?.chosen_option_id ?? chosen

  const pick = (optionId) => {
    if (answered || busy) return
    setChosen(optionId)
    onSubmit('single_choice', { option_id: optionId }) // evaluate on tap
  }

  return (
    <div data-testid={`v2lx-activity-${plan.recipe}`} style={{ paddingTop: 8 }}>
      {plan.context && <div className="v2lx-fb-body" style={{ color: 'var(--v2-muted)', marginBottom: 14 }}>{plan.context}</div>}
      {showEnglish && <div className="v2lx-card" style={{ marginBottom: 16 }}><div className="v2lx-sentence" style={{ fontSize: 20 }}>{plan.text_en}</div></div>}
      {isListening && (
        <div style={{ marginBottom: 16 }}>
          <V2AudioButton text={plan.text_en} settings={settings} available={!!capabilities?.audio_output} onReplay={() => onSupport('audio_replay')} />
        </div>
      )}
      <div role="radiogroup" aria-label="Alternativas" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(plan.presentation.options || []).map((o) => {
          let result = null
          let dim = false
          if (answered && correctId != null) {
            if (o.option_id === correctId) result = 'correct'
            else if (o.option_id === chosenId) result = 'wrong'
            else dim = true
          }
          return (
            <button
              key={o.option_id}
              type="button"
              className="v2lx-option"
              data-testid={`v2lx-option-${o.option_id}`}
              role="radio"
              aria-checked={chosenId === o.option_id}
              data-result={result || undefined}
              data-dim={dim || undefined}
              disabled={answered || busy}
              onClick={() => pick(o.option_id)}
            >
              <span>{o.text_pt}</span>
              {result === 'correct' && <span aria-hidden="true" style={{ color: 'var(--v2-fb-correct)', fontWeight: 900, fontSize: 18 }}>✓</span>}
              {result === 'wrong' && <span aria-hidden="true" style={{ color: 'var(--v2-fb-linguistic)', fontWeight: 900, fontSize: 18 }}>✕</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---- Completion (§22) — tap the bank; a chip fills the slot -------------------
function CompletionActivity({ plan, busy, answered, onSubmittable, onSupport }) {
  const [value, setValue] = useState('')
  const [revealed, setRevealed] = useState(false)
  const { masked_text, expected_tokens } = buildMaskedCompletion(plan)
  const hasWordBank = (plan.support.features || []).includes('word_bank')
  useEffect(() => {
    onSubmittable(value.trim() ? { type: 'text', payload: { text: value } } : null)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const parts = masked_text.split(/_{3,}/)
  return (
    <div data-testid="v2lx-activity-completion" style={{ paddingTop: 8 }}>
      <div className="v2lx-eyebrow" style={{ marginBottom: 16 }}>Complete a frase</div>
      <div className="v2lx-card" style={{ textAlign: 'center' }}>
        <div className="v2lx-sentence" data-testid="v2lx-sentence" style={{ fontSize: 24, lineHeight: 1.5 }}>
          {parts[0]}
          <span data-testid="v2lx-slot" style={{ color: value ? 'var(--v2-primary)' : 'var(--v2-muted-2)', borderBottom: '3px solid', padding: '0 8px' }}>{value || '     '}</span>
          {parts.slice(1).join('_____')}
        </div>
      </div>
      <div className="v2lx-translation" style={{ textAlign: 'center', margin: '14px 0 18px' }}>{plan.text_pt}</div>
      {hasWordBank && (
        <div data-testid="v2lx-word-bank" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
          {expected_tokens.map((t, i) => (
            <button key={i} type="button" className="v2lx-chip" disabled={answered || busy} onClick={() => setValue(t)}>{t}</button>
          ))}
        </div>
      )}
      {!hasWordBank && (
        <input className="v2lx-input" data-testid="v2lx-completion-input" value={value} disabled={answered || busy}
          placeholder="Complete a frase" aria-label="Resposta" onChange={(e) => setValue(e.target.value)} />
      )}
      {!answered && !revealed && (
        <button type="button" className="v2lx-disclose" data-testid="v2lx-reveal" style={{ display: 'block', margin: '10px auto 0' }}
          disabled={busy} onClick={() => { setRevealed(true); onSupport('answer_reveal') }}>Ver a resposta</button>
      )}
      {revealed && <div className="v2lx-fb-body" data-testid="v2lx-revealed" style={{ color: 'var(--v2-muted)', marginTop: 8, textAlign: 'center' }}>Resposta: <b>{plan.text_en}</b></div>}
    </div>
  )
}

// ---- Word order (§23) — tap to build; ≥44px chips ----------------------------
function WordOrderActivity({ plan, busy, answered, onSubmittable }) {
  const bank = presentedOrderTokens(plan).map((t, i) => ({ t, i }))
  const [picked, setPicked] = useState([])
  const remaining = bank.filter((b) => !picked.includes(b.i))
  useEffect(() => {
    const complete = picked.length === bank.length && bank.length > 0
    onSubmittable(complete ? { type: 'token_sequence', payload: { tokens: picked.map((i) => bank.find((x) => x.i === i).t) } } : null)
  }, [picked]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div data-testid="v2lx-activity-word-order" style={{ paddingTop: 8 }}>
      <div className="v2lx-eyebrow" style={{ marginBottom: 4, textTransform: 'none', fontSize: 15, fontWeight: 900, color: 'var(--v2-ink)' }}>Monte a frase na ordem correta</div>
      <div className="v2lx-translation" style={{ marginBottom: 16 }}>{plan.text_pt}</div>
      <div data-testid="v2lx-token-answer" aria-label="Sua frase" style={{ minHeight: 84, background: 'var(--v2-surface)', borderRadius: 18, boxShadow: 'inset 0 0 0 2px var(--v2-line)', padding: 14, display: 'flex', flexWrap: 'wrap', gap: 9, alignContent: 'flex-start', marginBottom: 14 }}>
        {picked.length === 0 && <span style={{ color: 'var(--v2-muted-2)', fontWeight: 700, padding: 6 }}>Toque nas palavras para montar</span>}
        {picked.map((i) => {
          const b = bank.find((x) => x.i === i)
          return <button key={i} type="button" className="v2lx-chip v2lx-chip--placed" disabled={answered || busy} aria-label={`Remover ${b.t}`} onClick={() => setPicked((p) => p.filter((x) => x !== i))}>{b.t}</button>
        })}
      </div>
      <div data-testid="v2lx-token-bank" aria-label="Palavras disponíveis" style={{ display: 'flex', flexWrap: 'wrap', gap: 9, justifyContent: 'center' }}>
        {remaining.map((b) => (
          <button key={b.i} type="button" className="v2lx-chip" data-testid={`v2lx-token-${b.i}`} disabled={answered || busy} onClick={() => setPicked((p) => [...p, b.i])}>{b.t}</button>
        ))}
      </div>
    </div>
  )
}

// ---- Speaking control (§25) — idle/listening/processing/result ---------------
function SpeakingControl({ plan, capabilities, busy, answered, isPronunciation, onSubmittable, onSubmit }) {
  const [transcript, setTranscript] = useState(null)
  const [listening, setListening] = useState(false)
  const canRecord = !!capabilities?.speech_input
  const hasAcoustic = !!capabilities?.pronunciation_assessment
  useEffect(() => {
    if (isPronunciation) return // pronunciation submits via footer with its own payload
    onSubmittable(transcript && transcript.trim() ? { type: 'speech_transcript', payload: { transcript } } : null)
  }, [transcript, isPronunciation]) // eslint-disable-line react-hooks/exhaustive-deps

  const micState = listening ? 'listening' : (transcript != null ? 'result' : 'idle')
  return (
    <div data-testid="v2lx-activity-speaking" style={{ paddingTop: 8, textAlign: 'center' }}>
      <div className="v2lx-eyebrow" style={{ marginBottom: 18 }}>Prática de fala</div>
      <div className="v2lx-card" style={{ marginBottom: 22 }}>
        <div className="v2lx-sentence" data-testid="v2lx-sentence" style={{ fontSize: 22 }}>{plan.text_en}</div>
      </div>
      {canRecord ? (
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div className="v2lx-mic" data-mic={micState} data-testid="v2lx-mic" aria-hidden="true" style={{ pointerEvents: 'none' }}>
            {micState === 'listening' ? '■' : micState === 'result' ? '↺' : '🎤'}
          </div>
          <MicButton lang="en-US" label={transcript != null ? 'Falar de novo' : 'Falar em inglês'} disabled={busy || answered}
            onPartial={() => setListening(true)}
            onResult={(t) => { setListening(false); setTranscript(t); if (isPronunciation) onSubmittable({ type: 'pronunciation_attempt', payload: { transcript: t } }) }} />
        </div>
      ) : (
        <div className="v2lx-fb-body" data-testid="v2lx-stt-unavailable" style={{ color: 'var(--v2-muted)' }}>Reconhecimento de fala indisponível neste dispositivo.</div>
      )}
      {transcript != null && (
        <div className="v2lx-fb-note" data-testid="v2lx-transcript" style={{ marginTop: 16, fontStyle: 'italic', background: 'var(--v2-surface-alt)' }}>
          <div className="v2lx-fb-body">“{transcript}”</div>
        </div>
      )}
      {/* §25 — pronunciation with no acoustic assessor is practice, NOT a score. */}
      {isPronunciation && !hasAcoustic && (
        <div className="v2lx-fb-body" data-testid="v2lx-speaking-practice" style={{ color: 'var(--v2-muted)', marginTop: 12 }}>Prática de fala — sem nota de pronúncia.</div>
      )}
    </div>
  )
}

// ---- Production writing (§24) ------------------------------------------------
function ProductionActivity({ plan, capabilities, busy, answered, onSubmittable, onSubmit, onSupport }) {
  const speaking = plan.modality === 'speaking'
  if (speaking) {
    return <SpeakingControl plan={plan} capabilities={capabilities} busy={busy} answered={answered} isPronunciation={false} onSubmittable={onSubmittable} onSubmit={onSubmit} />
  }
  const [value, setValue] = useState('')
  const [hintShown, setHintShown] = useState(false)
  const features = plan.support.features || []
  const showTranslation = (plan.presentation.show || []).includes('text_pt') || features.includes('translation')
  const isFree = plan.recipe === 'free_production'
  useEffect(() => {
    onSubmittable(value.trim() ? { type: 'text', payload: { text: value } } : null)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div data-testid={`v2lx-activity-${plan.recipe}`} style={{ paddingTop: 8 }}>
      <div className="v2lx-eyebrow" style={{ marginBottom: 12 }}>{isFree ? 'Produção livre' : 'Produção guiada'}</div>
      <div className="v2lx-card" style={{ background: isFree ? 'var(--v2-fb-semantic-bg)' : 'var(--v2-surface-alt)', boxShadow: 'none', marginBottom: 16 }}>
        <div className="v2lx-sentence" style={{ fontSize: 20 }}>{plan.context || plan.text_pt}</div>
        {features.includes('model_sentence') && plan.presentation.model_reference && (
          <div className="v2lx-fb-body" data-testid="v2lx-model" style={{ color: 'var(--v2-muted)', marginTop: 10 }}>Modelo: {plan.text_en}</div>
        )}
      </div>
      {showTranslation && plan.context && <div className="v2lx-translation" style={{ marginBottom: 12 }}>{plan.text_pt}</div>}
      {isFree && features.includes('hint') && !hintShown && (
        <button type="button" className="v2lx-disclose" data-testid="v2lx-hint" disabled={busy} onClick={() => { setHintShown(true); onSupport('hint') }}>Ver uma dica</button>
      )}
      {hintShown && <div className="v2lx-fb-body" data-testid="v2lx-hint-text" style={{ color: 'var(--v2-muted)', marginBottom: 8 }}>Dica: {plan.text_pt}</div>}
      <textarea className="v2lx-input" data-testid="v2lx-production-input" rows={3} value={value} disabled={answered || busy}
        placeholder="Escreva sua resposta em inglês…" aria-label="Resposta em inglês" onChange={(e) => setValue(e.target.value)} />
    </div>
  )
}

// ---- Pronunciation (§25) — no acoustic score --------------------------------
function PronunciationActivity({ plan, capabilities, settings, busy, answered, onSubmittable, onSubmit, onSupport }) {
  return (
    <div data-testid="v2lx-activity-pronunciation">
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <V2AudioButton text={plan.text_en} settings={settings} available={!!capabilities?.audio_output} onReplay={() => onSupport('audio_replay')} />
      </div>
      <SpeakingControl plan={plan} capabilities={capabilities} busy={busy} answered={answered} isPronunciation onSubmittable={onSubmittable} onSubmit={onSubmit} />
    </div>
  )
}

const RENDERERS = {
  exposure: ExposureActivity,
  meaning_recognition: RecognitionActivity,
  listening_recognition: RecognitionActivity,
  fixed_element_completion: CompletionActivity,
  word_order_reconstruction: WordOrderActivity,
  guided_production: ProductionActivity,
  free_production: ProductionActivity,
  pronunciation: PronunciationActivity,
}

export default function V2LearnerActivity(props) {
  const Renderer = RENDERERS[props.plan?.recipe]
  if (!Renderer) return <div data-testid="v2lx-unknown-recipe" className="v2lx-fb-body">Atividade não suportada.</div>
  return <Renderer key={props.plan.activity_id} {...props} />
}
