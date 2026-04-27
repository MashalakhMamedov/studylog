import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { supabase } from '../lib/supabase.js'
import { SkeletonCard } from '../components/Skeleton.jsx'
import { localDateStr } from '../lib/utils.js'
import Field from '../components/ui/Field.jsx'

function scoreColor(pct) {
  if (pct >= 80) return '#22c55e'
  if (pct >= 60) return '#eab308'
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
  correct_answers: '', topic: '', date: localDateStr(),
}

function quizValidation(form) {
  const total = Number(form.total_questions)
  const correct = Number(form.correct_answers)
  const error =
    form.total_questions && (!Number.isInteger(total) || total < 1)
      ? 'Total questions must be a whole number.'
      : total > 500
        ? 'Total questions cannot exceed 500.'
        : form.correct_answers && (!Number.isInteger(correct) || correct < 0)
          ? 'Correct answers must be a whole number.'
          : form.total_questions && form.correct_answers && correct > total
            ? 'Correct answers cannot exceed total questions.'
            : ''
  const score = Number.isInteger(total) && total > 0 && Number.isInteger(correct) && correct >= 0 && correct <= total
    ? Math.round((correct / total) * 100)
    : null

  return { total, correct, error, score }
}

function formFromQuiz(q) {
  return {
    course_id: q.course_id || '',
    resource_id: q.resource_id || '',
    total_questions: q.total_questions?.toString() || '',
    correct_answers: q.correct_answers?.toString() || '',
    topic: q.topic || '',
    date: q.date || localDateStr(),
  }
}

export default function Quiz() {
  const { session } = useAuth()
  const { accentColor } = useTheme()
  const [tab, setTab] = useState('log')
  const [courses, setCourses] = useState([])
  const [allResources, setAllResources] = useState([])
  const [history, setHistory] = useState(null) // null = not yet fetched
  const [historyError, setHistoryError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(false)
  const [formError, setFormError] = useState('')
  const [courseFilter, setCourseFilter] = useState('all')
  const [editingQuiz, setEditingQuiz] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

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
  }, [tab, history, session?.user?.id])

  useEffect(() => {
    setHistory(null)
    setHistoryError('')
    setCourseFilter('all')
  }, [session?.user?.id])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(false), 2500)
    return () => clearTimeout(t)
  }, [toast])

  async function fetchHistory() {
    setHistoryError('')
    const userId = session?.user?.id
    if (!userId) {
      setHistory([])
      setHistoryError('Sign in again to load quiz history.')
      return
    }

    try {
      const { data, error } = await supabase
        .from('quiz_results')
        .select('id, user_id, course_id, resource_id, total_questions, correct_answers, score_percent, topic, date, courses(name, emoji, color), resources(name)')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(100)

      if (error) throw error
      setHistory(data ?? [])
    } catch (error) {
      setHistory([])
      setHistoryError(error.message || 'Could not load quiz history.')
    }
  }

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
    setFormError('')
  }

  const { total, correct, error: validationError, score: liveScore } = quizValidation(form)
  const canSubmit = form.course_id && form.total_questions && form.correct_answers !== '' && !validationError && !saving

  async function submit() {
    setFormError('')
    if (!form.course_id) {
      setFormError('Choose a course before logging a quiz.')
      return
    }
    if (validationError || !form.total_questions || form.correct_answers === '') {
      setFormError(validationError || 'Enter total questions and correct answers.')
      return
    }
    setSaving(true)
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error(userError?.message || 'Sign in again before logging a quiz.')
      }

      const { error } = await supabase.from('quiz_results').insert({
        user_id: user.id,
        course_id: form.course_id,
        resource_id: form.resource_id || null,
        total_questions: total,
        correct_answers: correct,
        topic: form.topic.trim() || null,
        date: form.date,
      })

      if (error) throw error

      setForm({ ...EMPTY_FORM, course_id: form.course_id, date: localDateStr() })
      setHistory(null) // invalidate cache so history refreshes next visit
      setToast(true)
    } catch (error) {
      setFormError(error.message || 'Could not save quiz. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function openEditQuiz(q) {
    setEditingQuiz(q)
    setEditForm(formFromQuiz(q))
    setEditError('')
  }

  function closeEditQuiz() {
    setEditingQuiz(null)
    setEditForm(EMPTY_FORM)
    setEditError('')
    setSavingEdit(false)
  }

  function setEdit(key, val) {
    setEditForm(f => ({ ...f, [key]: val }))
    setEditError('')
  }

  async function saveEditQuiz() {
    if (!editingQuiz) return
    const { total: editTotal, correct: editCorrect, error } = quizValidation(editForm)
    if (!editForm.course_id) {
      setEditError('Choose a course before saving.')
      return
    }
    if (error || !editForm.total_questions || editForm.correct_answers === '') {
      setEditError(error || 'Enter total questions and correct answers.')
      return
    }

    setSavingEdit(true)
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error(userError?.message || 'Sign in again before editing a quiz.')
      }

      const { data, error: updateError } = await supabase
        .from('quiz_results')
        .update({
          course_id: editForm.course_id,
          resource_id: editForm.resource_id || null,
          total_questions: editTotal,
          correct_answers: editCorrect,
          topic: editForm.topic.trim() || null,
          date: editForm.date,
        })
        .eq('id', editingQuiz.id)
        .eq('user_id', user.id)
        .select('id, user_id, course_id, resource_id, total_questions, correct_answers, score_percent, topic, date, courses(name, emoji, color), resources(name)')
        .single()

      if (updateError) throw updateError
      setHistory(prev => prev ? prev.map(q => q.id === data.id ? data : q) : prev)
      closeEditQuiz()
    } catch (error) {
      setEditError(error.message || 'Could not update quiz. Please try again.')
    } finally {
      setSavingEdit(false)
    }
  }

  async function deleteQuiz() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error(userError?.message || 'Sign in again before deleting a quiz.')
      }

      const { error } = await supabase
        .from('quiz_results')
        .delete()
        .eq('id', deleteTarget.id)
        .eq('user_id', user.id)

      if (error) throw error
      setHistory(prev => prev ? prev.filter(q => q.id !== deleteTarget.id) : prev)
      setDeleteTarget(null)
    } catch (error) {
      setHistoryError(error.message || 'Could not delete quiz.')
    } finally {
      setDeleting(false)
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
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>Quizzes</h1>
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
              : { backgroundColor: 'var(--bg-surf)', color: 'var(--text-2)', border: '1px solid var(--border)' }
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
          validationError={validationError || formError}
          onSubmit={submit}
        />
      ) : (
        <HistoryTab
          history={history}
          historyError={historyError}
          courses={historyCourses}
          courseFilter={courseFilter}
          setCourseFilter={setCourseFilter}
          filteredHistory={filteredHistory}
          onEdit={openEditQuiz}
          onDelete={setDeleteTarget}
        />
      )}

      {editingQuiz && (
        <QuizEditModal
          form={editForm}
          set={setEdit}
          courses={courses}
          resources={allResources.filter(r => r.course_id === editForm.course_id)}
          error={editError}
          saving={savingEdit}
          onSave={saveEditQuiz}
          onClose={closeEditQuiz}
        />
      )}

      {deleteTarget && (
        <DeleteQuizConfirm
          quiz={deleteTarget}
          deleting={deleting}
          onConfirm={deleteQuiz}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {toast && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-3 rounded-2xl z-50"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}
        >
          <span className="flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: '#10b981' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" className="w-3 h-3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <span className="text-sm font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>Quiz logged!</span>
        </div>
      )}
    </div>
  )
}

// ── Log tab ──────────────────────────────────────────────────────────────────

function LogTab({ courses, resources, form, set, liveScore, canSubmit, saving, validationError, onSubmit }) {
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
          style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: form.course_id ? 'var(--text-1)' : 'var(--text-2)' }}
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
            max="500"
            className="h-11 px-3 rounded-xl text-sm w-full outline-none"
            style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
          />
        </Field>
        <Field label="Correct Answers *">
          <input
            type="number"
            value={form.correct_answers}
            onChange={e => set('correct_answers', e.target.value)}
            placeholder="e.g. 16"
            min="0"
            max={Number(form.total_questions) > 0 ? Math.min(Number(form.total_questions), 500) : 500}
            className="h-11 px-3 rounded-xl text-sm w-full outline-none"
            style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
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
            backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)',
            color: form.resource_id ? 'var(--text-1)' : 'var(--text-2)',
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
            maxLength={120}
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

      {validationError && (
        <p className="text-xs" style={{ color: '#f87171' }}>{validationError}</p>
      )}

      <button
        onClick={onSubmit}
        disabled={!canSubmit}
        className="w-full py-3.5 rounded-xl font-bold text-sm"
        style={{
          backgroundColor: canSubmit ? accentColor : 'var(--bg-surf)',
          color: canSubmit ? '#fff' : 'var(--text-2)',
          border: canSubmit ? 'none' : '1px solid var(--border)',
        }}
      >
        {saving ? 'Saving…' : 'Log Quiz'}
      </button>
    </div>
  )
}

// ── History tab ──────────────────────────────────────────────────────────────

function HistoryTab({ history, historyError, courses, courseFilter, setCourseFilter, filteredHistory, onEdit, onDelete }) {
  const { accentColor } = useTheme()
  if (history === null) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map(i => (
          <SkeletonCard key={i} height={76} radius={12} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {historyError && (
        <p className="text-xs rounded-xl px-3 py-2" style={{ color: '#f87171', backgroundColor: '#ef444422', border: '1px solid #ef444444' }}>
          {historyError}
        </p>
      )}

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
        <p className="text-center py-16 text-sm" style={{ color: 'var(--text-2)' }}>No quizzes logged yet</p>
      ) : (
        <div className="space-y-2.5">
          {filteredHistory.map(q => (
            <QuizHistoryCard key={q.id} quiz={q} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

function QuizHistoryCard({ quiz: q, onEdit, onDelete }) {
  const pct = Number(q.score_percent)
  const color = scoreColor(pct)
  const c = q.courses

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}>
      <div className="h-1" style={{ backgroundColor: c?.color ?? 'var(--text-3)' }} />
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
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold leading-tight truncate" style={{ color: 'var(--text-1)' }}>
              {q.topic || 'Quiz'}
            </p>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => onEdit(q)}
                className="p-1.5 rounded-lg"
                style={{ backgroundColor: 'var(--bg-surf)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
                aria-label="Edit quiz"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button
                onClick={() => onDelete(q)}
                className="p-1.5 rounded-lg"
                style={{ backgroundColor: 'var(--bg-surf)', color: '#f87171', border: '1px solid var(--border)' }}
                aria-label="Delete quiz"
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
              <span className="text-[10px]" style={{ color: 'var(--text-2)' }}>{q.resources.name}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--text-2)' }}>
              {q.correct_answers}/{q.total_questions} correct
            </span>
            <span className="text-xs" style={{ color: 'var(--border)' }}>·</span>
            <span className="text-xs" style={{ color: 'var(--text-2)' }}>
              {new Date(q.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Shared ───────────────────────────────────────────────────────────────────

function QuizEditModal({ form, set, courses, resources, error, saving, onSave, onClose }) {
  const { accentColor } = useTheme()
  const { error: validationError, score } = quizValidation(form)
  const canSave = form.course_id && form.total_questions && form.correct_answers !== '' && !validationError && !saving

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: 'var(--modal-overlay)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-1)' }}>Edit Quiz</h2>
          <button onClick={onClose} style={{ color: 'var(--text-2)' }} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {score !== null && (
          <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ backgroundColor: scoreColor(score) + '18', border: `1px solid ${scoreColor(score)}33` }}>
            <span className="text-sm font-medium" style={{ color: scoreColor(score) }}>{scoreLabel(score)}</span>
            <span className="text-2xl font-black tabular-nums" style={{ color: scoreColor(score) }}>{score}%</span>
          </div>
        )}

        <Field label="Course">
          <select value={form.course_id} onChange={e => { set('course_id', e.target.value); set('resource_id', '') }} className="h-11 px-3 rounded-xl text-sm w-full outline-none" style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}>
            <option value="" disabled>Select a course</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Total Questions">
            <input type="number" value={form.total_questions} onChange={e => set('total_questions', e.target.value)} min="1" max="500" className="h-11 px-3 rounded-xl text-sm w-full outline-none" style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }} />
          </Field>
          <Field label="Correct Answers">
            <input type="number" value={form.correct_answers} onChange={e => set('correct_answers', e.target.value)} min="0" max={Number(form.total_questions) > 0 ? Math.min(Number(form.total_questions), 500) : 500} className="h-11 px-3 rounded-xl text-sm w-full outline-none" style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }} />
          </Field>
        </div>

        <Field label="Resource (optional)">
          <select value={form.resource_id} onChange={e => set('resource_id', e.target.value)} disabled={!form.course_id} className="h-11 px-3 rounded-xl text-sm w-full outline-none" style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: form.resource_id ? 'var(--text-1)' : 'var(--text-2)', opacity: form.course_id ? 1 : 0.45 }}>
            <option value="">None</option>
            {resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Topic">
            <input type="text" value={form.topic} onChange={e => set('topic', e.target.value)} maxLength={120} className="h-11 px-3 rounded-xl text-sm w-full outline-none" style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }} />
          </Field>
          <Field label="Date">
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="h-11 px-3 rounded-xl text-sm w-full outline-none" style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }} />
          </Field>
        </div>

        {(validationError || error) && <p className="text-xs" style={{ color: '#f87171' }}>{validationError || error}</p>}

        <button onClick={onSave} disabled={!canSave} className="w-full py-3 rounded-xl font-semibold text-sm" style={{ backgroundColor: canSave ? accentColor : 'var(--bg-surf)', color: canSave ? '#fff' : 'var(--text-2)', border: canSave ? 'none' : '1px solid var(--border)' }}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

function DeleteQuizConfirm({ quiz, deleting, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--modal-overlay)' }} onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="w-full max-w-xs rounded-2xl p-5 space-y-4" style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)' }}>
        <div className="space-y-1.5">
          <p className="font-bold" style={{ color: 'var(--text-1)' }}>Delete quiz?</p>
          <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>{quiz.topic || 'Quiz'}</p>
          <p className="text-xs" style={{ color: 'var(--text-2)' }}>This will permanently remove the result.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} disabled={deleting} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ backgroundColor: 'var(--bg-surf)', color: 'var(--text-1)', border: '1px solid var(--border)' }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={deleting} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#ef4444', color: '#fff' }}>
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Pill({ active, onClick, children }) {
  const { accentColor } = useTheme()
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-medium"
      style={active
        ? { backgroundColor: accentColor, color: '#fff' }
        : { backgroundColor: 'var(--bg-surf)', color: 'var(--text-2)', border: '1px solid var(--border)' }
      }
    >
      {children}
    </button>
  )
}

