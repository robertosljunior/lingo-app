import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store.jsx'
import { BottomNav } from '../components/ui.jsx'
import {
  deleteProfileData,
  exportProfileData,
  importProfileData,
  previewProfileDataDeletion,
} from '../lib/profile-data-lifecycle.js'
import { clearDownloadedResources, formatStorageBytes, getDeviceStorageSnapshot } from '../lib/device-storage-manager.js'

function Section({ title, children }) {
  return <section className="v2lx-card" style={{ display: 'grid', gap: 14 }}><div className="v2lx-kicker">{title}</div>{children}</section>
}

function ChoiceRow({ label, value, options, onChange }) {
  return <div><div style={{ fontWeight: 800, marginBottom: 8 }}>{label}</div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{options.map((option) => <button key={option.value} type="button" className={value === option.value ? 'v2lx-cta' : 'v2lx-textbtn'} aria-pressed={value === option.value} onClick={() => onChange(option.value)} style={{ minWidth: 84 }}>{option.label}</button>)}</div></div>
}

function ToggleRow({ label, description, checked, onChange, testid }) {
  return <label style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18 }}><span><strong style={{ display: 'block' }}>{label}</strong>{description && <span className="muted" style={{ display: 'block', fontSize: 13, lineHeight: 1.45, marginTop: 3 }}>{description}</span>}</span><input data-testid={testid} type="checkbox" checked={!!checked} onChange={(event) => onChange(event.target.checked)} /></label>
}

function downloadJson(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a')
  anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function safeFilename(value) {
  return String(value || 'perfil').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'perfil'
}

export default function V2Settings() {
  const { settings, updateSetting, setTab, SCREENS, db, profiles, activeProfile, switchProfile, addProfile, renameActiveProfile, showToast } = useApp()
  const active = useMemo(() => profiles.find((profile) => profile.profile_id === activeProfile) || null, [profiles, activeProfile])
  const replacement = useMemo(() => profiles.find((profile) => profile.profile_id !== activeProfile) || null, [profiles, activeProfile])
  const [renameValue, setRenameValue] = useState(active?.name || '')
  const [newProfileName, setNewProfileName] = useState('')
  const [dataBusy, setDataBusy] = useState(false)
  const [dataMessage, setDataMessage] = useState('')
  const [storage, setStorage] = useState(null)
  const [storageBusy, setStorageBusy] = useState(false)
  const [storageMessage, setStorageMessage] = useState('')
  const importInput = useRef(null)

  useEffect(() => setRenameValue(active?.name || ''), [active?.profile_id, active?.name])
  useEffect(() => { let live = true; getDeviceStorageSnapshot().then((value) => { if (live) setStorage(value) }); return () => { live = false } }, [])
  if (!settings) return null

  async function saveName(event) { event.preventDefault(); const clean = renameValue.trim(); if (!clean || clean === active?.name) return; await renameActiveProfile(clean); showToast('Nome atualizado') }
  async function createProfile(event) { event.preventDefault(); const clean = newProfileName.trim(); if (!clean) return; await addProfile(clean); setNewProfileName(''); showToast('Perfil criado') }

  async function exportActiveProfile() {
    if (!active || dataBusy) return
    setDataBusy(true); setDataMessage('')
    try { const bundle = await exportProfileData(active.profile_id); const date = new Date().toISOString().slice(0, 10); downloadJson(`aprendaidioma-${safeFilename(active.name)}-${date}.json`, bundle); setDataMessage('Arquivo criado neste aparelho. Modelos, vozes e conteúdo global não fazem parte da exportação do perfil.') }
    catch (error) { setDataMessage(`Não foi possível exportar: ${String(error?.message || error)}`) }
    finally { setDataBusy(false) }
  }

  async function restoreProfile(event) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file || dataBusy) return
    setDataBusy(true); setDataMessage('')
    try { const bundle = JSON.parse(await file.text()); const result = await importProfileData(bundle); await db.setSetting('active_profile', result.profile_id); showToast('Perfil restaurado'); window.location.reload() }
    catch (error) { setDataMessage(`Nada foi alterado. O arquivo não pôde ser restaurado: ${String(error?.message || error)}`) }
    finally { setDataBusy(false) }
  }

  async function deleteActiveProfile() {
    if (!active || !replacement || dataBusy) return
    const preview = await previewProfileDataDeletion(active.profile_id)
    const typed = window.prompt(`Para excluir o perfil “${active.name || 'Perfil'}” e todos os seus registros, digite exatamente o nome do perfil.\n\nModelos, vozes, conteúdo e preferências globais permanecerão neste aparelho.`, '')
    if (typed !== (active.name || '')) { if (typed != null) setDataMessage('O nome não corresponde. Nenhum dado foi excluído.'); return }
    setDataBusy(true); setDataMessage('')
    try { await deleteProfileData(active.profile_id, { replacementProfileId: replacement.profile_id }); showToast(`${preview.profile.name || 'Perfil'} excluído`); window.location.reload() }
    catch (error) { setDataMessage(`Nenhum dado foi excluído: ${String(error?.message || error)}`); setDataBusy(false) }
  }

  async function cleanDownloadedResources() {
    if (storageBusy) return
    const count = (storage?.voices?.length || 0) + (storage?.semantic_model ? 1 : 0) + (storage?.knowledge_packs?.length || 0) + (storage?.managed_cache_names?.length || 0)
    if (!count) { setStorageMessage('Não há recursos baixados para limpar.'); return }
    const ok = window.confirm('Remover modelos, vozes e caches baixados deste aparelho?\n\nSeu histórico, respostas, perfis e progresso não serão apagados. Recursos necessários poderão ser baixados novamente.')
    if (!ok) return
    setStorageBusy(true); setStorageMessage('')
    try {
      const result = await clearDownloadedResources({ snapshot: storage })
      setStorage(result.after)
      setStorageMessage(result.ok ? 'Recursos baixados removidos. Histórico, respostas, perfis e progresso foram preservados.' : 'Alguns recursos não puderam ser removidos. Seus dados de aprendizagem não foram alterados.')
    } catch (error) { setStorageMessage(`Não foi possível concluir a limpeza: ${String(error?.message || error)}`) }
    finally { setStorageBusy(false) }
  }

  return <div className="phone v2lx" data-testid="v2-settings" data-experience="v2" data-surface="settings">
    <header style={{ padding: '16px 20px 8px', flexShrink: 0 }}><div className="v2lx-kicker">Seu aplicativo</div><h1 style={{ margin: '4px 0 0', fontFamily: 'var(--v2-font-display, inherit)', fontSize: 'clamp(30px, 9vw, 42px)', lineHeight: .95 }}>Ajustes</h1></header>
    <main className="screen-body" style={{ paddingTop: 12, paddingBottom: 112, gap: 12 }}>
      <Section title="Perfis neste aparelho">
        <div style={{ display: 'grid', gap: 8 }}>{profiles.map((profile) => { const selected = profile.profile_id === activeProfile; return <button key={profile.profile_id} type="button" data-testid={`v2-profile-${profile.profile_id}`} aria-pressed={selected} onClick={() => !selected && switchProfile(profile.profile_id)} style={{ padding: '12px 14px', borderRadius: 14, textAlign: 'left', font: 'inherit', cursor: selected ? 'default' : 'pointer', border: selected ? '2px solid var(--v2-accent, var(--indigo-600))' : '1px solid var(--border)', background: selected ? 'var(--v2-surface-2, var(--bg-alt))' : 'transparent', color: 'inherit' }}><strong>{profile.name || 'Perfil'}</strong>{selected && <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>ativo</span>}</button> })}</div>
        <form onSubmit={saveName} style={{ display: 'grid', gap: 8 }}><label htmlFor="v2-profile-name" style={{ fontWeight: 800 }}>Nome do perfil ativo</label><input id="v2-profile-name" className="input" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} /><button type="submit" className="v2lx-textbtn" disabled={!renameValue.trim() || renameValue.trim() === active?.name}>Salvar nome</button></form>
        <form onSubmit={createProfile} style={{ display: 'grid', gap: 8 }}><label htmlFor="v2-new-profile" style={{ fontWeight: 800 }}>Adicionar outro perfil</label><input id="v2-new-profile" className="input" value={newProfileName} onChange={(event) => setNewProfileName(event.target.value)} placeholder="Nome" /><button type="submit" className="v2lx-textbtn" disabled={!newProfileName.trim()}>Criar perfil</button></form>
      </Section>
      <Section title="Aparência"><ChoiceRow label="Tema" value={settings.theme} options={[{ value: 'system', label: 'Sistema' }, { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Escuro' }]} onChange={(value) => updateSetting('theme', value)} /></Section>
      <Section title="Áudio"><ToggleRow testid="v2-setting-autoplay-answer" label="Ler a frase depois da resposta" description="Usa a voz disponível neste aparelho. A atividade continua utilizável sem áudio." checked={settings.auto_read_correct_answer} onChange={(value) => updateSetting('auto_read_correct_answer', value)} /><ToggleRow testid="v2-setting-autoplay-explanation" label="Ler explicações automaticamente" description="Pode ser desligado sem alterar sua progressão ou seus registros." checked={settings.auto_read_explanations} onChange={(value) => updateSetting('auto_read_explanations', value)} /></Section>
      <Section title="Armazenamento neste aparelho">
        <div data-testid="v2-storage-summary" style={{ display: 'grid', gap: 6 }}>
          <strong>{storage?.usage_bytes != null ? `${formatStorageBytes(storage.usage_bytes)} usados` : 'Uso total não informado pelo navegador'}</strong>
          {storage?.quota_bytes != null && <span className="muted" style={{ fontSize: 13 }}>Limite disponível para este site: {formatStorageBytes(storage.quota_bytes)}</span>}
          <span className="muted" style={{ fontSize: 13 }}>Recursos baixados identificados: {formatStorageBytes(storage?.known_resource_bytes || 0)}</span>
          <span className="muted" style={{ fontSize: 13 }}>Vozes neurais: {storage?.voices?.length || 0} · Modelo semântico: {storage?.semantic_model ? 'instalado' : 'não instalado'} · Conteúdo extra: {storage?.knowledge_packs?.length || 0}</span>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>A limpeza abaixo remove apenas recursos que podem ser baixados novamente. Histórico, respostas, perfis, sessões e progresso ficam intactos.</p>
        <button data-testid="v2-clear-downloaded-resources" type="button" className="v2lx-textbtn" disabled={storageBusy || !storage} onClick={cleanDownloadedResources} style={{ justifySelf: 'start' }}>{storageBusy ? 'Limpando…' : 'Liberar espaço de recursos baixados'}</button>
        {storageMessage && <p data-testid="v2-storage-message" role="status" style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>{storageMessage}</p>}
      </Section>
      <Section title="Privacidade e dados">
        <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>Seus perfis, práticas e respostas ficam neste dispositivo. Histórico e pontos para revisar são separados por perfil.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="button" className="v2lx-textbtn" onClick={() => setTab(SCREENS.HISTORY)}>Abrir histórico</button><button type="button" className="v2lx-textbtn" onClick={() => setTab(SCREENS.MISTAKES)}>Abrir revisão</button></div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'grid', gap: 10 }}><strong>Dados do perfil ativo</strong><p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>A exportação inclui respostas, histórico, revisão, progressão V2, sessões interrompidas e aulas privadas deste perfil. Conteúdo, modelos e vozes são compartilhados pelo aplicativo e não entram no arquivo.</p><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button data-testid="v2-export-profile" type="button" className="v2lx-textbtn" disabled={dataBusy || !active} onClick={exportActiveProfile}>Exportar perfil</button><button data-testid="v2-import-profile" type="button" className="v2lx-textbtn" disabled={dataBusy} onClick={() => importInput.current?.click()}>Restaurar arquivo</button><input ref={importInput} data-testid="v2-import-profile-input" type="file" accept="application/json,.json" hidden onChange={restoreProfile} /></div><p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>A restauração nunca sobrescreve dados existentes. Qualquer conflito cancela a operação inteira.</p></div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'grid', gap: 8 }}><button data-testid="v2-delete-profile" type="button" className="v2lx-textbtn" disabled={dataBusy || !active || !replacement} onClick={deleteActiveProfile} style={{ color: 'var(--error, #b42318)', justifySelf: 'start' }}>Excluir perfil ativo</button><p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>{replacement ? 'Exclui permanentemente todos os registros V1 e V2 deste perfil. Os dados dos outros perfis e os recursos compartilhados permanecem.' : 'O último perfil não pode ser excluído. Crie outro perfil primeiro.'}</p></div>
        {dataMessage && <p data-testid="v2-data-message" role="status" style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>{dataMessage}</p>}
      </Section>
    </main><BottomNav active="settings" onNavigate={setTab} />
  </div>
}
