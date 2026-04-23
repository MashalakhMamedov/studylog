import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { supabase } from '../lib/supabase.js'

const todayStr = () => new Date().toISOString().split('T')[0]

function scoreColor(pct) {
  if (pct >= 80) return '#10b981'
  if (pct >= 60) return '#f59e0b'
  return '#ef4444'
}

function scoreLabel(pct) {
  if (pct >= 90) return 'Excellent'
  if (pct >= 80) return 'Good'
  if (pct >= 60) return 'Okay'
  if (pct >= 40) return 'Needs work'
  return 'Struggling'
}

const EMPTY_FORM = {
  course_id: '', resource_id: '', total_questions: '',
  correct_answers: '', topic: '', date: todayStr(),
}

export default function Quiz() {
  const { session } = useAuth()
  const { accentColor } = useTheme()
  const [tab, setTab] = useState('log')
  const [courses, setCourses] = useState([])
  const [allResources, setAllResources] = useState([])
  const [history, setHistory] = useState(null) // null = not yet fetched
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(false)
  const [courseFilter, setCourseFilter] = useState('all')

  useEffect(() => {
    Promise.all([
      supabase.from('courses').select('id, name, emoji, color').order('name'),
      supabase.from('resources').select('id, course_id, name').order('name'),
    ]).then(([{ data: c }, { data: r }]) => {
      if (c) setCourses(c)
      if (r) setAllResources(r)
    })
  }, [])

  useEffect(() => {
    if (tab === 'history' && history === null) fetchHistory()
  }, [tab])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(false), 2500)
    return () => clearTimeout(t)
  }, [toast])

  async function fetchHistory() {
    const { data } = await supabase
      .from('quiz_results')
      .select('*, courses(name, emoji, color), resources(name)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    setHistory(data ?? [])
  }

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  const total = parseInt(form.total_questions, 10)
  const correct = parseInt(form.correct_answers, 10)
  const liveScore = !isNaN(total) && total > 0 && !isNaN(correct) && correct >= 0
    ? Math.round((correct / total) * 100)
    : null
  const canSubmit = form.course_id && total > 0 && !isNaN(correct) && correct >= 0 && correct <= total && !saving

  async function submit() {
    if (!canSubmit) return
    setSaving(true)
    const { error } = await supabase.from('quiz_results').insert({
      user_id: session.user.id,
      course_id: form.course_id,
      resource_id: form.resource_id || null,
      total_questions: total,
      correct_answers: correct,
      topic: form.topic.trim() || null,
      date: form.date,
    })
    setSaving(false)
    if (!error) {
      setForm({ ...EMPTY_FORM, course_id: form.course_id, date: todayStr() })
      setHistory(null) // invalidate cache so history refreshes next visit
      setToast(true)
    }
  }

  const courseResources = allResources.filter(r => r.course_id === form.course_id)
  const filteredHistory = (history ?? []).filter(
    q => courseFilter === 'all' || q.course_id === courseFilter
  )
  // Only show courses that actually have quiz history as filter options
  const historyCourses = courses.filter(c => (history ?? []).some(q => q.course_id === c.id))

  return (
    <div className="px-4 pt-8 pb-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: '#e8e8ec' }}>Quizzes</h1>
        <Link
          to="/session?mode=log"
          className="text-xs px-3 py-1.5 rounded-lg"
          style={{ color: '#6b6b78', border: '1px solid #2a2a30' }}
        >
          ← Back
        </Link>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2">
        {[['log', 'Log Quiz'], ['history', 'History']].map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={tab === t
              ? { backgroundColor: accentColor, color: '#fff' }
              : { backgroundColor: '#1a1a1e', color: '#6b6b78', border: '1px solid #2a2a30' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'log' ? (
        <LogTab
          courses={courses}
          resources={courseResources}
          form={form}
          set={set}
          liveScore={liveScore}
          canSubmit={canSubmit}
          saving={saving}
          onSubmit={submit}
        />
      ) : (
        <HistoryTab
          history={history}
          courses={historyCourses}
          courseFilter={courseFilter}
          setCourseFilter={setCourseFilter}
          filteredHistory={filteredHistory}
        />
      )}

      {toast && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-3 rounded-2xl z-50"
          style={{ backgroundColor: '#111113', border: '1px solid #2a2a30', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}
        >
          <span className="flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: '#10b981' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" className="w-3 h-3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <span className="text-sm font-medium whitespace-nowrap" style={{ color: '#e8e8ec' }}>Quiz logged!</span>
        </div>
      )}
    </div>
  )
}

// ── Log tab ──────────────────────────────────────────────────────────────────

function LogTab({ courses, resources, form, set, liveScore, canSubmit, saving, onSubmit }) {
  const { accentColor } = useTheme()
  return (
    <div className="space-y-4">

      {/* Live score badge */}
      {liveScore !== null && (
        <div
          className="flex flex-col items-center justify-center py-5 rounded-2xl"
          style={{ backgroundColor: scoreColor(liveScore) + '18', border: `1px solid ${scoreColor(liveScore)}33` }}
        >
          <p className="text-5xl font-black tabular-nums" style={{ color: scoreColor(liveScore) }}>
            {liveScore}%
          </p>
          <p className="text-sm font-medium mt-1" style={{ color: scoreColor(liveScore) }}>
            {scoreLabel(liveScore)}
          </p>
        </div>
      )}

      {/* Course */}
      <Field label="Course *">
        <select
          value={form.course_id}
          onChange={e => { set('course_id', e.target.value); set('resource_id', '') }}
          className="h-11 px-3 rounded-xl text-sm w-full outline-none"
          style={{ backgroundColor: '#1a1a1e', border: '1px solid #2a2a30', color: form.course_id ? '#e8e8ec' : '#6b6b78' }}
        >
          <option value="" disabled>Select a course</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
      </Field>

      {/* Questions row */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Total Questions *">
          <input
            type="number"
            value={form.total_questions}
            onChange={e => set('total_questions', e.target.value)}
            placeholder="e.g. 20"
            min="1"
            className="h-11 px-3 rounded-xl text-sm w-full outline-none"
            style={{ backgroundColor: '#1a1a1e', border: '1px solid #2a2a30', color: '#e8e8ec' }}
          />
        </Field>
        <Field label="Correct Answers *">
          <input
            type="number"
            value={form.correct_answers}
            onChange={e => set('correct_answers', e.target.value)}
            placeholder="e.g. 16"
            min="0"
            className="h-11 px-3 rounded-xl text-sm w-full outline-none"
            style={{ backgroundColor: '#1a1a1e', border: '1px solid #2a2a30', color: '#e8e8ec' }}
          />
        </Field>
      </div>

      {/* Resource (optional) */}
      <Field label="Resource (optional)">
        <select
          value={form.resource_id}
          onChange={e => set('resource_id', e.target.value)}
          disabled={!form.course_id}
          className="h-11 px-3 rounded-xl text-sm w-full outline-none"
          style={{
            backgroundColor: '#1a1a1e', border: '1px solid #2a2a30',
            color: form.resource_id ? '#e8e8ec' : '#6b6b78',
            opacity: form.course_id ? 1 : 0.45,
          }}
        >
          <option value="">None</option>
          {resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </Field>

      {/* Topic + Date row */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Topic (optional)">
          <input
            type="text"
            value={form.topic}
            onChange={e => set('topic', e.target.value)}
            placeholder="e.g. Chapter 4"
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

      <button
        onClick={onSubmit}
        disabled={!canSubmit}
        className="w-full py-3.5 rounded-xl font-bold text-sm"
        style={{
          backgroundColor: canSubmit ? accentColor : '#1a1a1e',
          color: canSubmit ? '#fff' : '#6b6b78',
          border: canSubmit ? 'none' : '1px solid #2a2a30',
        }}
      >
        {saving ? 'Saving…' : 'Log Quiz'}
      </button>
    </div>
  )
}

// ── History tab ──────────────────────────────────────────────────────────────

function HistoryTab({ history, courses, courseFilter, setCourseFilter, filteredHistory }) {
  const { accentColor } = useTheme()
  if (history === null) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: '#2a2a30', borderTopColor: accentColor }} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Course filter pills */}
      {courses.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <Pill active={courseFilter === 'all'} onClick={() => setCourseFilter('all')}>All</Pill>
          {courses.map(c => (
            <Pill key={c.id} active={courseFilter === c.id} onClick={() => setCourseFilter(c.id)}>
              {c.emoji} {c.name}
            </Pill>
          ))}
        </div>
      )}

      {filteredHistory.length === 0 ? (
        <p className="text-center py-16 text-sm" style={{ color: '#6b6b78' }}>No quizzes logged yet</p>
      ) : (
        <div className="space-y-2.5">
          {filteredHistory.map(q => <QuizHistoryCard key={q.id} quiz={q} />)}
        </div>
      )}
    </div>
  )
}

function QuizHistoryCard({ quiz: q }) {
  const pct = Number(q.score_percent)
  const color = scoreColor(pct)
  const c = q.courses

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #2a2a30', backgroundColor: '#111113' }}>
      <div className="h-1" style={{ backgroundColor: c?.color ?? '#6b6b78' }} />
      <div className="p-4 flex items-start gap-3">

        {/* Score circle */}
        <div
          className="flex-shrink-0 w-14 h-14 rounded-2xl flex flex-col items-center justify-center"
          style={{ backgroundColor: color + '18', border: `1px solid ${color}33` }}
        >
          <p className="text-lg font-black leading-none tabular-nums" style={{ color }}>{pct}%</p>
          <p className="text-[9px] font-medium mt-0.5" style={{ color }}>{scoreLabel(pct)}</p>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="text-sm font-semibold leading-tight truncate" style={{ color: '#e8e8ec' }}>
            {q.topic || 'Quiz'}
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            {c && (
              <span
                className="px-2 py-0.5 rounded-lg text-[10px] font-semibold"
                style={{ backgroundColor: c.color + '22', color: c.color }}
              >
                {c.emoji} {c.name}
              </span>
            )}
            {q.resources?.name && (
              <span className="text-[10px]" style={{ color: '#6b6b78' }}>{q.resources.name}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: '#6b6b78' }}>
              {q.correct_answers}/{q.total_questions} correct
            </span>
            <span className="text-xs" style={{ color: '#2a2a30' }}>·</span>
            <span className="text-xs" style={{ color: '#6b6b78' }}>
              {new Date(q.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Shared ───────────────────────────────────────────────────────────────────

function Pill({ active, onClick, children }) {
  const { accentColor } = useTheme()
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-medium"
      style={active
        ? { backgroundColor: accentColor, color: '#fff' }
        : { backgroundColor: '#1a1a1e', color: '#6b6b78', border: '1px solid #2a2a30' }
      }
    >
      {children}
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
