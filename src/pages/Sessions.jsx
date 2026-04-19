import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

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

const ENERGY_COLOR = { high: '#10b981', medium: '#f59e0b', low: '#ef4444', post_night_shift: '#a855f7' }

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

  useEffect(() => {
    supabase.from('courses').select('id, name, emoji').order('name')
      .then(({ data }) => { if (data) setCourses(data) })
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
    const { error } = await supabase.from('sessions').insert({
      user_id: session.user.id,
      course_id: form.course_id,
      resource_id: form.resource_id || null,
      duration_minutes: parseInt(form.duration, 10),
      pages_covered: form.pages_covered.trim() || null,
      focus_type: form.focus_type,
      energy_level: form.energy_level,
      date: form.date,
      notes: form.notes.trim() || null,
    })
    setSaving(false)
    if (!error) { setForm({ ...DEFAULT_FORM, date: today() }); setToast(true) }
  }

  const canSubmit = form.course_id && form.duration && !saving

  return (
    <div className="px-4 pt-8 pb-8 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: '#e8e8ec' }}>Log Session</h1>
        <Link
          to="/quiz"
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-medium"
          style={{ backgroundColor: '#1a1a1e', color: '#e8e8ec', border: '1px solid #2a2a30' }}
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
          style={{ backgroundColor: '#1a1a1e', border: '1px solid #2a2a30', color: form.course_id ? '#e8e8ec' : '#6b6b78' }}
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
            backgroundColor: '#1a1a1e',
            border: '1px solid #2a2a30',
            color: form.resource_id ? '#e8e8ec' : '#6b6b78',
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
            style={{ backgroundColor: '#1a1a1e', border: '1px solid #2a2a30', color: '#e8e8ec' }}
          />
        </Field>
        <Field label="Date">
          <input
            type="date"
            value={form.date}
            onChange={e => set('date', e.target.value)}
            className="h-11 px-3 rounded-xl text-sm w-full outline-none"
            style={{ backgroundColor: '#1a1a1e', border: '1px solid #2a2a30', color: '#e8e8ec', colorScheme: 'dark' }}
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
          style={{ backgroundColor: '#1a1a1e', border: '1px solid #2a2a30', color: '#e8e8ec' }}
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
                ? { backgroundColor: '#7c6af7', color: '#fff' }
                : { backgroundColor: '#1a1a1e', color: '#6b6b78', border: '1px solid #2a2a30' }
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
                  : { backgroundColor: '#1a1a1e', color: '#6b6b78', border: '1px solid #2a2a30' }
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
          style={{ backgroundColor: '#1a1a1e', border: '1px solid #2a2a30', color: '#e8e8ec' }}
        />
      </Field>

      {/* Submit */}
      <button
        onClick={submit}
        disabled={!canSubmit}
        className="w-full py-3.5 rounded-xl font-semibold text-sm"
        style={{
          backgroundColor: canSubmit ? '#7c6af7' : '#1a1a1e',
          color: canSubmit ? '#fff' : '#6b6b78',
          border: canSubmit ? 'none' : '1px solid #2a2a30',
        }}
      >
        {saving ? 'Saving…' : 'Log Session'}
      </button>

      {/* Toast */}
      {toast && <Toast />}
    </div>
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
      className="fixed bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg z-50"
      style={{ backgroundColor: '#111113', border: '1px solid #2a2a30', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}
    >
      <span
        className="flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0"
        style={{ backgroundColor: '#10b981' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" className="w-3 h-3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      <span className="text-sm font-medium whitespace-nowrap" style={{ color: '#e8e8ec' }}>
        Session logged
      </span>
    </div>
  )
}
