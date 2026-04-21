import { useState, useEffect, useRef, useMemo } from 'react'
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
const STATUS_COLOR = { not_started: '#E63946', in_progress: '#E9C46A', completed: '#2A9D8F' }

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
    <div className="page-enter px-4 pt-4 pb-6 space-y-5">
      {/* Header */}
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

      {/* Filters */}
      <div className="space-y-2">
        <select
          value={courseFilter}
          onChange={e => setCourseFilter(e.target.value)}
          className="w-full h-10 px-3 rounded-xl text-sm outline-none"
          style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: courseFilter === 'all' ? 'var(--text-2)' : 'var(--text-1)' }}
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
                ? { backgroundColor: '#E63946', color: '#fff' }
                : { backgroundColor: 'var(--bg-surf)', color: 'var(--text-2)', border: '1px solid var(--border)' }
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
            style={{ borderColor: 'var(--border)', borderTopColor: '#E63946' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="text-5xl">{resources.length === 0 ? '📚' : '🔍'}</span>
          <div className="space-y-1">
            <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
              {resources.length === 0 ? 'No materials yet' : 'No materials match this filter'}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-2)' }}>
              {resources.length === 0 ? 'Add your first resource to start tracking progress' : 'Try a different course or status filter'}
            </p>
          </div>
          {resources.length === 0 && (
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ backgroundColor: '#E63946', color: '#fff' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add First Material
            </button>
          )}
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
              onUpdate={updated => setResources(prev => prev.map(x => x.id === updated.id ? updated : x))}
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

function ResourceCard({ resource: r, minutesStudied, onEdit, onDelete, onUpdate }) {
  const courseColor = r.courses?.color || 'var(--text-2)'
  const timeStudied = minutesStudied > 0 ? formatDuration(minutesStudied * 60) : null
  const isCompleted = r.status === 'completed'

  const [editingPos, setEditingPos] = useState(false)
  const [posValue, setPosValue] = useState(r.current_position || '')
  const [togglingComplete, setTogglingComplete] = useState(false)
  const posInputRef = useRef(null)

  useEffect(() => { setPosValue(r.current_position || '') }, [r.current_position])
  useEffect(() => { if (editingPos) posInputRef.current?.focus() }, [editingPos])

  const posNum = parseInt(posValue.trim(), 10)
  const showBar = r.total_pages && posValue.trim() !== '' && !isNaN(posNum) && String(posNum) === posValue.trim()
  const barPct = showBar ? Math.min(100, Math.round((posNum / r.total_pages) * 100)) : 0

  async function savePosition() {
    const val = posValue.trim()
    setEditingPos(false)
    if (val === (r.current_position || '')) return
    const { data, error } = await supabase
      .from('resources').update({ current_position: val })
      .eq('id', r.id).select('*, courses(name, emoji, color)').single()
    if (!error && data) onUpdate(data)
  }

  async function toggleComplete() {
    if (togglingComplete) return
    setTogglingComplete(true)
    const newStatus = isCompleted ? 'in_progress' : 'completed'
    const { data, error } = await supabase
      .from('resources').update({ status: newStatus })
      .eq('id', r.id).select('*, courses(name, emoji, color)').single()
    if (!error && data) onUpdate(data)
    setTogglingComplete(false)
  }

  return (
    <div
      className="hoverable-card rounded-2xl overflow-hidden"
      style={{
        border: `1px solid ${isCompleted ? '#2A9D8F44' : 'var(--border)'}`,
        backgroundColor: isCompleted ? 'rgba(42,157,143,0.04)' : 'var(--bg-card)',
      }}
    >
      {/* Course color bar */}
      <div className="h-1" style={{ backgroundColor: courseColor, opacity: isCompleted ? 0.4 : 1 }} />

      <div className="p-4 space-y-3">
        {/* Course label + completed badge + link */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>
              {r.courses?.emoji} {r.courses?.name}
            </span>
            {isCompleted && (
              <span className="flex items-center gap-0.5 text-xs font-medium" style={{ color: '#2A9D8F' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Done
              </span>
            )}
          </div>
          {r.link && (
            <a
              href={r.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
              style={{ backgroundColor: 'var(--bg-surf)', color: '#E63946', border: '1px solid var(--border)' }}
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
        <p className="font-bold text-base leading-snug" style={{ color: isCompleted ? 'var(--text-2)' : 'var(--text-1)' }}>{r.name}</p>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: STATUS_COLOR[r.status] + '22', color: STATUS_COLOR[r.status] }}
          >
            {STATUS_LABEL[r.status]}
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: 'var(--bg-surf)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
            {TYPE_ICON[r.type]} {TYPE_LABEL[r.type] || r.type}
          </span>
          {r.total_pages && (
            <span className="text-xs" style={{ color: 'var(--text-2)' }}>
              {r.total_pages} pages
            </span>
          )}
          {timeStudied && (
            <span className="flex items-center gap-1 text-xs" style={{ color: '#E63946' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              {timeStudied}
            </span>
          )}
        </div>

        {/* Bookmark / left-off-at */}
        <div className="space-y-1.5">
          {editingPos ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: 'var(--text-2)', whiteSpace: 'nowrap' }}>Left off at:</span>
              <input
                ref={posInputRef}
                type="text"
                value={posValue}
                onChange={e => setPosValue(e.target.value)}
                onBlur={savePosition}
                onKeyDown={e => { if (e.key === 'Enter') savePosition(); if (e.key === 'Escape') { setPosValue(r.current_position || ''); setEditingPos(false) } }}
                placeholder="page 45, ch. 3, 15:00…"
                className="flex-1 px-2 py-0.5 rounded-lg text-xs outline-none min-w-0"
                style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              />
            </div>
          ) : (
            <button
              onClick={() => setEditingPos(true)}
              className="flex items-center gap-1 text-xs text-left w-full group"
              style={{ color: 'var(--text-2)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 shrink-0" style={{ color: 'var(--text-2)' }}>
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              <span>
                Left off at:{' '}
                <span style={{ color: posValue ? 'var(--text-1)' : 'var(--text-2)', fontStyle: posValue ? 'normal' : 'italic' }}>
                  {posValue || 'tap to set'}
                </span>
              </span>
            </button>
          )}

          {/* Progress bar */}
          {showBar && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-surf)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${barPct}%`, backgroundColor: isCompleted ? '#2A9D8F' : courseColor }}
                />
              </div>
              <span className="text-xs shrink-0" style={{ color: 'var(--text-2)' }}>{barPct}%</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={toggleComplete}
            disabled={togglingComplete}
            className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1"
            style={isCompleted
              ? { backgroundColor: 'rgba(42,157,143,0.15)', color: '#2A9D8F', border: '1px solid #2A9D8F44' }
              : { backgroundColor: 'var(--bg-surf)', color: 'var(--text-2)', border: '1px solid var(--border)' }
            }
          >
            {isCompleted ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Done
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                  <circle cx="12" cy="12" r="10" />
                </svg>
                Mark Done
              </>
            )}
          </button>
          <button
            onClick={onEdit}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium"
            style={{ backgroundColor: 'var(--bg-surf)', color: 'var(--text-1)', border: '1px solid var(--border)' }}
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-1.5 rounded-lg text-xs"
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

function ResourceModal({ form, setForm, courses, editing, saving, onSave, onClose }) {
  const canSave = form.name.trim().length > 0 && form.course_id && !saving

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: 'var(--modal-overlay)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {/* Title */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-1)' }}>
            {editing ? 'Edit Material' : 'New Material'}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--text-2)' }}>
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
            style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
          />
        </Field>

        {/* Course */}
        <Field label="Course">
          <select
            value={form.course_id}
            onChange={e => setForm(f => ({ ...f, course_id: e.target.value }))}
            className="h-10 px-3 rounded-xl text-sm w-full outline-none"
            style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: form.course_id ? 'var(--text-1)' : 'var(--text-2)' }}
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
              style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
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
              style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
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
            style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
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
            style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
          />
        </Field>

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
          {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Material'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{label}</label>
      {children}
    </div>
  )
}

function DeleteConfirm({ resource, onConfirm, onCancel }) {
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
        <div className="space-y-1.5">
          <p className="font-bold" style={{ color: 'var(--text-1)' }}>Delete material?</p>
          <p className="text-sm font-medium" style={{ color: '#E63946' }}>{resource.name}</p>
          <p className="text-xs" style={{ color: 'var(--text-2)' }}>
            Sessions linked to this material will remain but lose the reference.
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
