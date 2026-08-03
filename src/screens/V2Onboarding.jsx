// V2Onboarding.jsx — Slice V2.22-UX2-R §4. The V2 first-run.
//
// WHY THIS SCREEN EXISTS. Until this slice `App.jsx` rendered the legacy
// onboarding whenever `needsOnboarding` was true — BEFORE it resolved which
// product the learner was in. So the very first second of a clean install was
// always V1: a mascot, a Kids/Adulto choice and a CEFR self-assessment, none of
// which the V2 product believes in. Whatever V2 did afterwards, the app had
// already introduced itself as something else (§3/§16).
//
// What it asks: a name. That is the whole questionnaire.
//
// What it deliberately does NOT ask, and why:
//   - Kids / Adulto — V2 has one register. An audience split would fork copy,
//     illustration and tone for a product that has none of those forks.
//   - CEFR / "quanto de inglês você sabe" — a self-declared band is not
//     evidence. The Learner Model is built from what the learner actually does,
//     and starting it from a guess would make the first sessions dishonest.
//   - "qual palavra você quer estudar" — the Home navigates by CONTEXT (§5);
//     the lexeme is an internal organising key, not a learner-facing choice.
//   - a mascot, an avatar or a character of any kind (§6).
//
// The visual language is the mockup's, through the same tokens every other V2
// surface uses (§9/§10): kicker → condensed display line → body → one filled
// CTA on an otherwise calm page. It runs no Planner and writes no evidence.

import { useState } from 'react'
import { useApp } from '../store.jsx'

const STEPS = ['intro', 'name']

export default function V2Onboarding() {
  const { completeV2Onboarding } = useApp()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const stage = STEPS[step]

  async function finish() {
    if (busy) return
    setBusy(true)
    // No catch that swallows: if the profile cannot be written the button
    // returns to its idle label rather than pretending the account exists.
    try { await completeV2Onboarding({ name }) }
    finally { setBusy(false) }
  }

  return (
    <div className="phone v2lx v2lx-onb" data-testid="v2lx-onboarding" data-experience="v2" data-surface="onboarding" data-step={stage}>
      <div className="v2lx-onb-body">
        <div className="v2lx-onb-head">
          <span className="v2lx-home-logo" aria-hidden="true">A</span>
          <span className="v2lx-kicker">AprendaIdioma</span>
        </div>

        {stage === 'intro' && (
          <div className="v2lx-onb-stage" data-testid="v2lxo-intro">
            <h1 className="v2lx-onb-title">Inglês do jeito que ele aparece.</h1>
            <p className="v2lx-onb-lede">
              Você pratica situações reais — conversas, trabalho, viagens — e o app
              acompanha o que já está firme e o que ainda vale repetir.
            </p>
            {/* Three factual promises about how the product behaves. Not
                features, not levels, not a score: each one is something the
                learner can verify in the first session. */}
            <ul className="v2lx-onb-points">
              <li>Cada sessão é montada na hora, a partir do que você respondeu antes.</li>
              <li>Sem cadastro e sem senha: tudo fica no seu aparelho.</li>
              <li>Funciona offline depois da primeira abertura.</li>
            </ul>
          </div>
        )}

        {stage === 'name' && (
          <div className="v2lx-onb-stage" data-testid="v2lxo-name">
            <h1 className="v2lx-onb-title">Como podemos te chamar?</h1>
            <p className="v2lx-onb-lede">Só para o app falar com você. Pode ser um apelido.</p>
            <label className="v2lx-onb-field">
              <span className="v2lx-kicker">Seu nome</span>
              <input
                data-testid="v2lxo-name-input"
                className="v2lx-onb-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) finish() }}
                placeholder="Seu nome ou apelido"
                maxLength={24}
                autoFocus
                autoComplete="given-name"
                enterKeyHint="go"
              />
            </label>
          </div>
        )}
      </div>

      <div className="v2lx-onb-foot">
        {stage === 'intro' && (
          <button type="button" className="v2lx-onb-cta" data-testid="v2lxo-continue" onClick={() => setStep(1)}>
            Continuar
          </button>
        )}
        {stage === 'name' && (
          <>
            <button type="button" className="v2lx-onb-cta" data-testid="v2lxo-start" onClick={finish} disabled={busy}>
              {busy ? 'Preparando…' : 'Começar a praticar'}
            </button>
            {/* The name is genuinely optional — the field exists so the app can
                address the learner, not to gate the product behind a form. */}
            <button type="button" className="v2lx-textbtn v2lx-onb-skip" data-testid="v2lxo-back" onClick={() => setStep(0)} disabled={busy}>
              Voltar
            </button>
          </>
        )}
      </div>

      {/* Two dots, not a progress bar: the flow is short enough that a
          percentage would overstate it. */}
      <div className="v2lx-onb-dots" aria-hidden="true">
        {STEPS.map((s, i) => (
          <span key={s} className={`v2lx-onb-dot ${i === step ? 'is-on' : ''}`} />
        ))}
      </div>
    </div>
  )
}
