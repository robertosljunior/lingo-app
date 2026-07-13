import { useEffect, useMemo, useState } from 'react'
import { useApp, SCREENS } from '../store.jsx'
import { BottomNav } from '../components/ui.jsx'
import { I } from '../components/icons.jsx'
import { getSkill, listSkills } from '../lib/skill-registry.js'

const VISUAL = {
  daily_life: { icon:'🏠', color:'#2563EB', desc:'Rotina, casa, amigos e situações do dia a dia.' },
  workplace: { icon:'💼', color:'#4F46E5', desc:'Reuniões, projetos, clientes e carreira.' },
  travel: { icon:'✈️', color:'#0891B2', desc:'Aeroporto, hotel, trajetos e pedidos durante viagens.' },
  food_and_restaurants: { icon:'🍽️', color:'#D97706', desc:'Pedidos, reservas, cardápios e preferências.' },
  shopping_and_services: { icon:'🛍️', color:'#DB2777', desc:'Compras, atendimento, trocas e serviços.' },
  technology_and_communication: { icon:'💬', color:'#059669', desc:'Mensagens, suporte, chamadas e tecnologia.' },
}
const LEVEL_NAMES = { A1:'Fundamentos', A2:'Situações comuns', B1:'Comunicação independente', B2:'Comunicação avançada' }
const GROUPS = [
  ['Perguntas', ['question_structure','question_auxiliary','missing_auxiliary','wrong_auxiliary']],
  ['Tempos verbais', ['simple_present','past_simple','present_perfect','present_perfect_continuous','verb_tense']],
  ['Forma dos verbos', ['verb_form','gerund_after_been','verb_to_be']],
  ['Ordem das palavras', ['word_order']],
  ['Preposições', ['preposition','workplace_preposition']],
  ['Vocabulário', ['vocabulary','spelling']],
  ['Collocations', ['collocation']],
  ['Pronúncia e compreensão', ['listen_type','speak_sentence']],
]

export default function TrainingHub() {
  const { db, activeProfile, latest, lessons, sessions, skillProfiles, startLesson, startPracticeSession, generateAdaptiveLesson, showToast, setTab } = useApp()
  const [summary, setSummary] = useState(null)
  const [theme, setTheme] = useState(null)
  const [progress, setProgress] = useState({})
  const [busy, setBusy] = useState(false)
  const current = lessons[0] || null
  useEffect(() => { db.getTrainingHubSummary(activeProfile).then(setSummary) }, [db, activeProfile])
  useEffect(() => {
    if (!theme) return
    Promise.all(['A1','A2','B1','B2'].map(l => db.getThemeLevelProgress(activeProfile, theme.theme, l).then(p => [l,p]))).then(rows => setProgress(Object.fromEntries(rows)))
  }, [db, activeProfile, theme])
  const top = skillProfiles?.slice(0, 4) || []
  async function startGenerated(level, mode='quick_practice') {
    if (!theme || busy) return
    const p = progress[level]
    if (p && !p.available) { showToast(p.disabled_reason || 'Pacote indisponível'); return }
    setBusy(true)
    try {
      await db.setTrainingPreferences(activeProfile, { preferred_theme: theme.theme, preferred_level: level, last_training_mode: mode })
      const res = await generateAdaptiveLesson({ questionCount: mode === 'lesson' ? 30 : 10, level, theme: theme.theme })
      // Safe failure: never leave the user on a broken/empty lesson. If the pack
      // could not produce a usable lesson, keep them on the Hub with guidance.
      if (!res?.lesson || !(res.lesson.questions?.length > 0)) {
        showToast('Não foi possível montar esta aula. Tente outro nível ou restaure o pacote de conteúdo.')
        return
      }
      startLesson(res.lesson)
    } catch (err) {
      if (import.meta.env?.DEV) console.error('hub_lesson_open_failed', err)
      showToast('Não foi possível montar esta aula. Tente outro nível ou restaure o pacote de conteúdo.')
    } finally { setBusy(false) }
  }
  if (!summary) return <div className="phone"><div className="screen-body"><div className="muted">Carregando hub…</div></div></div>
  if (theme) return <ThemeScreen theme={theme} progress={progress} onBack={() => setTheme(null)} onStart={startGenerated} busy={busy} />
  return (
    <div className="phone">
      <div style={{ padding:'10px 20px 8px', flexShrink:0 }}><div className="label-eyebrow">treinamento</div><h1 className="h1" style={{marginTop:4}}>Escolha o que treinar</h1></div>
      <div className="screen-body" style={{ paddingBottom:100 }}>
        <section className="card" style={{ padding:16, background:'linear-gradient(135deg,#EEF2FF,#FFFFFF)' }}>
          <div style={{fontWeight:900,fontSize:18}}>Continuar aprendendo</div>
          <p className="muted" style={{fontSize:13,margin:'6px 0 12px'}}>{current ? `${current.title || current.focus} · ${current.level}` : 'Gere uma prática curta por tema ou habilidade.'}</p>
          {current ? <button className="btn btn-primary" onClick={() => startLesson(current)}>Continuar <I.chevR s={16}/></button> : <button className="btn btn-primary" onClick={() => startPracticeSession()}>Prática rápida</button>}
        </section>
        <section><div className="label-eyebrow" style={{marginBottom:10}}>Escolher um tema</div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>{summary.themes.map(t => <ThemeCard key={t.theme} row={t} onClick={() => setTheme(t)} />)}</div></section>
        <section className="card" style={{padding:16}}><div style={{fontWeight:900,fontSize:17}}>Revisar minhas dificuldades</div>{top.length ? top.map(p => <div key={p.skill_id} style={{display:'flex',justifyContent:'space-between',gap:8,padding:'10px 0',borderBottom:'1px solid var(--border)'}}><div><div style={{fontWeight:800}}>{p.label_pt || getSkill(p.skill_id)?.label_pt || p.skill_id}</div><div className="muted" style={{fontSize:12}}>Domínio estimado: {Math.round((p.mastery||0)*100)}% · evidência real</div></div><button className="btn btn-sm btn-secondary" onClick={() => startPracticeSession(p.skill_id)}>Praticar</button></div>) : <p className="muted">Ainda sem dados suficientes.</p>}</section>
        <SkillsSection onPractice={startPracticeSession} onLesson={async (skill) => { const res=await generateAdaptiveLesson({ targetSkillId:skill, questionCount:10 }); if(res?.lesson) startLesson(res.lesson) }} />
      </div><BottomNav active="home" onNavigate={setTab} />
    </div>
  )
}
function ThemeCard({ row, onClick }) { const v=VISUAL[row.theme]||{}; return <button className="card tap" data-testid={`theme-${row.theme}`} onClick={onClick} style={{textAlign:'left',padding:16,borderRadius:22,borderColor:'transparent',boxShadow:'var(--shadow-sm)',font:'inherit',background:'var(--surface)'}}><div style={{fontSize:28}}>{v.icon||'📚'}</div><div style={{fontWeight:900,fontSize:16,marginTop:8}}>{row.title?.pt || row.theme}</div><p className="muted" style={{fontSize:12,lineHeight:1.35,minHeight:48}}>{v.desc || row.description?.pt}</p><div style={{fontSize:11,fontWeight:800,color:v.color}}>{row.levels.join(' · ')}</div><div className="muted" style={{fontSize:11,marginTop:6}}>{row.question_count ? `${row.question_count} questões praticadas` : 'Ainda sem dados suficientes'}</div></button> }
function ThemeScreen({ theme, progress, onBack, onStart, busy }) { const v=VISUAL[theme.theme]||{}; return <div className="phone"><div style={{padding:'8px 20px',display:'flex',gap:10,alignItems:'center'}}><button className="back" onClick={onBack} aria-label="Voltar"><I.chevL s={18}/></button><div><div className="label-eyebrow">tema</div><h1 className="h1" style={{margin:0}}>{theme.title?.pt || theme.theme}</h1></div></div><div className="screen-body" style={{paddingBottom:40}}><p className="muted-2" style={{fontSize:14}}>{v.desc || theme.description?.pt}</p>{['A1','A2','B1','B2'].map(l => { const p=progress[l] || {}; return <div key={l} className="card" data-testid={`level-${l}`} style={{padding:16,borderLeft:`5px solid ${p.available===false?'var(--border-strong)':v.color||'var(--indigo-600)'}`}}><div style={{display:'flex',justifyContent:'space-between',gap:8}}><div><div style={{fontWeight:900,fontSize:18}}>{l} — {LEVEL_NAMES[l]}</div><div className="muted" style={{fontSize:12}}>{p.status || 'Ainda sem dados suficientes'}{p.available===false ? ' · indisponível' : ''}</div></div><span className="chip">{l===theme.preferences?.preferred_level?'Recomendado':'Selecionável'}</span></div><div className="muted" style={{fontSize:12,marginTop:8}}>{p.pack_count||0} packs · {p.template_count||0} templates · {(p.skills||[]).map(s=>getSkill(s)?.label_pt||s).join(', ') || 'skills em carregamento'}</div>{p.disabled_reason && <div style={{fontSize:12,color:'var(--warn-ink)',marginTop:8}}>{p.disabled_reason}</div>}<div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}><button className="btn btn-sm btn-primary" disabled={busy || p.available===false} onClick={()=>onStart(l,'quick_practice')}>Prática rápida</button><button className="btn btn-sm btn-secondary" disabled={busy || p.available===false} onClick={()=>onStart(l,'lesson')}>Aula completa</button><button className="btn btn-sm btn-ghost" disabled={busy || p.available===false} onClick={()=>onStart(l,'review')}>Revisar dificuldades</button></div></div>})}</div></div> }
function SkillsSection({ onPractice, onLesson }) { return <section className="card" style={{padding:16}}><div style={{fontWeight:900,fontSize:17,marginBottom:10}}>Habilidades</div>{GROUPS.map(([name, ids]) => <details key={name} style={{borderTop:'1px solid var(--border)',padding:'10px 0'}}><summary style={{fontWeight:800,cursor:'pointer'}}>{name}</summary>{ids.map(id => { const s=getSkill(id); return <div key={id} style={{padding:'10px 0'}}><div style={{fontWeight:800}}>{s?.label_pt || id}</div><div className="muted" style={{fontSize:12}}>{s?.description_pt || 'Habilidade canônica.'}</div><div style={{display:'flex',gap:8,marginTop:8}}><button className="btn btn-sm btn-secondary" onClick={()=>onPractice(id)}>Praticar esta habilidade</button><button className="btn btn-sm btn-ghost" onClick={()=>onLesson(id)}>Gerar aula</button></div></div>})}</details>)}</section> }
