import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store.jsx'
import { BottomNav } from '../components/ui.jsx'

function Section({ title, children }) {
  return (
    <section className="v2lx-card" style={{ display: 'grid', gap: 14 }}>
      <div className="v2lx-kicker">{title}</div>
      {children}
    </section>
  )
}

function ChoiceRow({ label, value, options, onChange }) {
  return (
    <div>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? 'v2lx-cta' : 'v2lx-textbtn'}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            style={{ minWidth: 84 }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ToggleRow({ label, description, checked, onChange, testid }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18 }}>
      <span>
        <strong style={{ display: 'block' }}>{label}</strong>
        {description && <span className="muted" style={{ display: 'block', fontSize: 13, lineHeight: 1.45, marginTop: 3 }}>{description}</span>}
      </span>
      <input data-testid={testid} type="checkbox" checked={!!checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  )
}

export default function V2Settings() {
  const {
    settings, updateSetting, setTab, SCREENS,
    profiles, activeProfile, switchProfile, addProfile, renameActiveProfile, showToast,
  } = useApp()
  const active = useMemo(
    () => profiles.find((profile) => profile.profile_id === activeProfile) || null,
    [profiles, activeProfile],
  )
  const [renameValue, setRenameValue] = useState(active?.name || '')
  const [newProfileName, setNewProfileName] = useState('')

  useEffect(() => setRenameValue(active?.name || ''), [active?.profile_id, active?.name])
  if (!settings) return null

  async function saveName(event) {
    event.preventDefault()
    const clean = renameValue.trim()
    if (!clean || clean === active?.name) return
    await renameActiveProfile(clean)
    showToast('Nome atualizado')
  }

  async function createProfile(event) {
    event.preventDefault()
    const clean = newProfileName.trim()
    if (!clean) return
    await addProfile(clean)
    setNewProfileName('')
    showToast('Perfil criado')
  }

  return (
    <div className="phone v2lx" data-testid="v2-settings" data-experience="v2" data-surface="settings">
      <header style={{ padding: '16px 20px 8px', flexShrink: 0 }}>
        <div className="v2lx-kicker">Seu aplicativo</div>
        <h1 style={{ margin: '4px 0 0', fontFamily: 'var(--v2-font-display, inherit)', fontSize: 'clamp(30px, 9vw, 42px)', lineHeight: .95 }}>Ajustes</h1>
      </header>

      <main className="screen-body" style={{ paddingTop: 12, paddingBottom: 112, gap: 12 }}>
        <Section title="Perfis neste aparelho">
          <div style={{ display: 'grid', gap: 8 }}>
            {profiles.map((profile) => {
              const selected = profile.profile_id === activeProfile
              return (
                <button
                  key={profile.profile_id}
                  type="button"
                  data-testid={`v2-profile-${profile.profile_id}`}
                  aria-pressed={selected}
                  onClick={() => !selected && switchProfile(profile.profile_id)}
                  style={{
                    padding: '12px 14px', borderRadius: 14, textAlign: 'left', font: 'inherit', cursor: selected ? 'default' : 'pointer',
                    border: selected ? '2px solid var(--v2-accent, var(--indigo-600))' : '1px solid var(--border)',
                    background: selected ? 'var(--v2-surface-2, var(--bg-alt))' : 'transparent', color: 'inherit',
                  }}
                >
                  <strong>{profile.name || 'Perfil'}</strong>
                  {selected && <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>ativo</span>}
                </button>
              )
            })}
          </div>

          <form onSubmit={saveName} style={{ display: 'grid', gap: 8 }}>
            <label htmlFor="v2-profile-name" style={{ fontWeight: 800 }}>Nome do perfil ativo</label>
            <input id="v2-profile-name" className="input" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
            <button type="submit" className="v2lx-textbtn" disabled={!renameValue.trim() || renameValue.trim() === active?.name}>Salvar nome</button>
          </form>

          <form onSubmit={createProfile} style={{ display: 'grid', gap: 8 }}>
            <label htmlFor="v2-new-profile" style={{ fontWeight: 800 }}>Adicionar outro perfil</label>
            <input id="v2-new-profile" className="input" value={newProfileName} onChange={(event) => setNewProfileName(event.target.value)} placeholder="Nome" />
            <button type="submit" className="v2lx-textbtn" disabled={!newProfileName.trim()}>Criar perfil</button>
          </form>
        </Section>

        <Section title="Aparência">
          <ChoiceRow
            label="Tema"
            value={settings.theme}
            options={[
              { value: 'system', label: 'Sistema' },
              { value: 'light', label: 'Claro' },
              { value: 'dark', label: 'Escuro' },
            ]}
            onChange={(value) => updateSetting('theme', value)}
          />
        </Section>

        <Section title="Áudio">
          <ToggleRow
            testid="v2-setting-autoplay-answer"
            label="Ler a frase depois da resposta"
            description="Usa a voz disponível neste aparelho. A atividade continua utilizável sem áudio."
            checked={settings.auto_read_correct_answer}
            onChange={(value) => updateSetting('auto_read_correct_answer', value)}
          />
          <ToggleRow
            testid="v2-setting-autoplay-explanation"
            label="Ler explicações automaticamente"
            description="Pode ser desligado sem alterar sua progressão ou seus registros."
            checked={settings.auto_read_explanations}
            onChange={(value) => updateSetting('auto_read_explanations', value)}
          />
        </Section>

        <Section title="Privacidade e dados">
          <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
            Seus perfis, práticas e respostas ficam neste dispositivo. Histórico e pontos para revisar são separados por perfil.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="v2lx-textbtn" onClick={() => setTab(SCREENS.HISTORY)}>Abrir histórico</button>
            <button type="button" className="v2lx-textbtn" onClick={() => setTab(SCREENS.MISTAKES)}>Abrir revisão</button>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>
            Exclusão e exportação completas serão oferecidas somente quando puderem abranger todos os registros V2 com segurança.
          </p>
        </Section>
      </main>
      <BottomNav active="settings" onNavigate={setTab} />
    </div>
  )
}
