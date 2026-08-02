// V2LearnerHome.jsx — Slice V2.22-UX2. The CONTEXTUAL learner Home.
//
// What changed and why (§1/§2/§22): the previous Home derived one learner-facing
// card per authored content pack, so the learner was asked to decide "do I want
// to study `still`, `but` or `yet` today?". Nobody opens a language app with
// that thought. `still`, `but` and `yet` still exist — they organise the
// curriculum internally and focused mode still reaches them for diagnostics —
// but they are no longer a navigation choice.
//
// The Home now navigates by CONTEXT: authored Practice Collections that each
// span several internal packs. Tapping one opens the SAME lesson screen and the
// SAME controller as "Praticar agora", with an optional authored scope (§5).
//
// It still runs NO Planner, computes NO mastery and chooses NO target, recipe or
// exemplar. It shows no mascot, no path of bubbles, no XP, no CEFR and no
// percentage — the personality is typography, rhythm and hierarchy (§8).

import { useMemo, useState } from 'react'
import { useApp, SCREENS } from '../store.jsx'
import { BottomNav } from '../components/ui.jsx'
import {
  buildLearnerHomePresentationV2,
  buildPracticeCollectionCatalogV2,
  buildRecipePreferenceOptionsV2,
} from '../lib/pedagogy-v2/learner-home-presentation.js'
import {
  experienceSwitcherAvailable,
  resolveLearnerExperienceMode,
} from '../lib/pedagogy-v2/learner-experience-mode.js'
import V2DevExperienceSwitch from '../components/pedagogy-v2-learner/V2DevExperienceSwitch.jsx'

// Abstract, thin-stroke context marks. Geometry only — no character, no animal,
// no avatar (§8). Unknown roles fall back to the neutral mark.
const CONTEXT_MARKS = {
  conversation: 'M3 13a7 7 0 0 1 7-7h4a7 7 0 0 1 0 14h-6l-5 3z',
  work: 'M3 8h18v11H3zM8 8V5h8v3',
  route: 'M6 20V9a3 3 0 0 1 3-3h6a3 3 0 0 0 3-3M6 20h12',
  decision: 'M12 3v7m0 0-5 5m5-5 5 5M7 15v6m10-6v6',
  idea: 'M9 18h6M10 21h4M12 3a6 6 0 0 1 4 10.5V16H8v-2.5A6 6 0 0 1 12 3z',
  context: 'M4 6h16M4 12h16M4 18h10',
}

function ContextMark({ role }) {
  return (
    <svg className="v2lx-context-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={CONTEXT_MARKS[role] || CONTEXT_MARKS.context} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function V2LearnerHome() {
  const { settings, profiles, activeProfile, navigate, setTab, updateSetting } = useApp()
  const [catalogExpanded, setCatalogExpanded] = useState(false)

  const profileName = useMemo(
    () => profiles?.find((p) => p.profile_id === activeProfile)?.name ?? null,
    [profiles, activeProfile],
  )
  const home = useMemo(() => buildLearnerHomePresentationV2({ profileName }), [profileName])
  // The contextual catalogue. Authored copy only — it carries no pack id, so no
  // technical label can reach the screen even by mistake (§28.6).
  const catalog = useMemo(() => buildPracticeCollectionCatalogV2(undefined, { expanded: catalogExpanded }), [catalogExpanded])
  const formats = useMemo(() => buildRecipePreferenceOptionsV2(), [])

  // Slicing and the "show the rest" label are the adapter's call (§21); the
  // component only renders what it is handed.
  const collections = catalog.collections
  const visible = catalog.visible
  const hiddenCount = catalog.hidden_count

  // Every entry point below routes to the SAME lesson screen and the same real
  // controller. The Home never plans; it only says which session to start.
  const startMode = (mode) => navigate(SCREENS.PEDAGOGY_V2_LEARNER, { mode })
  // A context is an optional SCOPE on the real adaptive session — not a new
  // mode, not a playlist and not a promise of how many exercises will come (§6/§17).
  const startCollection = (collectionId, format) => navigate(SCREENS.PEDAGOGY_V2_LEARNER, {
    mode: 'adaptive',
    collection: collectionId,
    ...(format && format !== 'mixed' ? { format } : {}),
  })

  const devToolsAvailable = experienceSwitcherAvailable(settings)
  const mode = resolveLearnerExperienceMode(settings)

  return (
    <div className="phone v2lx" data-testid="v2lx-home" data-experience="v2" data-surface="home" data-home-version="ux2">
      <div className="v2lx-scroll" style={{ paddingBottom: 100 }}>
        <div className="v2lx-content">
          <div className="v2lx-home-head">
            <div className="v2lx-home-brand"><span className="v2lx-home-logo" aria-hidden="true">A</span>AprendaIdioma</div>
          </div>

          <div className="v2lx-greeting" data-testid="v2lxh-greeting">{home.greeting}</div>
          <h1 className="v2lx-home-title">{home.subhead}</h1>

          {/* A — Praticar agora. The one primary CTA, adaptive, no promise of
              resuming anything (§9.A). */}
          <section className="v2lx-hero" aria-label="Praticar agora">
            <div className="v2lx-hero-eyebrow">{home.primary_action.description}</div>
            <button type="button" className="v2lx-hero-cta" data-testid="v2lxh-primary" data-mode={home.primary_action.mode} onClick={() => startMode(home.primary_action.mode)}>
              {home.primary_action.label}
            </button>
          </section>

          {/* B — Praticar por contexto. The real navigation layer: situations,
              never packs (§2/§9.B). */}
          {collections.length > 0 && (
            <section className="v2lx-contexts" aria-label="Praticar por contexto" data-testid="v2lxh-contexts">
              <h2 className="v2lx-section-title">Praticar por contexto</h2>
              <div className="v2lx-context-list">
                {visible.map((c) => (
                  <div key={c.collection_id} className="v2lx-context-card" data-testid={`v2lxh-collection-${c.collection_id}`}>
                    <button
                      type="button"
                      className="v2lx-context-main"
                      data-testid={`v2lxh-collection-open-${c.collection_id}`}
                      onClick={() => startCollection(c.collection_id, 'mixed')}
                    >
                      <ContextMark role={c.icon_role} />
                      <span className="v2lx-context-copy">
                        <span className="v2lx-context-title">{c.title}</span>
                        <span className="v2lx-context-desc">{c.description}</span>
                      </span>
                    </button>
                    {/* Format is a SECONDARY control inside the context, never a
                        category of its own (§12). This is what makes "montar
                        frases" discoverable at all — the learner can see that
                        the format exists without needing the Planner to offer
                        it first (§11). */}
                    <div className="v2lx-format-row">
                      <span className="v2lx-format-lead">{formats.lead_in}</span>
                      {formats.options.filter((f) => f.format !== 'mixed').map((f) => (
                        <button
                          key={f.format}
                          type="button"
                          className="v2lx-format-chip"
                          data-testid={`v2lxh-format-${c.collection_id}-${f.format}`}
                          data-format={f.format}
                          onClick={() => startCollection(c.collection_id, f.format)}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {hiddenCount > 0 && (
                <button type="button" className="v2lx-textbtn v2lx-context-more" data-testid="v2lxh-contexts-more" onClick={() => setCatalogExpanded(true)}>
                  {catalog.more_label}
                </button>
              )}
            </section>
          )}

          {/* C — Revisão e Explorar. Real study modes, clearly secondary (§9.C). */}
          <section className="v2lx-secondary" aria-label="Revisão e Explorar">
            <div className="v2lx-action-grid">
              {home.actions.map((a) => (
                <button key={a.mode} type="button" className="v2lx-action-card" data-testid={`v2lxh-action-${a.mode}`} data-mode={a.mode} onClick={() => startMode(a.mode)}>
                  <div className="v2lx-action-title">{a.label}</div>
                  <div className="v2lx-action-desc">{a.description}</div>
                </button>
              ))}
            </div>
          </section>

          {/* D — facts. Only objectively derivable ones ever appear here; the
              Home invents none, so no mastery / CEFR / XP / percentage (§9.D). */}
          {home.facts.length > 0 && (
            <div className="v2lx-home-facts" data-testid="v2lxh-facts">
              {home.facts.map((f, i) => (
                <div key={i} className="v2lx-home-fact">{f.text}</div>
              ))}
            </div>
          )}

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
