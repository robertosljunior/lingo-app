import { useApp, SCREENS } from './store.jsx'
import { Toast } from './components/ui.jsx'
import Home from './screens/Home.jsx'
import Import from './screens/Import.jsx'
import Exercise from './screens/Exercise.jsx'
import Result from './screens/Result.jsx'
import Review from './screens/Review.jsx'
import Export from './screens/Export.jsx'
import History from './screens/History.jsx'
import Mistakes from './screens/Mistakes.jsx'
import SettingsRouter from './screens/SettingsRouter.jsx'
import TrainingHub from './screens/TrainingHub.jsx'
import Stories from './screens/Stories.jsx'
import TalkRouter from './screens/TalkRouter.jsx'
import LegacyOnboarding from './screens/LegacyOnboarding.jsx'
import V2Onboarding from './screens/V2Onboarding.jsx'
import PedagogyV2Lab from './screens/PedagogyV2Lab.jsx'
import PedagogyV2Inspector from './screens/PedagogyV2Inspector.jsx'
import PedagogyV2Playground from './screens/PedagogyV2Playground.jsx'
import V2LessonExperience from './screens/V2LessonExperience.jsx'
import PwaInstallController from './components/PwaInstallController.jsx'
import { learnerExperienceV2Enabled } from './lib/pedagogy-v2/learner-experience-mode.js'

const SCREEN_COMPONENTS = {
  [SCREENS.HOME]: Home,
  [SCREENS.IMPORT]: Import,
  [SCREENS.EXERCISE]: Exercise,
  [SCREENS.RESULT]: Result,
  [SCREENS.REVIEW]: Review,
  [SCREENS.EXPORT]: Export,
  [SCREENS.HISTORY]: History,
  [SCREENS.MISTAKES]: Mistakes,
  [SCREENS.SETTINGS]: SettingsRouter,
  [SCREENS.TRAINING]: TrainingHub,
  [SCREENS.STORIES]: Stories,
  [SCREENS.TALK]: TalkRouter,
  [SCREENS.PEDAGOGY_V2_PILOT]: PedagogyV2Lab,
  [SCREENS.PEDAGOGY_V2_INSPECTOR]: PedagogyV2Inspector,
  [SCREENS.PEDAGOGY_V2_PLAYGROUND]: PedagogyV2Playground,
  [SCREENS.PEDAGOGY_V2_LEARNER]: V2LessonExperience,
}

// Screens that require an active lesson/session; if reached without one, fall
// back to Home rather than crash.
const NEEDS_SESSION = new Set([SCREENS.EXERCISE, SCREENS.RESULT, SCREENS.REVIEW])

export default function App() {
  const { ready, screen, activeLesson, toast, needsOnboarding, settings } = useApp()

  // V2.22-UX2-R §3 — THE CUTOVER DEFECT THIS FIXES. The first-run branch used to
  // run before the experience was resolved and hardcoded the legacy onboarding,
  // so a clean install always opened on V1 — mascot, Kids/Adulto, CEFR — no
  // matter which product it then went on to render. The very first second of the
  // app contradicted the product behind it.
  //
  // The experience is now resolved FIRST, by the same single source of truth
  // that decides everything else (`learner-experience-mode.js`), and the first
  // run belongs to whichever product the learner is actually in:
  //
  //   V2 (default, and explicit true) → V2Onboarding
  //   explicit false                  → LegacyOnboarding
  //
  // The condition is deliberately the resolver and not `settings?.x === false`
  // inline: there is exactly one place in the codebase that decides V1 vs V2.
  if (ready && needsOnboarding) {
    const V2 = learnerExperienceV2Enabled(settings)
    return (
      <div className="app-shell" data-experience={V2 ? 'v2' : 'v1'}>
        {V2 ? <V2Onboarding /> : <LegacyOnboarding />}
        <Toast show={!!toast}>{toast}</Toast>
      </div>
    )
  }

  // The very first paint of a clean install, before settings are read. It is
  // styled in the V2 language rather than the legacy one because that is what
  // resolves a moment later in every environment (§16: the first second must
  // already be the new product). Its ground comes from the V2 tokens, so it
  // does not flash a different colour into the onboarding behind it.
  if (!ready) {
    return (
      <div className="app-shell" data-experience="v2">
        <div className="phone v2lx v2lx-boot" data-testid="app-boot">
          <div className="v2lx-boot-label">Carregando…</div>
        </div>
      </div>
    )
  }

  let active = screen
  if (NEEDS_SESSION.has(active) && !activeLesson) active = SCREENS.HOME
  const Screen = SCREEN_COMPONENTS[active] || Home

  return (
    <div className="app-shell" data-experience={learnerExperienceV2Enabled(settings) ? 'v2' : 'v1'}>
      {/* key forces a remount per screen so the entrance animation replays */}
      <Screen key={active} />
      <PwaInstallController />
      <Toast show={!!toast}>{toast}</Toast>
    </div>
  )
}
