import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store.jsx'
import { useAI } from '../ai/useAI.js'
import { StatusBar } from '../components/ui.jsx'
import { I } from '../components/icons.jsx'
import { getModel, formatSize } from '../ai/models.js'
import { TUTOR_SYSTEM_PROMPT, generateLesson, extractYaml } from '../ai/lesson-generator.js'
import { validateLesson } from '../lib/lesson-parser.js'

let msgId = 0
const uid = () => `m${++msgId}`

export default function Chat() {
  const { back, settings, saveLesson, startLesson, mistakes, showToast, updateSetting } = useApp()
  const ai = useAI()
  const modelId = settings?.ai_model || ai.modelId
  const model = getModel(modelId)

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [composer, setComposer] = useState(false)
  const listRef = useRef(null)

  // Greet once the model is ready.
  useEffect(() => {
    if (ai.status === 'ready' && messages.length === 0) {
      setMessages([{ id: uid(), role: 'assistant', content: 'Oi! Sou seu tutor de inglês. Posso conversar, corrigir suas frases ou **criar uma aula** na hora. O que você quer treinar hoje?' }])
    }
  }, [ai.status])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  const chat = () => ai.getCapability('chat')

  const streamAssistant = async (history) => {
    const cap = chat()
    if (!cap) { pushError('O modelo não está pronto.'); return }
    const id = uid()
    setMessages((m) => [...m, { id, role: 'assistant', content: '', streaming: true }])
    const model2 = [{ role: 'system', content: TUTOR_SYSTEM_PROMPT }, ...history.map((h) => ({ role: h.role, content: h.content }))]
    let acc = ''
    try {
      for await (const t of cap.stream(model2, { temperature: 0.7, max_tokens: 800 })) {
        acc += t
        setMessages((m) => m.map((x) => (x.id === id ? { ...x, content: acc } : x)))
      }
    } catch (e) {
      setMessages((m) => m.map((x) => (x.id === id ? { ...x, content: acc || 'Desculpe, tive um problema ao responder.', streaming: false, error: true } : x)))
      return
    }
    // Detect an embedded lesson and surface it as a card.
    const yaml = extractYaml(acc)
    const v = yaml ? validateLesson(yaml) : { ok: false }
    const cleaned = v.ok ? acc.replace(/```[\s\S]*?```/g, '').trim() || 'Preparei uma aula pra você 👇' : acc
    setMessages((m) => m.map((x) => (x.id === id ? { ...x, content: cleaned, streaming: false, lesson: v.ok ? v.lesson : null } : x)))
  }

  const pushError = (text) => setMessages((m) => [...m, { id: uid(), role: 'assistant', content: text, error: true }])

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    const userMsg = { id: uid(), role: 'user', content: text }
    const history = [...messages, userMsg]
    setMessages(history)
    setBusy(true)
    await streamAssistant(history)
    setBusy(false)
  }

  const createLesson = async ({ focus, level, count }) => {
    setComposer(false)
    setBusy(true)
    const userMsg = { id: uid(), role: 'user', content: `Crie uma aula: ${focus} · ${level} · ${count} perguntas.` }
    setMessages((m) => [...m, userMsg])
    const streamId = uid()
    setMessages((m) => [...m, { id: streamId, role: 'assistant', content: 'Gerando sua aula…', streaming: true }])
    const weaknesses = mistakes.slice(0, 3).map((x) => x.mistake_type)
    try {
      const res = await generateLesson({
        chat: chat(), focus, level, count, weaknesses,
        onToken: () => setMessages((m) => m.map((x) => (x.id === streamId ? { ...x, content: 'Gerando sua aula…' } : x))),
      })
      if (res.ok) {
        setMessages((m) => m.map((x) => (x.id === streamId ? { ...x, content: `Pronto! Uma aula de ${res.lesson.questions.length} perguntas sobre ${res.lesson.focus}.`, streaming: false, lesson: res.lesson } : x)))
      } else {
        setMessages((m) => m.map((x) => (x.id === streamId ? { ...x, content: `Não consegui montar uma aula válida (${res.error}). Tenta de novo ou troque o modelo nas Configurações.`, streaming: false, error: true } : x)))
      }
    } catch (e) {
      setMessages((m) => m.map((x) => (x.id === streamId ? { ...x, content: 'Falha ao gerar a aula.', streaming: false, error: true } : x)))
    }
    setBusy(false)
  }

  const useLesson = async (lesson) => {
    const saved = await saveLesson(lesson)
    showToast('Aula salva')
    startLesson(saved)
  }

  // ---- Gate: unsupported / not loaded ----
  if (ai.supported === false) {
    return <Gate back={back} title="Tutor IA">
      <UnsupportedCard />
    </Gate>
  }
  if (ai.status !== 'ready') {
    return <Gate back={back} title="Tutor IA">
      <ActivateCard ai={ai} model={model} onActivate={() => ai.loadModel(modelId)} />
    </Gate>
  }

  // ---- Chat ----
  return (
    <div className="phone">
      <StatusBar />
      <div className="app-header">
        <button className="back" onClick={() => back()} aria-label="Voltar"><I.back /></button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Tutor IA</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>{model.name} · no dispositivo</div>
        </div>
        <div style={{ width: 40 }} />
      </div>

      <div className="chat-list" ref={listRef}>
        {messages.map((m) => (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 8 }}>
            <div className={`bubble ${m.role === 'user' ? 'bubble-user' : 'bubble-ai'}`} style={m.error ? { borderColor: 'var(--error)', color: 'var(--error-ink)' } : undefined}>
              {m.streaming && !m.content ? <span className="typing"><span /><span /><span /></span> : renderText(m.content)}
            </div>
            {m.lesson && <LessonCard lesson={m.lesson} onUse={() => useLesson(m.lesson)} />}
          </div>
        ))}
      </div>

      {messages.length <= 1 && !busy && (
        <div style={{ display: 'flex', gap: 8, padding: '0 14px 8px', flexWrap: 'wrap' }}>
          {['Criar uma aula', 'Me dê 5 frases pra praticar', 'Como pedir aumento em inglês?'].map((q) => (
            <button key={q} className="chip tap" style={{ cursor: 'pointer' }}
              onClick={() => { if (q === 'Criar uma aula') setComposer(true); else { setInput(q); setTimeout(send, 0) } }}>
              {q}
            </button>
          ))}
        </div>
      )}

      {composer && <LessonComposer defaultLevel={settings?.level || 'B1'} defaultCount={Math.min(settings?.question_count || 8, 12)} onCancel={() => setComposer(false)} onCreate={createLesson} />}

      <div className="chat-input">
        <button className="send-btn" style={{ background: 'var(--surface-2)', color: 'var(--indigo-600)', border: '1px solid var(--border)' }} onClick={() => setComposer(true)} aria-label="Criar aula" title="Criar aula">
          <I.spark s={20} />
        </button>
        <textarea
          value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Fale com o tutor…" rows={1} disabled={busy}
        />
        <button className="send-btn" onClick={send} disabled={busy || !input.trim()} aria-label="Enviar"><I.send s={20} /></button>
      </div>
    </div>
  )
}

function Gate({ back, title, children }) {
  return (
    <div className="phone">
      <StatusBar />
      <div className="app-header">
        <button className="back" onClick={() => back()} aria-label="Voltar"><I.back /></button>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
        <div style={{ width: 40 }} />
      </div>
      <div className="screen-body" style={{ justifyContent: 'center', gap: 16 }}>{children}</div>
    </div>
  )
}

function UnsupportedCard() {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 24 }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--warn-bg)', color: 'var(--warn)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
        <I.bot s={34} />
      </div>
      <h2 className="h2">WebGPU não disponível</h2>
      <p className="muted-2" style={{ fontSize: 14, lineHeight: 1.5, marginTop: 8 }}>
        O tutor roda um modelo de IA direto no seu dispositivo, e isso precisa de <strong>WebGPU</strong>.
        Use um navegador recente (Chrome ou Edge no desktop, ou Chrome no Android) para ativar.
      </p>
      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>O resto do app funciona normalmente sem isso.</p>
    </div>
  )
}

function ActivateCard({ ai, model, onActivate }) {
  const loading = ai.status === 'loading'
  const pct = Math.round((ai.progress?.ratio || 0) * 100)
  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(140deg, var(--indigo-500), var(--indigo-700))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <I.spark s={26} />
        </div>
        <div>
          <h2 className="h2">Ativar o tutor IA</h2>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>Um modelo roda 100% no seu dispositivo.</div>
        </div>
      </div>

      <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{model.name}</div>
          <span className="chip chip-indigo">{formatSize(model.sizeMB)}</span>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>{model.note}</div>
      </div>

      <p className="muted" style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 14 }}>
        O download inicial (~{formatSize(model.sizeMB)}) precisa de internet e fica salvo no navegador. Depois disso, o tutor funciona offline. Troque o modelo em Configurações.
      </p>

      {loading ? (
        <div>
          <div className="progress" style={{ height: 10 }}><div className="fill" style={{ width: `${pct}%` }} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--ink-3)' }}>
            <span>{ai.progress?.text || 'Baixando…'}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
          </div>
        </div>
      ) : (
        <button className="btn btn-primary btn-block" onClick={onActivate}>
          <I.spark s={18} /> Baixar e ativar
        </button>
      )}

      {ai.status === 'error' && (
        <div className="card" style={{ background: 'var(--error-bg)', borderColor: 'transparent', padding: 12, marginTop: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--error-ink)', lineHeight: 1.4 }}>{ai.error}</div>
        </div>
      )}
    </div>
  )
}

function LessonCard({ lesson, onUse }) {
  return (
    <div className="card" style={{ alignSelf: 'flex-start', maxWidth: '90%', padding: 14, borderColor: 'var(--indigo-300)', background: 'var(--indigo-50)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ color: 'var(--indigo-700)' }}><I.spark s={16} /></div>
        <div className="label-eyebrow" style={{ color: 'var(--indigo-700)' }}>aula gerada</div>
      </div>
      <div style={{ fontWeight: 800, fontSize: 16, fontFamily: 'var(--font-mono)' }}>{lesson.focus}</div>
      <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 2 }}>{lesson.level} · {lesson.questions.length} perguntas · {[...new Set(lesson.questions.map((q) => q.type))].length} tipos</div>
      <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={onUse}>
        Salvar e iniciar <I.chevR s={18} />
      </button>
    </div>
  )
}

function LessonComposer({ defaultLevel, defaultCount, onCancel, onCreate }) {
  const [focus, setFocus] = useState('')
  const [level, setLevel] = useState(defaultLevel)
  const [count, setCount] = useState(defaultCount)
  return (
    <div className="sheet sheet-anim" style={{ background: 'var(--surface)' }}>
      <div className="handle" />
      <div className="sheet-title">Criar aula</div>
      <div>
        <div className="label-eyebrow" style={{ marginBottom: 6 }}>tema / foco</div>
        <input className="input" placeholder="ex.: reuniões, entrevista de emprego, small talk" value={focus} onChange={(e) => setFocus(e.target.value)} autoFocus />
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div className="label-eyebrow" style={{ marginBottom: 6 }}>nível</div>
          <div style={{ display: 'flex', gap: 6, background: 'var(--bg-alt)', padding: 4, borderRadius: 12 }}>
            {['A2', 'B1', 'B2'].map((l) => (
              <button key={l} onClick={() => setLevel(l)} style={{ flex: 1, padding: 8, borderRadius: 8, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontWeight: level === l ? 700 : 600, fontSize: 13, background: level === l ? 'var(--surface)' : 'transparent', color: level === l ? 'var(--ink)' : 'var(--ink-3)', boxShadow: level === l ? 'var(--shadow-sm)' : 'none' }}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ width: 110 }}>
          <div className="label-eyebrow" style={{ marginBottom: 6 }}>perguntas</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', background: 'var(--bg-alt)', padding: '6px 10px', borderRadius: 12 }}>
            <button onClick={() => setCount(Math.max(3, count - 1))} style={countBtn}>–</button>
            <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
            <button onClick={() => setCount(Math.min(15, count + 1))} style={countBtn}>+</button>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary" style={{ flex: 1.4 }} disabled={!focus.trim()} onClick={() => onCreate({ focus: focus.trim().replace(/\s+/g, '_'), level, count })}>
          <I.spark s={18} /> Gerar aula
        </button>
      </div>
    </div>
  )
}

const countBtn = { width: 26, height: 26, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer', fontSize: 18, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }

// Minimal markdown: **bold** and `code`.
function renderText(text) {
  const parts = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let last = 0, m
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('**')) parts.push(<strong key={m.index}>{tok.slice(2, -2)}</strong>)
    else parts.push(<code key={m.index}>{tok.slice(1, -1)}</code>)
    last = m.index + tok.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}
