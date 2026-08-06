import { lazy, Suspense } from 'react'
import { useApp, SCREENS } from './store.jsx'
import { Toast } from './components/ui.jsx'
import Home from './screens/Home.jsx'
import V2Onboarding from './screens/V2Onboarding.jsx'
import PwaInstallController from './components/PwaInstallController.jsx'
import { learnerExperienceV2Enabled } from './lib/pedagogy-v2/learner-experience-mode.js'

// RX-8B: the application previously imported every V1/V2 screen at boot. That
// made ordinary V2 Home visits download legacy lessons, Stories, Talk, Settings,
// diagnostic labs and the full exercise surface before any of them was needed.
// Keep only the default Home and V2 first-run path eager; every other product
// surface is a route-level chunk loaded when the store actually selects it.
const ImportScreen = lazy(() => import('./screens/Import.jsx'))
const Exercise = lazy(() => import('./screens/Exercise.jsx'))
const Result = lazy(() => import('./screens/Result.jsx'))
const Review = lazy(() => import('./screens/Review.jsx'))
const ExportScreen = lazy(() => import('./screens/Export.jsx'))
const History = lazy(() => import('./screens/History.jsx'))
const Mistakes = lazy(() => import('./screens/Mistakes.jsx'))
const SettingsRouter = lazy(() => import('./screens/SettingsRouter.jsx'))
const TrainingHub = lazy(() => import('./screens/TrainingHub.jsx'))
const Stories = lazy(() => import('./screens/Stories.jsx'))
const TalkRouter = lazy(() => import('./screens/TalkRouter.jsx'))
const LegacyOnboarding = lazy(() => import('./screens/LegacyOnboarding.jsx'))
const PedagogyV2Lab = lazy(() => import('./screens/PedagogyV2Lab.jsx'))
const PedagogyV2Inspector = lazy(() => import('./screens/PedagogyV2Inspector.jsx'))
const PedagogyV2Playground = lazy(() => import('./screens/PedagogyV2Playground.jsx'))
const V2LessonExperience = lazy(() => import('./screens/V2LessonExperience.jsx'))

const SCREEN_COMPONENTS = {
  [SCREENS.HOME]: Home,
  [SCREENS.IMPORT]: ImportScreen,
  [SCREENS.EXERCISE]: Exercise,
  [SCREENS.RESULT]: Result,
  [SCREENS.REVIEW]: Review,
  [SCREENS.EXPORT]: ExportScreen,
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

function ScreenLoading() {
  return (
    <div className="phone v2lx v2lx-boot" data-testid="screen-loading" aria-live="polite">
      <div className="v2lx-boot-label">Carregando…</div>
    </div>
  )
}

export default function App() {
  const { ready, screen, activeLesson, toast, needsOnboarding, settings } = useApp()

  // V2.22-UX2-R §3 — resolve the product before choosing first-run UI. V2 is
  // eager because it is the production default; legacy onboarding is fetched
  // only for the explicit rollback experience.
  if (ready && needsOnboarding) {
    const V2 = learnerExperienceV2Enabled(settings)
    return (
      <div className="app-shell" data-experience={V2 ? 'v2' : 'v1'}>
        <Suspense fallback={<ScreenLoading />}>
          {V2 ? <V2Onboarding /> : <LegacyOnboarding />}
        </Suspense>
        <Toast show={!!toast}>{toast}</Toast>
      </div>
    )
  }

  // The very first paint of a clean install, before settings are read. It is
  // styled in the V2 language because V2 is the default product.
  if (!ready) {
    return (
      <div className="app-shell" data-experience="v2">
        <ScreenLoading />
      </div>
    )
  }

  let active = screen
  if (NEEDS_SESSION.has(active) && !activeLesson) active = SCREENS.HOME
  const Screen = SCREEN_COMPONENTS[active] || Home

  return (
    <div className="app-shell" data-experience={learnerExperienceV2Enabled(settings) ? 'v2' : 'v1'}>
      <Suspense fallback={<ScreenLoading />}>
        {/* key forces a remount per screen so the entrance animation replays */}
        <Screen key={active} />
      </Suspense>
      <PwaInstallController />
      <Toast show={!!toast}>{toast}</Toast>
    </div>
  )
}
