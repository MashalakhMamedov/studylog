import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTimer, fmtTime } from '../context/TimerContext.jsx'

function fmtMinutes(seconds) {
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

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

const ENERGY_COLOR = { high: '#2A9D8F', medium: '#E9C46A', low: '#E76F51', post_night_shift: '#E63946' }

export default function Timer() {
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
    <div className="page-enter px-4 pt-6 pb-6">

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
        <FullscreenOverlay
          totalSeconds={totalSeconds}
          running={running}
          segment={currentSeg}
          onPause={pauseClock}
          onResume={startClock}
          onExit={() => setFullscreen(false)}
        />
      )}
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
          backgroundColor: courseId ? '#E63946' : 'var(--bg-surf)',
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
  return (
    <div className="flex flex-col items-center gap-6">
      {/* Fullscreen button */}
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

      {/* Current context chip */}
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

      {/* Big timer */}
      <div className="flex flex-col items-center gap-1 py-6">
        <span
          className="font-bold tabular-nums tracking-tight leading-none"
          style={{ color: 'var(--text-1)', fontSize: totalSeconds >= 3600 ? '4rem' : '5.5rem' }}
        >
          {fmtTime(totalSeconds)}
        </span>
        <span className="text-xs mt-2" style={{ color: running ? '#E63946' : 'var(--text-2)' }}>
          {running ? 'Recording…' : 'Paused'}
        </span>
      </div>

      {/* Pulse ring while running */}
      {running && (
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: '#E63946', boxShadow: '0 0 0 0 #E6394666', animation: 'pulse 2s ease-in-out infinite' }}
        />
      )}

      {/* Controls */}
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
          style={{ backgroundColor: '#E63946', color: '#fff' }}
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
        style={{ backgroundColor: courseId ? '#E63946' : 'var(--bg-surf)', color: courseId ? '#fff' : 'var(--text-2)' }}
      >
        Confirm Swap
      </button>
    </Overlay>
  )
}

function FinishModal({ totalSeconds, segments, form, setForm, courses, allResources, saving, onSubmit, onClose }) {
  const multiSegment = segments.length > 1
  const resources = allResources.filter(r => r.course_id === form.course_id)
  const totalMins = Math.max(1, Math.round(totalSeconds / 60))

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-1)' }}>Finish Session</h2>
        <CloseBtn onClose={onClose} />
      </div>

      {/* Summary banner */}
      <div className="flex flex-col items-center gap-1 py-4 rounded-2xl mb-4"
        style={{ backgroundColor: 'var(--bg-surf)' }}>
        <span className="text-3xl font-bold tabular-nums" style={{ color: 'var(--text-1)' }}>
          {fmtTime(totalSeconds)}
        </span>
        <span className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
          You studied for {totalMins} minute{totalMins !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Segment breakdown (multi-segment only) */}
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
                <span className="text-xs font-medium flex-shrink-0 ml-2" style={{ color: '#E63946' }}>{dur}m</span>
              </div>
            )
          })}
        </div>
      )}

      <div className="space-y-4">
        {/* Course + Resource (single-segment only — editable) */}
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

        {/* Duration + Date */}
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

        {/* Pages covered */}
        <Field label="Pages / Section Covered (optional)">
          <input
            type="text"
            value={form.pages_covered}
            onChange={e => set('pages_covered', e.target.value)}
            placeholder="e.g. 45–62 or Chapter 3"
            className="h-11 px-3 rounded-xl text-sm w-full outline-none"
            style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
          />
        </Field>

        {/* Focus type */}
        <Field label="Focus Type">
          <div className="grid grid-cols-2 gap-2">
            {FOCUS_TYPES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => set('focus_type', value)}
                className="py-2 rounded-xl text-xs font-medium text-left px-3"
                style={form.focus_type === value
                  ? { backgroundColor: '#E63946', color: '#fff' }
                  : { backgroundColor: 'var(--bg-surf)', color: 'var(--text-2)', border: '1px solid var(--border)' }
                }
              >
                {label}
              </button>
            ))}
          </div>
        </Field>

        {/* Energy level */}
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

        {/* Notes */}
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
        style={{ backgroundColor: saving ? 'var(--bg-surf)' : '#E63946', color: saving ? 'var(--text-2)' : '#fff' }}
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
      style={{ backgroundColor: 'var(--modal-overlay)' }}
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-xs rounded-2xl p-5 space-y-4"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="space-y-1">
          <p className="font-bold" style={{ color: 'var(--text-1)' }}>Discard this session?</p>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>All elapsed time will be lost.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: '#E63946', color: '#fff' }}
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

// ── Shared primitives ───────────────────────────────────────────────────────

function Overlay({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: 'var(--modal-overlay)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
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
        <span className="flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: '#2A9D8F' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" className="w-3 h-3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <span className="text-sm font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>Session logged</span>
      </div>
    </div>
  )
}

function FullscreenOverlay({ totalSeconds, running, segment, onPause, onResume, onExit }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center select-none"
      style={{ backgroundColor: '#0a0a0b' }}
      onClick={() => running ? onPause() : onResume()}
    >
      {/* Exit button */}
      <button
        onClick={e => { e.stopPropagation(); onExit() }}
        className="absolute top-4 right-4 flex items-center justify-center w-10 h-10 rounded-full"
        style={{ color: '#ffffff55', border: '1px solid #ffffff18' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Timer + context */}
      <div className="flex flex-col items-center gap-5">
        <span
          className="font-mono font-bold tabular-nums tracking-tight leading-none"
          style={{ color: '#ffffff', fontSize: 'clamp(5rem, 22vw, 12.5rem)' }}
        >
          {fmtTime(totalSeconds)}
        </span>

        <div className="flex flex-col items-center gap-1.5 text-center px-6">
          <span className="text-lg font-medium" style={{ color: '#ffffff99' }}>
            {segment.courseEmoji} {segment.courseName}
          </span>
          {segment.resourceName && (
            <span className="text-sm" style={{ color: '#ffffff55' }}>
              {segment.resourceName}
            </span>
          )}
        </div>

        <span className="text-xs mt-1" style={{ color: running ? '#E63946' : '#ffffff44' }}>
          {running ? 'Tap to pause' : 'Paused — tap to resume'}
        </span>
      </div>

      {/* Bottom pause/resume button */}
      <button
        onClick={e => { e.stopPropagation(); running ? onPause() : onResume() }}
        className="absolute bottom-10 flex items-center gap-2 px-8 py-3 rounded-2xl font-semibold text-sm"
        style={{ backgroundColor: '#ffffff10', color: '#ffffffcc', border: '1px solid #ffffff1a' }}
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
    </div>
  )
}
