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

const TimerContext = createContext(null)

export function useTimer() {
  return useContext(TimerContext)
}

export function TimerProvider({ children }) {
  const { session } = useAuth()

  const [courses, setCourses] = useState([])
  const [allResources, setAllResources] = useState([])

  const [phase, setPhase] = useState('setup')
  const [courseId, setCourseId] = useState('')
  const [resourceId, setResourceId] = useState('')

  const [totalSeconds, setTotalSeconds] = useState(0)
  const [running, setRunning] = useState(false)
  const accumulatedRef = useRef(0)
  const startTsRef = useRef(null)
  const intervalRef = useRef(null)
  const runningRef = useRef(false)
  const segmentsRef = useRef([])

  const [segments, setSegments] = useState([])

  const [showSwap, setShowSwap] = useState(false)
  const [swapCourseId, setSwapCourseId] = useState('')
  const [swapResourceId, setSwapResourceId] = useState('')

  const [showFinish, setShowFinish] = useState(false)
  const [finishForm, setFinishForm] = useState({ pages_covered: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const [showDiscard, setShowDiscard] = useState(false)
  const [toast, setToast] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('courses').select('id, name, emoji, color').order('name'),
      supabase.from('resources').select('id, course_id, name').order('name'),
    ]).then(([{ data: c }, { data: r }]) => {
      if (c) setCourses(c)
      if (r) setAllResources(r)
    })
    return () => clearInterval(intervalRef.current)
  }, [])

  useEffect(() => { runningRef.current = running }, [running])
  useEffect(() => { segmentsRef.current = segments }, [segments])

  useEffect(() => {
    document.title = phase === 'running'
      ? `⏱ ${fmtTime(totalSeconds)} - StudyLog`
      : 'StudyLog'
  }, [totalSeconds, phase])

  useEffect(() => {
    if (phase !== 'running') return
    let notif = null
    let tickId = null

    function getLabel() {
      const seg = segmentsRef.current[segmentsRef.current.length - 1]
      const elapsed = runningRef.current && startTsRef.current
        ? accumulatedRef.current + Math.floor((Date.now() - startTsRef.current) / 1000)
        : accumulatedRef.current
      const ctx = seg
        ? `${seg.courseName}${seg.resourceName ? ` › ${seg.resourceName}` : ''}`
        : 'Session'
      return `${ctx} — ${fmtTime(elapsed)} elapsed`
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
        tickId = setInterval(notify, 60000)
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

  function startClock() {
    startTsRef.current = Date.now()
    intervalRef.current = setInterval(() => {
      setTotalSeconds(accumulatedRef.current + Math.floor((Date.now() - startTsRef.current) / 1000))
    }, 500)
    setRunning(true)
  }

  function pauseClock() {
    clearInterval(intervalRef.current)
    accumulatedRef.current += Math.floor((Date.now() - startTsRef.current) / 1000)
    setTotalSeconds(accumulatedRef.current)
    setRunning(false)
  }

  function startSession() {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    const course = courses.find(c => c.id === courseId)
    const resource = allResources.find(r => r.id === resourceId)
    setSegments([{
      course_id: course.id, resource_id: resource?.id ?? null,
      courseName: course.name, courseEmoji: course.emoji, courseColor: course.color,
      resourceName: resource?.name ?? null, startSeconds: 0,
    }])
    accumulatedRef.current = 0
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
    const course = courses.find(c => c.id === swapCourseId)
    const resource = allResources.find(r => r.id === swapResourceId)
    const snapSeconds = accumulatedRef.current + (running ? Math.floor((Date.now() - startTsRef.current) / 1000) : 0)
    setSegments(prev => [...prev, {
      course_id: course.id, resource_id: resource?.id ?? null,
      courseName: course.name, courseEmoji: course.emoji, courseColor: course.color,
      resourceName: resource?.name ?? null, startSeconds: snapSeconds,
    }])
    setShowSwap(false)
  }

  function openFinish() {
    if (running) pauseClock()
    setFinishForm({ pages_covered: '', notes: '' })
    setShowFinish(true)
  }

  async function submitFinish() {
    setSaving(true)
    const date = new Date().toISOString().split('T')[0]
    const rows = segments.map((seg, i) => {
      const endSec = i < segments.length - 1 ? segments[i + 1].startSeconds : totalSeconds
      return {
        user_id: session.user.id,
        course_id: seg.course_id,
        resource_id: seg.resource_id ?? null,
        duration_minutes: Math.max(1, Math.round((endSec - seg.startSeconds) / 60)),
        pages_covered: finishForm.pages_covered.trim() || null,
        notes: finishForm.notes.trim() || null,
        date,
      }
    })
    const { error } = await supabase.from('sessions').insert(rows)
    setSaving(false)
    if (!error) { resetAll(); setToast(true) }
  }

  function resetAll() {
    clearInterval(intervalRef.current)
    accumulatedRef.current = 0
    startTsRef.current = null
    setTotalSeconds(0)
    setRunning(false)
    setSegments([])
    setPhase('setup')
    setShowFinish(false)
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
      showFinish, setShowFinish, finishForm, setFinishForm, saving,
      showDiscard, setShowDiscard,
      toast, setToast,
      startClock, pauseClock,
      startSession, openSwap, confirmSwap, openFinish, submitFinish, resetAll,
    }}>
      {children}
    </TimerContext.Provider>
  )
}
