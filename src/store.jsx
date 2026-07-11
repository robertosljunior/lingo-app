// store.jsx — single app store: navigation, settings, active lesson, the live
// exercise session, and IndexedDB-backed data. Exposed through useApp().

import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react'
import * as db from './lib/storage.js'
import { parseLesson } from './lib/lesson-parser.js'
import { SAMPLE_YAML } from './lib/sample-lesson.js'
import { warmupNlp } from './lib/nlp-client.js'
import { configureTts } from './lib/audio/tts.js'
import { shuffle } from './lib/srs.js'

const AppCtx = createContext(null)
export const useApp = () => useContext(AppCtx)

export const SCREENS = {
  HOME: 'home', IMPORT: 'import', EXERCISE: 'exercise', RESULT: 'result',
  REVIEW: 'review', EXPORT: 'export', HISTORY: 'history',
  MISTAKES: 'mistakes', SETTINGS: 'settings',
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
  const [profiles, setProfiles] = useState([])
  const [dueCount, setDueCount] = useState(0)

  const [activeLesson, setActiveLesson] = useState(null)
  const [session, setSession] = useState({ id: null, qIdx: 0, answers: [] })

  const [toast, setToast] = useState(null)
  const toastTimer = useRef(0)

  // ---- boot ----
  useEffect(() => {
    (async () => {
      await db.ensureBootstrapped()
      const s = await db.getSettings()
      setSettings(s)
      const profile = s.active_profile || db.DEFAULT_PROFILE
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
      setProfiles(await db.getProfiles())
      setSessions(await db.getSessionSummaries(profile))
      setMistakes(await db.getMistakes(profile))
      setDueCount(await db.countDueReviews(profile))
      setReady(true)
      warmupNlp()
    })()
  }, [])

  const activeProfile = settings?.active_profile || db.DEFAULT_PROFILE

  // ---- audio ----
  useEffect(() => {
    if (settings) configureTts(settings)
  }, [settings])

  // ---- theme ----
  useEffect(() => {
    if (!settings) return
    const root = document.documentElement
    if (settings.theme === 'light') root.setAttribute('data-theme', 'light')
    else if (settings.theme === 'dark') root.setAttribute('data-theme', 'dark')
    else root.removeAttribute('data-theme')
  }, [settings?.theme])

  const refreshLibrary = useCallback(async (profile = activeProfile) => {
    setLessons(await db.getAllLessons())
    setProfiles(await db.getProfiles())
    setSessions(await db.getSessionSummaries(profile))
    setMistakes(await db.getMistakes(profile))
    setDueCount(await db.countDueReviews(profile))
  }, [activeProfile])

  // ---- profiles ----
  const switchProfile = useCallback(async (profile_id) => {
    setSettings((s) => ({ ...s, active_profile: profile_id }))
    await db.setSetting('active_profile', profile_id)
    await refreshLibrary(profile_id)
  }, [refreshLibrary])

  const addProfile = useCallback(async (name) => {
    const id = await db.saveProfile({ name })
    await switchProfile(id)
    return id
  }, [switchProfile])

  const removeProfile = useCallback(async (profile_id) => {
    await db.deleteProfile(profile_id)
    const rest = (await db.getProfiles())
    if (rest.length === 0) {
      await db.saveProfile({ profile_id: db.DEFAULT_PROFILE, name: 'Você' })
    }
    const next = (await db.getProfiles())[0].profile_id
    await switchProfile(next)
  }, [switchProfile])

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

  // Synthetic sessions built from stored questions (SRS review / practice).
  const startSynthetic = useCallback((questions, meta) => {
    const lesson = {
      lesson_id: meta.id,
      title: meta.title,
      level: meta.level || '—',
      focus: meta.focus,
      questions: shuffle(questions),
    }
    setActiveLesson(lesson)
    setSession({ id: newSessionId(meta.id), qIdx: 0, answers: [] })
    navigate(SCREENS.EXERCISE, {})
  }, [navigate])

  // "Revisão do dia": questions whose Leitner interval has elapsed.
  const startReviewSession = useCallback(async () => {
    const qs = await db.getDueReviews(activeProfile)
    if (qs.length === 0) { showToast('Nada para revisar agora 🎉'); return }
    startSynthetic(qs, { id: 'review', title: 'Revisão do dia', focus: 'revisao_espacada' })
  }, [activeProfile, startSynthetic, showToast])

  // "Treino dirigido": the questions this profile misses the most.
  const startPracticeSession = useCallback(async () => {
    const qs = await db.getPracticeQuestions(activeProfile)
    if (qs.length === 0) { showToast('Errou pouco até agora — treine com uma aula!'); return }
    startSynthetic(qs, { id: 'practice', title: 'Treino dirigido', focus: 'maiores_dificuldades' })
  }, [activeProfile, startSynthetic, showToast])

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
    // rec: { question, user_answer, analysis, spoken_transcript?, pronunciation_score? }
    const q = rec.question
    const a = rec.analysis
    // Synthetic sessions (review/practice) reuse questions from other lessons —
    // keep the question's original lesson so stats and SRS aggregate right.
    const lessonId = q.lesson_id || activeLesson.lesson_id
    const stored = {
      profile_id: activeProfile,
      lesson_id: lessonId,
      question_id: q.id,
      user_answer: rec.user_answer,
      expected_answer: a.target || q.expected_answer,
      score: a.similarity_score,
      is_correct: a.verdict === 'correct',
      verdict: a.verdict,
      mistake_type: a.verdict === 'correct' ? null : a.possible_mistake_type,
      feedback: a.feedback,
      session_id: session.id,
      spoken_transcript: rec.spoken_transcript || null,
      pronunciation_score: rec.pronunciation_score ?? null,
    }
    const key = await db.saveAnswer(stored)
    await db.updateSrs({
      profile_id: activeProfile,
      lesson_id: lessonId,
      question_id: q.id,
      correct: a.verdict === 'correct',
    })
    const entry = { ...stored, key, question: q }
    setSession((s) => ({ ...s, answers: [...s.answers, entry] }))
    return entry
  }, [activeLesson, session.id, activeProfile])

  // Persist the user's self-rated confidence ("difícil/ok/fácil") on an answer.
  // "Fácil" also pushes the question further out in the review schedule.
  const rateAnswer = useCallback(async (key, confidence) => {
    if (key == null) return
    const entry = session.answers.find((a) => a.key === key)
    setSession((s) => ({
      ...s,
      answers: s.answers.map((a) => (a.key === key ? { ...a, confidence } : a)),
    }))
    await db.updateAnswer(key, { confidence })
    if (entry) {
      await db.bumpSrsConfidence({
        profile_id: activeProfile,
        lesson_id: entry.lesson_id,
        question_id: entry.question_id,
        confidence,
      })
    }
  }, [session.answers, activeProfile])

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
    lessons, sessions, mistakes, dueCount,
    profiles, activeProfile, switchProfile, addProfile, removeProfile,
    startReviewSession, startPracticeSession,
    activeLesson, session,
    toast,
    SCREENS,
    isTab: (k) => TABS.has(k),
    navigate, back, setTab, showToast,
    refreshLibrary, saveLesson, startLesson, submitAnswer, rateAnswer, nextQuestion, updateSetting,
    db,
  }

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}
