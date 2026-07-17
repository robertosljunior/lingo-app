// V2ActivityRenderer.jsx — dispatches an ActivityPlanV2 to its recipe
// renderer. Pure presentation: every pedagogical/assessment decision lives in
// src/lib/pedagogy-v2. All eight recipes have a renderer even when a recipe is
// filtered from selection by runtime capabilities.

import V2ExposureActivity from './V2ExposureActivity.jsx'
import V2ChoiceActivity from './V2ChoiceActivity.jsx'
import V2CompletionActivity from './V2CompletionActivity.jsx'
import V2WordOrderActivity from './V2WordOrderActivity.jsx'
import V2ProductionActivity from './V2ProductionActivity.jsx'
import V2PronunciationActivity from './V2PronunciationActivity.jsx'

const RENDERERS = {
  exposure: V2ExposureActivity,
  meaning_recognition: V2ChoiceActivity,
  listening_recognition: V2ChoiceActivity,
  fixed_element_completion: V2CompletionActivity,
  word_order_reconstruction: V2WordOrderActivity,
  guided_production: V2ProductionActivity,
  free_production: V2ProductionActivity,
  pronunciation: V2PronunciationActivity,
}

export default function V2ActivityRenderer({ plan, capabilities, settings, busy, onSubmit, onSupport }) {
  const Renderer = RENDERERS[plan?.recipe]
  if (!Renderer) return <div data-testid="v2-unknown-recipe" className="muted">Atividade não suportada.</div>
  return (
    <div>
      <div className="label-eyebrow" style={{ marginBottom: 8 }}>{plan.presentation?.instructions_pt}</div>
      <Renderer key={plan.activity_id} plan={plan} capabilities={capabilities} settings={settings}
        busy={busy} onSubmit={onSubmit} onSupport={onSupport} />
    </div>
  )
}
