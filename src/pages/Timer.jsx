import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

// Wall-clock based format — never drifts even when tab is backgrounded
function fmtTime(s) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function fmtMinutes(seconds) {
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export default function Timer() {
  const { session } = useAuth()
  const navigate = useNavigate()

  const [courses, setCourses] = useState([])
  const [allResources, setAllResources] = useState([])

  const [phase, setPhase] = useState('setup') // 'setup' | 'running' | 'finish'
  const [courseId, setCourseId] = useState('')
  const [resourceId, setResourceId] = useState('')

  const [totalSeconds, setTotalSeconds] = useState(0)
  const [running, setRunning] = useState(false)
  // Refs hold timing state — immune to React render scheduling and tab throttling
  const accumulatedRef = useRef(0)
  const startTsRef = useRef(null)
  const intervalRef = useRef(null)

  // Each segment: { course_id, resource_id|null, courseName, courseEmoji, courseColor, resourceName|null, startSeconds }
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

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => { setToast(false); navigate('/') }, 1800)
    return () => clearTimeout(t)
  }, [toast])

  // ── Timing primitives (imperative, no useEffect dependency) ──────────────

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

  // ── Session actions ──────────────────────────────────────────────────────

  function startSession() {
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
    // Snapshot totalSeconds at swap moment — computed from wall clock so it's accurate even if throttled
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

  // ── Derived ──────────────────────────────────────────────────────────────

  const currentSeg = segments[segments.length - 1]
  const setupResources = allResources.filter(r => r.course_id === courseId)
  const swapResources = allResources.filter(r => r.course_id === swapCourseId)

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="px-4 pt-8 pb-6">
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#e8e8ec' }}>Focus Timer</h1>

      {phase === 'setup' && (
        <SetupView
          courses={courses}
          resources={setupResources}
          courseId={courseId}
          resourceId={resourceId}
          onCourseChange={id => { setCourseId(id); setResourceId('') }}
          onResourceChange={setResourceId}
          onStart={startSession}
        />
      )}

      {phase === 'running' && currentSeg && (
        <RunningView
          totalSeconds={totalSeconds}
          running={running}
          segment={currentSeg}
          segmentCount={segments.length}
          onPause={pauseClock}
          onResume={startClock}
          onSwap={openSwap}
          onFinish={openFinish}
          onDiscard={() => setShowDiscard(true)}
        />
      )}

      {showSwap && (
        <SwapModal
          courses={courses}
          resources={swapResources}
          courseId={swapCourseId}
          resourceId={swapResourceId}
          onCourseChange={id => { setSwapCourseId(id); setSwapResourceId('') }}
          onResourceChange={setSwapResourceId}
          onConfirm={confirmSwap}
          onClose={() => setShowSwap(false)}
        />
      )}

      {showFinish && (
        <FinishModal
          totalSeconds={totalSeconds}
          segments={segments}
          form={finishForm}
          setForm={setFinishForm}
          saving={saving}
          onSubmit={submitFinish}
          onClose={() => { setShowFinish(false); if (!running) startClock() }}
        />
      )}

      {showDiscard && (
        <DiscardModal
          onConfirm={resetAll}
          onCancel={() => setShowDiscard(false)}
        />
      )}

      {toast && <Toast />}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SetupView({ courses, resources, courseId, resourceId, onCourseChange, onResourceChange, onStart }) {
  return (
    <div className="space-y-4">
      <Field label="Course *">
        <select
          value={courseId}
          onChange={e => onCourseChange(e.target.value)}
          className="h-11 px-3 rounded-xl text-sm w-full outline-none"
          style={{ backgroundColor: '#1a1a1e', border: '1px solid #2a2a30', color: courseId ? '#e8e8ec' : '#6b6b78' }}
        >
          <option value="" disabled>Select a course</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
      </Field>

      <Field label="Resource (optional)">
        <select
          value={resourceId}
          onChange={e => onResourceChange(e.target.value)}
          disabled={!courseId}
          className="h-11 px-3 rounded-xl text-sm w-full outline-none"
          style={{
            backgroundColor: '#1a1a1e', border: '1px solid #2a2a30',
            color: resourceId ? '#e8e8ec' : '#6b6b78',
            opacity: courseId ? 1 : 0.45,
          }}
        >
          <option value="">None</option>
          {resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </Field>

      <button
        onClick={onStart}
        disabled={!courseId}
        className="w-full py-4 rounded-2xl font-bold text-base mt-2"
        style={{
          backgroundColor: courseId ? '#7c6af7' : '#1a1a1e',
          color: courseId ? '#fff' : '#6b6b78',
          border: courseId ? 'none' : '1px solid #2a2a30',
        }}
      >
        Start Session
      </button>
    </div>
  )
}

function RunningView({ totalSeconds, running, segment, segmentCount, onPause, onResume, onSwap, onFinish, onDiscard }) {
  return (
    <div className="flex flex-col items-center gap-6">
      {/* Current context chip */}
      <div className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl"
        style={{ backgroundColor: '#111113', border: '1px solid #2a2a30' }}>
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold flex-shrink-0"
            style={{ backgroundColor: segment.courseColor + '22', color: segment.courseColor, border: `1px solid ${segment.courseColor}44` }}
          >
            {segment.courseEmoji} {segment.courseName}
          </span>
          {segment.resourceName && (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 flex-shrink-0" style={{ color: '#6b6b78' }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span className="text-xs truncate" style={{ color: '#6b6b78' }}>{segment.resourceName}</span>
            </>
          )}
          {segmentCount > 1 && (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#1a1a1e', color: '#6b6b78' }}>
              ×{segmentCount}
            </span>
          )}
        </div>
        <button
          onClick={onSwap}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold flex-shrink-0"
          style={{ backgroundColor: '#1a1a1e', color: '#e8e8ec', border: '1px solid #2a2a30' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
            <path d="M7 16V4m0 0L3 8m4-4l4 4" />
            <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          Swap
        </button>
      </div>

      {/* Big timer */}
      <div className="flex flex-col items-center gap-1 py-6">
        <span
          className="font-bold tabular-nums tracking-tight leading-none"
          style={{ color: '#e8e8ec', fontSize: totalSeconds >= 3600 ? '4rem' : '5.5rem' }}
        >
          {fmtTime(totalSeconds)}
        </span>
        <span className="text-xs mt-2" style={{ color: running ? '#7c6af7' : '#6b6b78' }}>
          {running ? 'Recording…' : 'Paused'}
        </span>
      </div>

      {/* Pulse ring while running */}
      {running && (
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: '#7c6af7', boxShadow: '0 0 0 0 #7c6af755', animation: 'pulse 2s ease-in-out infinite' }}
        />
      )}

      {/* Controls */}
      <div className="w-full flex gap-3">
        <button
          onClick={running ? onPause : onResume}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm"
          style={{ backgroundColor: '#1a1a1e', color: '#e8e8ec', border: '1px solid #2a2a30' }}
        >
          {running ? (
            <>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
              Pause
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Resume
            </>
          )}
        </button>
        <button
          onClick={onFinish}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm"
          style={{ backgroundColor: '#7c6af7', color: '#fff' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Finish
        </button>
      </div>

      <button
        onClick={onDiscard}
        className="text-xs py-1.5 px-4 rounded-xl"
        style={{ color: '#6b6b78', border: '1px solid #2a2a30' }}
      >
        Discard session
      </button>
    </div>
  )
}

function SwapModal({ courses, resources, courseId, resourceId, onCourseChange, onResourceChange, onConfirm, onClose }) {
  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: '#e8e8ec' }}>Swap Context</h2>
        <CloseBtn onClose={onClose} />
      </div>
      <p className="text-xs mb-4" style={{ color: '#6b6b78' }}>
        Switch course or resource. Time so far is saved to the current context.
      </p>

      <div className="space-y-3">
        <Field label="Course">
          <select
            value={courseId}
            onChange={e => onCourseChange(e.target.value)}
            className="h-11 px-3 rounded-xl text-sm w-full outline-none"
            style={{ backgroundColor: '#1a1a1e', border: '1px solid #2a2a30', color: '#e8e8ec' }}
          >
            {courses.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
        </Field>
        <Field label="Resource (optional)">
          <select
            value={resourceId}
            onChange={e => onResourceChange(e.target.value)}
            className="h-11 px-3 rounded-xl text-sm w-full outline-none"
            style={{ backgroundColor: '#1a1a1e', border: '1px solid #2a2a30', color: resourceId ? '#e8e8ec' : '#6b6b78' }}
          >
            <option value="">None</option>
            {resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
      </div>

      <button
        onClick={onConfirm}
        disabled={!courseId}
        className="w-full py-3 rounded-xl font-semibold text-sm mt-4"
        style={{ backgroundColor: courseId ? '#7c6af7' : '#1a1a1e', color: courseId ? '#fff' : '#6b6b78' }}
      >
        Confirm Swap
      </button>
    </Overlay>
  )
}

function FinishModal({ totalSeconds, segments, form, setForm, saving, onSubmit, onClose }) {
  const multiSegment = segments.length > 1

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: '#e8e8ec' }}>Finish Session</h2>
        <CloseBtn onClose={onClose} />
      </div>

      {/* Total time */}
      <div className="flex items-center justify-center gap-2 py-3 rounded-xl mb-4"
        style={{ backgroundColor: '#1a1a1e' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" style={{ color: '#7c6af7' }}>
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
        <span className="text-xl font-bold tabular-nums" style={{ color: '#e8e8ec' }}>{fmtTime(totalSeconds)}</span>
        <span className="text-xs" style={{ color: '#6b6b78' }}>total</span>
      </div>

      {/* Segments breakdown */}
      {multiSegment && (
        <div className="space-y-1.5 mb-4">
          {segments.map((seg, i) => {
            const endSec = i < segments.length - 1 ? segments[i + 1].startSeconds : totalSeconds
            const dur = Math.max(1, Math.round((endSec - seg.startSeconds) / 60))
            return (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl"
                style={{ backgroundColor: '#1a1a1e' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm">{seg.courseEmoji}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: '#e8e8ec' }}>{seg.courseName}</p>
                    {seg.resourceName && (
                      <p className="text-[10px] truncate" style={{ color: '#6b6b78' }}>{seg.resourceName}</p>
                    )}
                  </div>
                </div>
                <span className="text-xs font-medium flex-shrink-0 ml-2" style={{ color: '#7c6af7' }}>
                  {dur}m
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div className="space-y-3">
        <Field label="Pages / Section Covered (optional)">
          <input
            type="text"
            value={form.pages_covered}
            onChange={e => setForm(f => ({ ...f, pages_covered: e.target.value }))}
            placeholder="e.g. 45–62 or Chapter 3"
            className="h-11 px-3 rounded-xl text-sm w-full outline-none"
            style={{ backgroundColor: '#1a1a1e', border: '1px solid #2a2a30', color: '#e8e8ec' }}
          />
        </Field>
        <Field label="Notes (optional)">
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="What did you work on?"
            rows={2}
            className="px-3 py-2.5 rounded-xl text-sm w-full outline-none resize-none"
            style={{ backgroundColor: '#1a1a1e', border: '1px solid #2a2a30', color: '#e8e8ec' }}
          />
        </Field>
      </div>

      <button
        onClick={onSubmit}
        disabled={saving}
        className="w-full py-3.5 rounded-xl font-bold text-sm mt-4"
        style={{ backgroundColor: saving ? '#1a1a1e' : '#7c6af7', color: saving ? '#6b6b78' : '#fff' }}
      >
        {saving ? 'Saving…' : `Log Session${multiSegment ? `s (${segments.length})` : ''}`}
      </button>
    </Overlay>
  )
}

function DiscardModal({ onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-xs rounded-2xl p-5 space-y-4"
        style={{ backgroundColor: '#111113', border: '1px solid #2a2a30' }}>
        <div className="space-y-1">
          <p className="font-bold" style={{ color: '#e8e8ec' }}>Discard this session?</p>
          <p className="text-sm" style={{ color: '#6b6b78' }}>All elapsed time will be lost.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: '#7c6af7', color: '#fff' }}
          >
            Keep Going
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{ backgroundColor: '#1a1a1e', color: '#6b6b78', border: '1px solid #2a2a30' }}
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Shared primitives ───────────────────────────────────────────────────────

function Overlay({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: '#111113', border: '1px solid #2a2a30' }}>
        {children}
      </div>
    </div>
  )
}

function CloseBtn({ onClose }) {
  return (
    <button onClick={onClose} style={{ color: '#6b6b78' }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  )
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium" style={{ color: '#6b6b78' }}>{label}</label>
      {children}
    </div>
  )
}

function Toast() {
  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-3 rounded-2xl z-50"
      style={{ backgroundColor: '#111113', border: '1px solid #2a2a30', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}
    >
      <span className="flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: '#10b981' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" className="w-3 h-3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      <span className="text-sm font-medium whitespace-nowrap" style={{ color: '#e8e8ec' }}>Session logged</span>
    </div>
  )
}
