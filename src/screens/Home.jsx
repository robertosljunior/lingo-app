// Home.jsx — V2.20-R §5. The ROOT of the app (SCREENS.HOME) is now a thin
// router, not a screen. Before this cutover it *was* the V1 Home, so opening the
// published app — bottom-nav "Início", closing a lesson, finishing a session —
// always landed on the legacy product even with a perfect V2 underneath (§1).
//
//   resolved experience 'v2' → V2LearnerHome  (default, every environment)
//   resolved experience 'v1' → LegacyHome     (explicit opt-out only)
//
// It renders no JSX of its own: the V2 Home is NOT duplicated here, and the two
// products never mix on one screen (§11).

import { useApp } from '../store.jsx'
import LegacyHome from './LegacyHome.jsx'
import V2LearnerHome from './V2LearnerHome.jsx'
import { learnerExperienceV2Enabled } from '../lib/pedagogy-v2/learner-experience-mode.js'

export default function Home() {
  const { settings } = useApp()
  if (learnerExperienceV2Enabled(settings)) return <V2LearnerHome />
  return <LegacyHome />
}
