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
import Settings from './screens/Settings.jsx'
import TrainingHub from './screens/TrainingHub.jsx'
import PwaInstallController from './components/PwaInstallController.jsx'

const SCREEN_COMPONENTS = {
  [SCREENS.HOME]: Home,
  [SCREENS.IMPORT]: Import,
  [SCREENS.EXERCISE]: Exercise,
  [SCREENS.RESULT]: Result,
  [SCREENS.REVIEW]: Review,
  [SCREENS.EXPORT]: Export,
  [SCREENS.HISTORY]: History,
  [SCREENS.MISTAKES]: Mistakes,
  [SCREENS.SETTINGS]: Settings,
  [SCREENS.TRAINING]: TrainingHub,
}

// Screens that require an active lesson/session; if reached without one, fall
// back to Home rather than crash.
const NEEDS_SESSION = new Set([SCREENS.EXERCISE, SCREENS.RESULT, SCREENS.REVIEW])

export default function App() {
  const { ready, screen, activeLesson, toast } = useApp()

  if (!ready) {
    return (
      <div className="app-shell">
        <div className="phone" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: 'var(--ink-3)', fontWeight: 700, fontSize: 14 }}>Carregando…</div>
        </div>
      </div>
    )
  }

  let active = screen
  if (NEEDS_SESSION.has(active) && !activeLesson) active = SCREENS.HOME
  const Screen = SCREEN_COMPONENTS[active] || Home

  return (
    <div className="app-shell">
      {/* key forces a remount per screen so the entrance animation replays */}
      <Screen key={active} />
      <PwaInstallController />
      <Toast show={!!toast}>{toast}</Toast>
    </div>
  )
}
