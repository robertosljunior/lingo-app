import { useApp } from '../store.jsx'
import { learnerExperienceV2Enabled } from '../lib/pedagogy-v2/learner-experience-mode.js'
import Settings from './Settings.jsx'
import V2Settings from './V2Settings.jsx'

// Product boundary: learner-facing settings must belong to the resolved
// experience. The V2 product never renders CEFR, V1 lesson generation, content
// packs or experimental-lab controls as if they were learner preferences.
export default function SettingsRouter() {
  const { settings } = useApp()
  return learnerExperienceV2Enabled(settings) ? <V2Settings /> : <Settings />
}
