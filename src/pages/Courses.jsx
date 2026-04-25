import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { supabase } from '../lib/supabase.js'
import {
  CourseModal, EMPTY_COURSE_FORM,
  STATUS_COLOR, PRIORITY_COLOR, PRIORITY_ORDER,
  STATUS_OPTIONS,
} from '../components/CourseModal.jsx'

export default function Courses() {
  const { session } = useAuth()
  const { accentColor } = useTheme()
  const [courses, setCourses] = useState([])
  const [materialCounts, setMaterialCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_COURSE_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => { fetchCourses() }, [])

  async function fetchCourses() {
    setLoading(true)
    const [{ data, error }, { data: resData }] = await Promise.all([
      supabase.from('courses').select('*').order('created_at'),
      supabase.from('resources').select('course_id'),
    ])
    if (!error) setCourses(data)
    if (resData) {
      const counts = {}
      resData.forEach(r => { counts[r.course_id] = (counts[r.course_id] || 0) + 1 })
      setMaterialCounts(counts)
    }
    setLoading(false)
  }

  async function saveCourse() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      ...form,
      name: form.name.trim(),
      exam_date: form.exam_date || null,
    }

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

  function openAdd() { setEditing(null); setForm(EMPTY_COURSE_FORM); setShowModal(true) }
  function openEdit(course) {
    setEditing(course)
    setForm({
      name: course.name,
      emoji: course.emoji,
      color: course.color,
      status: course.status,
      priority: course.priority,
      exam_date: course.exam_date || '',
    })
    setShowModal(true)
  }
  function closeModal() { setShowModal(false); setEditing(null); setForm(EMPTY_COURSE_FORM) }

  const filtered = courses
    .filter(c => filter === 'all' || c.status === filter)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])

  return (
    <div className="page-enter px-4 pt-4 pb-6 space-y-6">
      <div className="flex items-center justify-end">
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: accentColor, color: '#fff' }}
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
              ? { backgroundColor: accentColor, color: '#fff' }
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
            style={{ borderColor: 'var(--border)', borderTopColor: accentColor }}
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
              style={{ backgroundColor: accentColor, color: '#fff' }}
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
          {filtered.map((course, i) => (
            <div key={course.id} className="stagger-in" style={{ animationDelay: `${Math.min(i, 7) * 50}ms` }}>
              <CourseCard
                course={course}
                materialCount={materialCounts[course.id] || 0}
                onEdit={() => openEdit(course)}
                onDelete={() => setDeleteTarget(course)}
              />
            </div>
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

function CourseCard({ course, materialCount, onEdit, onDelete }) {
  const navigate = useNavigate()

  return (
    <div
      className="hoverable-card rounded-xl overflow-hidden cursor-pointer"
      style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}
      onClick={() => navigate(`/course/${course.id}`)}
    >
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

        {materialCount > 0 && (
          <p className="text-[10px]" style={{ color: 'var(--text-2)' }}>
            📚 {materialCount} material{materialCount !== 1 ? 's' : ''}
          </p>
        )}

        <div className="flex gap-1.5 pt-0.5" onClick={e => e.stopPropagation()}>
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

function DeleteConfirm({ course, onConfirm, onCancel }) {
  const { accentColor } = useTheme()
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--modal-overlay)' }}
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div
        className="w-full max-w-xs rounded-2xl p-5 space-y-4"
        style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)' }}
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
            style={{ backgroundColor: accentColor, color: '#fff' }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
