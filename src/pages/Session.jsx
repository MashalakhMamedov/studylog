import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useTimer, fmtTime } from '../context/TimerContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { supabase } from '../lib/supabase.js'
import SwipeableRow from '../components/SwipeableRow.jsx'
import FullscreenTimer from '../components/FullscreenTimer.jsx'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtMins(m) {
  if (!m) return '0m'
  const h = Math.floor(m / 60)
  const min = m % 60
  if (h === 0) return `${min}m`
  if (min === 0) return `${h}h`
  return `${h}h ${min}m`
}

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtRelativeDate(dateStr) {
  if (dateStr === localDateStr()) return 'Today'
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  if (dateStr === localDateStr(yesterday)) return 'Yesterday'
  const [y, mo, day] = dateStr.split('-').map(Number)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return y === new Date().getFullYear() ? `${day} ${months[mo - 1]}` : `${day} ${months[mo - 1]} ${y}`
}

const today = () => new Date().toISOString().split('T')[0]

const TIME_BASED_TYPES = new Set(['video', 'lecture_recording', 'podcast', 'online_course'])

const FOCUS_TYPES = [
  { value: 'deep_focus',   label: 'Deep Focus' },
  { value: 'light_review', label: 'Light Review' },
  { value: 'practice',     label: 'Practice' },
  { value: 'video',        label: 'Video Lecture' },
  { value: 'project',      label: 'Project Work' },
]

const ENERGY_LEVELS = [
  { value: 'high',             label: 'High' },
  { value: 'medium',           label: 'Medium' },
  { value: 'low',              label: 'Low' },
  { value: 'post_night_shift', label: 'Post-Night-Shift' },
]

const ENERGY_COLOR = { high: '#22c55e', medium: '#eab308', low: '#ef4444', post_night_shift: '#8b5cf6' }
const ENERGY_LABEL = { high: 'High', medium: 'Medium', low: 'Low', post_night_shift: 'Post-Night-Shift' }
const FOCUS_LABEL = {
  deep_focus: 'Deep Focus', light_review: 'Light Review',
  practice: 'Practice', video: 'Video Lecture', project: 'Project Work',
}

const DEFAULT_LOG_FORM = {
  course_id: '', resource_id: '', duration: '',
  pages_covered: '', focus_type: 'deep_focus',
  energy_level: 'high', date: today(), notes: '',
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function Session() {
  const [searchParams] = useSearchParams()
  const initialMode = searchParams.get('mode') === 'log' ? 'log' : 'focus'
  const [mode, setMode] = useState(initialMode)
  const [switchWarning, setSwitchWarning] = useState(false)
  const { phase } = useTimer()
  const { accentColor } = useTheme()

  useEffect(() => {
    if (phase !== 'running') setSwitchWarning(false)
  }, [phase])

  function handleModeSwitch(newMode) {
    if (newMode === mode) return
    if (newMode === 'log' && phase === 'running') {
      setSwitchWarning(true)
      return
    }
    setSwitchWarning(false)
    setMode(newMode)
  }

  return (
    <div className="page-enter">
      {/* Segmented control */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex p-1 rounded-full" style={{ backgroundColor: 'var(--bg-surf)' }}>
          <button
            onClick={() => handleModeSwitch('focus')}
            className="flex-1 py-2 rounded-full text-sm font-semibold transition-colors"
            style={mode === 'focus'
              ? { backgroundColor: accentColor, color: '#fff' }
              : { backgroundColor: 'transparent', color: 'var(--text-3)' }
            }
          >
            Focus Now
          </button>
          <button
            onClick={() => handleModeSwitch('log')}
            className="flex-1 py-2 rounded-full text-sm font-semibold transition-colors"
            style={mode === 'log'
              ? { backgroundColor: accentColor, color: '#fff' }
              : { backgroundColor: 'transparent', color: 'var(--text-3)' }
            }
          >
            Log Past Session
          </button>
        </div>

        {switchWarning && (
          <p className="text-xs mt-2.5 px-1" style={{ color: '#eab308' }}>
            ⚠ Finish or discard your running session before switching.
          </p>
        )}
      </div>

      {mode === 'focus' && <FocusTab />}
      {mode === 'log' && <LogTab />}
    </div>
  )
}

// ── Focus Tab ────────────────────────────────────────────────────────────────

function FocusTab() {
  const navigate = useNavigate()
  const {
    courses, allResources,
    phase, courseId, setCourseId, resourceId, setResourceId,
    totalSeconds, running,
    segments,
    showSwap, setShowSwap, swapCourseId, setSwapCourseId, swapResourceId, setSwapResourceId,
    showFinish, setShowFinish, finishForm, setFinishForm, saving,
    showDiscard, setShowDiscard,
    toast, setToast,
    startClock, pauseClock,
    startSession, openSwap, confirmSwap, openFinish, submitFinish, resetAll,
  } = useTimer()

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => { setToast(false); navigate('/') }, 1800)
    return () => clearTimeout(t)
  }, [toast])

  const currentSeg = segments[segments.length - 1]
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    if (fullscreen) {
      document.documentElement.requestFullscreen?.().catch(() => {})
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {})
    }
  }, [fullscreen])

  useEffect(() => {
    function onFsChange() { if (!document.fullscreenElement) setFullscreen(false) }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  useEffect(() => { if (phase !== 'running') setFullscreen(false) }, [phase])

  const setupResources = allResources.filter(r => r.course_id === courseId)
  const swapResources = allResources.filter(r => r.course_id === swapCourseId)

  return (
    <div className="px-4 pt-2 pb-6">
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
          onFullscreen={() => setFullscreen(true)}
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
          courses={courses}
          allResources={allResources}
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

      {fullscreen && phase === 'running' && currentSeg && (
        <FullscreenTimer
          totalSeconds={totalSeconds}
          running={running}
          segment={currentSeg}
          onPause={pauseClock}
          onResume={startClock}
          onFinish={openFinish}
          onExit={() => setFullscreen(false)}
        />
      )}
    </div>
  )
}

// ── Log Tab ──────────────────────────────────────────────────────────────────

function LogTab() {
  const { session } = useAuth()
  const { accentColor } = useTheme()
  const navigate = useNavigate()
  const [courses, setCourses] = useState([])
  const [resources, setResources] = useState([])
  const [form, setForm] = useState(DEFAULT_LOG_FORM)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(false)
  const [history, setHistory] = useState(null)

  useEffect(() => {
    supabase.from('courses').select('id, name, emoji').order('name')
      .then(({ data }) => { if (data) setCourses(data) })
    supabase.from('sessions')
      .select('id, date, duration_minutes, pages_covered, focus_type, energy_level, notes, courses(name, emoji, color), resources(name)')
      .order('date', { ascending: false })
      .limit(30)
      .then(({ data }) => setHistory(data ?? []))
  }, [])

  useEffect(() => {
    setForm(f => ({ ...f, resource_id: '' }))
    if (!form.course_id) { setResources([]); return }
    supabase.from('resources').select('id, name, type')
      .eq('course_id', form.course_id).order('name')
      .then(({ data }) => { if (data) setResources(data) })
  }, [form.course_id])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => { setToast(false); navigate('/') }, 1800)
    return () => clearTimeout(t)
  }, [toast])

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function submit() {
    if (!form.course_id || !form.duration) return
    setSaving(true)
    const { data: inserted, error } = await supabase.from('sessions').insert({
      user_id: session.user.id,
      course_id: form.course_id,
      resource_id: form.resource_id || null,
      duration_minutes: parseInt(form.duration, 10),
      pages_covered: form.pages_covered.trim() || null,
      focus_type: form.focus_type,
      energy_level: form.energy_level,
      date: form.date,
      notes: form.notes.trim() || null,
    }).select('id, date, duration_minutes, pages_covered, focus_type, energy_level, notes, courses(name, emoji, color), resources(name)').single()
    setSaving(false)
    if (!error) {
      if (inserted) setHistory(prev => [inserted, ...(prev ?? [])])
      setForm({ ...DEFAULT_LOG_FORM, date: today() })
      setToast(true)
    }
  }

  async function handleDeleteHistory(id) {
    setHistory(prev => prev.filter(s => s.id !== id))
    await supabase.from('sessions').delete().eq('id', id)
  }

  const canSubmit = form.course_id && form.duration && !saving
  const selectedResource = resources.find(r => r.id === form.resource_id)
  const coverIsTime = selectedResource && TIME_BASED_TYPES.has(selectedResource.type)

  return (
    <div className="px-4 pt-2 pb-8 space-y-5">
      <div className="flex items-center justify-end">
        <Link
          to="/quiz"
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-medium"
          style={{ backgroundColor: 'var(--bg-surf)', color: 'var(--text-1)', border: '1px solid var(--border)' }}
        >
          🧪 Quiz
        </Link>
      </div>

      <Field label="Course *">
        <select
          value={form.course_id}
          onChange={e => set('course_id', e.target.value)}
          className="h-11 px-3 rounded-xl text-sm w-full outline-none"
          style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: form.course_id ? 'var(--text-1)' : 'var(--text-2)' }}
        >
          <option value="" disabled>Select a course</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
      </Field>

      <Field label="Resource (optional)">
        <select
          value={form.resource_id}
          onChange={e => set('resource_id', e.target.value)}
          disabled={!form.course_id}
          className="h-11 px-3 rounded-xl text-sm w-full outline-none"
          style={{
            backgroundColor: 'var(--bg-surf)',
            border: '1px solid var(--border)',
            color: form.resource_id ? 'var(--text-1)' : 'var(--text-2)',
            opacity: form.course_id ? 1 : 0.5,
          }}
        >
          <option value="">None</option>
          {resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Duration (min) *">
          <input
            type="number"
            value={form.duration}
            onChange={e => set('duration', e.target.value)}
            placeholder="e.g. 45"
            min="1"
            className="h-11 px-3 rounded-xl text-sm w-full outline-none"
            style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
          />
        </Field>
        <Field label="Date">
          <input
            type="date"
            value={form.date}
            onChange={e => set('date', e.target.value)}
            className="h-11 px-3 rounded-xl text-sm w-full outline-none"
            style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
          />
        </Field>
      </div>

      <Field label={coverIsTime ? 'Minutes Watched (optional)' : 'Pages / Section Covered (optional)'}>
        <input
          type="text"
          value={form.pages_covered}
          onChange={e => set('pages_covered', e.target.value)}
          placeholder={coverIsTime ? 'e.g. 45 or 1:30:00' : 'e.g. 45–62 or Chapter 3'}
          className="h-11 px-3 rounded-xl text-sm w-full outline-none"
          style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
        />
      </Field>

      <Field label="Focus Type">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {FOCUS_TYPES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => set('focus_type', value)}
              className="py-2 rounded-xl text-xs font-medium text-left px-3"
              style={form.focus_type === value
                ? { backgroundColor: accentColor, color: '#fff' }
                : { backgroundColor: 'var(--bg-surf)', color: 'var(--text-2)', border: '1px solid var(--border)' }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Energy Level">
        <div className="flex gap-2 flex-wrap">
          {ENERGY_LEVELS.map(({ value, label }) => {
            const active = form.energy_level === value
            return (
              <button
                key={value}
                onClick={() => set('energy_level', value)}
                className="flex-1 py-2 rounded-xl text-xs font-medium"
                style={active
                  ? { backgroundColor: ENERGY_COLOR[value] + '33', color: ENERGY_COLOR[value], border: `1px solid ${ENERGY_COLOR[value]}55` }
                  : { backgroundColor: 'var(--bg-surf)', color: 'var(--text-2)', border: '1px solid var(--border)' }
                }
              >
                {label}
              </button>
            )
          })}
        </div>
      </Field>

      <Field label="Notes (optional)">
        <textarea
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="What did you work on? Any blockers?"
          rows={3}
          className="px-3 py-2.5 rounded-xl text-sm w-full outline-none resize-none"
          style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
        />
      </Field>

      <button
        onClick={submit}
        disabled={!canSubmit}
        className="w-full py-3.5 rounded-xl font-semibold text-sm"
        style={{
          backgroundColor: canSubmit ? accentColor : 'var(--bg-surf)',
          color: canSubmit ? '#fff' : 'var(--text-2)',
          border: canSubmit ? 'none' : '1px solid var(--border)',
        }}
      >
        {saving ? 'Saving…' : 'Log Session'}
      </button>

      <div className="pt-2">
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-1)' }}>Session History</p>
        {history === null ? (
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-full rounded-xl animate-pulse" style={{ height: '60px', backgroundColor: 'var(--bg-surf)' }} />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="text-4xl">📋</span>
            <div className="space-y-1">
              <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>No sessions yet</p>
              <p className="text-xs" style={{ color: 'var(--text-2)' }}>Log your first session above to get started</p>
            </div>
          </div>
        ) : (
          <div
            className="rounded-xl overflow-hidden divide-y"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            {history.map((s, i) => (
              <div key={s.id} className="stagger-in" style={{ animationDelay: `${Math.min(i, 7) * 40}ms` }}>
                <HistoryCard s={s} onDelete={handleDeleteHistory} />
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && <Toast />}
    </div>
  )
}

// ── Timer sub-components ─────────────────────────────────────────────────────

function SetupView({ courses, resources, courseId, resourceId, onCourseChange, onResourceChange, onStart }) {
  const { accentColor } = useTheme()
  return (
    <div className="space-y-4">
      <Field label="Course *">
        <select
          value={courseId}
          onChange={e => onCourseChange(e.target.value)}
          className="h-11 px-3 rounded-xl text-sm w-full outline-none"
          style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: courseId ? 'var(--text-1)' : 'var(--text-2)' }}
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
            backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)',
            color: resourceId ? 'var(--text-1)' : 'var(--text-2)',
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
          backgroundColor: courseId ? accentColor : 'var(--bg-surf)',
          color: courseId ? '#fff' : 'var(--text-2)',
          border: courseId ? 'none' : '1px solid var(--border)',
        }}
      >
        Start Session
      </button>
    </div>
  )
}

function RunningView({ totalSeconds, running, segment, segmentCount, onPause, onResume, onSwap, onFinish, onDiscard, onFullscreen }) {
  const { accentColor } = useTheme()
  return (
    <div className="flex flex-col items-center gap-6">
      <button
        onClick={onFullscreen}
        title="Enter fullscreen"
        className="self-end flex items-center justify-center w-8 h-8 rounded-xl"
        style={{ color: 'var(--text-2)', border: '1px solid var(--border)' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        </svg>
      </button>

      <div className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold flex-shrink-0"
            style={{ backgroundColor: segment.courseColor + '22', color: segment.courseColor, border: `1px solid ${segment.courseColor}44` }}
          >
            {segment.courseEmoji} {segment.courseName}
          </span>
          {segment.resourceName && (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-2)' }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span className="text-xs truncate" style={{ color: 'var(--text-2)' }}>{segment.resourceName}</span>
            </>
          )}
          {segmentCount > 1 && (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-surf)', color: 'var(--text-2)' }}>
              ×{segmentCount}
            </span>
          )}
        </div>
        <button
          onClick={onSwap}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold flex-shrink-0"
          style={{ backgroundColor: 'var(--bg-surf)', color: 'var(--text-1)', border: '1px solid var(--border)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
            <path d="M7 16V4m0 0L3 8m4-4l4 4" />
            <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          Swap
        </button>
      </div>

      <div className="flex flex-col items-center gap-1 py-6">
        <span
          className="tabular-nums tracking-tight leading-none"
          style={{
            color: 'var(--text-1)',
            fontSize: totalSeconds >= 3600 ? '4rem' : '5.5rem',
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
          }}
        >
          {fmtTime(totalSeconds)}
        </span>
        <span className="text-xs mt-2" style={{ color: running ? accentColor : 'var(--text-2)' }}>
          {running ? 'Recording…' : 'Paused'}
        </span>
      </div>

      {running && (
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: accentColor, boxShadow: `0 0 0 0 ${accentColor}66`, animation: 'pulse 2s ease-in-out infinite' }}
        />
      )}

      <div className="w-full flex gap-3">
        <button
          onClick={running ? onPause : onResume}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm"
          style={{ backgroundColor: 'var(--bg-surf)', color: 'var(--text-1)', border: '1px solid var(--border)' }}
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
          style={{ backgroundColor: accentColor, color: '#fff' }}
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
        style={{ color: 'var(--text-2)', border: '1px solid var(--border)' }}
      >
        Discard session
      </button>
    </div>
  )
}

function SwapModal({ courses, resources, courseId, resourceId, onCourseChange, onResourceChange, onConfirm, onClose }) {
  const { accentColor } = useTheme()
  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-1)' }}>Swap Context</h2>
        <CloseBtn onClose={onClose} />
      </div>
      <p className="text-xs mb-4" style={{ color: 'var(--text-2)' }}>
        Switch course or resource. Time so far is saved to the current context.
      </p>
      <div className="space-y-3">
        <Field label="Course">
          <select
            value={courseId}
            onChange={e => onCourseChange(e.target.value)}
            className="h-11 px-3 rounded-xl text-sm w-full outline-none"
            style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
          >
            {courses.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
        </Field>
        <Field label="Resource (optional)">
          <select
            value={resourceId}
            onChange={e => onResourceChange(e.target.value)}
            className="h-11 px-3 rounded-xl text-sm w-full outline-none"
            style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: resourceId ? 'var(--text-1)' : 'var(--text-2)' }}
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
        style={{ backgroundColor: courseId ? accentColor : 'var(--bg-surf)', color: courseId ? '#fff' : 'var(--text-2)' }}
      >
        Confirm Swap
      </button>
    </Overlay>
  )
}

function FinishModal({ totalSeconds, segments, form, setForm, courses, allResources, saving, onSubmit, onClose }) {
  const { accentColor } = useTheme()
  const multiSegment = segments.length > 1
  const resources = allResources.filter(r => r.course_id === form.course_id)
  const totalMins = Math.max(1, Math.round(totalSeconds / 60))
  const selectedResource = resources.find(r => r.id === form.resource_id)
  const coverIsTime = selectedResource && TIME_BASED_TYPES.has(selectedResource.type)

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-1)' }}>Finish Session</h2>
        <CloseBtn onClose={onClose} />
      </div>

      <div className="flex flex-col items-center gap-1 py-4 rounded-2xl mb-4"
        style={{ backgroundColor: 'var(--bg-surf)' }}>
        <span className="tabular-nums" style={{ color: 'var(--text-1)', fontSize: '2rem', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
          {fmtTime(totalSeconds)}
        </span>
        <span className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
          You studied for {totalMins} minute{totalMins !== 1 ? 's' : ''}
        </span>
      </div>

      {multiSegment && (
        <div className="space-y-1.5 mb-4">
          {segments.map((seg, i) => {
            const endSec = i < segments.length - 1 ? segments[i + 1].startSeconds : totalSeconds
            const dur = Math.max(1, Math.round((endSec - seg.startSeconds) / 60))
            return (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl"
                style={{ backgroundColor: 'var(--bg-surf)' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm">{seg.courseEmoji}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-1)' }}>{seg.courseName}</p>
                    {seg.resourceName && (
                      <p className="text-[10px] truncate" style={{ color: 'var(--text-2)' }}>{seg.resourceName}</p>
                    )}
                  </div>
                </div>
                <span className="text-xs font-medium flex-shrink-0 ml-2" style={{ color: accentColor }}>{dur}m</span>
              </div>
            )
          })}
        </div>
      )}

      <div className="space-y-4">
        {!multiSegment && (
          <>
            <Field label="Course *">
              <select
                value={form.course_id}
                onChange={e => setForm(f => ({ ...f, course_id: e.target.value, resource_id: '' }))}
                className="h-11 px-3 rounded-xl text-sm w-full outline-none"
                style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: form.course_id ? 'var(--text-1)' : 'var(--text-2)' }}
              >
                <option value="" disabled>Select a course</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
              </select>
            </Field>
            <Field label="Resource (optional)">
              <select
                value={form.resource_id}
                onChange={e => set('resource_id', e.target.value)}
                disabled={!form.course_id}
                className="h-11 px-3 rounded-xl text-sm w-full outline-none"
                style={{
                  backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)',
                  color: form.resource_id ? 'var(--text-1)' : 'var(--text-2)',
                  opacity: form.course_id ? 1 : 0.5,
                }}
              >
                <option value="">None</option>
                {resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
          </>
        )}

        {!multiSegment ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Duration (min)">
              <input
                type="number"
                value={form.duration_minutes}
                onChange={e => set('duration_minutes', e.target.value)}
                min="1"
                className="h-11 px-3 rounded-xl text-sm w-full outline-none"
                style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              />
            </Field>
            <Field label="Date">
              <input
                type="date"
                value={form.date}
                onChange={e => set('date', e.target.value)}
                className="h-11 px-3 rounded-xl text-sm w-full outline-none"
                style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              />
            </Field>
          </div>
        ) : (
          <Field label="Date">
            <input
              type="date"
              value={form.date}
              onChange={e => set('date', e.target.value)}
              className="h-11 px-3 rounded-xl text-sm w-full outline-none"
              style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
            />
          </Field>
        )}

        <Field label={coverIsTime ? 'Minutes Watched (optional)' : 'Pages / Section Covered (optional)'}>
          <input
            type="text"
            value={form.pages_covered}
            onChange={e => set('pages_covered', e.target.value)}
            placeholder={coverIsTime ? 'e.g. 45 or 1:30:00' : 'e.g. 45–62 or Chapter 3'}
            className="h-11 px-3 rounded-xl text-sm w-full outline-none"
            style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
          />
        </Field>

        <Field label="Focus Type">
          <div className="grid grid-cols-2 gap-2">
            {FOCUS_TYPES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => set('focus_type', value)}
                className="py-2 rounded-xl text-xs font-medium text-left px-3"
                style={form.focus_type === value
                  ? { backgroundColor: accentColor, color: '#fff' }
                  : { backgroundColor: 'var(--bg-surf)', color: 'var(--text-2)', border: '1px solid var(--border)' }
                }
              >
                {label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Energy Level">
          <div className="flex gap-2 flex-wrap">
            {ENERGY_LEVELS.map(({ value, label }) => {
              const active = form.energy_level === value
              return (
                <button
                  key={value}
                  onClick={() => set('energy_level', value)}
                  className="flex-1 py-2 rounded-xl text-xs font-medium"
                  style={active
                    ? { backgroundColor: ENERGY_COLOR[value] + '33', color: ENERGY_COLOR[value], border: `1px solid ${ENERGY_COLOR[value]}55` }
                    : { backgroundColor: 'var(--bg-surf)', color: 'var(--text-2)', border: '1px solid var(--border)' }
                  }
                >
                  {label}
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="Notes (optional)">
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="What did you work on? Any blockers?"
            rows={2}
            className="px-3 py-2.5 rounded-xl text-sm w-full outline-none resize-none"
            style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
          />
        </Field>
      </div>

      <button
        onClick={onSubmit}
        disabled={saving}
        className="w-full py-3.5 rounded-xl font-bold text-sm mt-4"
        style={{ backgroundColor: saving ? 'var(--bg-surf)' : accentColor, color: saving ? 'var(--text-2)' : '#fff' }}
      >
        {saving ? 'Saving…' : `Log Session${multiSegment ? `s (${segments.length})` : ''}`}
      </button>
    </Overlay>
  )
}

function DiscardModal({ onConfirm, onCancel }) {
  const { accentColor } = useTheme()
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--modal-overlay)' }}
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-xs rounded-2xl p-5 space-y-4"
        style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)' }}>
        <div className="space-y-1">
          <p className="font-bold" style={{ color: 'var(--text-1)' }}>Discard this session?</p>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>All elapsed time will be lost.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: accentColor, color: '#fff' }}
          >
            Keep Going
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{ backgroundColor: 'var(--bg-surf)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Log sub-components ───────────────────────────────────────────────────────

function HistoryCard({ s, onDelete }) {
  const { accentColor } = useTheme()
  const [confirming, setConfirming] = useState(false)
  const course = s.courses
  if (!course) return null

  return (
    <>
      <SwipeableRow onDelete={() => setConfirming(true)}>
        <div className="px-4 py-3 pr-10 relative" style={{ backgroundColor: 'var(--bg-card)' }}>
          <button
            onClick={() => setConfirming(true)}
            className="absolute top-3 right-3 p-1"
            style={{ color: 'var(--text-2)' }}
            aria-label="Delete session"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6M9 6V4h6v2" />
            </svg>
          </button>

          <div className="flex items-center justify-between gap-2">
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold truncate"
              style={{ backgroundColor: course.color + '22', color: course.color, maxWidth: '55%' }}
            >
              {course.emoji} {course.name}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-1)' }}>{fmtMins(s.duration_minutes)}</span>
              <span className="text-[11px]" style={{ color: 'var(--text-2)' }}>{fmtRelativeDate(s.date)}</span>
            </div>
          </div>

          {(s.resources?.name || s.pages_covered) && (
            <p className="text-xs mt-1.5 truncate" style={{ color: 'var(--text-2)' }}>
              {[s.resources?.name, s.pages_covered].filter(Boolean).join(' · ')}
            </p>
          )}

          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {s.focus_type && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{ backgroundColor: `${accentColor}22`, color: accentColor }}
              >
                {FOCUS_LABEL[s.focus_type] ?? s.focus_type}
              </span>
            )}
            {s.energy_level && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{ backgroundColor: ENERGY_COLOR[s.energy_level] + '22', color: ENERGY_COLOR[s.energy_level] }}
              >
                {ENERGY_LABEL[s.energy_level] ?? s.energy_level}
              </span>
            )}
          </div>

          {s.notes && (
            <p className="text-xs italic mt-1.5 truncate" style={{ color: 'var(--text-2)' }}>{s.notes}</p>
          )}
        </div>
      </SwipeableRow>

      {confirming && (
        <DeleteConfirmModal
          onConfirm={() => { onDelete(s.id); setConfirming(false) }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  )
}

function DeleteConfirmModal({ onConfirm, onCancel }) {
  const { accentColor } = useTheme()
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--modal-overlay)' }}
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div
        className="w-full max-w-xs rounded-2xl p-5 space-y-4"
        style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)' }}
      >
        <div className="space-y-1">
          <p className="font-bold" style={{ color: 'var(--text-1)' }}>Delete this session?</p>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>This can't be undone.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: 'var(--bg-surf)', color: 'var(--text-1)', border: '1px solid var(--border)' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: accentColor, color: '#fff' }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Shared primitives ────────────────────────────────────────────────────────

function Overlay({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: 'var(--modal-overlay)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)' }}>
        {children}
      </div>
    </div>
  )
}

function CloseBtn({ onClose }) {
  return (
    <button onClick={onClose} style={{ color: 'var(--text-2)' }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  )
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{label}</label>
      {children}
    </div>
  )
}

function Toast() {
  return (
    <div className="fixed top-16 left-0 right-0 flex justify-center z-[70] pointer-events-none px-4">
      <div
        className="flex items-center gap-2 px-4 py-3 rounded-2xl pointer-events-auto"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          animation: 'toastSlideDown 250ms ease both',
        }}
      >
        <span className="flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: '#22c55e' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" className="w-3 h-3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <span className="text-sm font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>Session logged</span>
      </div>
    </div>
  )
}
