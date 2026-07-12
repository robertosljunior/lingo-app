// store.jsx — single app store: navigation, settings, active lesson, the live
// exercise session, and IndexedDB-backed data. Exposed through useApp().

import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react'
import * as db from './lib/storage.js'
import { parseLesson } from './lib/lesson-parser.js'
import { SAMPLE_YAML } from './lib/sample-lesson.js'
import { warmupNlp } from './lib/nlp-client.js'
import { configureTts } from './lib/audio/tts.js'
import { generateLessonFromContext, buildGeneratedLessonYaml } from './lib/lesson-generator.js'
import { inferAssessedSkills } from './lib/skill-profile.js'


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

// Test-only hook: E2E runs may inject a deterministic generation seed through
// sessionStorage. Never set during normal usage; sessionStorage dies with the
// tab, so it cannot leak into a real install.
function e2eGenerationSeed() {
  try { return window.sessionStorage.getItem('e2e:generation-seed') } catch { return null }
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
  const [skillProfiles, setSkillProfiles] = useState([])
  const [profiles, setProfiles] = useState([])
  const [dueCount, setDueCount] = useState(0)

  const [activeLesson, setActiveLesson] = useState(null)
  const [session, setSession] = useState({ id: null, qIdx: 0, answers: [] })

  const [toast, setToast] = useState(null)
  const toastTimer = useRef(0)
  const adaptiveStartRef = useRef(false)
  const generationStartRef = useRef(false)

  // ---- boot ----
  useEffect(() => {
    (async () => {
      await db.ensureBootstrapped()
      // Test-only hook: E2E runs flag the tab via sessionStorage to reach the
      // same public storage layer the UI uses (never set in normal usage).
      try { if (window.sessionStorage.getItem('e2e:enabled')) window.__e2e = { db } } catch { /* noop */ }
      const s = await db.getSettings()
      setSettings(s)
      const profile = s.active_profile || db.DEFAULT_PROFILE
      // Seed the sample lesson on first run so the app is usable immediately.
      let all = await db.getAllLessons(profile)
      if (all.length === 0) {
        try {
          const lesson = parseLesson(SAMPLE_YAML)
          await db.saveLesson(lesson)
          all = await db.getAllLessons(profile)
        } catch { /* ignore seed failure */ }
      }
      setLessons(all)
      setProfiles(await db.getProfiles())
      setSessions(await db.getSessionSummaries(profile))
      if (s[`skill_profile_rebuild_version:${profile}`] !== '1') {
        await db.rebuildSkillProfilesFromEvaluations(profile).catch(() => {})
      }
      setMistakes(await db.getMistakes(profile))
      setSkillProfiles(await db.getSkillProfiles(profile))
      setDueCount(await db.countDueReviews(profile))
      const persisted = await db.getPersistedAdaptiveSession(profile).catch(() => null)
      if (persisted?.session?.mode === 'adaptive_review' && persisted.session.profile_id === profile && persisted?.lesson?.questions?.length) {
        setActiveLesson(persisted.lesson)
        setSession(persisted.session)
        setScreen(SCREENS.EXERCISE)
      }
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
    setLessons(await db.getAllLessons(profile))
    setProfiles(await db.getProfiles())
    setSessions(await db.getSessionSummaries(profile))
    setMistakes(await db.getMistakes(profile))
    setSkillProfiles(await db.getSkillProfiles(profile))
    setDueCount(await db.countDueReviews(profile))
  }, [activeProfile])

  // ---- profiles ----
  const switchProfile = useCallback(async (profile_id) => {
    setSettings((s) => ({ ...s, active_profile: profile_id }))
    await db.setSetting('active_profile', profile_id)
    // The in-memory lesson/session belongs to the previous profile — drop it
    // so nothing private carries over to the newly selected profile.
    setActiveLesson(null)
    setSession({ id: null, qIdx: 0, answers: [] })
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
    // With the neural engine on, pre-synthesize the lesson's sentences in the
    // background so every "ouvir" is instant and offline.
    if (settings?.tts_engine === 'piper') {
      import('./lib/audio/tts-piper.js')
        .then((piper) => piper.warmCache(
          lesson.questions.map((q) => q.expected_answer).filter(Boolean),
          settings.piper_voice,
        ))
        .catch(() => {})
    }
    return saved
  }, [refreshLibrary, settings?.tts_engine, settings?.piper_voice])

  // Synthetic sessions built from stored questions (SRS review / practice).
  const startSynthetic = useCallback((questions, meta) => {
    const lesson = {
      lesson_id: meta.id,
      title: meta.title,
      level: meta.level || '—',
      focus: meta.focus,
      mode: meta.mode || 'synthetic',
      questions,
    }
    const nextSession = { id: newSessionId(meta.id), qIdx: 0, answers: [], mode: meta.mode || 'synthetic', adaptive_plan: meta.plan || null, profile_id: activeProfile }
    setActiveLesson(lesson)
    setSession(nextSession)
    if (meta.mode === 'adaptive_review') db.persistAdaptiveSession(activeProfile, { lesson, session: nextSession }).catch(() => {})
    navigate(SCREENS.EXERCISE, {})
  }, [navigate, activeProfile])

  // "Revisão do dia": questions whose Leitner interval has elapsed.
  const startReviewSession = useCallback(async () => {
    const qs = await db.getDueReviews(activeProfile)
    if (qs.length === 0) { showToast('Nada para revisar agora 🎉'); return }
    startSynthetic(qs, { id: 'review', title: 'Revisão do dia', focus: 'revisao_espacada' })
  }, [activeProfile, startSynthetic, showToast])

  // "Treino dirigido": the questions this profile misses the most.
  const startPracticeSession = useCallback(async (targetSkillId = null) => {
    if (adaptiveStartRef.current) return
    adaptiveStartRef.current = true
    try {
    const plan = await db.getAdaptivePracticePlan(activeProfile, { requestedSize: 10, targetSkillId })
    if (!plan.selected_questions.length) { showToast('Ainda não há perguntas cadastradas para essa prática.'); return }
    const all = await db.getAllQuestions(activeProfile)
    const byKey = new Map(all.map((q) => [`${q.lesson_id}:${q.id}`, q]))
    const qs = plan.selected_questions.map((sq) => byKey.get(`${sq.lesson_id}:${sq.question_id}`)).filter(Boolean)
    const label = targetSkillId ? `Prática: ${plan.target_skills.find((s) => s.skill_id === targetSkillId)?.skill_id || targetSkillId}` : 'Prática adaptativa'
    startSynthetic(qs, { id: 'adaptive_review', title: label, focus: targetSkillId || 'adaptive_review', mode: 'adaptive_review', plan })
    } finally { adaptiveStartRef.current = false }
  }, [activeProfile, startSynthetic, showToast])


  const generateAdaptiveLesson = useCallback(async ({ questionCount = 30, targetSkillId = null, seed = null } = {}) => {
    if (generationStartRef.current) return null
    generationStartRef.current = true
    try {
      const context = await db.buildLessonGenerationContext(activeProfile)
      context.profile_id = activeProfile
      if (targetSkillId) {
        const found = context.target_skills.find((s) => s.skill_id === targetSkillId) || { skill_id: targetSkillId, priority: 1, mastery: 0.4, evidence: 'emerging' }
        context.target_skills = [found, ...context.target_skills.filter((s) => s.skill_id !== targetSkillId)]
      }
      const lesson = generateLessonFromContext(context, { questionCount, seed: seed ?? e2eGenerationSeed(), profileId: activeProfile })
      const saved = await db.saveLesson(lesson)
      await refreshLibrary(activeProfile)
      return { lesson: saved, yaml: buildGeneratedLessonYaml(saved), validation: lesson.generation_metadata }
    } finally { generationStartRef.current = false }
  }, [activeProfile, refreshLibrary])

  const startLesson = useCallback(async (lesson) => {
    // Lessons coming from the list view carry no questions (separate store) —
    // hydrate the full record before starting. Private lessons owned by another
    // profile are refused by the storage layer.
    let full
    try {
      full = lesson.questions?.length ? lesson : await db.getLesson(lesson.lesson_id, { profile_id: activeProfile })
    } catch (e) {
      if (e?.code === db.LESSON_NOT_ACCESSIBLE) { showToast('Esta aula pertence a outro perfil.'); return }
      throw e
    }
    if (!full || !full.questions?.length) return
    if (full.owner_profile_id && full.owner_profile_id !== activeProfile) { showToast('Esta aula pertence a outro perfil.'); return }
    setActiveLesson(full)
    setSession({ id: newSessionId(full.lesson_id), qIdx: 0, answers: [] })
    navigate(SCREENS.EXERCISE, {})
  }, [navigate, activeProfile, showToast])

  const submitAnswer = useCallback(async (rec) => {
    // rec: { question, user_answer, analysis, spoken_transcript?, pronunciation_score? }
    const q = rec.question
    const a = rec.analysis
    // Synthetic sessions (review/practice) reuse questions from other lessons —
    // keep the question's original lesson so stats and SRS aggregate right.
    const lessonId = q.lesson_id || activeLesson.lesson_id
    const evaluation = {
      engine_version: a.engine_version || '1',
      verdict: a.verdict,
      score: a.score ?? a.similarity_score,
      primary_error: a.primary_error || null,
      detected_errors: a.detected_errors || [],
      alignment: a.alignment || [],
      accepted_differences: a.accepted_differences || [],
      target_answer: a.target_answer || a.target || q.expected_answer,
      normalized_user_answer: a.normalized_user_answer,
      normalized_expected_answer: a.normalized_expected_answer,
    }
    // Persist the assessed skills so Result/Review can summarize the session
    // and the skill-profile pipeline consumes exactly what the UI showed.
    evaluation.assessed_skills = a.assessed_skills?.length
      ? a.assessed_skills
      : inferAssessedSkills({ evaluation, question: q, user_answer: rec.user_answer, expected_answer: evaluation.target_answer })
    const stored = {
      profile_id: activeProfile,
      lesson_id: lessonId,
      question_id: q.id,
      user_answer: rec.user_answer,
      expected_answer: a.target || q.expected_answer,
      score: a.similarity_score,
      is_correct: a.verdict === 'correct',
      verdict: a.verdict,
      mistake_type: a.verdict === 'correct' ? null : (evaluation.primary_error?.category || a.possible_mistake_type),
      feedback: a.feedback,
      evaluation,
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
    lessons, sessions, mistakes, skillProfiles, dueCount,
    profiles, activeProfile, switchProfile, addProfile, removeProfile,
    startReviewSession, startPracticeSession, generateAdaptiveLesson,
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
