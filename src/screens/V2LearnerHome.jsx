// V2LearnerHome.jsx — Slice V2.18 learner-facing Training home. When
// `v2_learner_experience_enabled` is ON, this REPLACES the V1 Training Hub as the
// primary experience. It is purely learner-facing: greeting, one primary CTA and
// two study entries (Explore / Review). It runs NO Planner, computes NO mastery,
// chooses NO target/pack/capability — every "Praticar agora / Explorar / Revisão"
// simply starts a REAL Study session in the corresponding mode; the V2 pipeline
// decides what to study (§4/§8/§9/§10/§15).
//
// It deliberately shows NONE of the V1 truths (themes, A1–B2, "domínio estimado",
// skills) so the learner never sees two pedagogical models at once (§21/§22).

import { useMemo } from 'react'
import { useApp, SCREENS } from '../store.jsx'
import { BottomNav } from '../components/ui.jsx'
import { buildLearnerHomePresentationV2 } from '../lib/pedagogy-v2/learner-home-presentation.js'

export function v2LearnerHomeEnabled(settings) {
  return !!settings?.v2_learner_experience_enabled
}

export default function V2LearnerHome() {
  const { settings, profiles, activeProfile, navigate, setTab } = useApp()

  // Greeting name comes from the EXISTING profile record — no new property (§24).
  const profileName = useMemo(
    () => profiles?.find((p) => p.profile_id === activeProfile)?.name ?? null,
    [profiles, activeProfile],
  )
  const home = useMemo(() => buildLearnerHomePresentationV2({ profileName }), [profileName])

  // The Home never runs the Planner just to enable a button; it always routes to
  // a real session which resolves to an activity OR a factual empty state (§16).
  const startMode = (mode) => navigate(SCREENS.PEDAGOGY_V2_LEARNER, { mode })

  // Diagnostics stay reachable via a discreet secondary link (§26) — never the
  // primary hierarchy for the ordinary learner.
  const diagnosticsAvailable = !!(settings?.pedagogy_v2_pilot_enabled || settings?.pedagogy_v2_diagnostics_enabled || import.meta.env?.DEV)

  return (
    <div className="phone v2lx" data-testid="v2lx-home">
      <div className="v2lx-scroll" style={{ paddingBottom: 100 }}>
        <div className="v2lx-content">
          <div className="v2lx-home-head">
            <div className="v2lx-home-brand"><span className="v2lx-home-logo" aria-hidden="true">A</span>AprendaIdioma</div>
          </div>

          <div className="v2lx-greeting" data-testid="v2lxh-greeting">{home.greeting}</div>
          <h1 className="v2lx-home-title">{home.subhead}</h1>

          {/* HERO — the single primary CTA (adaptive). */}
          <section className="v2lx-hero" aria-label="Praticar agora">
            <div className="v2lx-hero-eyebrow">{home.primary_action.description}</div>
            <button type="button" className="v2lx-hero-cta" data-testid="v2lxh-primary" data-mode={home.primary_action.mode} onClick={() => startMode(home.primary_action.mode)}>
              {home.primary_action.label}
            </button>
          </section>

          {/* Study entries — Explore / Review as real study modes (§9/§10). */}
          <div className="v2lx-action-grid">
            {home.actions.map((a) => (
              <button key={a.mode} type="button" className="v2lx-action-card" data-testid={`v2lxh-action-${a.mode}`} data-mode={a.mode} onClick={() => startMode(a.mode)}>
                <div className="v2lx-action-title">{a.label}</div>
                <div className="v2lx-action-desc">{a.description}</div>
              </button>
            ))}
          </div>

          {home.facts.length > 0 && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="v2lxh-facts">
              {home.facts.map((f, i) => (
                <div key={i} className="v2lx-fb-body" style={{ color: 'var(--v2-muted)' }}>{f.text}</div>
              ))}
            </div>
          )}

          {diagnosticsAvailable && (
            <div className="v2lx-home-tools">
              <button type="button" className="v2lx-textbtn" data-testid="v2lxh-tools" onClick={() => navigate(SCREENS.PEDAGOGY_V2_PILOT)}>Ferramentas V2</button>
            </div>
          )}
        </div>
      </div>
      <BottomNav active="home" onNavigate={setTab} />
    </div>
  )
}
