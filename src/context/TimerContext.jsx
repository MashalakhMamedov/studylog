import { createContext, useContext, useState, useRef, useEffect } from 'react'
import { useAuth } from './AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

export function fmtTime(s) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function localDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── localStorage keys ─────────────────────────────────────────────────────────

const LS = {
  startedAt:     'sl_timer_startedAt',     // ms timestamp when session started
  totalPausedMs: 'sl_timer_totalPausedMs', // cumulative ms spent paused (completed pauses only)
  pausedAt:      'sl_timer_pausedAt',      // ms timestamp when current pause started ('' if running)
  running:       'sl_timer_running',       // 'true' | 'false'
  segments:      'sl_timer_segments',      // JSON array of segment objects
}

const TimerContext = createContext(null)

export function useTimer() {
  return useContext(TimerContext)
}

export function TimerProvider({ children }) {
  const { session } = useAuth()

  const [courses, setCourses]         = useState([])
  const [allResources, setAllResources] = useState([])

  const [phase, setPhase]           = useState('setup')
  const [courseId, setCourseId]     = useState('')
  const [resourceId, setResourceId] = useState('')

  const [totalSeconds, setTotalSeconds] = useState(0)
  const [running, setRunning]           = useState(false)
  const [segments, setSegments]         = useState([])

  // ── Wall-clock tracking refs ──────────────────────────────────────────────
  // Elapsed = (now - sessionStartedAt) - totalPausedMs - currentPauseDuration
  const sessionStartedAtRef = useRef(null) // Date.now() when session began
  const totalPausedMsRef    = useRef(0)    // sum of all completed pause durations (ms)
  const pauseStartedAtRef   = useRef(null) // Date.now() when the current pause began (null if running)

  const intervalRef  = useRef(null)
  const segmentsRef  = useRef([])          // mirror of segments state for event-handler closures

  const [showSwap, setShowSwap]           = useState(false)
  const [swapCourseId, setSwapCourseId]   = useState('')
  const [swapResourceId, setSwapResourceId] = useState('')

  const [showFinish, setShowFinish] = useState(false)
  const [finishForm, setFinishForm] = useState({
    pages_covered: '', notes: '',
    focus_type: 'deep_focus', energy_level: 'high',
    date: localDateStr(), course_id: '', resource_id: '', duration_minutes: '',
  })
  const [saving, setSaving] = useState(false)
  const [finishError, setFinishError] = useState('')

  const [showDiscard, setShowDiscard] = useState(false)
  const [toast, setToast]             = useState(false)

  // ── Helpers ───────────────────────────────────────────────────────────────

  // Always reads from refs — safe to call inside intervals and event handlers.
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

  // ── Restore from localStorage on mount (handles page kills & PWA restarts) ─

  useEffect(() => {
    const startedAtStr = localStorage.getItem(LS.startedAt)
    if (!startedAtStr) return

    const startedAt     = Number(startedAtStr)
    const totalPausedMs = Number(localStorage.getItem(LS.totalPausedMs) || '0')
    const pausedAtStr   = localStorage.getItem(LS.pausedAt)
    const pausedAt      = pausedAtStr ? Number(pausedAtStr) : null
    const wasRunning    = localStorage.getItem(LS.running) === 'true'
    const savedSegs     = JSON.parse(localStorage.getItem(LS.segments) || '[]')

    // Guard against corrupt / impossibly old data (> 24 h)
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
      intervalRef.current = setInterval(() => setTotalSeconds(calcElapsedSeconds()), 1000)
      setRunning(true)
    }
    // If paused: display the frozen elapsed time, leave interval stopped.
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keep segmentsRef in sync for closures ─────────────────────────────────

  useEffect(() => { segmentsRef.current = segments }, [segments])

  // ── Load courses + resources ──────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      supabase.from('courses').select('id, name, emoji, color').order('name'),
      supabase.from('resources').select('id, course_id, name, type').order('name'),
    ]).then(([{ data: c }, { data: r }]) => {
      if (c) setCourses(c)
      if (r) setAllResources(r)
    })
    return () => clearInterval(intervalRef.current)
  }, [])

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
    // Account for the just-ended pause (works for both fresh start and resume).
    // On fresh start pauseStartedAtRef is already null so nothing changes.
    if (pauseStartedAtRef.current !== null) {
      totalPausedMsRef.current += Date.now() - pauseStartedAtRef.current
      pauseStartedAtRef.current = null
    }
    clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => setTotalSeconds(calcElapsedSeconds()), 1000)
    setRunning(true)
    persistTimer()
  }

  function pauseClock() {
    clearInterval(intervalRef.current)
    pauseStartedAtRef.current = Date.now()
    setTotalSeconds(calcElapsedSeconds()) // snapshot the correct elapsed time
    setRunning(false)
    persistTimer()
  }

  // ── Session lifecycle ─────────────────────────────────────────────────────

  function startSession() {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    const course   = courses.find(c => c.id === courseId)
    const resource = allResources.find(r => r.id === resourceId)

    const initialSegments = [{
      course_id: course.id, resource_id: resource?.id ?? null,
      courseName: course.name, courseEmoji: course.emoji, courseColor: course.color,
      resourceName: resource?.name ?? null, startSeconds: 0,
    }]
    segmentsRef.current = initialSegments
    setSegments(initialSegments)

    // Initialise wall-clock tracking — must happen before startClock()
    sessionStartedAtRef.current = Date.now()
    totalPausedMsRef.current    = 0
    pauseStartedAtRef.current   = null

    setTotalSeconds(0)
    setPhase('running')
    startClock() // starts interval + persists
  }

  function openSwap() {
    const cur = segments[segments.length - 1]
    setSwapCourseId(cur.course_id)
    setSwapResourceId(cur.resource_id ?? '')
    setShowSwap(true)
  }

  function confirmSwap() {
    const course   = courses.find(c => c.id === swapCourseId)
    const resource = allResources.find(r => r.id === swapResourceId)
    const snapSecs = calcElapsedSeconds()

    const next = [...segmentsRef.current, {
      course_id: course.id, resource_id: resource?.id ?? null,
      courseName: course.name, courseEmoji: course.emoji, courseColor: course.color,
      resourceName: resource?.name ?? null, startSeconds: snapSecs,
    }]
    segmentsRef.current = next
    setSegments(next)
    setShowSwap(false)
    persistTimer()
  }

  function openFinish() {
    if (running) pauseClock()
    setFinishError('')
    const elapsed = calcElapsedSeconds() // accurate from wall-clock refs
    const lastSeg = segments[segments.length - 1]
    setFinishForm({
      pages_covered: '', notes: '',
      focus_type: 'deep_focus', energy_level: 'high',
      date: localDateStr(),
      course_id:  lastSeg?.course_id  ?? '',
      resource_id: lastSeg?.resource_id ?? '',
      duration_minutes: String(Math.max(1, Math.round(elapsed / 60))),
    })
    setShowFinish(true)
  }

  async function submitFinish() {
    setFinishError('')
    const totalElapsed = calcElapsedSeconds()
    const isSingle = segments.length === 1
    const explicitDuration = Number(finishForm.duration_minutes)
    if (isSingle && (!Number.isInteger(explicitDuration) || explicitDuration < 1 || explicitDuration > 720)) {
      setFinishError('Duration must be a whole number between 1 and 720 minutes.')
      return
    }
    const rows = segments.map((seg, i) => {
      const endSec      = i < segments.length - 1 ? segments[i + 1].startSeconds : totalElapsed
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
  }

  return (
    <TimerContext.Provider value={{
      courses, allResources,
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
    }}>
      {children}
    </TimerContext.Provider>
  )
}
