import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import {
  CourseModal, EMPTY_COURSE_FORM,
  STATUS_COLOR, PRIORITY_COLOR,
} from '../components/CourseModal.jsx'

// ── Constants ────────────────────────────────────────────────────────────────
const FOCUS_LABEL = {
  deep_focus: 'Deep Focus', light_review: 'Light Review',
  practice: 'Practice', video: 'Video Lecture', project: 'Project Work',
}
const ENERGY_COLOR = { high: '#2A9D8F', medium: '#E9C46A', low: '#E76F51', post_night_shift: '#E63946' }
const ENERGY_LABEL = { high: 'High', medium: 'Medium', low: 'Low', post_night_shift: 'Post-Night' }
const ENERGY_SCORE = { high: 3, medium: 2, low: 1, post_night_shift: 0 }
const TYPE_ICON = { pdf: '📄', video: '🎬', online_course: '🌐', textbook: '📖', exercises: '✏️', other: '📎' }
const TYPE_LABEL = { pdf: 'PDF', video: 'Video', online_course: 'Online Course', textbook: 'Textbook', exercises: 'Exercises', other: 'Other' }
const RES_STATUS_COLOR = { not_started: '#E63946', in_progress: '#E9C46A', completed: '#2A9D8F' }
const RES_STATUS_LABEL = { not_started: 'Not Started', in_progress: 'In Progress', completed: 'Completed' }

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
  const todayStr = localDateStr()
  if (dateStr === todayStr) return 'Today'
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (dateStr === localDateStr(yesterday)) return 'Yesterday'
  const [y, mo, day] = dateStr.split('-').map(Number)
  return new Date(y, mo - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target - today) / 86400000)
}

function calcAvgEnergy(sessions) {
  const scored = sessions.filter(s => ENERGY_SCORE[s.energy_level] !== undefined)
  if (!scored.length) return null
  const avg = scored.reduce((sum, s) => sum + ENERGY_SCORE[s.energy_level], 0) / scored.length
  if (avg >= 2.5) return 'high'
  if (avg >= 1.5) return 'medium'
  if (avg >= 0.5) return 'low'
  return 'post_night_shift'
}

const isKnown = p => p.startsWith('✓ ')
const displayText = p => p.replace(/^✓ /, '')
const toggleKnown = p => isKnown(p) ? displayText(p) : `✓ ${p}`

// ── Main component ───────────────────────────────────────────────────────────
export default function CourseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [course, setCourse] = useState(null)
  const [sessions, setSessions] = useState([])
  const [resources, setResources] = useState([])
  const [minutesByResource, setMinutesByResource] = useState({})
  const [loading, setLoading] = useState(true)

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState(EMPTY_COURSE_FORM)
  const [saving, setSaving] = useState(false)

  // Syllabus
  const [syllabusText, setSyllabusText] = useState('')
  const [syllabusChanged, setSyllabusChanged] = useState(false)
  const [savingSyllabus, setSavingSyllabus] = useState(false)

  // Prerequisites
  const [prereqs, setPrereqs] = useState([])
  const [newPrereq, setNewPrereq] = useState('')
  const prereqInputRef = useRef(null)

  useEffect(() => { fetchAll() }, [id])

  async function fetchAll() {
    setLoading(true)
    const [
      { data: courseData },
      { data: sessionData },
      { data: resourceData },
      { data: sessionMinData },
    ] = await Promise.all([
      supabase.from('courses').select('*').eq('id', id).single(),
      supabase.from('sessions')
        .select('*, resources(name)')
        .eq('course_id', id)
        .order('date', { ascending: false }),
      supabase.from('resources').select('*').eq('course_id', id).order('created_at'),
      supabase.from('sessions')
        .select('resource_id, duration_minutes')
        .eq('course_id', id)
        .not('resource_id', 'is', null),
    ])

    if (courseData) {
      setCourse(courseData)
      setSyllabusText(courseData.syllabus || '')
      setPrereqs(courseData.prerequisites || [])
    } else {
      navigate('/courses')
    }
    if (sessionData) setSessions(sessionData)
    if (resourceData) setResources(resourceData)
    if (sessionMinData) {
      const map = {}
      sessionMinData.forEach(s => { map[s.resource_id] = (map[s.resource_id] || 0) + s.duration_minutes })
      setMinutesByResource(map)
    }
    setLoading(false)
  }

  // ── Computed stats ───────────────────────────────────────────────────────
  const totalMins = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0)
  const avgMins = sessions.length ? Math.round(totalMins / sessions.length) : 0
  const avgEnergy = calcAvgEnergy(sessions)
  const recentSessions = sessions.slice(0, 10)

  // ── Edit modal ───────────────────────────────────────────────────────────
  function openEdit() {
    if (!course) return
    setEditForm({
      name: course.name,
      emoji: course.emoji,
      color: course.color,
      status: course.status,
      priority: course.priority,
      exam_date: course.exam_date || '',
    })
    setShowEditModal(true)
  }

  async function saveCourse() {
    if (!editForm.name.trim()) return
    setSaving(true)
    const payload = { ...editForm, name: editForm.name.trim(), exam_date: editForm.exam_date || null }
    const { data, error } = await supabase.from('courses').update(payload).eq('id', id).select().single()
    if (!error && data) setCourse(data)
    setSaving(false)
    setShowEditModal(false)
  }

  // ── Syllabus ─────────────────────────────────────────────────────────────
  async function saveSyllabus() {
    setSavingSyllabus(true)
    await supabase.from('courses').update({ syllabus: syllabusText || null }).eq('id', id)
    setSyllabusChanged(false)
    setSavingSyllabus(false)
  }

  // ── Prerequisites ────────────────────────────────────────────────────────
  async function savePrereqsToDb(list) {
    await supabase.from('courses').update({ prerequisites: list }).eq('id', id)
  }

  function addPrereq() {
    const val = newPrereq.trim()
    if (!val) return
    const updated = [...prereqs, val]
    setPrereqs(updated)
    setNewPrereq('')
    savePrereqsToDb(updated)
    prereqInputRef.current?.focus()
  }

  function removePrereq(idx) {
    const updated = prereqs.filter((_, i) => i !== idx)
    setPrereqs(updated)
    savePrereqsToDb(updated)
  }

  function togglePrereq(idx) {
    const updated = prereqs.map((p, i) => i === idx ? toggleKnown(p) : p)
    setPrereqs(updated)
    savePrereqsToDb(updated)
  }

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--border)', borderTopColor: '#E63946' }} />
      </div>
    )
  }

  if (!course) return null

  const examDays = daysUntil(course.exam_date)

  return (
    <div className="page-enter pb-10">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="h-1.5" style={{ backgroundColor: course.color }} />
        <div className="px-4 pt-3 pb-4 space-y-3">
          {/* Nav row */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/courses')}
              className="flex items-center gap-1 text-sm font-medium -ml-1"
              style={{ color: 'var(--text-2)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Courses
            </button>
            <button
              onClick={openEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
              style={{ backgroundColor: 'var(--bg-surf)', color: 'var(--text-1)', border: '1px solid var(--border)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
          </div>

          {/* Emoji + Name */}
          <div className="flex items-center gap-3">
            <span className="text-5xl leading-none">{course.emoji}</span>
            <h1 className="text-2xl font-bold leading-tight" style={{ color: 'var(--text-1)' }}>{course.name}</h1>
          </div>

          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="px-2 py-0.5 rounded-lg text-xs font-medium capitalize"
              style={{ backgroundColor: STATUS_COLOR[course.status] + '22', color: STATUS_COLOR[course.status] }}
            >
              {course.status}
            </span>
            <span
              className="px-2 py-0.5 rounded-lg text-xs font-medium capitalize"
              style={{ backgroundColor: PRIORITY_COLOR[course.priority] + '22', color: PRIORITY_COLOR[course.priority] }}
            >
              {course.priority} priority
            </span>
            {examDays !== null && (
              <span
                className="px-2 py-0.5 rounded-lg text-xs font-medium"
                style={{
                  backgroundColor: examDays < 0
                    ? 'var(--bg-surf)'
                    : examDays <= 7 ? '#E6394622'
                    : examDays <= 14 ? '#E9C46A22'
                    : 'var(--bg-surf)',
                  color: examDays < 0
                    ? 'var(--text-2)'
                    : examDays <= 7 ? '#E63946'
                    : examDays <= 14 ? '#E9C46A'
                    : 'var(--text-2)',
                  border: (examDays < 0 || examDays > 14) ? '1px solid var(--border)' : 'none',
                }}
              >
                {examDays < 0
                  ? `Exam was ${Math.abs(examDays)}d ago`
                  : examDays === 0 ? 'Exam today!'
                  : `${examDays} days until exam`}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-7">
        {/* ── Stats row ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Study Time', value: fmtMins(totalMins), color: null },
            { label: 'Sessions', value: sessions.length, color: null },
            { label: 'Avg Session', value: sessions.length ? fmtMins(avgMins) : '—', color: null },
            {
              label: 'Avg Energy',
              value: avgEnergy ? ENERGY_LABEL[avgEnergy] : '—',
              color: avgEnergy ? ENERGY_COLOR[avgEnergy] : null,
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-xl p-2.5 text-center"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <p className="text-xs font-bold leading-tight" style={{ color: color || 'var(--text-1)' }}>{value}</p>
              <p className="text-[9px] mt-0.5 leading-tight" style={{ color: 'var(--text-2)' }}>{label}</p>
            </div>
          ))}
        </div>

        {/* ── Syllabus ──────────────────────────────────────────────────────── */}
        <section className="space-y-2.5">
          <h2 className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Syllabus</h2>
          <textarea
            value={syllabusText}
            onChange={e => { setSyllabusText(e.target.value); setSyllabusChanged(true) }}
            placeholder="Paste your course syllabus here…"
            rows={6}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none leading-relaxed"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: syllabusChanged ? `1px solid ${course.color}` : '1px solid var(--border)',
              color: 'var(--text-1)',
            }}
          />
          {syllabusChanged && (
            <button
              onClick={saveSyllabus}
              disabled={savingSyllabus}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ backgroundColor: course.color, color: '#fff' }}
            >
              {savingSyllabus ? 'Saving…' : 'Save Syllabus'}
            </button>
          )}
        </section>

        {/* ── Prerequisites ─────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Prerequisites</h2>

          {prereqs.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {prereqs.map((p, i) => {
                const known = isKnown(p)
                const text = displayText(p)
                return (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 pl-1.5 pr-1 py-1 rounded-lg text-xs font-medium"
                    style={{
                      backgroundColor: known ? '#2A9D8F18' : 'var(--bg-surf)',
                      border: `1px solid ${known ? '#2A9D8F44' : 'var(--border)'}`,
                      color: known ? 'var(--text-2)' : 'var(--text-1)',
                    }}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => togglePrereq(i)}
                      className="flex items-center justify-center w-4 h-4 rounded flex-shrink-0"
                      style={{
                        backgroundColor: known ? '#2A9D8F' : 'transparent',
                        border: known ? 'none' : '1.5px solid var(--border)',
                      }}
                      aria-label={known ? 'Mark unknown' : 'Mark as known'}
                    >
                      {known && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" className="w-2.5 h-2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                    <span style={{ textDecoration: known ? 'line-through' : 'none' }}>{text}</span>
                    <button
                      onClick={() => removePrereq(i)}
                      className="ml-0.5 flex-shrink-0"
                      style={{ color: 'var(--text-2)' }}
                      aria-label="Remove"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add input */}
          <div className="flex gap-2">
            <input
              ref={prereqInputRef}
              type="text"
              value={newPrereq}
              onChange={e => setNewPrereq(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPrereq()}
              placeholder="Add a prerequisite topic…"
              className="flex-1 h-9 px-3 rounded-xl text-sm outline-none"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
            />
            <button
              onClick={addPrereq}
              disabled={!newPrereq.trim()}
              className="px-4 h-9 rounded-xl text-sm font-semibold flex-shrink-0"
              style={{
                backgroundColor: newPrereq.trim() ? '#E63946' : 'var(--bg-surf)',
                color: newPrereq.trim() ? '#fff' : 'var(--text-2)',
                border: newPrereq.trim() ? 'none' : '1px solid var(--border)',
              }}
            >
              Add
            </button>
          </div>
        </section>

        {/* ── Materials ─────────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>
              Materials
              {resources.length > 0 && (
                <span className="ml-1.5 font-normal" style={{ color: 'var(--text-2)' }}>({resources.length})</span>
              )}
            </h2>
            <button
              onClick={() => navigate('/resources')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium"
              style={{ backgroundColor: 'var(--bg-surf)', color: 'var(--text-1)', border: '1px solid var(--border)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Resource
            </button>
          </div>

          {resources.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-2)' }}>No materials added yet.</p>
          ) : (
            <div className="space-y-2">
              {resources.map(r => (
                <MiniResourceCard
                  key={r.id}
                  resource={r}
                  minutesStudied={minutesByResource[r.id] || 0}
                  courseColor={course.color}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Recent Sessions ───────────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>
            Recent Sessions
            {sessions.length > 0 && (
              <span className="ml-1.5 font-normal" style={{ color: 'var(--text-2)' }}>
                ({sessions.length}{sessions.length === 10 ? '+' : ''})
              </span>
            )}
          </h2>

          {recentSessions.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-2)' }}>No sessions logged yet.</p>
          ) : (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}
            >
              {recentSessions.map((s, i) => (
                <div key={s.id}>
                  {i > 0 && <div style={{ height: '1px', backgroundColor: 'var(--border)' }} />}
                  <SessionRow session={s} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Edit modal */}
      {showEditModal && (
        <CourseModal
          form={editForm}
          setForm={setEditForm}
          editing={course}
          saving={saving}
          onSave={saveCourse}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MiniResourceCard({ resource: r, minutesStudied, courseColor }) {
  const isCompleted = r.status === 'completed'
  const posNum = parseInt((r.current_position || '').trim(), 10)
  const showBar = r.total_pages && !isNaN(posNum) && String(posNum) === (r.current_position || '').trim()
  const barPct = showBar ? Math.min(100, Math.round((posNum / r.total_pages) * 100)) : 0

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border: `1px solid ${isCompleted ? '#2A9D8F44' : 'var(--border)'}`,
        backgroundColor: isCompleted ? 'rgba(42,157,143,0.04)' : 'var(--bg-card)',
      }}
    >
      <div className="h-0.5" style={{ backgroundColor: courseColor, opacity: isCompleted ? 0.4 : 1 }} />
      <div className="px-3 py-2.5 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-semibold truncate"
              style={{ color: isCompleted ? 'var(--text-2)' : 'var(--text-1)' }}
            >
              {r.name}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{ backgroundColor: RES_STATUS_COLOR[r.status] + '22', color: RES_STATUS_COLOR[r.status] }}
              >
                {RES_STATUS_LABEL[r.status]}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--text-2)' }}>
                {TYPE_ICON[r.type]} {TYPE_LABEL[r.type] || r.type}
              </span>
              {r.total_pages && (
                <span className="text-[10px]" style={{ color: 'var(--text-2)' }}>
                  {showBar ? `p.${posNum} / ${r.total_pages}` : `${r.total_pages} pages`}
                </span>
              )}
              {minutesStudied > 0 && (
                <span className="text-[10px]" style={{ color: '#E63946' }}>
                  ⏱ {fmtMins(minutesStudied)}
                </span>
              )}
            </div>
          </div>
          {r.link && (
            <a
              href={r.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 px-2 py-1 rounded-lg text-xs font-medium"
              style={{ backgroundColor: 'var(--bg-surf)', color: '#E63946', border: '1px solid var(--border)' }}
            >
              Open
            </a>
          )}
        </div>

        {showBar && (
          <div className="space-y-1">
            <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-surf)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${barPct}%`, backgroundColor: isCompleted ? '#2A9D8F' : courseColor }}
              />
            </div>
            <p className="text-[10px] text-right" style={{ color: 'var(--text-2)' }}>{barPct}%</p>
          </div>
        )}
      </div>
    </div>
  )
}

function SessionRow({ session: s }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {s.focus_type && (
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0"
              style={{ backgroundColor: '#E6394622', color: '#E63946' }}
            >
              {FOCUS_LABEL[s.focus_type] ?? s.focus_type}
            </span>
          )}
          {s.resources?.name && (
            <span className="text-xs truncate" style={{ color: 'var(--text-2)' }}>
              {s.resources.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>
            {fmtMins(s.duration_minutes)}
          </span>
          <span className="text-[11px]" style={{ color: 'var(--text-2)' }}>
            {fmtRelativeDate(s.date)}
          </span>
        </div>
      </div>

      {(s.energy_level || s.pages_covered) && (
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {s.energy_level && (
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{ backgroundColor: ENERGY_COLOR[s.energy_level] + '22', color: ENERGY_COLOR[s.energy_level] }}
            >
              {ENERGY_LABEL[s.energy_level]}
            </span>
          )}
          {s.pages_covered && (
            <span className="text-[10px]" style={{ color: 'var(--text-2)' }}>{s.pages_covered}</span>
          )}
        </div>
      )}

      {s.notes && (
        <p className="text-xs italic mt-1.5 truncate" style={{ color: 'var(--text-2)' }}>{s.notes}</p>
      )}
    </div>
  )
}
