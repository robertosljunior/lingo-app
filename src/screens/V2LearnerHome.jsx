// V2LearnerHome.jsx — Slice V2.18 learner-facing Training home, polished in V2.20
// (§32). When the resolved experience is V2 this REPLACES the V1 Training Hub as
// the primary experience. It is purely learner-facing: greeting, one primary CTA
// and two study entries (Explore / Review). It runs NO Planner, computes NO
// mastery, chooses NO target/pack/capability — every "Praticar agora / Explorar /
// Revisão" simply starts a REAL Study session in the corresponding mode; the V2
// pipeline decides what to study (§4/§44).
//
// It deliberately shows NONE of the V1 truths (themes, A1–B2, "domínio estimado",
// skills) so the learner never sees two pedagogical models at once (§33).
//
// V2.20 §32: the learner hierarchy is greeting + Praticar agora + Explorar +
// Revisão "e pouco mais". Diagnostics and the V1/V2 switch are NOT part of it —
// they live in a clearly separated DEV strip that a production learner never sees.

import { useMemo } from 'react'
import { useApp, SCREENS } from '../store.jsx'
import { BottomNav } from '../components/ui.jsx'
import { buildLearnerHomePresentationV2, buildPracticeCategoriesV2 } from '../lib/pedagogy-v2/learner-home-presentation.js'
import { loadPedagogyV2Registry } from '../lib/pedagogy-v2/registry.js'
import {
  experienceSwitcherAvailable,
  resolveLearnerExperienceMode,
} from '../lib/pedagogy-v2/learner-experience-mode.js'
import V2DevExperienceSwitch from '../components/pedagogy-v2-learner/V2DevExperienceSwitch.jsx'

export default function V2LearnerHome() {
  const { settings, profiles, activeProfile, navigate, setTab, updateSetting } = useApp()

  // Greeting name comes from the EXISTING profile record — no new property.
  const profileName = useMemo(
    () => profiles?.find((p) => p.profile_id === activeProfile)?.name ?? null,
    [profiles, activeProfile],
  )
  const home = useMemo(() => buildLearnerHomePresentationV2({ profileName }), [profileName])
  // V2.21-R2 §19: one entry per authored pack, copy taken from the manifest.
  const categories = useMemo(() => buildPracticeCategoriesV2(loadPedagogyV2Registry()), [])

  // The Home never runs the Planner just to enable a button; it always routes to
  // a real session which resolves to an activity OR a factual empty state.
  const startMode = (mode) => navigate(SCREENS.PEDAGOGY_V2_LEARNER, { mode })
  // Focused practice: the SAME lesson screen and the SAME controller, with the
  // pack pinned. The category chooses the pack, never the sentence (§21/§22).
  const startFocused = (packId) => navigate(SCREENS.PEDAGOGY_V2_LEARNER, { mode: 'focused', pack: packId })

  const devToolsAvailable = experienceSwitcherAvailable(settings)
  const mode = resolveLearnerExperienceMode(settings)

  return (
    // `data-experience` is the V2.20 §42 DEV/test marker proving which product is
    // on screen. It carries no learner-facing meaning and renders nothing.
    <div className="phone v2lx" data-testid="v2lx-home" data-experience="v2" data-surface="home">
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

          {/* Study entries — Explore / Review as real study modes. */}
          <div className="v2lx-action-grid">
            {home.actions.map((a) => (
              <button key={a.mode} type="button" className="v2lx-action-card" data-testid={`v2lxh-action-${a.mode}`} data-mode={a.mode} onClick={() => startMode(a.mode)}>
                <div className="v2lx-action-title">{a.label}</div>
                <div className="v2lx-action-desc">{a.description}</div>
              </button>
            ))}
          </div>

          {/* Escolher prática — a discreet secondary control, never a dashboard:
              no CEFR, no mastery, no technical id (§19/§23). */}
          {categories.length > 0 && (
            <section className="v2lx-categories" aria-label="Escolher prática" data-testid="v2lxh-categories">
              <h2 className="v2lx-categories-title">Escolher prática</h2>
              <div className="v2lx-category-list">
                {categories.map((c) => (
                  <button
                    key={c.pack_id}
                    type="button"
                    className="v2lx-category-card"
                    data-testid={`v2lxh-category-${c.pack_id}`}
                    data-pack={c.pack_id}
                    onClick={() => startFocused(c.pack_id)}
                  >
                    <div className="v2lx-category-label">{c.label}</div>
                    <div className="v2lx-category-desc">{c.description}</div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {home.facts.length > 0 && (
            <div className="v2lx-home-facts" data-testid="v2lxh-facts">
              {home.facts.map((f, i) => (
                <div key={i} className="v2lx-home-fact">{f.text}</div>
              ))}
            </div>
          )}

          {/* DEV strip — visually separated from everything above; never shipped
              to an ordinary learner (§32). */}
          {devToolsAvailable && (
            <div className="v2lx-devstrip" data-testid="v2lxh-devstrip">
              <V2DevExperienceSwitch
                mode={mode}
                onChange={(next) => updateSetting('v2_learner_experience_enabled', next === 'v2')}
              />
              <button type="button" className="v2lx-textbtn" data-testid="v2lxh-tools" onClick={() => navigate(SCREENS.PEDAGOGY_V2_PILOT)}>Ferramentas V2 · diagnóstico</button>
            </div>
          )}
        </div>
      </div>
      <BottomNav active="home" onNavigate={setTab} />
    </div>
  )
}
