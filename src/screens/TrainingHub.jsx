// TrainingHub.jsx — Slice V2.18 entry router. Training's content depends on the
// learner-experience flag (§2/§3):
//   v2_learner_experience_enabled === false → the V1 Training Hub (unchanged);
//   v2_learner_experience_enabled === true  → the V2 Learner Home.
// Only ONE of the two pedagogical worlds is ever the primary Training surface —
// the V1 hub and the V2 home never render together (§21).

import { useApp } from '../store.jsx'
import LegacyTrainingHub from './LegacyTrainingHub.jsx'
import V2LearnerHome, { v2LearnerHomeEnabled } from './V2LearnerHome.jsx'

export default function TrainingHub() {
  const { settings } = useApp()
  if (v2LearnerHomeEnabled(settings)) return <V2LearnerHome />
  return <LegacyTrainingHub />
}
