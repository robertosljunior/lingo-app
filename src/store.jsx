// store.jsx — single app store: navigation, settings, active lesson, the live
// exercise session, and IndexedDB-backed data. Exposed through useApp().

import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react'
import * as db from './lib/storage.js'
import { parseLesson } from './lib/lesson-parser.js'
import { SAMPLE_YAML } from './lib/sample-lesson.js'
import { warmupNlp } from './lib/nlp-client.js'

const AppCtx = createContext(null)
export const useApp = () => useContext(AppCtx)

export const SCREENS = {
  HOME: 'home', IMPORT: 'import', EXERCISE: 'exercise', RESULT: 'result',
  REVIEW: 'review', EXPORT: 'export', HISTORY: 'history',
  MISTAKES: 'mistakes', SETTINGS: 'settings', CHAT: 'chat',
}

const TABS = new Set([SCREENS.HOME, SCREENS.HISTORY, SCREENS.MISTAKES, SCREENS.SETTINGS])

function newSessionId(lessonId) {
  return `${lessonId}-${Date.now().toString(36)}`
}

export function AppProvider({ children }) {
  const [ready, setReady] = useState(false)
  const [screen, setScreen] = useState(SCREENS.HOME)
  const [params, setParams] = useState({})
  const navStack = useRef([])

  const [settings, setSettings] = useState(null)
  const [lessons, setLessons] = useState([])
  const [sessions, setSessions] = useState([])
  const [mistakes, setMistakes] = useState([])

  const [activeLesson, setActiveLesson] = useState(null)
  const [session, setSession] = useState({ id: null, qIdx: 0, answers: [] })

  const [toast, setToast] = useState(null)
  const toastTimer = useRef(0)

  // ---- boot ----
  useEffect(() => {
    (async () => {
      const s = await db.getSettings()
      setSettings(s)
      // Seed the sample lesson on first run so the app is usable immediately.
      let all = await db.getAllLessons()
      if (all.length === 0) {
        try {
          const lesson = parseLesson(SAMPLE_YAML)
          await db.saveLesson(lesson)
          all = await db.getAllLessons()
        } catch { /* ignore seed failure */ }
      }
      setLessons(all)
      setSessions(await db.getSessionSummaries())
      setMistakes(await db.getMistakes())
      setReady(true)
      warmupNlp()
    })()
  }, [])

  // ---- theme ----
  useEffect(() => {
    if (!settings) return
    const root = document.documentElement
    if (settings.theme === 'light') root.setAttribute('data-theme', 'light')
    else if (settings.theme === 'dark') root.setAttribute('data-theme', 'dark')
    else root.removeAttribute('data-theme')
  }, [settings?.theme])

  const refreshLibrary = useCallback(async () => {
    setLessons(await db.getAllLessons())
    setSessions(await db.getSessionSummaries())
    setMistakes(await db.getMistakes())
  }, [])

  // ---- navigation ----
  const navigate = useCallback((next, p = {}) => {
    setScreen((cur) => { navStack.current.push(cur); return next })
    setParams(p)
  }, [])

  const back = useCallback((fallback = SCREENS.HOME) => {
    const prev = navStack.current.pop()
    setScreen(prev || fallback)
    setParams({})
  }, [])

  const setTab = useCallback((k) => {
    navStack.current = []
    setScreen(k)
    setParams({})
  }, [])

  // ---- toast ----
  const showToast = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1800)
  }, [])

  // ---- lessons / session ----
  const saveLesson = useCallback(async (lesson) => {
    const saved = await db.saveLesson(lesson)
    await refreshLibrary()
    return saved
  }, [refreshLibrary])

  const startLesson = useCallback(async (lesson) => {
    // Lessons coming from the list view carry no questions (separate store) —
    // hydrate the full record before starting.
    const full = lesson.questions?.length ? lesson : await db.getLesson(lesson.lesson_id)
    if (!full || !full.questions?.length) return
    setActiveLesson(full)
    setSession({ id: newSessionId(full.lesson_id), qIdx: 0, answers: [] })
    navigate(SCREENS.EXERCISE, {})
  }, [navigate])

  const submitAnswer = useCallback(async (rec) => {
    // rec: { question, user_answer, analysis }
    const q = rec.question
    const a = rec.analysis
    const stored = {
      lesson_id: activeLesson.lesson_id,
      question_id: q.id,
      user_answer: rec.user_answer,
      expected_answer: a.target || q.expected_answer,
      score: a.similarity_score,
      is_correct: a.verdict === 'correct',
      verdict: a.verdict,
      mistake_type: a.verdict === 'correct' ? null : a.possible_mistake_type,
      feedback: a.feedback,
      session_id: session.id,
    }
    await db.saveAnswer(stored)
    const entry = { ...stored, question: q }
    setSession((s) => ({ ...s, answers: [...s.answers, entry] }))
    return entry
  }, [activeLesson, session.id])

  const nextQuestion = useCallback(() => {
    setSession((s) => {
      if (s.qIdx + 1 >= activeLesson.questions.length) {
        // finished
        refreshLibrary()
        navigate(SCREENS.RESULT, {})
        return s
      }
      return { ...s, qIdx: s.qIdx + 1 }
    })
  }, [activeLesson, navigate, refreshLibrary])

  const updateSetting = useCallback(async (key, value) => {
    setSettings((s) => ({ ...s, [key]: value }))
    await db.setSetting(key, value)
  }, [])

  const value = {
    ready, screen, params, settings,
    lessons, sessions, mistakes,
    activeLesson, session,
    toast,
    SCREENS,
    isTab: (k) => TABS.has(k),
    navigate, back, setTab, showToast,
    refreshLibrary, saveLesson, startLesson, submitAnswer, nextQuestion, updateSetting,
    db,
  }

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}
