import { createContext, useContext, useState, useRef, useEffect } from 'react'
import { useAuth } from './AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { localDateStr } from '../lib/utils.js'
import { DEFAULT_POM_SETTINGS } from '../lib/constants.js'

export function fmtTime(s) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// ── localStorage keys ─────────────────────────────────────────────────────────

const LS = {
  startedAt:     'sl_timer_startedAt',
  totalPausedMs: 'sl_timer_totalPausedMs',
  pausedAt:      'sl_timer_pausedAt',
  running:       'sl_timer_running',
  segments:      'sl_timer_segments',
}

export const TimerContext = createContext(null)

export function useTimer() {
  return useContext(TimerContext)
}

export function TimerProvider({ children }) {
  const { session } = useAuth()

  const [courses, setCourses]           = useState([])
  const [allResources, setAllResources] = useState([])
  const [coursesLoading, setCoursesLoading] = useState(true)

  const [phase, setPhase]           = useState('setup')
  const [courseId, setCourseId]     = useState('')
  const [resourceId, setResourceId] = useState('')

  const [totalSeconds, setTotalSeconds] = useState(0)
  const [running, setRunning]           = useState(false)
  const [segments, setSegments]         = useState([])

  // ── Wall-clock tracking refs ──────────────────────────────────────────────
  const sessionStartedAtRef = useRef(null)
  const totalPausedMsRef    = useRef(0)
  const pauseStartedAtRef   = useRef(null)

  const intervalRef  = useRef(null)
  const segmentsRef  = useRef([])

  const [showSwap, setShowSwap]             = useState(false)
  const [swapCourseId, setSwapCourseId]     = useState('')
  const [swapResourceId, setSwapResourceId] = useState('')

  const [showFinish, setShowFinish] = useState(false)
  const [finishForm, setFinishForm] = useState({
    pages_covered: '', notes: '',
    focus_type: 'deep_focus', energy_level: 'high',
    date: localDateStr(), course_id: '', resource_id: '', duration_minutes: '',
  })
  const [saving, setSaving]           = useState(false)
  const [finishError, setFinishError] = useState('')

  const [showDiscard, setShowDiscard] = useState(false)
  const [toast, setToast]             = useState(false)

  // ── Pomodoro refs (read-safe inside stale setInterval closures) ───────────
  const pomodoroModeRef          = useRef(false)
  const pomodoroPhaseRef         = useRef('work')
  const pomodoroCycleRef         = useRef(1)
  const pomodoroSecondsLeftRef   = useRef(0)
  const pomodoroSettingsRef      = useRef({ ...DEFAULT_POM_SETTINGS })
  const breakSecondsTotalRef     = useRef(0)
  const completedWorkCyclesRef   = useRef(0)

  // ── Pomodoro state (reactive for UI) ─────────────────────────────────────
  const [pomodoroMode,        _setPomodoroMode]        = useState(false)
  const [pomodoroPhase,       _setPomodoroPhase]       = useState('work')
  const [pomodoroCycle,       _setPomodoroCycle]       = useState(1)
  const [pomodoroSecondsLeft, _setPomodoroSecondsLeft] = useState(0)
  const [breakSecondsTotal,   _setBreakSecondsTotal]   = useState(0)
  const [pomodoroNotification, setPomodoroNotification] = useState(null)

  // ── Pomodoro public setters ───────────────────────────────────────────────

  function setPomodoroMode(val) {
    pomodoroModeRef.current = val
    _setPomodoroMode(val)
  }

  function setPomodoroSettings(settings) {
    pomodoroSettingsRef.current = settings
  }

  // ── Pomodoro internal helpers (only use refs + stable setters — safe in stale closures) ──

  function initPomodoroPhase(ph) {
    const s   = pomodoroSettingsRef.current
    const dur = ph === 'work' ? s.workMin * 60
      : ph === 'short_break'  ? s.shortBreakMin * 60
      : s.longBreakMin * 60
    pomodoroPhaseRef.current       = ph
    pomodoroSecondsLeftRef.current = dur
    _setPomodoroPhase(ph)
    _setPomodoroSecondsLeft(dur)
  }

  function handlePomodoroTransition() {
    if (navigator.vibrate) navigator.vibrate(300)

    const s            = pomodoroSettingsRef.current
    const currentPhase = pomodoroPhaseRef.current
    const currentCycle = pomodoroCycleRef.current
    let newCycle, notifMessage

    if (currentPhase === 'work') {
      completedWorkCyclesRef.current += 1
      const isLongBreak = currentCycle >= s.longBreakAfter
      const breakMin    = isLongBreak ? s.longBreakMin : s.shortBreakMin
      notifMessage = `Break time! ${breakMin} minutes`
      newCycle     = currentCycle  // cycle display stays same during break
      pomodoroCycleRef.current = newCycle
      _setPomodoroCycle(newCycle)
      initPomodoroPhase(isLongBreak ? 'long_break' : 'short_break')
    } else {
      notifMessage = 'Back to work!'
      newCycle     = currentPhase === 'long_break' ? 1 : currentCycle + 1
      pomodoroCycleRef.current = newCycle
      _setPomodoroCycle(newCycle)
      initPomodoroPhase('work')
    }

    setPomodoroNotification({ message: notifMessage, id: Date.now() })
  }

  // ── Timer tick — only refs + stable setters, safe in stale setInterval closure ──

  function timerTick() {
    setTotalSeconds(calcElapsedSeconds())

    if (!pomodoroModeRef.current) return

    const newLeft = pomodoroSecondsLeftRef.current - 1

    if (pomodoroPhaseRef.current !== 'work') {
      breakSecondsTotalRef.current += 1
      _setBreakSecondsTotal(breakSecondsTotalRef.current)
    }

    if (newLeft <= 0) {
      pomodoroSecondsLeftRef.current = 0
      _setPomodoroSecondsLeft(0)
      handlePomodoroTransition()
    } else {
      pomodoroSecondsLeftRef.current = newLeft
      _setPomodoroSecondsLeft(newLeft)
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function calcElapsedSeconds() {
    if (!sessionStartedAtRef.current) return 0
    const currentPausedMs = pauseStartedAtRef.current
      ? Date.now() - pauseStartedAtRef.current
      : 0
    const elapsed =
      Date.now() - sessionStartedAtRef.current -
      totalPausedMsRef.current -
      currentPausedMs
    return Math.max(0, Math.floor(elapsed / 1000))
  }

  function persistTimer() {
    if (!sessionStartedAtRef.current) return
    localStorage.setItem(LS.startedAt,     String(sessionStartedAtRef.current))
    localStorage.setItem(LS.totalPausedMs, String(totalPausedMsRef.current))
    localStorage.setItem(LS.pausedAt,      pauseStartedAtRef.current ? String(pauseStartedAtRef.current) : '')
    localStorage.setItem(LS.running,       pauseStartedAtRef.current ? 'false' : 'true')
    localStorage.setItem(LS.segments,      JSON.stringify(segmentsRef.current))
  }

  function clearPersistedTimer() {
    Object.values(LS).forEach(k => localStorage.removeItem(k))
  }

  // ── Restore from localStorage on mount ───────────────────────────────────

  useEffect(() => {
    const startedAtStr = localStorage.getItem(LS.startedAt)
    if (!startedAtStr) return

    const startedAt     = Number(startedAtStr)
    const totalPausedMs = Number(localStorage.getItem(LS.totalPausedMs) || '0')
    const pausedAtStr   = localStorage.getItem(LS.pausedAt)
    const pausedAt      = pausedAtStr ? Number(pausedAtStr) : null
    const wasRunning    = localStorage.getItem(LS.running) === 'true'
    const savedSegs     = JSON.parse(localStorage.getItem(LS.segments) || '[]')

    if (!startedAt || savedSegs.length === 0 || Date.now() - startedAt > 86_400_000) {
      clearPersistedTimer()
      return
    }

    sessionStartedAtRef.current = startedAt
    totalPausedMsRef.current    = totalPausedMs
    pauseStartedAtRef.current   = wasRunning ? null : (pausedAt ?? Date.now())

    segmentsRef.current = savedSegs
    setSegments(savedSegs)
    setPhase('running')
    setTotalSeconds(calcElapsedSeconds())

    if (wasRunning) {
      // Restored sessions always run as stopwatch (Pomodoro state is not persisted)
      intervalRef.current = setInterval(timerTick, 1000)
      setRunning(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { segmentsRef.current = segments }, [segments])

  useEffect(() => {
    if (session === null) resetAll()
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load courses + resources ──────────────────────────────────────────────

  useEffect(() => {
    if (!session) return
    Promise.all([
      supabase.from('courses').select('id, name, emoji, color').order('name'),
      supabase.from('resources').select('id, course_id, name, type, link').order('name'),
    ]).then(([{ data: c, error: ce }, { data: r, error: re }]) => {
      if (ce) { console.error('Failed to load courses:', ce); setCourses([]) }
      else if (c) setCourses(c)
      if (re) { console.error('Failed to load resources:', re); setAllResources([]) }
      else if (r) setAllResources(r)
      setCoursesLoading(false)
    }).catch(() => {
      setCoursesLoading(false)
    })
    return () => clearInterval(intervalRef.current)
  }, [session])

  // ── Browser tab title ─────────────────────────────────────────────────────

  useEffect(() => {
    document.title = phase === 'running'
      ? `⏱ ${fmtTime(totalSeconds)} - StudyLog`
      : 'StudyLog'
  }, [totalSeconds, phase])

  // ── Background notification (fires when tab is hidden) ────────────────────

  useEffect(() => {
    if (phase !== 'running') return
    let notif  = null
    let tickId = null

    function getLabel() {
      const seg = segmentsRef.current[segmentsRef.current.length - 1]
      const ctx = seg
        ? `${seg.courseName}${seg.resourceName ? ` › ${seg.resourceName}` : ''}`
        : 'Session'
      return `${ctx} — ${fmtTime(calcElapsedSeconds())} elapsed`
    }

    function notify() {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
      notif = new Notification('StudyLog Timer Running', {
        body: getLabel(), silent: true, tag: 'studylog-timer',
      })
    }

    function onVisibility() {
      if (document.hidden) {
        notify()
        tickId = setInterval(notify, 60_000)
      } else {
        clearInterval(tickId)
        tickId = null
        if (notif) { notif.close(); notif = null }
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      clearInterval(tickId)
      if (notif) notif.close()
    }
  }, [phase])

  // ── Clock controls ────────────────────────────────────────────────────────

  function startClock() {
    if (pauseStartedAtRef.current !== null) {
      totalPausedMsRef.current += Date.now() - pauseStartedAtRef.current
      pauseStartedAtRef.current = null
    }
    clearInterval(intervalRef.current)
    intervalRef.current = setInterval(timerTick, 1000)
    setRunning(true)
    persistTimer()
  }

  function pauseClock() {
    clearInterval(intervalRef.current)
    pauseStartedAtRef.current = Date.now()
    setTotalSeconds(calcElapsedSeconds())
    setRunning(false)
    persistTimer()
  }

  // ── Session lifecycle ─────────────────────────────────────────────────────

  function startSession() {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    const course   = courses.find(c => c.id === courseId)
    if (!course) return
    const resource = allResources.find(r => r.id === resourceId)

    const initialSegments = [{
      course_id: course.id, resource_id: resource?.id ?? null,
      courseName: course.name, courseEmoji: course.emoji, courseColor: course.color,
      resourceName: resource?.name ?? null,
      resourceLink: resource?.link ?? null,
      startSeconds: 0,
    }]
    segmentsRef.current = initialSegments
    setSegments(initialSegments)

    sessionStartedAtRef.current = Date.now()
    totalPausedMsRef.current    = 0
    pauseStartedAtRef.current   = null

    if (pomodoroModeRef.current) {
      breakSecondsTotalRef.current   = 0
      completedWorkCyclesRef.current = 0
      pomodoroCycleRef.current       = 1
      _setBreakSecondsTotal(0)
      _setPomodoroCycle(1)
      initPomodoroPhase('work')
    }

    setTotalSeconds(0)
    setPhase('running')
    startClock()
  }

  function openSwap() {
    const cur = segments[segments.length - 1]
    setSwapCourseId(cur.course_id)
    setSwapResourceId(cur.resource_id ?? '')
    setShowSwap(true)
  }

  function confirmSwap() {
    const course   = courses.find(c => c.id === swapCourseId)
    if (!course) { setShowSwap(false); return }
    const resource = allResources.find(r => r.id === swapResourceId)
    const snapSecs = calcElapsedSeconds()

    const next = [...segmentsRef.current, {
      course_id: course.id, resource_id: resource?.id ?? null,
      courseName: course.name, courseEmoji: course.emoji, courseColor: course.color,
      resourceName: resource?.name ?? null,
      resourceLink: resource?.link ?? null,
      startSeconds: snapSecs,
    }]
    segmentsRef.current = next
    setSegments(next)
    setShowSwap(false)
    persistTimer()
  }

  function openFinish() {
    if (running) pauseClock()
    setFinishError('')
    const elapsed  = calcElapsedSeconds()
    const workSecs = pomodoroModeRef.current
      ? Math.max(0, elapsed - breakSecondsTotalRef.current)
      : elapsed
    const lastSeg  = segments[segments.length - 1]
    const nCycles  = completedWorkCyclesRef.current
    const pomNote  = pomodoroModeRef.current && nCycles > 0
      ? `[Pomodoro: ${nCycles} cycle${nCycles !== 1 ? 's' : ''}] `
      : ''
    setFinishForm({
      pages_covered: '', notes: pomNote,
      focus_type: 'deep_focus', energy_level: 'high',
      date: localDateStr(),
      course_id:        lastSeg?.course_id   ?? '',
      resource_id:      lastSeg?.resource_id ?? '',
      duration_minutes: String(Math.max(1, Math.round(workSecs / 60))),
    })
    setShowFinish(true)
  }

  async function submitFinish() {
    setFinishError('')
    const totalElapsed     = calcElapsedSeconds()
    const isSingle         = segments.length === 1
    const explicitDuration = Number(finishForm.duration_minutes)
    if (isSingle && (!Number.isInteger(explicitDuration) || explicitDuration < 1 || explicitDuration > 720)) {
      setFinishError('Duration must be a whole number between 1 and 720 minutes.')
      return
    }
    const rows = segments.map((seg, i) => {
      const endSec        = i < segments.length - 1 ? segments[i + 1].startSeconds : totalElapsed
      const timerDuration = Math.max(1, Math.round((endSec - seg.startSeconds) / 60))
      return {
        user_id:          session.user.id,
        course_id:        isSingle ? finishForm.course_id       : seg.course_id,
        resource_id:      isSingle ? (finishForm.resource_id || null) : (seg.resource_id ?? null),
        duration_minutes: isSingle && finishForm.duration_minutes
          ? explicitDuration
          : timerDuration,
        pages_covered: finishForm.pages_covered.trim() || null,
        focus_type:    finishForm.focus_type   || null,
        energy_level:  finishForm.energy_level || null,
        date:          finishForm.date,
        notes:         finishForm.notes.trim() || null,
      }
    })
    if (rows.some(row => row.duration_minutes > 720)) {
      setFinishError('Duration cannot exceed 720 minutes.')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('sessions').insert(rows)
    setSaving(false)
    if (error) {
      setFinishError(error.message || 'Could not save session. Please try again.')
    } else {
      resetAll()
      setToast(true)
    }
  }

  function resetAll() {
    clearInterval(intervalRef.current)
    intervalRef.current = null
    sessionStartedAtRef.current = null
    totalPausedMsRef.current    = 0
    pauseStartedAtRef.current   = null
    clearPersistedTimer()
    setTotalSeconds(0)
    setRunning(false)
    setSegments([])
    setPhase('setup')
    setShowFinish(false)
    setFinishError('')
    setShowSwap(false)
    setShowDiscard(false)
    // Reset Pomodoro session state — keep pomodoroMode (user preference)
    pomodoroPhaseRef.current       = 'work'
    pomodoroCycleRef.current       = 1
    pomodoroSecondsLeftRef.current = 0
    breakSecondsTotalRef.current   = 0
    completedWorkCyclesRef.current = 0
    _setPomodoroPhase('work')
    _setPomodoroCycle(1)
    _setPomodoroSecondsLeft(0)
    _setBreakSecondsTotal(0)
    setPomodoroNotification(null)
  }

  return (
    <TimerContext.Provider value={{
      courses, allResources, coursesLoading,
      phase,
      courseId, setCourseId,
      resourceId, setResourceId,
      totalSeconds, running,
      segments,
      showSwap, setShowSwap, swapCourseId, setSwapCourseId, swapResourceId, setSwapResourceId,
      showFinish, setShowFinish, finishForm, setFinishForm, saving, finishError,
      showDiscard, setShowDiscard,
      toast, setToast,
      startClock, pauseClock,
      startSession, openSwap, confirmSwap, openFinish, submitFinish, resetAll,
      // Pomodoro
      pomodoroMode, setPomodoroMode,
      pomodoroPhase,
      pomodoroCycle,
      pomodoroSecondsLeft,
      breakSecondsTotal,
      setPomodoroSettings,
      pomodoroNotification, setPomodoroNotification,
    }}>
      {children}
    </TimerContext.Provider>
  )
}
