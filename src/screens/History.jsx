import { useApp } from '../store.jsx'
import LegacyHistory from './LegacyHistory.jsx'
import V2History from './V2History.jsx'
import { learnerExperienceV2Enabled } from '../lib/pedagogy-v2/learner-experience-mode.js'

// Product boundary: the shared navigation destination resolves to exactly one
// history implementation. V2 evidence is never interpreted as V1 answers, and
// V1 sessions remain available only to an explicit legacy opt-out.
export default function History() {
  const { settings } = useApp()
  return learnerExperienceV2Enabled(settings) ? <V2History /> : <LegacyHistory />
}
