import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

const DEFAULT_COURSES = [
  { name: 'PEED',   emoji: '⚡', color: '#E63946', status: 'active', priority: 'high' },
  { name: 'PTFM',   emoji: '🔧', color: '#f59e0b', status: 'active', priority: 'high' },
  { name: 'CV',     emoji: '👁',  color: '#10b981', status: 'active', priority: 'medium' },
  { name: 'MMS',    emoji: '⚙️', color: '#6366f1', status: 'active', priority: 'medium' },
  { name: 'MD',     emoji: '📐', color: '#E63946', status: 'active', priority: 'medium' },
  { name: 'CMS',    emoji: '🖥',  color: '#0ea5e9', status: 'active', priority: 'low' },
  { name: 'IoT',    emoji: '📡', color: '#84cc16', status: 'active', priority: 'low' },
  { name: 'Nano',   emoji: '🔬', color: '#a855f7', status: 'active', priority: 'low' },
  { name: 'MATLAB', emoji: '📊', color: '#fb923c', status: 'active', priority: 'low' },
]

const COLOR_SWATCHES = [
  '#E63946', '#6366f1', '#a855f7', '#ec4899',
  '#E63946', '#ef4444', '#fb923c', '#f59e0b',
  '#84cc16', '#10b981', '#06b6d4', '#0ea5e9',
]

const STATUS_OPTIONS = ['active', 'backlog', 'completed']
const PRIORITY_OPTIONS = ['high', 'medium', 'low']

const STATUS_COLOR = { active: '#E9C46A', backlog: '#E63946', completed: '#2A9D8F' }
const PRIORITY_COLOR = { high: '#E63946', medium: '#E9C46A', low: 'var(--text-2)' }
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

const EMPTY_FORM = { name: '', emoji: '📚', color: '#E63946', status: 'active', priority: 'medium' }

export default function Courses() {
  const { session } = useAuth()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => { fetchCourses() }, [])

  async function fetchCourses() {
    setLoading(true)
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('created_at')
    if (!error) {
      if (data.length === 0) await seedCourses()
      else setCourses(data)
    }
    setLoading(false)
  }

  async function seedCourses() {
    const rows = DEFAULT_COURSES.map(c => ({ ...c, user_id: session.user.id }))
    const { data, error } = await supabase.from('courses').insert(rows).select()
    if (!error) setCourses(data)
  }

  async function saveCourse() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = { ...form, name: form.name.trim() }

    if (editing) {
      const { data, error } = await supabase
        .from('courses').update(payload).eq('id', editing.id).select().single()
      if (!error) setCourses(prev => prev.map(c => c.id === editing.id ? data : c))
    } else {
      const { data, error } = await supabase
        .from('courses').insert({ ...payload, user_id: session.user.id }).select().single()
      if (!error) setCourses(prev => [...prev, data])
    }

    setSaving(false)
    closeModal()
  }

  async function deleteCourse(id) {
    await supabase.from('courses').delete().eq('id', id)
    setCourses(prev => prev.filter(c => c.id !== id))
    setDeleteTarget(null)
  }

  function openAdd() { setEditing(null); setForm(EMPTY_FORM); setShowModal(true) }
  function openEdit(course) {
    setEditing(course)
    setForm({ name: course.name, emoji: course.emoji, color: course.color, status: course.status, priority: course.priority })
    setShowModal(true)
  }
  function closeModal() { setShowModal(false); setEditing(null); setForm(EMPTY_FORM) }

  const filtered = courses
    .filter(c => filter === 'all' || c.status === filter)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])

  return (
    <div className="page-enter px-4 pt-4 pb-6 space-y-6">
      <div className="flex items-center justify-end">
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: '#E63946', color: '#fff' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', ...STATUS_OPTIONS].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize"
            style={filter === s
              ? { backgroundColor: '#E63946', color: '#fff' }
              : { backgroundColor: 'var(--bg-surf)', color: 'var(--text-2)', border: '1px solid var(--border)' }
            }
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div
            className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--border)', borderTopColor: '#E63946' }}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="text-5xl">{courses.length === 0 ? '🎓' : '🔍'}</span>
          <div className="space-y-1">
            <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
              {courses.length === 0 ? 'No courses yet' : 'No courses match this filter'}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-2)' }}>
              {courses.length === 0 ? 'Add your first course to start tracking your studies' : 'Try a different status filter'}
            </p>
          </div>
          {courses.length === 0 && (
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ backgroundColor: '#E63946', color: '#fff' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add First Course
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map(course => (
            <CourseCard
              key={course.id}
              course={course}
              onEdit={() => openEdit(course)}
              onDelete={() => setDeleteTarget(course)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <CourseModal
          form={form}
          setForm={setForm}
          editing={editing}
          saving={saving}
          onSave={saveCourse}
          onClose={closeModal}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          course={deleteTarget}
          onConfirm={() => deleteCourse(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

function CourseCard({ course, onEdit, onDelete }) {
  return (
    <div className="hoverable-card rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}>
      <div className="h-1.5" style={{ backgroundColor: course.color }} />
      <div className="p-3 space-y-2.5">
        <div className="text-3xl leading-none">{course.emoji}</div>

        <p className="font-bold text-sm leading-tight" style={{ color: 'var(--text-1)' }}>{course.name}</p>

        <div className="flex flex-wrap gap-1">
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-medium capitalize"
            style={{ backgroundColor: STATUS_COLOR[course.status] + '22', color: STATUS_COLOR[course.status] }}
          >
            {course.status}
          </span>
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-medium capitalize"
            style={{ backgroundColor: PRIORITY_COLOR[course.priority] + '22', color: PRIORITY_COLOR[course.priority] }}
          >
            {course.priority}
          </span>
        </div>

        <div className="flex gap-1.5 pt-0.5">
          <button
            onClick={onEdit}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium"
            style={{ backgroundColor: 'var(--bg-surf)', color: 'var(--text-1)', border: '1px solid var(--border)' }}
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="px-2.5 py-1.5 rounded-lg"
            style={{ backgroundColor: 'var(--bg-surf)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

function CourseModal({ form, setForm, editing, saving, onSave, onClose }) {
  const canSave = form.name.trim().length > 0 && !saving

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: 'var(--modal-overlay)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 space-y-4"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-1)' }}>
            {editing ? 'Edit Course' : 'New Course'}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--text-2)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Emoji + Name */}
        <div className="flex gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>Emoji</label>
            <input
              type="text"
              value={form.emoji}
              onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}
              className="w-14 h-10 rounded-xl text-center text-xl outline-none"
              style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              maxLength={2}
            />
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. PEED"
              className="h-10 px-3 rounded-xl text-sm w-full outline-none"
              style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              onKeyDown={e => e.key === 'Enter' && canSave && onSave()}
            />
          </div>
        </div>

        {/* Color swatches */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>Color</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_SWATCHES.map(c => (
              <button
                key={c}
                onClick={() => setForm(f => ({ ...f, color: c }))}
                className="w-7 h-7 rounded-full transition-transform"
                style={{
                  backgroundColor: c,
                  transform: form.color === c ? 'scale(1.25)' : 'scale(1)',
                  outline: form.color === c ? `2px solid ${c}` : 'none',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>
        </div>

        {/* Status + Priority */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>Status</label>
            <select
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="h-10 px-3 rounded-xl text-sm outline-none"
              style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>Priority</label>
            <select
              value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
              className="h-10 px-3 rounded-xl text-sm outline-none"
              style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
            >
              {PRIORITY_OPTIONS.map(p => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Live preview */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <div className="h-1" style={{ backgroundColor: form.color }} />
          <div className="px-3 py-2.5 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-surf)' }}>
            <span className="text-2xl leading-none">{form.emoji}</span>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{form.name || 'Course name'}</p>
              <p className="text-xs capitalize" style={{ color: 'var(--text-2)' }}>{form.status} · {form.priority}</p>
            </div>
          </div>
        </div>

        <button
          onClick={onSave}
          disabled={!canSave}
          className="w-full py-3 rounded-xl font-semibold text-sm"
          style={{
            backgroundColor: canSave ? '#E63946' : 'var(--bg-surf)',
            color: canSave ? '#fff' : 'var(--text-2)',
            border: canSave ? 'none' : '1px solid var(--border)',
          }}
        >
          {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Course'}
        </button>
      </div>
    </div>
  )
}

function DeleteConfirm({ course, onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--modal-overlay)' }}
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div
        className="w-full max-w-xs rounded-2xl p-5 space-y-4"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div className="text-center space-y-1.5">
          <p className="text-4xl">{course.emoji}</p>
          <p className="font-bold text-base" style={{ color: 'var(--text-1)' }}>Delete {course.name}?</p>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            Sessions and resources linked to this course will also be removed.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium"
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
