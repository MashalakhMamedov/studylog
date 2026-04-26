import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Clock3, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import SwipeableRow from '../components/SwipeableRow.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { SkeletonCard } from '../components/Skeleton.jsx'

const today = () => new Date().toISOString().split('T')[0]

const FOCUS_TYPES = [
  { value: 'deep_focus',    label: 'Deep Focus' },
  { value: 'light_review',  label: 'Light Review' },
  { value: 'practice',      label: 'Practice' },
  { value: 'video',         label: 'Video Lecture' },
  { value: 'project',       label: 'Project Work' },
]

const ENERGY_LEVELS = [
  { value: 'high',             label: 'High' },
  { value: 'medium',           label: 'Medium' },
  { value: 'low',              label: 'Low' },
  { value: 'post_night_shift', label: 'Post-Night-Shift' },
]

const ENERGY_COLOR = { high: '#2A9D8F', medium: '#E9C46A', low: '#E76F51', post_night_shift: '#E63946' }
const ENERGY_LABEL = { high: 'High', medium: 'Medium', low: 'Low', post_night_shift: 'Post-Night-Shift' }

const FOCUS_LABEL = {
  deep_focus: 'Deep Focus', light_review: 'Light Review',
  practice: 'Practice', video: 'Video Lecture', project: 'Project Work',
}

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
  const d = new Date(); d.setDate(d.getDate() - 1)
  if (dateStr === localDateStr(d)) return 'Yesterday'
  const [y, mo, day] = dateStr.split('-').map(Number)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return y === new Date().getFullYear() ? `${day} ${months[mo - 1]}` : `${day} ${months[mo - 1]} ${y}`
}

const DEFAULT_FORM = {
  course_id: '', resource_id: '', duration: '',
  pages_covered: '', focus_type: 'deep_focus',
  energy_level: 'high', date: today(), notes: '',
}

export default function Sessions() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [courses, setCourses] = useState([])
  const [resources, setResources] = useState([])
  const [form, setForm] = useState(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(false)
  const [history, setHistory] = useState(null)

  useEffect(() => {
    supabase.from('courses').select('id, name, emoji').order('name')
      .then(({ data }) => { if (data) setCourses(data) })
    supabase.from('sessions')
      .select('id, date, duration_minutes, pages_covered, focus_type, energy_level, notes, courses(name, emoji, color), resources(name)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50)
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
      setForm({ ...DEFAULT_FORM, date: today() })
      setToast(true)
    }
  }

  async function handleDeleteHistory(id) {
    setHistory(prev => prev.filter(s => s.id !== id))
    await supabase.from('sessions').delete().eq('id', id).eq('user_id', session.user.id)
  }

  const canSubmit = form.course_id && form.duration && !saving

  return (
    <div className="page-enter px-4 pt-4 pb-8 space-y-5">
      <div className="flex items-center justify-end">
        <Link
          to="/quiz"
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-medium"
          style={{ backgroundColor: 'var(--bg-surf)', color: 'var(--text-1)', border: '1px solid var(--border)' }}
        >
          🧪 Quiz
        </Link>
      </div>

      {/* Course */}
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

      {/* Resource */}
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

      {/* Duration + Date */}
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
          rows={3}
          className="px-3 py-2.5 rounded-xl text-sm w-full outline-none resize-none"
          style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
        />
      </Field>

      {/* Submit */}
      <button
        onClick={submit}
        disabled={!canSubmit}
        className="w-full py-3.5 rounded-xl font-semibold text-sm"
        style={{
          backgroundColor: canSubmit ? '#E63946' : 'var(--bg-surf)',
          color: canSubmit ? '#fff' : 'var(--text-2)',
          border: canSubmit ? 'none' : '1px solid var(--border)',
        }}
      >
        {saving ? 'Saving…' : 'Log Session'}
      </button>

      {/* Session history */}
      <div className="pt-2">
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-1)' }}>Session History</p>
        {history === null ? (
          <div className="space-y-3">
            {[0,1,2].map(i => (
              <SkeletonCard key={i} height={60} radius={12} />
            ))}
          </div>
        ) : history.length === 0 ? (
          <EmptyState
            icon={Clock3}
            title="Your study sessions will appear here"
            description="Log a session or use the focus timer to get started"
            compact
          />
        ) : (
          <div
            className="rounded-2xl overflow-hidden divide-y"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderColor: 'var(--border)' }}
          >
            {history.map(s => <HistoryCard key={s.id} s={s} onDelete={handleDeleteHistory} />)}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && <Toast />}
    </div>
  )
}

function HistoryCard({ s, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const course = s.courses
  if (!course) return null

  return (
    <SwipeableRow onDelete={() => setConfirming(true)}>
      <div className="px-4 py-3 pr-10 relative" style={{ backgroundColor: 'var(--bg-card)' }}>
        {confirming ? (
          <div className="flex items-center justify-end gap-2 min-h-[54px] text-xs">
            <span style={{ color: '#f87171' }}>Delete?</span>
            <button onClick={() => { onDelete(s.id); setConfirming(false) }} className="font-semibold" style={{ color: '#ef4444' }}>
              ✓ Yes
            </button>
            <button onClick={() => setConfirming(false)} className="font-semibold" style={{ color: '#9ca3af' }}>
              ✗ No
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => setConfirming(true)}
              className="absolute top-3 right-3 p-1"
              style={{ color: '#6b7280' }}
              aria-label="Delete session"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
            </button>

            <div className="flex items-center justify-between gap-2">
              <span
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold truncate"
                style={{ backgroundColor: course.color + '22', color: course.color, maxWidth: '55%' }}
              >
                {course.emoji} {course.name}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{fmtMins(s.duration_minutes)}</span>
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
                  style={{ backgroundColor: '#E6394622', color: '#E63946' }}
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
          </>
        )}
      </div>
    </SwipeableRow>
  )

  return (
    <>
      <SwipeableRow onDelete={() => setConfirming(true)}>
        <div className="px-4 py-3 pr-10 relative" style={{ backgroundColor: 'var(--bg-card)' }}>
          {/* Trash button */}
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

          {/* Row 1: course chip + duration + date */}
          <div className="flex items-center justify-between gap-2">
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold truncate"
              style={{ backgroundColor: course.color + '22', color: course.color, maxWidth: '55%' }}
            >
              {course.emoji} {course.name}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{fmtMins(s.duration_minutes)}</span>
              <span className="text-[11px]" style={{ color: 'var(--text-2)' }}>{fmtRelativeDate(s.date)}</span>
            </div>
          </div>

          {/* Row 2: resource + pages */}
          {(s.resources?.name || s.pages_covered) && (
            <p className="text-xs mt-1.5 truncate" style={{ color: 'var(--text-2)' }}>
              {[s.resources?.name, s.pages_covered].filter(Boolean).join(' · ')}
            </p>
          )}

          {/* Row 3: focus + energy badges */}
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {s.focus_type && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{ backgroundColor: '#E6394622', color: '#E63946' }}
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

          {/* Notes */}
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
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--modal-overlay)' }}
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div
        className="w-full max-w-xs rounded-2xl p-5 space-y-4"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
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
            style={{ backgroundColor: '#E63946', color: '#fff' }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
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
        <span
          className="flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0"
          style={{ backgroundColor: '#2A9D8F' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" className="w-3 h-3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <span className="text-sm font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>
          Session logged
        </span>
      </div>
    </div>
  )
}
