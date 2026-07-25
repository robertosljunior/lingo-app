// TrainingHub.jsx — Slice V2.18 entry router, re-pointed in V2.20 (§2) at the
// three-valued experience resolver. Training's content depends on the resolved
// learner experience:
//   'v2' → the V2 Learner Home (dev/dogfood default, or an explicit opt-in);
//   'v1' → the V1 Training Hub (production default, or an explicit opt-out).
// Only ONE of the two pedagogical worlds is ever the primary Training surface —
// the V1 hub and the V2 home never render together (§33).

import { useApp } from '../store.jsx'
import LegacyTrainingHub from './LegacyTrainingHub.jsx'
import V2LearnerHome from './V2LearnerHome.jsx'
import { learnerExperienceV2Enabled } from '../lib/pedagogy-v2/learner-experience-mode.js'

export default function TrainingHub() {
  const { settings } = useApp()
  if (learnerExperienceV2Enabled(settings)) return <V2LearnerHome />
  return <LegacyTrainingHub />
}
