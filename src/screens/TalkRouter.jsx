import { useApp } from '../store.jsx'
import { learnerExperienceV2Enabled } from '../lib/pedagogy-v2/learner-experience-mode.js'
import Talk from './Talk.jsx'
import V2TalkUnavailable from './V2TalkUnavailable.jsx'

// Direct or stale navigation to the shared TALK route must still respect the
// product boundary. V1 keeps its legacy Bob exercise; V2 receives an honest
// boundary surface and never renders or records the V1 activity.
export default function TalkRouter() {
  const { settings } = useApp()
  return learnerExperienceV2Enabled(settings) ? <V2TalkUnavailable /> : <Talk />
}
