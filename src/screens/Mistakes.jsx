import { useApp } from '../store.jsx'
import LegacyMistakes from './LegacyMistakes.jsx'
import V2ReviewPoints from './V2ReviewPoints.jsx'
import { learnerExperienceV2Enabled } from '../lib/pedagogy-v2/learner-experience-mode.js'

// Product boundary: V2 review points are derived from V2 evidence only. The
// legacy ranking/mastery screen remains available solely to explicit V1 mode.
export default function Mistakes() {
  const { settings } = useApp()
  return learnerExperienceV2Enabled(settings) ? <V2ReviewPoints /> : <LegacyMistakes />
}
