import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { formatDuration } from '../lib/utils.js'

const TYPE_OPTIONS = ['pdf', 'video', 'online_course', 'textbook', 'exercises', 'other']
const TYPE_LABEL = {
  pdf: 'PDF', video: 'Video', online_course: 'Online Course',
  textbook: 'Textbook', exercises: 'Exercises', other: 'Other',
}
const TYPE_ICON = {
  pdf: '📄', video: '🎬', online_course: '🌐',
  textbook: '📖', exercises: '✏️', other: '📎',
}

const STATUS_OPTIONS = ['not_started', 'in_progress', 'completed']
const STATUS_LABEL = { not_started: 'Not Started', in_progress: 'In Progress', completed: 'Completed' }
const STATUS_COLOR = { not_started: '#ef4444', in_progress: '#f59e0b', completed: '#10b981' }

const EMPTY_FORM = { name: '', course_id: '', type: 'pdf', total_pages: '', link: '', status: 'not_started' }

export default function Resources() {
  const { session } = useAuth()
  const [resources, setResources] = useState([])
  const [courses, setCourses] = useState([])
  const [minutesByResource, setMinutesByResource] = useState({})
  const [loading, setLoading] = useState(true)
  const [courseFilter, setCourseFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: rData }, { data: cData }, { data: sData }] = await Promise.all([
      supabase.from('resources').select('*, courses(name, emoji, color)').order('created_at', { ascending: false }),
      supabase.from('courses').select('id, name, emoji, color').order('name'),
      supabase.from('sessions').select('resource_id, duration_minutes').not('resource_id', 'is', null),
    ])
    if (rData) setResources(rData)
    if (cData) setCourses(cData)
    if (sData) {
      const map = {}
      sData.forEach(s => { map[s.resource_id] = (map[s.resource_id] || 0) + s.duration_minutes })
      setMinutesByResource(map)
    }
    setLoading(false)
  }

  async function saveResource() {
    if (!form.name.trim() || !form.course_id) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      course_id: form.course_id,
      type: form.type,
      total_pages: form.total_pages ? parseInt(form.total_pages, 10) : null,
      link: form.link.trim() || null,
      status: form.status,
    }

    if (editing) {
      const { data, error } = await supabase
        .from('resources').update(payload).eq('id', editing.id)
        .select('*, courses(name, emoji, color)').single()
      if (!error) setResources(prev => prev.map(r => r.id === editing.id ? data : r))
    } else {
      const { data, error } = await supabase
        .from('resources').insert({ ...payload, user_id: session.user.id })
        .select('*, courses(name, emoji, color)').single()
      if (!error) setResources(prev => [data, ...prev])
    }

    setSaving(false)
    closeModal()
  }

  async function deleteResource(id) {
    await supabase.from('resources').delete().eq('id', id)
    setResources(prev => prev.filter(r => r.id !== id))
    setDeleteTarget(null)
  }

  function openAdd() {
    setEditing(null)
    setForm({ ...EMPTY_FORM, course_id: courseFilter !== 'all' ? courseFilter : (courses[0]?.id || '') })
    setShowModal(true)
  }
  function openEdit(r) {
    setEditing(r)
    setForm({
      name: r.name, course_id: r.course_id, type: r.type || 'pdf',
      total_pages: r.total_pages ?? '', link: r.link ?? '', status: r.status,
    })
    setShowModal(true)
  }
  function closeModal() { setShowModal(false); setEditing(null); setForm(EMPTY_FORM) }

  const filtered = useMemo(() =>
    resources.filter(r =>
      (courseFilter === 'all' || r.course_id === courseFilter) &&
      (statusFilter === 'all' || r.status === statusFilter)
    ), [resources, courseFilter, statusFilter])

  return (
    <div className="px-4 pt-8 pb-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: '#e8e8ec' }}>Materials</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: '#7c6af7', color: '#fff' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <select
          value={courseFilter}
          onChange={e => setCourseFilter(e.target.value)}
          className="w-full h-10 px-3 rounded-xl text-sm outline-none"
          style={{ backgroundColor: '#1a1a1e', border: '1px solid #2a2a30', color: courseFilter === 'all' ? '#6b6b78' : '#e8e8ec' }}
        >
          <option value="all">All Courses</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
          ))}
        </select>

        <div className="flex gap-2 flex-wrap">
          {['all', ...STATUS_OPTIONS].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={statusFilter === s
                ? { backgroundColor: '#7c6af7', color: '#fff' }
                : { backgroundColor: '#1a1a1e', color: '#6b6b78', border: '1px solid #2a2a30' }
              }
            >
              {s === 'all' ? 'All' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: '#2a2a30', borderTopColor: '#7c6af7' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-1">
          <p className="text-sm" style={{ color: '#6b6b78' }}>No materials here</p>
          <p className="text-xs" style={{ color: '#6b6b78' }}>Add a resource to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <ResourceCard
              key={r.id}
              resource={r}
              minutesStudied={minutesByResource[r.id] || 0}
              onEdit={() => openEdit(r)}
              onDelete={() => setDeleteTarget(r)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <ResourceModal
          form={form}
          setForm={setForm}
          courses={courses}
          editing={editing}
          saving={saving}
          onSave={saveResource}
          onClose={closeModal}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          resource={deleteTarget}
          onConfirm={() => deleteResource(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

function ResourceCard({ resource: r, minutesStudied, onEdit, onDelete }) {
  const courseColor = r.courses?.color || '#6b6b78'
  const timeStudied = minutesStudied > 0 ? formatDuration(minutesStudied * 60) : null

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #2a2a30', backgroundColor: '#111113' }}>
      {/* Course color bar */}
      <div className="h-1" style={{ backgroundColor: courseColor }} />

      <div className="p-4 space-y-3">
        {/* Course label + link icon */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium" style={{ color: '#6b6b78' }}>
            {r.courses?.emoji} {r.courses?.name}
          </span>
          {r.link && (
            <a
              href={r.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
              style={{ backgroundColor: '#1a1a1e', color: '#7c6af7', border: '1px solid #2a2a30' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Open
            </a>
          )}
        </div>

        {/* Name */}
        <p className="font-bold text-base leading-snug" style={{ color: '#e8e8ec' }}>{r.name}</p>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status badge */}
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: STATUS_COLOR[r.status] + '22', color: STATUS_COLOR[r.status] }}
          >
            {STATUS_LABEL[r.status]}
          </span>

          {/* Type badge */}
          <span className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: '#1a1a1e', color: '#6b6b78', border: '1px solid #2a2a30' }}>
            {TYPE_ICON[r.type]} {TYPE_LABEL[r.type] || r.type}
          </span>

          {/* Pages */}
          {r.total_pages && (
            <span className="text-xs" style={{ color: '#6b6b78' }}>
              {r.total_pages} pages
            </span>
          )}

          {/* Time studied */}
          {timeStudied && (
            <span className="flex items-center gap-1 text-xs" style={{ color: '#7c6af7' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              {timeStudied}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onEdit}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium"
            style={{ backgroundColor: '#1a1a1e', color: '#e8e8ec', border: '1px solid #2a2a30' }}
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-1.5 rounded-lg text-xs"
            style={{ backgroundColor: '#1a1a1e', color: '#6b6b78', border: '1px solid #2a2a30' }}
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

function ResourceModal({ form, setForm, courses, editing, saving, onSave, onClose }) {
  const canSave = form.name.trim().length > 0 && form.course_id && !saving

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: '#111113', border: '1px solid #2a2a30' }}
      >
        {/* Title */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: '#e8e8ec' }}>
            {editing ? 'Edit Material' : 'New Material'}
          </h2>
          <button onClick={onClose} style={{ color: '#6b6b78' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Name */}
        <Field label="Name">
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Lecture slides week 3"
            className="h-10 px-3 rounded-xl text-sm w-full outline-none"
            style={{ backgroundColor: '#1a1a1e', border: '1px solid #2a2a30', color: '#e8e8ec' }}
          />
        </Field>

        {/* Course */}
        <Field label="Course">
          <select
            value={form.course_id}
            onChange={e => setForm(f => ({ ...f, course_id: e.target.value }))}
            className="h-10 px-3 rounded-xl text-sm w-full outline-none"
            style={{ backgroundColor: '#1a1a1e', border: '1px solid #2a2a30', color: form.course_id ? '#e8e8ec' : '#6b6b78' }}
          >
            <option value="" disabled>Select a course</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
            ))}
          </select>
        </Field>

        {/* Type + Status side by side */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="h-10 px-3 rounded-xl text-sm w-full outline-none"
              style={{ backgroundColor: '#1a1a1e', border: '1px solid #2a2a30', color: '#e8e8ec' }}
            >
              {TYPE_OPTIONS.map(t => (
                <option key={t} value={t}>{TYPE_LABEL[t]}</option>
              ))}
            </select>
          </Field>

          <Field label="Status">
            <select
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="h-10 px-3 rounded-xl text-sm w-full outline-none"
              style={{ backgroundColor: '#1a1a1e', border: '1px solid #2a2a30', color: '#e8e8ec' }}
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </Field>
        </div>

        {/* Total pages */}
        <Field label="Total Pages (optional)">
          <input
            type="number"
            value={form.total_pages}
            onChange={e => setForm(f => ({ ...f, total_pages: e.target.value }))}
            placeholder="e.g. 120"
            min="1"
            className="h-10 px-3 rounded-xl text-sm w-full outline-none"
            style={{ backgroundColor: '#1a1a1e', border: '1px solid #2a2a30', color: '#e8e8ec' }}
          />
        </Field>

        {/* Link */}
        <Field label="URL / Link (optional)">
          <input
            type="url"
            value={form.link}
            onChange={e => setForm(f => ({ ...f, link: e.target.value }))}
            placeholder="https://…"
            className="h-10 px-3 rounded-xl text-sm w-full outline-none"
            style={{ backgroundColor: '#1a1a1e', border: '1px solid #2a2a30', color: '#e8e8ec' }}
          />
        </Field>

        <button
          onClick={onSave}
          disabled={!canSave}
          className="w-full py-3 rounded-xl font-semibold text-sm"
          style={{
            backgroundColor: canSave ? '#7c6af7' : '#1a1a1e',
            color: canSave ? '#fff' : '#6b6b78',
            border: canSave ? 'none' : '1px solid #2a2a30',
          }}
        >
          {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Material'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" style={{ color: '#6b6b78' }}>{label}</label>
      {children}
    </div>
  )
}

function DeleteConfirm({ resource, onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div
        className="w-full max-w-xs rounded-2xl p-5 space-y-4"
        style={{ backgroundColor: '#111113', border: '1px solid #2a2a30' }}
      >
        <div className="space-y-1.5">
          <p className="font-bold" style={{ color: '#e8e8ec' }}>Delete material?</p>
          <p className="text-sm font-medium" style={{ color: '#7c6af7' }}>{resource.name}</p>
          <p className="text-xs" style={{ color: '#6b6b78' }}>
            Sessions linked to this material will remain but lose the reference.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{ backgroundColor: '#1a1a1e', color: '#e8e8ec', border: '1px solid #2a2a30' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: '#f43f5e', color: '#fff' }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
