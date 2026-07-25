// V2LearnerActivity.jsx — learner-facing activity renderers, re-skinned in Slice
// V2.20 to the Prototype/Polish-Pass visual language.
//
// They REUSE the existing V2 runtime logic (response contracts, masking, token
// order, mic, audio) — they never re-implement validation or assessment, never
// re-shuffle data the Engine already ordered (§43), and never decide anything
// pedagogical. Only the visual layer changed.
//
// The V2.20 rules applied throughout (§3/§5/§6):
//   • MENOS CONTAINER, MAIS CONTEÚDO — no white card behind a sentence anywhere;
//   • one unambiguous hierarchy: kicker → instruction → SENTENCE → translation →
//     interaction → feedback → CTA;
//   • the kicker is discreet and never competes with the protagonist;
//   • each recipe has a perceptible identity without becoming a different app.
//
// The primary CTA (Verificar/Continuar) lives in the shell footer; recipes that
// need a submit report their current payload up via `onSubmittable`, recognition
// submits on tap.

import { useEffect, useState } from 'react'
import { buildMaskedCompletion, presentedOrderTokens } from '../../lib/pedagogy-v2/activity-runtime-contracts.js'
import { MicButton } from '../mic-button.jsx'
import V2Sentence from './V2Sentence.jsx'
import V2AudioControl from './V2AudioControl.jsx'

// ---- Exposure (§7) — observation, not a question -----------------------------
// Structure: kicker → sentence (34px, on the background) → translation → audio
// pill → "Observe" as a caption with an accent rule. No sentence card, no big
// blue "Observe" box, no Verificar. The CTA is Continuar (owned by the shell).
function ExposureActivity({ plan, capabilities, settings, onSupport }) {
  return (
    <div data-testid="v2lx-activity-exposure" data-recipe="exposure" style={{ textAlign: 'center', paddingTop: 24 }}>
      <div className="v2lx-kicker" style={{ marginBottom: 14 }}>Observe esta frase</div>

      <V2Sentence variant="exposure" data-testid="v2lx-sentence" style={{ marginBottom: 14 }}>{plan.text_en}</V2Sentence>

      {plan.text_pt && <div className="v2lx-translation" style={{ fontSize: 17, marginBottom: 18 }}>{plan.text_pt}</div>}

      {!!capabilities?.audio_output && (
        <V2AudioControl variant="pill" text={plan.text_en} settings={settings} available onReplay={() => onSupport('audio_replay')} />
      )}

      {plan.context && (
        <div className="v2lx-accent" data-accent="observe" style={{ marginTop: 28 }} data-testid="v2lx-observe">
          <span className="v2lx-accent-label">Observe </span>
          <span className="v2lx-translation" style={{ fontSize: 14, color: 'var(--v2-muted)' }}>{plan.context}</span>
        </div>
      )}
    </div>
  )
}

// ---- Recognition (§8/§9/§10) — tap = answer ----------------------------------
// One renderer serves meaning_recognition, listening_recognition and the V2.19
// context_recognition, because they share a contract (single_choice over authored
// options) and differ only in what the STIMULUS is. Each keeps a distinct visual
// identity: a written question, an audio-first stimulus, or a situation choice.
function RecognitionActivity({ plan, capabilities, settings, busy, answered, assessment, onSubmit, onSupport }) {
  const [chosen, setChosen] = useState(null)
  const showEnglish = (plan.presentation.show || []).includes('text_en')
  const isListening = plan.recipe === 'listening_recognition'
  // §9 — context_recognition asks WHICH situation fits. The exemplar's authored
  // context IS the answer, so it must never be rendered above the options; the
  // V2.19 contract is preserved verbatim (the options carry the contexts).
  const isContext = plan.recipe === 'context_recognition'

  // After the answer the assessment tells us which option was expected — mark it
  // so the learner sees the target without leaking any id.
  const correctId = assessment?.feedback?.correct_option_id ?? null
  const chosenId = assessment?.feedback?.chosen_option_id ?? chosen

  const pick = (optionId) => {
    if (answered || busy) return
    setChosen(optionId)
    onSubmit('single_choice', { option_id: optionId }) // evaluate on tap
  }

  const kicker = isListening ? 'Ouça e escolha' : isContext ? 'Escolha a situação' : 'Reconhecer o sentido'
  // The question is the protagonist — and it is AUTHORED BY THE ENGINE
  // (`presentation.instructions_pt`), never composed in React. §8 removed the
  // redundant "Toque na opção correta." line that used to sit under it; the
  // buttons already read as tappable.
  const question = plan.presentation.instructions_pt

  return (
    <div data-testid={`v2lx-activity-${plan.recipe}`} data-recipe={plan.recipe} style={{ paddingTop: 10 }}>
      <div className="v2lx-kicker" style={{ marginBottom: 10 }}>{kicker}</div>

      {/* §6 — exactly ONE protagonist. When the plan shows the English sentence
          (meaning / context recognition), THAT is the stimulus, so the authored
          instruction steps down to a secondary line above it. When there is no
          sentence to show (listening), the question itself is the protagonist. */}
      {question && (showEnglish
        ? <p className="v2lx-instruction" data-testid="v2lx-prompt">{question}</p>
        : (
          <V2Sentence variant="prompt" as="h2" data-testid="v2lx-prompt" style={{ marginBottom: isListening ? 16 : 22 }}>
            {question}
          </V2Sentence>
        )
      )}

      {/* §9/§10 — the English sentence appears ONLY when the plan's own
          presentation contract lists it (`show` includes 'text_en'). Listening
          declares `show: []`, so the target text is never revealed before the
          answer. For context_recognition the sentence is the STIMULUS being
          situated; the correct context lives only inside the options, and the
          exemplar's authored context is never rendered above them (§9). */}
      {showEnglish && (
        <V2Sentence variant="exposure" data-testid="v2lx-sentence" style={{ marginBottom: 26 }}>{plan.text_en}</V2Sentence>
      )}

      {isListening && (
        <div style={{ textAlign: 'center', margin: '6px 0 26px' }}>
          <V2AudioControl variant="hero" text={plan.text_en} settings={settings} available={!!capabilities?.audio_output}
            onReplay={() => onSupport('audio_replay')} label="Ouvir" />
        </div>
      )}

      <div role="radiogroup" aria-label="Alternativas" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
              className={`v2lx-option${isContext ? ' v2lx-option--context' : ''}`}
              data-testid={`v2lx-option-${o.option_id}`}
              role="radio"
              aria-checked={chosenId === o.option_id}
              data-result={result || undefined}
              data-dim={dim || undefined}
              disabled={answered || busy}
              onClick={() => pick(o.option_id)}
            >
              <span>{o.text_pt}</span>
              {/* §8/§37 — state is never carried by colour alone. */}
              {result === 'correct' && <span className="v2lx-option-glyph" aria-label="correta" style={{ color: 'var(--v2-fb-correct)' }}>✓</span>}
              {result === 'wrong' && <span className="v2lx-option-glyph" aria-label="sua escolha" style={{ color: 'var(--v2-fb-linguistic)' }}>✕</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---- Completion (§11) — the gap is part of the sentence ----------------------
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
    <div data-testid="v2lx-activity-completion" data-recipe="fixed_element_completion" style={{ paddingTop: 20, textAlign: 'center' }}>
      <div className="v2lx-kicker" style={{ marginBottom: 18 }} data-testid="v2lx-kicker">{plan.presentation.instructions_pt}</div>

      {/* No card: the sentence sits on the background and the slot is visually
          PART of it — never an input inside a form (§11). */}
      <V2Sentence variant="completion" data-testid="v2lx-sentence" style={{ marginBottom: 12 }}>
        {parts[0]}
        <span className="v2lx-slot" data-testid="v2lx-slot" data-filled={value ? 'true' : undefined}>{value || '    '}</span>
        {parts.slice(1).join('_____')}
      </V2Sentence>

      {plan.text_pt && <div className="v2lx-translation" style={{ fontSize: 15, marginBottom: 26 }}>{plan.text_pt}</div>}

      {hasWordBank && (
        <div data-testid="v2lx-word-bank" className="v2lx-bank" style={{ marginTop: 0 }}>
          {expected_tokens.map((t, i) => (
            <button key={i} type="button" className="v2lx-chip" data-selected={value === t || undefined}
              disabled={answered || busy} onClick={() => setValue(t)}>{t}</button>
          ))}
        </div>
      )}
      {!hasWordBank && (
        <input className="v2lx-input" data-testid="v2lx-completion-input" value={value} disabled={answered || busy}
          placeholder="Complete a frase" aria-label="Resposta" onChange={(e) => setValue(e.target.value)} />
      )}

      {!answered && !revealed && (
        <button type="button" className="v2lx-textbtn" data-testid="v2lx-reveal" style={{ display: 'block', margin: '14px auto 0' }}
          disabled={busy} onClick={() => { setRevealed(true); onSupport('answer_reveal') }}>Ver a resposta</button>
      )}
      {revealed && <div className="v2lx-translation" data-testid="v2lx-revealed" style={{ marginTop: 10 }}>Resposta: <b style={{ color: 'var(--v2-ink)' }}>{plan.text_en}</b></div>}
    </div>
  )
}

// ---- Word order (§12) — tap to build ----------------------------------------
// The bank order comes from `presentation.presented_tokens` via the runtime
// contract (V2.19 seeded shuffle). The component NEVER re-shuffles (§43).
function WordOrderActivity({ plan, busy, answered, onSubmittable }) {
  const bank = presentedOrderTokens(plan).map((t, i) => ({ t, i }))
  const [picked, setPicked] = useState([])
  const remaining = bank.filter((b) => !picked.includes(b.i))
  useEffect(() => {
    const complete = picked.length === bank.length && bank.length > 0
    onSubmittable(complete ? { type: 'token_sequence', payload: { tokens: picked.map((i) => bank.find((x) => x.i === i).t) } } : null)
  }, [picked]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div data-testid="v2lx-activity-word-order" data-recipe="word_order_reconstruction" style={{ paddingTop: 10 }}>
      <div className="v2lx-kicker" style={{ marginBottom: 10 }}>Montar a frase</div>
      <V2Sentence variant="prompt" as="h2" data-testid="v2lx-prompt" style={{ marginBottom: 6 }}>{plan.presentation.instructions_pt}</V2Sentence>
      {plan.text_pt && <div className="v2lx-translation" style={{ fontSize: 14, marginBottom: 22 }}>{plan.text_pt}</div>}

      {/* Thin single border, no inset shadow; whitespace (not a dashed rule)
          separates the built sentence from the bank (§12). */}
      <div className="v2lx-build" data-testid="v2lx-token-answer" aria-label="Sua frase">
        {picked.length === 0 && <span className="v2lx-build-empty">Toque nas palavras para montar</span>}
        {picked.map((i) => {
          const b = bank.find((x) => x.i === i)
          return <button key={i} type="button" className="v2lx-chip v2lx-chip--placed" disabled={answered || busy} aria-label={`Remover ${b.t}`} onClick={() => setPicked((p) => p.filter((x) => x !== i))}>{b.t}</button>
        })}
      </div>

      <div className="v2lx-bank" data-testid="v2lx-token-bank" aria-label="Palavras disponíveis">
        {remaining.map((b) => (
          <button key={b.i} type="button" className="v2lx-chip" data-testid={`v2lx-token-${b.i}`} disabled={answered || busy} onClick={() => setPicked((p) => [...p, b.i])}>{b.t}</button>
        ))}
      </div>
    </div>
  )
}

// ---- Speaking control (§15) — idle/listening/result --------------------------
// COMPATIBILITY ONLY. V2.20 adds no voice mechanism: no ASR, no acoustic score,
// no phoneme assessment. The visual state is kept coherent and the sentence lost
// its card like everywhere else (§5); nothing else about speech changed.
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
    <div data-testid="v2lx-activity-speaking" data-recipe="speaking" style={{ paddingTop: 16, textAlign: 'center' }}>
      <div className="v2lx-kicker" style={{ marginBottom: 18 }}>Prática de fala</div>

      <V2Sentence variant="speaking" data-testid="v2lx-sentence" style={{ marginBottom: 32 }}>{plan.text_en}</V2Sentence>

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
        <div className="v2lx-translation" data-testid="v2lx-stt-unavailable">Reconhecimento de fala indisponível neste dispositivo.</div>
      )}

      {transcript != null && (
        <div className="v2lx-translation" data-testid="v2lx-transcript" style={{ marginTop: 18, fontStyle: 'italic' }}>“{transcript}”</div>
      )}

      {/* §15 — pronunciation with no acoustic assessor is PRACTICE, never a
          score. No percentage, no "pronúncia correta", ever. */}
      {isPronunciation && !hasAcoustic && (
        <div className="v2lx-translation" data-testid="v2lx-speaking-practice" style={{ marginTop: 12, fontSize: 13 }}>Prática de fala — sem nota de pronúncia.</div>
      )}
    </div>
  )
}

// ---- Production writing (§13/§14) --------------------------------------------
// Guided and Free share ONE structural family and are told apart by the accent
// rule colour (blue = still on the rail, violet = off the rail) plus their own
// kicker text — never by a whole second layout, and never by colour alone (§37).
function ProductionActivity({ plan, capabilities, busy, answered, onSubmittable, onSubmit, onSupport }) {
  const speaking = plan.modality === 'speaking'
  if (speaking) {
    return <SpeakingControl plan={plan} capabilities={capabilities} busy={busy} answered={answered} isPronunciation={false} onSubmittable={onSubmittable} onSubmit={onSubmit} />
  }
  const [value, setValue] = useState('')
  const [hintShown, setHintShown] = useState(false)
  const features = plan.support.features || []
  const isFree = plan.recipe === 'free_production'
  const accent = isFree ? 'free' : 'guided'
  useEffect(() => {
    onSubmittable(value.trim() ? { type: 'text', payload: { text: value } } : null)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div data-testid={`v2lx-activity-${plan.recipe}`} data-recipe={plan.recipe} data-accent={accent} style={{ paddingTop: 10 }}>
      <div className="v2lx-kicker" style={{ marginBottom: 12 }}>{isFree ? 'Produção livre' : 'Produção guiada'}</div>

      {/* Accent RULE, not a filled card (§13/§14). */}
      <div className="v2lx-accent" data-accent={accent} data-testid="v2lx-prompt-accent" style={{ marginBottom: isFree ? 30 : 22 }}>
        <V2Sentence variant="prompt" as="h2" data-testid="v2lx-prompt">{plan.context || plan.text_pt}</V2Sentence>

        {/* Support is a plain line with a "◦" marker — never a pill in a card. */}
        {features.includes('model_sentence') && plan.presentation.model_reference && (
          <div className="v2lx-support" data-testid="v2lx-model"><span className="v2lx-support-dot" aria-hidden="true">◦</span>Modelo: {plan.text_en}</div>
        )}
      </div>

      {isFree && features.includes('hint') && !hintShown && (
        <button type="button" className="v2lx-textbtn" data-testid="v2lx-hint" style={{ padding: '4px 0', display: 'block' }}
          disabled={busy} onClick={() => { setHintShown(true); onSupport('hint') }}>Ver uma dica</button>
      )}
      {hintShown && <div className="v2lx-support" data-testid="v2lx-hint-text"><span className="v2lx-support-dot" aria-hidden="true">◦</span>Dica: {plan.text_pt}</div>}

      {/* The textarea is the protagonist of the interaction: no full border, just
          a bottom rule that thickens to 3px on focus so the focus state is
          unmistakable (handoff §8 / spec §37). */}
      <textarea
        className="v2lx-write"
        data-testid="v2lx-production-input"
        data-accent={accent}
        rows={isFree ? 4 : 3}
        value={value}
        disabled={answered || busy}
        placeholder="Escreva sua resposta em inglês…"
        aria-label="Resposta em inglês"
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  )
}

// ---- Pronunciation (§15) — compatibility, no acoustic score ------------------
function PronunciationActivity({ plan, capabilities, settings, busy, answered, onSubmittable, onSubmit, onSupport }) {
  return (
    <div data-testid="v2lx-activity-pronunciation" data-recipe="pronunciation">
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <V2AudioControl variant="pill" text={plan.text_en} settings={settings} available={!!capabilities?.audio_output} onReplay={() => onSupport('audio_replay')} />
      </div>
      <SpeakingControl plan={plan} capabilities={capabilities} busy={busy} answered={answered} isPronunciation onSubmittable={onSubmittable} onSubmit={onSubmit} />
    </div>
  )
}

const RENDERERS = {
  exposure: ExposureActivity,
  meaning_recognition: RecognitionActivity,
  listening_recognition: RecognitionActivity,
  // V2.19 recipe — a real visual recipe in V2.20 (§9), sharing the recognition
  // contract it was authored against.
  context_recognition: RecognitionActivity,
  fixed_element_completion: CompletionActivity,
  word_order_reconstruction: WordOrderActivity,
  guided_production: ProductionActivity,
  free_production: ProductionActivity,
  pronunciation: PronunciationActivity,
}

export default function V2LearnerActivity(props) {
  const Renderer = RENDERERS[props.plan?.recipe]
  if (!Renderer) return <div data-testid="v2lx-unknown-recipe" className="v2lx-translation">Atividade não suportada.</div>
  return <Renderer key={props.plan.activity_id} {...props} />
}
