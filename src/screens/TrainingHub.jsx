// TrainingHub.jsx — Slice V2.18 entry router, re-pointed at the shared
// experience resolver. Training's content depends on the resolved learner
// experience:
//   'v2' → the V2 Learner Home (the default, in every environment — V2.20-R §8);
//   'v1' → the legacy V1 Training Hub (explicit opt-out only).
// Only ONE of the two pedagogical worlds is ever the primary Training surface —
// the V1 hub and the V2 home never render together (§33). Since V2.20-R the root
// Home routes identically (see Home.jsx), so Training and Início agree.

import { useApp } from '../store.jsx'
import LegacyTrainingHub from './LegacyTrainingHub.jsx'
import V2LearnerHome from './V2LearnerHome.jsx'
import { learnerExperienceV2Enabled } from '../lib/pedagogy-v2/learner-experience-mode.js'

export default function TrainingHub() {
  const { settings } = useApp()
  if (learnerExperienceV2Enabled(settings)) return <V2LearnerHome />
  return <LegacyTrainingHub />
}
